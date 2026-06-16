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

  const label = path.basename(repo);
  const term = vscode.window.createTerminal({ name: label, cwd: repo });

  // Name the tab (set-tab-title.sh auto-prepends [repo]) then launch claude.
  // Pass the prompt via a TEMP FILE rather than as a visible argument, so the terminal
  // doesn't echo the whole prompt as a giant stuck-at-top line. The echoed command
  // stays short; the file is removed right after claude reads it.
  const titleScript = shScript('set-tab-title.sh');
  const parts = [];
  if (fs.existsSync(titleScript)) {
    parts.push(`${shq(titleScript)} ${shq(label)} >/dev/null 2>&1`);
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
  term.sendText(parts.join(' ; '), true);
  // No auto-close: finished /go tabs are visually marked "✅ done" in the title (set by
  // set-tab-title.sh); Jack closes them himself. Auto-close was intentionally NOT added
  // because "only close fire-and-forget" can't be detected reliably and unpredictable
  // auto-close risks killing a session mid-use.
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
