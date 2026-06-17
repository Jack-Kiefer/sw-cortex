#!/bin/sh
# Set (or clear) a sticky custom name for this Claude Code session's terminal tab.
# Full docs: ~/.claude/scripts/TAB_TITLES.md
#
# Usage: set-tab-title.sh "🔍 researching · slug"   |   set-tab-title.sh --clear
#
# State is keyed by SESSION ID (~/.claude/tab-titles/<session_id>) — stable for the
# session's life and immune to tty reuse. tab-title-hook.sh re-asserts it on every
# Stop/Notification/UserPromptSubmit/SubagentStop via the terminalSequence hook output;
# that hook path (OSC 0 through CC) is what actually paints the tab. The direct /dev/tty
# stamp below ONLY works when this setter runs in a genuine interactive shell with a
# controlling terminal — when the model invokes it as a Bash tool call the shell is
# detached (tty "??") and the stamp is silently swallowed, so it is best-effort only.

DIR="$HOME/.claude/tab-titles"
mkdir -p "$DIR"

# The session id: set for any process under `claude` (the setter, hooks, child shells).
sid="$CLAUDE_CODE_SESSION_ID"

if [ "$1" = "--clear" ]; then
  [ -n "$sid" ] && rm -f "$DIR/$sid"
  echo "cleared custom title — automatic titles resume on the next update"
  exit 0
fi

if [ -z "$1" ]; then
  echo "usage: set-tab-title.sh \"name\" | --clear" >&2
  exit 1
fi

TITLE="$1"

if [ -z "$sid" ]; then
  echo "error: CLAUDE_CODE_SESSION_ID unset — not in a Claude Code session?" >&2
  exit 1
fi

# Persist (the hook reads this back) ...
printf '%s' "$TITLE" > "$DIR/$sid"

# ... and stamp the live tab now via OSC 0, written to this shell's controlling terminal.
# The interactive shell HAS a tty (unlike hooks); fall back silently if it doesn't.
{ printf '\033]0;%s\007' "$TITLE" > /dev/tty; } 2>/dev/null

echo "tab titled: $TITLE"
exit 0
