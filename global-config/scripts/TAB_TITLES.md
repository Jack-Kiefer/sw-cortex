# Custom Terminal Tab Titles for Claude Code Sessions

**Last Updated:** 2026-06-17

Gives every Claude Code session a custom name/status on its terminal tab
(`🔍 researching · slug`, `🙋 approve? · slug`, `✅ done · slug`) instead of
the auto-generated conversation summary. Driven by `/analyze`, the global
"Terminal Tab Status" standard in `~/CLAUDE.md`, and `/tab-title <name>`.

## How it works (terminalSequence + session-id state)

Claude Code v2.1.139+ runs hooks **without a controlling terminal**, so a hook
can't write an escape to `/dev/tty` itself. Instead hooks return the title
escape in JSON via the **`terminalSequence`** field (v2.1.141+) and Claude Code
emits it — race-free, tmux/screen/Windows-safe. That is the whole mechanism.

State is one file per session, keyed by **session id** (stable for the session's
life; immune to tty reuse):

```
set-tab-title.sh "TITLE"           (model/​/analyze, runs in the real shell)
  └─ writes ~/.claude/tab-titles/$CLAUDE_CODE_SESSION_ID   (source of truth)
  └─ also stamps the live tab now via OSC 0 → /dev/tty     (instant feedback)

hooks (read session_id from stdin JSON; have no tty):
  SessionStart / UserPromptSubmit → tab-title-default.sh
     └─ if no title file yet, write "🔍 <repo> · session"; emit it
        → GUARANTEES every session is titled even if the model never sets one
  Stop / Notification (--bell) + PostToolUse / UserPromptSubmit → tab-title-hook.sh
     └─ read the session's title file, emit it as {terminalSequence: "OSC0…"}
     └─ --bell adds the attention BEL; on a ✅ title it also emits an OSC 9
        desktop notification ("Claude Code — <label> done")
```

No process-tree tty walk, no `sleep`-based race, no VS Code extension involved
in titling. The model's `set-tab-title.sh` calls always win over the default,
because the default no-ops once a title file exists.

## Components

| Piece           | Path                                                  | Role                                                                          |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Setter          | `~/.claude/scripts/set-tab-title.sh`                  | `"NAME"` sets / `--clear` removes; writes session-id state + stamps the tab    |
| Re-assert hook  | `~/.claude/scripts/tab-title-hook.sh`                 | Emits the stored title via `terminalSequence`; `--bell` adds BEL + ✅ notify   |
| Default hook    | `~/.claude/scripts/tab-title-default.sh`              | Floor: titles a session that never called the setter (`🔍 <repo> · session`)   |
| Hook wiring     | `~/.claude/settings.json` → `hooks.*`                 | SessionStart/UserPromptSubmit → default; Stop/Notification(`--bell`)+PostToolUse → re-assert |
| State           | `~/.claude/tab-titles/<session_id>`                   | One plain-text file per session                                               |
| Slash command   | `~/.claude/commands/tab-title.md`                     | `/tab-title <name>` / `/tab-title --clear`                                     |
| Global standard | `~/CLAUDE.md` "Terminal Tab Status"                   | Every session sets/updates 🔍🔨🧪🙋❓📦✅ status                                |

## Changing it

- **Add a status to /analyze:** any string written via `set-tab-title.sh` is
  emitted verbatim — no mechanism change needed.
- **Disable entirely:** remove the hook entries from `settings.json` (the
  Stop/Notification/PostToolUse/UserPromptSubmit/SessionStart `tab-title-*`
  hooks). Deleting `~/.claude/tab-titles/*` reverts open tabs to auto-titles.
- **Bell / done-notify:** both live in `tab-title-hook.sh` behind `--bell`
  (Stop/Notification only). Don't pass `--bell` to PostToolUse — it would ding
  on every tool call.
- **Default floor title:** edit `tab-title-default.sh` (the `🔍 <repo> · session`
  string / repo derivation).

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
