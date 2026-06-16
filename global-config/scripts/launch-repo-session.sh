#!/usr/bin/env bash
# launch-repo-session.sh — stage a /go request for a real Claude Code session in a
# target repo. Used by the /go slash command.
#
# Usage: launch-repo-session.sh <repo-root> [--label <tab-label>] [initial prompt...]
#
# Mechanism (no macOS Accessibility needed): this writes the request (repo + prompt) to
# ~/.claude/.go-pending. The VS Code TASK "go: launch repo session" (bound to
# Cmd+Shift+Enter) opens a new terminal panel and runs go-run-pending.sh there, which
# reads this file, cd's into the repo, names the tab, and launches claude. The task
# opens the terminal natively, so there is no keystroke injection to be blocked.

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "launch-repo-session: repo root '$REPO' does not exist" >&2
  exit 2
fi
shift || true

# Optional --label (kept for compatibility / clarity; the reader derives it from cwd too)
LABEL="$(basename "$REPO")"
if [ "${1:-}" = "--label" ]; then
  shift
  LABEL="${1:-$LABEL}"
  shift || true
fi
PROMPT="$*"

REQ="$HOME/.claude/.go-pending"
# Line 1 = repo root; line 2+ = prompt (may be empty / multi-line).
{ printf '%s\n' "$REPO"; printf '%s' "$PROMPT"; } > "$REQ"

echo "go: staged a session request for [$LABEL]."
echo "    Press Cmd+Shift+Enter in VS Code to open it in a new terminal tab."
echo "    (or run the task: Cmd+Shift+P -> 'Tasks: Run Task' -> 'go: launch repo session')"
if [ -n "$PROMPT" ]; then
  echo "    It will run: claude with your task as the first prompt."
fi
