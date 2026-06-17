#!/usr/bin/env bash
# launch-repo-session.sh — request a real Claude Code session in a target repo.
# Used by the /go and /launch slash commands.
#
# Usage: launch-repo-session.sh <repo-root> [--label <tab-label>] [--keep-original] [initial prompt...]
#
#   --keep-original   Do NOT close the tab this was launched from (used by /launch).
#                     Default (used by /go) closes the originating tab once the new one opens.
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
KEEP_ORIGINAL=
# Flags (any order) precede the prompt.
while true; do
  case "${1:-}" in
    --label)         shift; LABEL="${1:-$LABEL}"; shift || true ;;
    --keep-original) KEEP_ORIGINAL=1; shift || true ;;
    *)               break ;;
  esac
done
PROMPT="$*"

QUEUE_DIR="$HOME/.claude/go-queue"
mkdir -p "$QUEUE_DIR"

# Resolve the tty of the tab this /go was launched FROM, so the extension can close that
# exact tab once the new one opens (Jack: "any tab I run /go in closes after launch").
# Walk up the process tree to the claude process — it holds the tab's tty (the bash-tool
# shell running this script is detached and reports "??"). Same walk as set-tab-title.sh.
# With --keep-original (/launch) we skip this entirely so CLOSE_TTY stays empty and the
# extension leaves the originating tab open.
CLOSE_TTY=
if [ -z "$KEEP_ORIGINAL" ]; then
  pid=$$
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
    t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ -n "$t" ] && [ "$t" != "??" ]; then CLOSE_TTY="$t"; break; fi
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
fi

# Unique per-request file (so concurrent /go's don't overwrite). Line 1 = repo root;
# line 2 = "CLOSE_TTY=<tty>" control line (empty value if unresolved); line 3+ = prompt.
REQ="$(mktemp "$QUEUE_DIR/req.XXXXXX")"
{ printf '%s\n' "$REPO"; printf 'CLOSE_TTY=%s\n' "$CLOSE_TTY"; printf '%s' "$PROMPT"; } > "$REQ"

echo "launch: opening a [$LABEL] session — a new terminal tab will appear automatically."
if [ -n "$PROMPT" ]; then
  echo "    It runs claude with your task as the first prompt."
fi
if [ -n "$KEEP_ORIGINAL" ]; then
  echo "    (--keep-original: this tab stays open.)"
fi
