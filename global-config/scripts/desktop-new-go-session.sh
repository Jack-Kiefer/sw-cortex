#!/usr/bin/env bash
# desktop-new-go-session.sh — open a new Claude Desktop Code session in the sw-cortex hub,
# ready for a /go. Claude Desktop counterpart of herdr-new-go-tab.sh, bound via skhd:
#   cmd + shift - return : /Users/jackkief/.claude/scripts/desktop-new-go-session.sh
# `claude --desktop` refuses to run without a tty, so `script` supplies one (skhd has none).

set -euo pipefail

HUB=/Users/jackkief/Desktop/Projects/sw-cortex
CLAUDE_BIN="$(command -v claude 2>/dev/null || echo "$HOME/.local/bin/claude")"

cd "$HUB"
script -q /dev/null "$CLAUDE_BIN" --desktop </dev/null >/dev/null 2>&1
