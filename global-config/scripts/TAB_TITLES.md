# Custom Terminal Tab Titles for Claude Code Sessions

**Last Updated:** 2026-08-18

Gives every Claude Code session a custom name/status on its terminal tab
(`🔍 researching · slug`, `🙋 approve? · slug`, `✅ done · slug`) instead of
the auto-generated conversation summary. Driven by `/serp-analyze`, the global
"Terminal Tab Status" standard in `~/CLAUDE.md`, and `/tab-title <name>`.

## Herdr sessions (primary since 2026-08)

Sessions launched by `/go`/`/launch` open as **Herdr tabs** when the `herdr`
server is running (one workspace per repo, one tab per task — see
`launch-repo-session.sh`). Herdr needs NO step-0 setup: it honors OSC 0/2
natively, so the `terminalSequence` escapes the hooks emit paint the pane's
`terminal_title` as-is. Two title surfaces exist there:

- **pane `terminal_title`** — driven by the OSC escapes (hooks + set-tab-title.sh),
  shown in the sidebar row; includes the transient `· <activity>` suffix.
- **tab LABEL** (the tab bar) — a separate value; `set-tab-title.sh` mirrors the
  persisted semantic title onto it via `herdr tab rename $HERDR_TAB_ID` whenever
  `HERDR_ENV`/`HERDR_TAB_ID` are set (they're exported inside every Herdr pane).

`close-own-tab.sh` closes a Herdr session's own tab via `herdr tab close
$HERDR_TAB_ID` (no tty walk). The `ctrl+shift+enter` binding in
`~/.config/herdr/config.toml` (machine-local, like VS Code's settings) runs
`herdr-new-go-tab.sh` → new hub tab with claude running and `/go ` pre-typed.
Herdr's own sidebar agent status (working/blocked/done) is detected
automatically and needs nothing from us.

Everything below is the VS Code path — still fully supported as the fallback
when Herdr isn't running.

## PREREQUISITE (step 0): VS Code needs `${sequence}` in its tab-title template

VS Code's `terminal.integrated.tabs.title` defaults to `${process}`, which
**silently discards every OSC 0/2 title escape**. Nothing below paints a tab
until this one machine-local line is set in
`~/Library/Application Support/Code/User/settings.json`, then the window reloaded:

```json
"terminal.integrated.tabs.title": "${sequence}"
```

This file is **outside** the synced `global-config` repo, so it does NOT ride a
config push — apply it per machine. If titles "don't update," check this FIRST.

## How it works (terminalSequence + session-id state)

Claude Code v2.1.139+ runs hooks **without a controlling terminal**, so a hook
can't write an escape to `/dev/tty` itself. Instead hooks return the title
escape in JSON via the **`terminalSequence`** field (v2.1.141+) and Claude Code
emits it to the session PTY — race-free, tmux/screen/Windows-safe. With
`${sequence}` set (step 0), VS Code surfaces that escape as the tab title.

State is one file per session, keyed by **session id** (stable for the session's
life; immune to tty reuse):

```
set-tab-title.sh "TITLE"           (model/​/serp-analyze)
  └─ writes ~/.claude/tab-titles/$CLAUDE_CODE_SESSION_ID   (source of truth)
  └─ also best-effort stamps the tab via OSC 0 → /dev/tty  (only works in a
     genuine interactive shell; swallowed when run as a Bash tool call)
  └─ a child/subagent session (CLAUDE_CODE_CHILD_SESSION=1) refuses to title

hooks (read session_id from stdin JSON; have no tty):
  SessionStart / UserPromptSubmit → tab-title-default.sh
     └─ if no title file yet, write the floor (CLAUDE_GO_TITLE if set, else
        "🔍 <repo> · session") and emit it → GUARANTEES every session is titled
  Stop / Notification (--bell) + SubagentStop + PostToolUse → tab-title-hook.sh
     └─ read the session's title file, emit it as {terminalSequence: "OSC0…"}
     └─ --bell adds the attention BEL; on a LEADING-✅ title it ALSO fires a
        macOS desktop notification via osascript (NOT OSC 9 — VS Code drops it)
     └─ SubagentStop re-asserts the PARENT's title after a child finishes
     └─ PostToolUse re-asserts after EVERY tool call, so a mid-run
        set-tab-title.sh paints on the next tool call instead of waiting for idle
  SessionEnd → inline `rm` of the session's title file + .did/.log/.notified (GC)
```

Children CANNOT paint the parent tab (their terminalSequence targets their own
non-tab PTY), so they delegate: the parent heals its title on SubagentStop. The
PostToolUse re-assert (no `--bell`) re-emits the stored title after every tool
call so mid-run `set-tab-title.sh` changes paint immediately rather than only on
the next idle hook — the per-tool-call hot-path I/O is the accepted cost, kept
cheap by the hook's early `exit 0` when no title file exists and `suppressOutput`.
The model's `set-tab-title.sh` calls win over the default, because the default
no-ops once a title file exists.

## Done-trail: `--did` (what the session has accomplished)

Beyond the current-step status, the tab can carry a running breadcrumb of what the
session has FINISHED, plus a full on-disk summary:

```
set-tab-title.sh "🔨 fixing cap" --did "raised COPY_LIMIT 2000→8000"
set-tab-title.sh --did "added regression test"      # keeps current title, logs a step
set-tab-title.sh "🧪 verifying" --did "npm test green"
  → tab reads:  🧪 verifying — npm test green, added regression test
```

- `--did "<phrase>"` prepends a short phrase to the session's **done-trail**
  (`~/.claude/tab-titles/$sid.did`, newest-first, one phrase per line) and appends a
  timestamped line to the **full summary** (`$sid.log`, append-only, oldest-first).
- The tab title is composed as `"<base title> — <last 2 dids>"`, capped (~44 chars of
  tail) so it never blows out the Herdr sidebar. Give a title, a `--did`, or both.
- `tab-title-hook.sh` re-reads `.did` and re-asserts the same composed title on every
  Stop/Notification/PostToolUse, so the breadcrumb survives idle re-paints and layers
  correctly UNDER the transient `· <activity>` suffix and the `❓ question` override.
- The **full summary of everything done** is `$sid.log` — read it for the complete
  record (the tab only shows the last two). `--clear` and SessionEnd remove both files.

Keep each `--did` phrase short and past-tense ("capped copier", "added test", "opened
PR #882") — it's a glanceable log of accomplishments, not a sentence.

## Components

| Piece           | Path                                     | Role                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setter          | `~/.claude/scripts/set-tab-title.sh`     | `"NAME"` sets / `--clear` removes; writes session-id state + stamps the tab                                                                                                                                                        |
| Re-assert hook  | `~/.claude/scripts/tab-title-hook.sh`    | Emits the stored title via `terminalSequence`; `--bell` adds BEL + ✅ notify; `--activity` (PostToolUse) forces the leading emoji to 🔨/🧪 while working — see "Live working status"                                               |
| Default hook    | `~/.claude/scripts/tab-title-default.sh` | Floor: titles a session that never called the setter (`🔍 <repo> · session`; the sw-cortex hub floor is plain `hub`, no emoji). With `--prompt` (UserPromptSubmit) it ALSO demotes a leading 🙋/❓/✅ → 🔨 — see "Auto-flip" below |
| Hook wiring     | `~/.claude/settings.json` → `hooks.*`    | SessionStart → default; UserPromptSubmit → default `--prompt`; Stop/Notification(`--bell`)+SubagentStop+PostToolUse → re-assert; SessionEnd → GC                                                                                   |
| State           | `~/.claude/tab-titles/<session_id>`      | One plain-text file per session                                                                                                                                                                                                    |
| Slash command   | `~/.claude/commands/tab-title.md`        | `/tab-title <name>` / `/tab-title --clear`                                                                                                                                                                                         |
| Global standard | `~/CLAUDE.md` "Terminal Tab Status"      | Every session sets/updates the 🔍📋🙋🔨🧪📝⬆️❓📦🚀✅ status (steps in that order)                                                                                                                                                 |

**Auto-flip on reply (resting → working).** A tab only shows a _resting_ status — 🙋 approve? / ❓ blocked / ✅ done — while it actually is that. The moment Jack replies, the `UserPromptSubmit` hook fires `tab-title-default.sh --prompt`, which — if the stored title leads with 🙋, ❓, or ✅ — rewrites the leading emoji to 🔨 (keeping the description / `· label`) and persists it, and clears the `.notified` marker so the next ✅ can toast again. ✅ is included so a re-prompted "done" tab drops its checkmark the instant Jack asks it something. SessionStart calls the same script WITHOUT `--prompt`, so it only re-asserts and never demotes. To change the flip target or which emojis count as "resting", edit the `--prompt` `case` block in `tab-title-default.sh`.

**Live working status (never a checkmark mid-work).** The leading emoji must reflect what the agent is doing _right now_, not a self-report the model froze earlier. The reliable "working now" signal is the hook EVENT, not Herdr's screen-scraped `agent_status` (which reads `idle` even mid-turn, so a live `herdr agent get` query is NOT usable here). `PostToolUse` (`tab-title-hook.sh --activity`) fires only _while_ a turn is active, so on `--activity` the agent is by definition working: the hook forces the leading emoji to 🔨 (building) or 🧪 (testing) — so a busy tab can never show ✅/🙋. 🧪 wins when the current tool looks like testing (a `test`/`vitest`/`jest`/`pytest`/`tsc`/`typecheck`/`lint`/`eslint`/`verify` Bash command, or a `verify-app`/`code-review`/`security-review` subagent); otherwise it keeps the model's own 🔨/🧪, else 🔨. This is TRANSIENT (rewrites the emitted title only, never the stored file) and skips a live ❓ question override. NON-working repaints (Stop/Notification `--bell`, plain SubagentStop) don't touch the emoji: idle/done keeps ✅/🔍, and a waiting/blocked pane is carried by Herdr's own live sidebar dot (no emoji forced). To change what counts as "testing" or the forced emoji, edit the `--activity` block in `tab-title-hook.sh`.

## Changing it

- **Add a status to /serp-analyze:** any string written via `set-tab-title.sh` is
  emitted verbatim — no mechanism change needed.
- **Disable entirely:** remove the hook entries from `settings.json` (the
  Stop/Notification/SubagentStop/UserPromptSubmit/SessionStart/SessionEnd
  `tab-title-*` hooks), or just unset `${sequence}` in VS Code (step 0).
  Deleting `~/.claude/tab-titles/*` reverts open tabs to auto-titles.
- **Bell / done-notify:** the BEL + osascript notification live in
  `tab-title-hook.sh` behind `--bell` (Stop/Notification only). The notify is
  `osascript` (macOS), NOT OSC 9 — VS Code's terminal swallows OSC 9. Only a
  LEADING-✅ status fires it (a ✅ inside the label does not).
- **Default floor title:** edit `tab-title-default.sh` (the `🔍 <repo> · session`
  string / repo derivation).
- **Editing the go-launcher extension:** `sync-global-config.sh push` does NOT
  build/install it. After editing `vscode-extensions/go-launcher/extension.js`
  or `package.json`: (1) bump the version in `package.json`, (2) run
  `bash vscode-extensions/go-launcher/build-and-install.sh`, (3) **Developer:
  Reload Window**, (4) verify the enabled build is the new version (`/status` or
  `~/.vscode/extensions/extensions.json`). The running extension host holds the
  OLD build until a full reload — skip this and the edit appears to "not work."
  In particular, the launcher must create its terminal with NO `name` (see "How
  it works"): a `name` permanently disposes the OSC title listener so the tab
  can never repaint.

## Gotchas

- **Requires Claude Code ≥ v2.1.141** (`terminalSequence`). On older versions
  the hooks emit JSON the CLI ignores → no title. (Installed: 2.1.179.)
- **Hooks load at session start.** Sessions already open when the hook config
  changed keep the old behavior until `/hooks` is run once in them (or restart).
- **A custom title replaces the built-in ✳/· indicator.** The emoji statuses
  carry that signal instead; the bell + VS Code's attention dot still work.
- **sync-global-config:** the scripts live in `~/.claude/scripts` (symlinked to
  `global-config/scripts`, so edits are live); `settings.json` is merged, not
  symlinked — hook entries were added to both copies.
