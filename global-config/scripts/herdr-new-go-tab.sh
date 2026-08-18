#!/usr/bin/env bash
# herdr-new-go-tab.sh — open a fresh hub tab in Herdr, primed for a /go.
#
# Bound to ctrl+shift+enter in ~/.config/herdr/config.toml ([[keys.command]] type="shell")
# AND to cmd+shift+enter in VS Code (runCommands → transient terminal → this script).
# Replaces the old VS Code cmd+shift+enter binding (new terminal in sw-cortex → `claude` →
# type "/go "). Finds (or creates) the sw-cortex hub workspace, opens a focused tab cwd'd
# at the hub, starts claude, and types "/go " WITHOUT submitting — Jack finishes the sentence.
#
# If NO Herdr client window is attached (server-only, or server down entirely), and we're
# running in a real terminal (the VS Code transient one), this terminal BECOMES the Herdr
# window via `exec herdr` — so cmd+shift+enter also "opens Herdr" when it isn't open.

set -euo pipefail

HUB=/Users/jackkief/Desktop/Projects/sw-cortex

HERDR_BIN="$(command -v herdr 2>/dev/null || true)"
[ -n "$HERDR_BIN" ] || HERDR_BIN="$HOME/.local/bin/herdr"

# A client shows as a bare `herdr` process (no subcommand); the daemon is `herdr server`.
client_attached() {
  ps ax -o command= | awk '{ n=split($1,a,"/"); if (a[n]=="herdr" && NF==1) found=1 } END { exit !found }'
}

# Server down (no socket / status fails): a primed tab can't be created — just become the
# Herdr window (the client boots the server) when we have a terminal to do it in.
if ! "$HERDR_BIN" status >/dev/null 2>&1; then
  if [ -t 0 ]; then exec "$HERDR_BIN"; fi
  echo "herdr-new-go-tab: herdr server not running and no tty to attach from" >&2
  exit 1
fi
[ -x "$HERDR_BIN" ] || { echo "herdr-new-go-tab: herdr CLI not found" >&2; exit 1; }

json_field() { # $1=json $2=field
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r "[.. | objects | .$2 // empty] | first // empty" 2>/dev/null
  else
    printf '%s' "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | sed -E 's/.*:"([^"]*)"/\1/'
  fi
}

ws_id="$("$HERDR_BIN" workspace list 2>/dev/null | {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.result.workspaces[] | select(.label == "sw-cortex") | .workspace_id' 2>/dev/null | head -1
  else
    cat >/dev/null; echo ""
  fi
})"

if [ -z "$ws_id" ]; then
  out="$("$HERDR_BIN" workspace create --cwd "$HUB" --label sw-cortex --focus)"
else
  out="$("$HERDR_BIN" tab create --workspace "$ws_id" --cwd "$HUB" --focus)"
fi
pane_id="$(json_field "$out" pane_id)"
[ -n "$pane_id" ] || { echo "herdr-new-go-tab: could not resolve new pane id" >&2; exit 1; }

"$HERDR_BIN" pane run "$pane_id" "clear ; claude"
"$HERDR_BIN" pane send-text "$pane_id" "/go "

# No Herdr window anywhere to show the tab we just made? Attach right here (the transient
# VS Code terminal), turning it into the Herdr window focused on the new /go tab.
if ! client_attached && [ -t 0 ]; then
  exec "$HERDR_BIN"
fi
