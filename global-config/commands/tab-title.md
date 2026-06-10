---
description: Set a sticky custom name for this terminal tab (or --clear to return to automatic titles)
---

Set a custom title on this session's terminal tab. Run exactly:

```bash
~/.claude/scripts/set-tab-title.sh "$ARGUMENTS"
```

If the argument is `--clear`, the tab returns to Claude's automatic titles.

Relay the script's one-line output. Notes for the user if asked: the name is stamped immediately and re-asserted after every tool call, turn end, and permission prompt by the global hooks (Stop/Notification/PostToolUse → `tab-title-hook.sh`); sessions opened before the hooks existed need `/hooks` typed once to load them. Full mechanism docs: `~/.claude/scripts/TAB_TITLES.md`.
