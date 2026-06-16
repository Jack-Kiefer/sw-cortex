#!/usr/bin/env bash
# launch-repo-session.sh — request a real Claude Code session in a target repo.
# Used by the /go slash command.
#
# Usage: launch-repo-session.sh <repo-root> [--label <tab-label>] [initial prompt...]
#
# Mechanism (fully automatic, no macOS Accessibility): this drops a request file into
# ~/.claude/go-queue/. The "Go Launcher" VS Code extension (~/.vscode/extensions/
# go-launcher) watches that dir and INSTANTLY opens a new integrated terminal cd'd into
# the repo, names the tab, and runs claude with the prompt. One file per request, so
# firing several /go's in a row opens several terminals (none clobber each other).

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "launch-repo-session: repo root '$REPO' does not exist" >&2
  exit 2
fi
shift || true

LABEL="$(basename "$REPO")"
if [ "${1:-}" = "--label" ]; then
  shift
  LABEL="${1:-$LABEL}"
  shift || true
fi
PROMPT="$*"

QUEUE_DIR="$HOME/.claude/go-queue"
mkdir -p "$QUEUE_DIR"

# Unique per-request file (so concurrent /go's don't overwrite). Line 1 = repo root;
# line 2+ = prompt. mktemp gives uniqueness without needing date/random.
REQ="$(mktemp "$QUEUE_DIR/req.XXXXXX")"
{ printf '%s\n' "$REPO"; printf '%s' "$PROMPT"; } > "$REQ"

echo "go: opening a [$LABEL] session — a new terminal tab will appear automatically."
if [ -n "$PROMPT" ]; then
  echo "    It runs claude with your task as the first prompt."
fi
