# Custom Terminal Tab Titles for Claude Code Sessions

**Last Updated:** 2026-06-17

Gives every Claude Code session a custom name/status on its terminal tab
(`🔍 researching · slug`, `🙋 approve? · slug`, `✅ done · slug`) instead of
the auto-generated conversation summary. Driven by `/analyze`, the global
"Terminal Tab Status" standard in `~/CLAUDE.md`, and `/tab-title <name>`.

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
set-tab-title.sh "TITLE"           (model/​/analyze)
  └─ writes ~/.claude/tab-titles/$CLAUDE_CODE_SESSION_ID   (source of truth)
  └─ also best-effort stamps the tab via OSC 0 → /dev/tty  (only works in a
     genuine interactive shell; swallowed when run as a Bash tool call)
  └─ a child/subagent session (CLAUDE_CODE_CHILD_SESSION=1) refuses to title

hooks (read session_id from stdin JSON; have no tty):
  SessionStart / UserPromptSubmit → tab-title-default.sh
     └─ if no title file yet, write the floor (CLAUDE_GO_TITLE if set, else
        "🔍 <repo> · session") and emit it → GUARANTEES every session is titled
  Stop / Notification (--bell) + SubagentStop → tab-title-hook.sh
     └─ read the session's title file, emit it as {terminalSequence: "OSC0…"}
     └─ --bell adds the attention BEL; on a LEADING-✅ title it ALSO fires a
        macOS desktop notification via osascript (NOT OSC 9 — VS Code drops it)
     └─ SubagentStop re-asserts the PARENT's title after a child finishes
  SessionEnd → inline `rm` of the session's title file (GC)
```

Children CANNOT paint the parent tab (their terminalSequence targets their own
non-tab PTY), so they delegate: the parent heals its title on SubagentStop. The
PostToolUse re-assert was removed (per-tool-call hot-path I/O; transitions cover
every idle moment). The model's `set-tab-title.sh` calls win over the default,
because the default no-ops once a title file exists.

## Components

| Piece           | Path                                     | Role                                                                                                           |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Setter          | `~/.claude/scripts/set-tab-title.sh`     | `"NAME"` sets / `--clear` removes; writes session-id state + stamps the tab                                    |
| Re-assert hook  | `~/.claude/scripts/tab-title-hook.sh`    | Emits the stored title via `terminalSequence`; `--bell` adds BEL + ✅ notify                                   |
| Default hook    | `~/.claude/scripts/tab-title-default.sh` | Floor: titles a session that never called the setter (`🔍 <repo> · session`)                                   |
| Hook wiring     | `~/.claude/settings.json` → `hooks.*`    | SessionStart/UserPromptSubmit → default; Stop/Notification(`--bell`)+SubagentStop → re-assert; SessionEnd → GC |
| State           | `~/.claude/tab-titles/<session_id>`      | One plain-text file per session                                                                                |
| Slash command   | `~/.claude/commands/tab-title.md`        | `/tab-title <name>` / `/tab-title --clear`                                                                     |
| Global standard | `~/CLAUDE.md` "Terminal Tab Status"      | Every session sets/updates 🔍🔨🧪🙋❓📦✅ status                                                               |

## Changing it

- **Add a status to /analyze:** any string written via `set-tab-title.sh` is
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
