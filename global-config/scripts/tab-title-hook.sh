#!/bin/sh
# Claude Code hook: maintains custom terminal-tab titles.
# Full docs: ~/.claude/scripts/TAB_TITLES.md
#
#   --bell   also ring the terminal bell (Stop/Notification use this;
#            PostToolUse calls without it so work doesn't ding constantly)
#
# If this tab has a custom title (~/.claude/tab-titles/<tty>, set via
# /tab-title or set-tab-title.sh), re-stamp it shortly AFTER Claude Code's
# own title update so the custom name is what sticks.

[ "$1" = "--bell" ] && { printf '\a' > /dev/tty; } 2>/dev/null

# Walk up to the claude process — it holds the tab's tty (children show "??").
pid=$$; tty=
while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
  tty=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -n "$tty" ] && [ "$tty" != "??" ] && break
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
[ -z "$tty" ] || [ "$tty" = "??" ] && exit 0

F="$HOME/.claude/tab-titles/$tty"
[ -f "$F" ] || exit 0

# Strip a leading "[repo] " prefix so stale repo-prefixed title files (an old
# setter wrote "[SERP] …") self-heal to the bare descriptive title.
t=$(sed -E 's/^\[[^]]+\] //' "$F")

# Ask the go-launcher extension to re-assert the authoritative tab name. renameWithArg
# overrides VS Code's own title regardless of ordering, so no deferral is needed here.
QDIR="$HOME/.claude/title-queue"
mkdir -p "$QDIR" 2>/dev/null
printf '%s' "$t" > "$QDIR/$tty" 2>/dev/null

# OSC fallback for terminals without the extension (plain Terminal.app, etc.). Deferred 1s
# so it lands AFTER Claude Code's own title write (which fires on the same transitions as
# these hooks and would otherwise win the race).
( sleep 1
  printf '\033]0;%s\007' "$t" > "/dev/$tty"
) >/dev/null 2>&1 &
exit 0
