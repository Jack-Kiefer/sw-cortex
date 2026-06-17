#!/bin/sh
# Set (or clear) a sticky custom name for the Claude Code terminal tab this
# session runs in. Writes the name to ~/.claude/tab-titles/<tty>; the
# Stop/Notification hooks (tab-title-hook.sh) re-stamp it after Claude Code's
# own title updates so the custom name wins whenever the session is idle.
#
# Usage: set-tab-title.sh "My name"   |   set-tab-title.sh --clear

DIR="$HOME/.claude/tab-titles"
mkdir -p "$DIR"

# Walk up the process tree to the claude process — it holds the tab's tty.
# (Bash-tool shells and their children report tty "??".)
pid=$$; tty=
while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
  tty=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -n "$tty" ] && [ "$tty" != "??" ] && break
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done

if [ -z "$tty" ] || [ "$tty" = "??" ]; then
  echo "error: could not resolve this session's terminal device" >&2
  exit 1
fi

if [ "$1" = "--clear" ]; then
  rm -f "$DIR/$tty"
  echo "cleared custom title for $tty — automatic titles resume on the next update"
  exit 0
fi

if [ -z "$1" ]; then
  echo "usage: set-tab-title.sh \"name\" | --clear" >&2
  exit 1
fi

TITLE="$1"

# The title is whatever the caller passes — a description of what the session is doing
# (e.g. "🔍 researching · darklaunch-drift"). No repo prefix: the task description itself
# conveys context, and the repo is inferable from it. (Repo-prefixing was removed per
# Jack's request to make titles describe the work, not the repo.)

printf '%s' "$TITLE" > "$DIR/$tty"
# Stamp immediately via the tty device path (works even without a controlling tty)
{ printf '\033]0;%s\007' "$TITLE" > "/dev/$tty"; } 2>/dev/null
echo "tab ($tty) titled: $TITLE"
exit 0
