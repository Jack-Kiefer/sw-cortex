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

echo "$(date +%H:%M:%S) fired${1:+ $1} tty=$tty" >> "$HOME/.claude/tab-titles/.hook-log"

F="$HOME/.claude/tab-titles/$tty"
[ -f "$F" ] || exit 0

# Deferred 1s so it lands AFTER Claude Code's own title write (which fires
# on the same transitions as these hooks and would otherwise win the race).
( sleep 1; printf '\033]0;%s\007' "$(cat "$F")" > "/dev/$tty" ) >/dev/null 2>&1 &
exit 0
