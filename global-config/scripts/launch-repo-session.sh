#!/usr/bin/env bash
# launch-repo-session.sh — open a NEW VS Code integrated terminal tab and start a
# real Claude Code session cd'd into a target repo (with its full native commands +
# project MCP servers). Used by the /go (and /serp) slash commands.
#
# Usage: launch-repo-session.sh <repo-root> [--label <tab-label>] [initial prompt...]
# Example: launch-repo-session.sh /Users/jackkief/Desktop/Projects/SERP --label SERP "fix the forecast zeros"
#
# The new session names its own terminal tab after the repo (via set-tab-title.sh) so
# you can see which project each tab is for.
#
# Mechanism: VS Code has no CLI to open a terminal tab, so we drive it via osascript
# keystrokes (Ctrl+Shift+` = new terminal). This REQUIRES macOS Accessibility
# permission for the controlling app (VS Code). If keystrokes are blocked, we print
# the exact command for the user to paste instead — never silently fail.

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "launch-repo-session: repo root '$REPO' does not exist" >&2
  exit 2
fi
shift || true

# Optional --label <name> for the tab; default to the repo's basename.
LABEL="$(basename "$REPO")"
if [ "${1:-}" = "--label" ]; then
  shift
  LABEL="${1:-$LABEL}"
  shift || true
fi
PROMPT="$*"

TITLE_SCRIPT="$HOME/.claude/scripts/set-tab-title.sh"

# Build the command the new terminal runs:
#   1. cd into the repo
#   2. stamp the tab title with the project (📁 <LABEL>) so the tab shows which repo
#   3. launch claude (with the task prompt if given)
# All single-quoted segments; escape single quotes in dynamic values.
esc() { printf "%s" "$1" | sed "s/'/'\\\\''/g"; }
REPO_Q="$(esc "$REPO")"
LABEL_Q="$(esc "$LABEL")"

# Plain-ASCII tab label — emoji get mangled when typed via osascript keystroke.
TITLE_CMD=""
if [ -x "$TITLE_SCRIPT" ]; then
  TITLE_CMD="'$HOME/.claude/scripts/set-tab-title.sh' '[$LABEL_Q]' ; "
fi

# Inherit the global default model (set in ~/.claude/settings.json) — no --model pin here.
if [ -n "$PROMPT" ]; then
  PROMPT_Q="$(esc "$PROMPT")"
  RUNCMD="cd '$REPO_Q' && ${TITLE_CMD}claude '$PROMPT_Q'"
else
  RUNCMD="cd '$REPO_Q' && ${TITLE_CMD}claude"
fi

FALLBACK_MSG="Could not open a VS Code terminal tab automatically (macOS Accessibility permission needed for VS Code).
Open a new terminal yourself and paste:
  $RUNCMD"

# AppleScript: focus VS Code, open a new integrated terminal (Ctrl+Shift+backtick =
# key code 50), then type the command and Enter (key code 36).
if osascript <<OSA 2>/dev/null
tell application "Visual Studio Code" to activate
delay 0.4
tell application "System Events"
  tell process "Code"
    key code 50 using {control down, shift down}
    delay 0.7
    keystroke "$RUNCMD"
    key code 36
  end tell
end tell
OSA
then
  echo "Opened a new VS Code terminal tab ($LABEL) running: $RUNCMD"
else
  echo "$FALLBACK_MSG"
  exit 1
fi
