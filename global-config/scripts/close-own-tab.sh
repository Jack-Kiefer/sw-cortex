#!/usr/bin/env bash
# close-own-tab.sh — close THIS session's terminal tab (Herdr tab, or VS Code via the
# Go Launcher extension).
#
# Used ONLY by explicit close commands (/save-for-later). NOT part of post-merge teardown —
# sessions leave their tab open at ✅ done after a PR merges; Jack closes tabs himself
# (2026-07-22 directive). The launched tab does NOT auto-close on its own (the extension has
# no ✅-title watcher) — this script is the only close mechanism, invoked only when Jack
# explicitly asks to close the chat.
#
# How it works: the extension (~/.vscode/extensions/jackkief.go-launcher) watches
# ~/.claude/go-queue/ and disposes the VS Code terminal whose shell PID's tty matches a
# CLOSE_TTY control line. launch-repo-session.sh already uses that to close the ORIGINATING
# tab; this drops a close-ONLY request (line 1 = "__CLOSE__" sentinel, line 2 =
# "CLOSE_TTY=<our tty>") so the extension closes the tab THIS session is running in.
#
# Resolving our own tty: when claude runs this as a Bash tool call the shell is detached
# (tty "??"), so we walk up the process tree to the `claude` process, which holds the tab's
# real tty — the SAME walk launch-repo-session.sh and set-tab-title.sh use.

set -euo pipefail

# Herdr session: panes export HERDR_TAB_ID (inherited by claude and its tool shells) —
# close our own tab directly through the herdr CLI, no tty walk needed.
if [ -n "${HERDR_TAB_ID:-}" ]; then
  HERDR_BIN="$(command -v herdr 2>/dev/null || true)"
  [ -n "$HERDR_BIN" ] || { [ -x "$HOME/.local/bin/herdr" ] && HERDR_BIN="$HOME/.local/bin/herdr"; } || true
  if [ -n "$HERDR_BIN" ] && "$HERDR_BIN" tab close "$HERDR_TAB_ID" >/dev/null 2>&1; then
    echo "close-own-tab: requested close of this Herdr tab ($HERDR_TAB_ID)."
    exit 0
  fi
  echo "close-own-tab: herdr tab close failed — tab left open." >&2
  exit 0   # best-effort, same as the VS Code path
fi

QUEUE_DIR="$HOME/.claude/go-queue"
mkdir -p "$QUEUE_DIR"

# Walk up the process tree to find the first ancestor with a real (non-"??") tty — that's
# the claude process holding this tab's controlling terminal.
OWN_TTY=
pid=$$
while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
  t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ -n "$t" ] && [ "$t" != "??" ]; then OWN_TTY="$t"; break; fi
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done

if [ -z "$OWN_TTY" ]; then
  echo "close-own-tab: could not resolve this session's tty — tab left open." >&2
  exit 0   # best-effort: never fail teardown over a cosmetic tab close
fi

# Drop a close-only request. Line 1 = "__CLOSE__" sentinel; line 2 = the control line.
REQ="$(mktemp "$QUEUE_DIR/close.XXXXXX")"
{ printf '__CLOSE__\n'; printf 'CLOSE_TTY=%s\n' "$OWN_TTY"; } > "$REQ"

echo "close-own-tab: requested close of this tab (tty $OWN_TTY) — it will disappear shortly."
exit 0
