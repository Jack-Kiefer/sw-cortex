# Custom Terminal Tab Titles for Claude Code Sessions

**Last Updated:** 2026-06-10

Lets a Claude Code session set (and keep) a custom name/status on its own
terminal tab — instead of the auto-generated conversation summary. Used
manually via `/tab-title <name>` and automatically by SERP's `/analyze`
command to show phase status (`🔍 researching · slug`, `🙋 approve? · slug`, …).

## The problem this solves

Claude Code owns the terminal title: it rewrites it (✳/· + conversation
summary) at every state transition, so anything else that writes a title
gets overwritten moments later. Additionally, Bash-tool shells are detached
(`tty` = `??`, no controlling terminal), so a session can't even reliably
write to its own tab directly.

## How it works

```
session runs set-tab-title.sh "NAME"
  └─ walks UP the process tree until it finds a pid with a real tty
     (the claude process itself, e.g. ttys002 — its children all show "??")
  └─ writes NAME to ~/.claude/tab-titles/<tty>          (the source of truth)
  └─ stamps the title once immediately via /dev/<tty>

global hooks (Stop, Notification, PostToolUse) run tab-title-hook.sh
  └─ same tty walk → if ~/.claude/tab-titles/<tty> exists:
     (sleep 1; printf OSC-title) &      ← DEFERRED + BACKGROUNDED
```

The `sleep 1 &` is the load-bearing trick: Claude Code writes its own title
on the same transitions the hooks fire on, and its write lands _after_ the
hook's. Deferring ours by 1s reverses the ordering, so the custom name is
what survives. PostToolUse (no bell) keeps the name asserted during active
work; Stop/Notification (with `--bell`) re-assert it at idle and also ring
the attention bell for every session, titled or not.

Keying by tty = keying by tab. The name survives across conversations in
the same tab until cleared or the tab closes (stale files for closed ttys
are harmless and get reused/overwritten when the tty number is reissued).

## Components

| Piece                | Path                                                                                                           | Role                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Setter               | `~/.claude/scripts/set-tab-title.sh`                                                                           | `"NAME"` sets, `--clear` removes; resolves tty, writes the file, stamps once                |
| Hook                 | `~/.claude/scripts/tab-title-hook.sh`                                                                          | Bell (`--bell` only) + deferred re-stamp if a title file exists                             |
| Hook wiring          | `~/.claude/settings.json` → `hooks.Stop` / `hooks.Notification` (with `--bell`), `hooks.PostToolUse` (without) | Fires the hook script                                                                       |
| Slash command        | `~/.claude/commands/tab-title.md`                                                                              | `/tab-title <name>` / `/tab-title --clear` in any session                                   |
| State                | `~/.claude/tab-titles/<tty>`                                                                                   | One file per tab, plain text title                                                          |
| /analyze integration | `SERP/.claude/commands/analyze.md` ("Tab status" section)                                                      | Emoji status map stamped at each phase transition                                           |
| Global standard      | `~/CLAUDE.md` "Terminal Tab Status" (source: `sw-cortex/global-config/CLAUDE.md`)                              | EVERY session in every project sets/updates its status (🔍🔨🧪🙋❓📦✅) — not just /analyze |

## Changing it

- **Different timing/race issues:** adjust the `sleep 1` in `tab-title-hook.sh`.
- **Add a status to /analyze:** extend the table in analyze.md's "Tab status"
  section — the mechanism needs no changes; any string written via
  `set-tab-title.sh` is maintained verbatim.
- **Disable entirely:** remove the three hook entries from settings.json
  (or just delete `~/.claude/tab-titles/*` to revert all tabs to auto-titles
  while keeping the bell).
- **Bell behavior:** lives in `tab-title-hook.sh` behind `--bell`; only
  Stop/Notification pass it. Don't add it to PostToolUse — it would ding on
  every tool call.

## Gotchas

- **Hooks load at session start.** Sessions already open when the hook
  config changed keep stamping nothing (or the old behavior) until `/hooks`
  is typed once in them. Symptom: `/tab-title` works for a second, then the
  auto-title comes back and stays — that's a session with stale hooks.
- **Brief flicker is by design:** Claude's auto-title appears for ~1s at
  each transition before the deferred stamp replaces it.
- **A renamed tab loses the built-in ✳/· indicator** (the custom string
  replaces the whole title). /analyze's emoji statuses carry that signal
  instead; for manual names, the bell + VS Code's attention dot still work.
- **sync-global-config:** these scripts/commands live in `~/.claude` and get
  absorbed into `sw-cortex/global-config/` on the next sync pull (plain `cp`,
  no deletes) — after editing, run the sync push per global-config rules.
