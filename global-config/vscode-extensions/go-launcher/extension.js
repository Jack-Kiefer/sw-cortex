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
const cp = require('child_process');

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

  // Request file: line 1 = repo root; line 2 = "CLOSE_TTY=<tty>" control line;
  // line 3+ = the (possibly multi-line) prompt.
  const nl1 = raw.indexOf('\n');
  const repo = (nl1 === -1 ? raw : raw.slice(0, nl1)).trim();
  const rest = nl1 === -1 ? '' : raw.slice(nl1 + 1);
  const nl2 = rest.indexOf('\n');
  const line2 = (nl2 === -1 ? rest : rest.slice(0, nl2)).trim();
  const prompt = nl2 === -1 ? '' : rest.slice(nl2 + 1);
  // The tty of the tab /go was run from — close it once the new tab is open.
  const closeTty = line2.startsWith('CLOSE_TTY=') ? line2.slice('CLOSE_TTY='.length).trim() : '';

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
  // NOTE: the launch title is stamped by the launch BODY (below), which resolves the tty
  // once from the interactive shell and writes ~/.claude/tab-titles/<tty> directly. We do
  // NOT stamp via set-tab-title.sh here: that walks the process tree and, during shell
  // init / on a reused tab, can resolve "??" and fail silently (errors were swallowed),
  // leaving the PREVIOUS session's stale title in place. Writing the file inline, after a
  // deterministic tty resolve, guarantees the stale title is cleared on every relaunch.
  // The prompt is passed to claude UNMODIFIED so a leading slash command (e.g.
  // "/analyze <task>") stays at offset 0 and actually dispatches. /analyze itself
  // drives the progress title via set-tab-title.sh — no prose directive needed.
  let cmd;
  if (prompt && prompt.trim()) {
    cmd = `claude ${shq(prompt)}`;
  } else {
    cmd = 'claude';
  }

  term.show(false);

  // Stamp the launch title once, then run claude. The launch runs from the interactive
  // shell, so $(tty) resolves to this tab's real device — write the title file (so the
  // hook keeps re-asserting it) and stamp the live tab now, OVERWRITING any stale title
  // a reused tty inherited. `clear` wipes the one echoed `source` line for a clean tab.
  const titleDir = path.join(os.homedir(), '.claude', 'tab-titles');
  try {
    const ls = path.join(
      os.tmpdir(),
      `go-launch-${Date.now()}-${Math.floor(Math.random() * 1e6)}.sh`
    );
    const body =
      `__t="$(basename "$(tty 2>/dev/null)" 2>/dev/null)"\n` +
      `if [ -n "$__t" ] && [ "$__t" != "??" ] && [ "$__t" != "not" ]; then\n` +
      `  mkdir -p ${shq(titleDir)} 2>/dev/null\n` +
      `  printf '%s' ${shq(desc)} > ${shq(titleDir)}/"$__t" 2>/dev/null\n` + // OVERWRITE stale title
      `  printf '\\033]0;%s\\007' ${shq(desc)} > /dev/"$__t" 2>/dev/null\n` + // stamp the live tab now
      `else\n` +
      `  ${shq(shScript('set-tab-title.sh'))} ${shq(desc)} >/dev/null 2>&1 || true\n` +
      `fi\n` +
      `clear\n${cmd}\n`;
    fs.writeFileSync(ls, body);
    term.sendText(`source ${shq(ls)} ; rm -f ${shq(ls)}`, true);
  } catch {
    term.sendText(cmd, true); // fallback
  }

  // Close the tab /go was launched FROM (any tab Jack runs /go in closes once its
  // replacement opens). Match a VS Code terminal to the launching tty by its shell PID's
  // tty. NEVER closes a tab other than the exact one /go ran in — and never the new tab.
  if (closeTty) closeTabByTty(closeTty, term);
}

// Dispose the VS Code terminal whose shell runs on `tty`, except `keep`. The terminal's
// processId is the shell PID; `ps -o tty=` on it yields the same tty the launcher resolved.
function closeTabByTty(tty, keep) {
  for (const t of vscode.window.terminals) {
    if (t === keep) continue;
    t.processId.then((pid) => {
      if (!pid) return;
      cp.execFile('ps', ['-o', 'tty=', '-p', String(pid)], (err, out) => {
        if (err) return;
        if (out.trim() === tty && t !== keep) t.dispose();
      });
    });
  }
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
