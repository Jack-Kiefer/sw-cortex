// go-launcher — opens a Claude Code terminal for each /go request, automatically.
//
// The /go command (launch-repo-session.sh) drops one file per request into
// ~/.claude/go-queue/. This extension watches that dir and, for each file, opens a new
// integrated terminal cd'd into the repo and runs claude with the prompt — no keypress,
// no macOS Accessibility. Requests staged before VS Code was open are picked up on start.
//
// Request file format (one per request):
//   line 1: absolute repo root
//   line 2+: the prompt (may be empty / multi-line)

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

const QUEUE_DIR = path.join(os.homedir(), '.claude', 'go-queue');

function shScript(homeRel) {
  return path.join(os.homedir(), '.claude', 'scripts', homeRel);
}

// Single-quote a string for safe POSIX shell embedding.
function shq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// Turn the /go prompt into a descriptive tab name (what the session is doing).
// Strips a leading slash-command, drops parenthetical/bracketed asides and trailing
// punctuation noise, then takes a clean run of words truncated at a word boundary.
function taskSlug(prompt) {
  let t = String(prompt || '').trim();
  if (!t) return 'session';
  t = t.replace(/^\/[a-z-]+\s+/i, ''); // drop leading "/analyze " etc.
  t = t.replace(/\([^)]*\)/g, ' '); // drop "(Odoo prod ↔ ...)" asides
  t = t.replace(/\[[^\]]*\]/g, ' '); // drop "[...]" asides
  t = t.replace(/\s+/g, ' ').trim(); // collapse whitespace/newlines
  if (!t) return 'session';
  const MAX = 48;
  if (t.length <= MAX) return t;
  // Truncate at the last word boundary within MAX, then ellipsis.
  let slug = t
    .slice(0, MAX)
    .replace(/\s+\S*$/, '')
    .replace(/[\s,.;:–—-]+$/, '');
  return (slug || t.slice(0, MAX)) + '…';
}

function processFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // gone already
  }
  // Consume immediately so it never double-fires.
  try {
    fs.unlinkSync(filePath);
  } catch {}

  const nl = raw.indexOf('\n');
  const repo = (nl === -1 ? raw : raw.slice(0, nl)).trim();
  const prompt = nl === -1 ? '' : raw.slice(nl + 1);

  if (!repo || !fs.existsSync(repo)) {
    vscode.window.showWarningMessage(`go-launcher: invalid repo in request: "${repo}"`);
    return;
  }

  // Name the terminal after the task (descriptive), so the VS Code tab list shows what
  // the session is doing — not "SERP". The running session re-titles it via escape codes.
  const desc = '🔨 ' + taskSlug(prompt);
  const term = vscode.window.createTerminal({ name: desc, cwd: repo });

  // Write the ENTIRE launch sequence to a temp shell script and run just that one short
  // path. This keeps the terminal from echoing the whole command/prompt as a wall of
  // text at the top — only "source <shortpath>" is typed, and the script clears itself.
  const titleScript = shScript('set-tab-title.sh');
  const parts = [];
  if (fs.existsSync(titleScript)) {
    const initial = desc;
    parts.push(`${shq(titleScript)} ${shq(initial)} >/dev/null 2>&1`);
  }

  if (prompt && prompt.trim()) {
    const pf = path.join(os.tmpdir(), `go-prompt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    try {
      fs.writeFileSync(pf, prompt);
      parts.push(`claude "$(cat ${shq(pf)})" ; rm -f ${shq(pf)}`);
    } catch {
      parts.push(`claude ${shq(prompt)}`); // fallback: inline (rare)
    }
  } else {
    parts.push('claude');
  }

  term.show(false);

  // A marker file the launch script writes its OWN tty into — deterministic, so the
  // auto-close watcher knows exactly which title file to watch (no fragile PID→tty guess).
  const ttyMarker = path.join(
    os.tmpdir(),
    `go-tty-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  );

  // Run the launch sequence from a temp script so the terminal echoes only one short
  // line (which `clear` then wipes) instead of the whole command + prompt. The script
  // records its tty, clears the screen, runs the title-set + claude, then removes itself.
  try {
    const ls = path.join(
      os.tmpdir(),
      `go-launch-${Date.now()}-${Math.floor(Math.random() * 1e6)}.sh`
    );
    const body = `basename "$(tty)" > ${shq(ttyMarker)} 2>/dev/null\nclear\n${parts.join('\n')}\n`;
    fs.writeFileSync(ls, body);
    term.sendText(`source ${shq(ls)} ; rm -f ${shq(ls)}`, true);
  } catch {
    term.sendText(parts.join(' ; '), true); // fallback
  }

  // Auto-close THIS /go-created tab ~5s after its title shows "✅ done". Only the
  // terminal this extension created is ever closed (we dispose this exact handle);
  // the hub and any tab you opened yourself are never touched. The tty comes from the
  // marker the launch script wrote, so we watch the exact ~/.claude/tab-titles/<tty>.
  watchForDone(term, ttyMarker);
}

function watchForDone(term, ttyMarker) {
  const DONE_RE = /✅\s*done/;
  let elapsed = 0;
  const INTERVAL = 3000;
  const MAX = 6 * 60 * 60 * 1000; // stop watching after 6h

  const timer = setInterval(() => {
    elapsed += INTERVAL;
    if (elapsed > MAX || !vscode.window.terminals.includes(term)) {
      clearInterval(timer);
      try {
        fs.unlinkSync(ttyMarker);
      } catch {}
      return;
    }
    // Resolve the tty from the marker the launch script wrote (retry until it appears).
    let tty = '';
    try {
      tty = fs.readFileSync(ttyMarker, 'utf8').trim();
    } catch {
      return;
    }
    if (!tty) return;
    const titleFile = path.join(os.homedir(), '.claude', 'tab-titles', tty);
    let title = '';
    try {
      title = fs.readFileSync(titleFile, 'utf8');
    } catch {
      return;
    }
    if (DONE_RE.test(title)) {
      clearInterval(timer);
      try {
        fs.unlinkSync(ttyMarker);
      } catch {}
      // Close fast (~5s after done) per Jack's choice.
      setTimeout(() => {
        if (vscode.window.terminals.includes(term)) term.dispose();
      }, 2000);
    }
  }, INTERVAL);
}

function drainExisting() {
  let files = [];
  try {
    files = fs.readdirSync(QUEUE_DIR).filter((f) => !f.startsWith('.'));
  } catch {
    return;
  }
  // Oldest-first so a batch ("launch a go for each") opens in the order staged.
  files
    .map((f) => path.join(QUEUE_DIR, f))
    .map((p) => ({ p, t: safeMtime(p) }))
    .sort((a, b) => a.t - b.t)
    .forEach(({ p }) => processFile(p));
}

function safeMtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function activate(context) {
  try {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  } catch {}

  // 1) Anything already queued before startup.
  drainExisting();

  // 2) Watch for new requests. RelativePattern over the queue dir.
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(QUEUE_DIR), '*')
  );
  const onNew = (uri) => {
    if (path.basename(uri.fsPath).startsWith('.')) return;
    // tiny delay so the writer finishes flushing
    setTimeout(() => processFile(uri.fsPath), 120);
  };
  watcher.onDidCreate(onNew);
  watcher.onDidChange(onNew);
  context.subscriptions.push(watcher);
}

function deactivate() {}

module.exports = { activate, deactivate };
