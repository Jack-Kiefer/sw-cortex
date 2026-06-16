#!/usr/bin/env bash
# go-run-pending.sh — run inside the VS Code "go: launch repo session" task's new
# terminal panel. Reads the pending /go request that the /go command wrote, cd's into
# the target repo, names the tab, and launches claude with the prompt.
#
# This replaces the osascript keystroke approach (which needed flaky macOS Accessibility):
# the VS Code TASK opens the new terminal panel natively, and THIS script — already
# running in that panel — just execs claude. No keystroke injection, no Accessibility.
#
# Request file (written by /go): ~/.claude/.go-pending  — two lines:
#   line 1: absolute repo root
#   line 2+: the prompt (may be empty; may span lines)

set -uo pipefail

REQ="$HOME/.claude/.go-pending"

if [ ! -f "$REQ" ]; then
  echo "go: no pending request (~/.claude/.go-pending not found)."
  echo "Run /go <task> in the hub first, then trigger this task."
  exec "$SHELL" -l
fi

REPO="$(sed -n '1p' "$REQ")"
PROMPT="$(sed '1d' "$REQ")"     # everything after line 1, preserving newlines
LABEL="$(basename "$REPO")"

# Consume the request so a stale one can't silently re-fire on the next trigger.
rm -f "$REQ"

if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "go: pending request had an invalid repo root: '$REPO'"
  exec "$SHELL" -l
fi

cd "$REPO" || { echo "go: could not cd into $REPO"; exec "$SHELL" -l; }

# Name the tab (set-tab-title.sh auto-prepends [<repo>] for spoke repos).
[ -x "$HOME/.claude/scripts/set-tab-title.sh" ] && "$HOME/.claude/scripts/set-tab-title.sh" "$LABEL" >/dev/null 2>&1

echo "go: launching claude in $LABEL ($REPO)"
if [ -n "$PROMPT" ]; then
  exec claude "$PROMPT"
else
  exec claude
fi
