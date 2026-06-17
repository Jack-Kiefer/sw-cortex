#!/bin/sh
# Claude Code hook (SessionStart / UserPromptSubmit): guarantee EVERY session has a tab
# title, even if the model never calls set-tab-title.sh. Full docs: ~/.claude/scripts/TAB_TITLES.md
#
# Writes a default "🔍 <repo> · session" title keyed by session id IFF none is set yet,
# then emits it via terminalSequence. Once the model sets a real status, that file exists
# and this no-ops — so the model's richer titles always win; this is only the floor.

input=$(cat)

sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$sid" ] || sid="$CLAUDE_CODE_SESSION_ID"
[ -n "$sid" ] || exit 0

DIR="$HOME/.claude/tab-titles"
F="$DIR/$sid"
# A title already exists → leave it (the model owns the status); just re-assert it.
if [ -f "$F" ]; then
  title=$(sed -E 's/^\[[^]]+\] //' "$F")
else
  cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
  [ -n "$cwd" ] || cwd="$PWD"
  repo=$(basename "$cwd" 2>/dev/null)
  [ -n "$repo" ] || repo="session"
  title="🔍 $repo · session"
  mkdir -p "$DIR"
  printf '%s' "$title" > "$F"
fi
[ -n "$title" ] || exit 0

esc=$(printf '\033]0;%s\007' "$title")
jq -nc --arg seq "$esc" '{terminalSequence: $seq, suppressOutput: true}'
exit 0
