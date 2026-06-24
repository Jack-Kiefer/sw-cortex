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

// Allowed leading status emoji (the Terminal Tab Status legend in ~/CLAUDE.md). Used to
// normalize the launch tab name; titling thereafter is owned by Claude Code's
// terminalSequence hook output (see ~/.claude/scripts/tab-title-hook.sh).
const STATUS_EMOJI = ['🔍', '🔨', '🧪', '🙋', '❓', '📦', '✅'];

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
  t = t.replace(/^\/[a-z-]+\s+/i, ''); // drop leading "/serp-analyze " etc.
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

// Enforce the canonical tab-title grammar: "<status-emoji> <label>" (the legend
// in ~/CLAUDE.md). Strips a legacy "[repo] " prefix and control chars, collapses
// whitespace, guarantees a leading status emoji (defaults to 🔨), and caps length
// at a word boundary. Idempotent — a clean title passes through unchanged.
function normalizeTitle(raw, fallbackEmoji) {
  let t = String(raw == null ? '' : raw);
  t = t.replace(/[\u0000-\u001F\u007F]/g, ' '); // strip control chars/newlines
  t = t.replace(/^\s*\[[^\]]+\]\s*/, ''); // drop stale "[SERP] " prefix
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) t = 'session';
  const lead = STATUS_EMOJI.find((e) => t.startsWith(e));
  if (!lead) {
    const emoji = STATUS_EMOJI.includes(fallbackEmoji) ? fallbackEmoji : '🔨';
    t = `${emoji} ${t}`;
  }
  const MAX = 64; // a touch longer than taskSlug's 48 to fit "<emoji> <status> · <label>"
  if (t.length > MAX) {
    t =
      t
        .slice(0, MAX)
        .replace(/\s+\S*$/, '')
        .replace(/[\s,.;:–—·-]+$/, '') + '…';
  }
  return t;
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

  // Close-only request: line 1 is the "__CLOSE__" sentinel and line 2 is "CLOSE_TTY=<tty>".
  // A /implement or /serp-analyze session drops this (via close-own-tab.sh) as its FINAL teardown
  // step after a merged PR — it asks the extension to dispose the session's OWN tab. No new
  // terminal is opened; we reuse closeTabByTty on the resolved tty and return early.
  if (repo === '__CLOSE__') {
    if (closeTty) closeTabByTty(closeTty, null);
    return;
  }

  if (!repo || !fs.existsSync(repo)) {
    vscode.window.showWarningMessage(`go-launcher: invalid repo in request: "${repo}"`);
    return;
  }

  // Derive the descriptive launch label. normalizeTitle enforces "<emoji> <label>" grammar.
  const desc = normalizeTitle(taskSlug(prompt), '🔨');
  // CRITICAL: do NOT pass `name` to createTerminal. A name sets VS Code's TitleEventSource.Api,
  // which sets a static title AND permanently disposes the terminal's OSC title-change listener
  // for the terminal's whole life — so no OSC 0/2 escape (the launch-body seed below OR the
  // running session's set-tab-title.sh / tab-title-hook.sh terminalSequence) can EVER repaint
  // the tab. That is exactly why /go tabs froze at the launch label. Creating with NO name keeps
  // the OSC listener live; the launch-body OSC seed (below) becomes the first ${sequence} value
  // and the session retitles freely from there. (Requires VS Code's
  // terminal.integrated.tabs.title = "${sequence}" — see TAB_TITLES.md step 0.)
  const term = vscode.window.createTerminal({ cwd: repo });

  // Write the ENTIRE launch sequence to a temp shell script and run just that one short
  // path. This keeps the terminal from echoing the whole command/prompt as a wall of
  // text at the top — only "source <shortpath>" is typed, and the script clears itself.
  // NOTE: the launch title is stamped by the launch BODY (below), which resolves the tty
  // once from the interactive shell and writes an OSC 0 title escape to /dev/<tty> directly
  // (it does NOT write any ~/.claude/tab-titles/<tty> file — that was the pre-rewrite design).
  // That OSC seed is load-bearing: it sets VS Code's ${sequence} title before claude boots, so
  // the tab shows the descriptive name immediately. We also export CLAUDE_GO_TITLE so the
  // spawned session's SessionStart floor (tab-title-default.sh) adopts THIS name instead of a
  // generic "🔍 <repo> · session". Once claude runs, its hooks drive the title (keyed by
  // session id). The prompt is passed to claude UNMODIFIED so a leading slash command (e.g.
  // "/serp-analyze <task>") stays at offset 0 and actually dispatches.
  let cmd;
  if (prompt && prompt.trim()) {
    cmd = `claude ${shq(prompt)}`;
  } else {
    cmd = 'claude';
  }

  // preserveFocus=true: reveal the new tab WITHOUT stealing focus from wherever Jack is.
  // (The arg is `preserveFocus`; the old `false` actively grabbed focus — that's why /go
  // always yanked you to the new tab no matter where you were.)
  term.show(true);

  // Stamp the launch title once, then run claude. This runs in the interactive shell
  // BEFORE claude starts (so CLAUDE_CODE_SESSION_ID isn't set yet) — so we stamp the tab
  // directly via OSC to the real tty. Once claude starts, its SessionStart hook adopts the
  // title and the model's set-tab-title.sh calls drive it from there (keyed by session id).
  // `clear` wipes the one echoed `source` line for a clean tab.
  try {
    const ls = path.join(
      os.tmpdir(),
      `go-launch-${Date.now()}-${Math.floor(Math.random() * 1e6)}.sh`
    );
    const body =
      `export CLAUDE_GO_TITLE=${shq(desc)}\n` + // floor for the spawned session's SessionStart hook
      `__t="$(basename "$(tty 2>/dev/null)" 2>/dev/null)"\n` +
      `if [ -n "$__t" ] && [ "$__t" != "??" ] && [ "$__t" != "not" ]; then\n` +
      `  printf '\\033]0;%s\\007' ${shq(desc)} > /dev/"$__t" 2>/dev/null\n` + // seed ${sequence} now
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

  // 2) Watch for new /go requests. QUEUE_DIR (~/.claude/go-queue) lives OUTSIDE the
  // open workspace, and vscode.workspace.createFileSystemWatcher does NOT reliably
  // fire for paths outside the workspace roots — so the old RelativePattern watcher
  // never fired, and the queue only ever drained on window reload (activate →
  // drainExisting). Use a workspace-independent Node fs.watch, plus a slow
  // setInterval poll as a belt-and-suspenders fallback (fs.watch can miss events on
  // some platforms/network FS). processFile unlinks the file before doing any work,
  // so a watch event and a poll tick can never double-process the same request.
  const onNew = (name) => {
    if (!name || String(name).startsWith('.')) return;
    // tiny delay so the writer finishes flushing
    setTimeout(() => processFile(path.join(QUEUE_DIR, String(name))), 120);
  };
  try {
    const fsWatcher = fs.watch(QUEUE_DIR, (_event, filename) => onNew(filename));
    context.subscriptions.push({ dispose: () => fsWatcher.close() });
  } catch {
    // fs.watch unavailable — the poll below still drains the queue.
  }
  // Poll fallback: drain anything the watcher missed. Cheap (a readdir) and safe.
  const poll = setInterval(drainExisting, 1000);
  context.subscriptions.push({ dispose: () => clearInterval(poll) });
}

function deactivate() {}

module.exports = { activate, deactivate };
