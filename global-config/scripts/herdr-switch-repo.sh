#!/usr/bin/env bash
# herdr-switch-repo.sh <repo-root> — switch THIS Herdr pane's claude session to another repo.
#
# Used by /go's bare-repo path (e.g. "/go serp") when the session runs inside a Herdr pane:
# instead of opening a new tab and closing this one, the SAME pane swaps in place — the
# current claude exits, the pane shell cd's to the repo, and a fresh claude boots there
# (same tab, same position; tab relabeled to the repo floor).
#
# Built on Herdr's native agent primitives, driven by a DETACHED helper (the invoking
# claude turn must end before the swap can run — the helper waits for that):
#   1. herdr agent wait <pane> --until idle      (invoking turn finished)
#   2. herdr agent prompt <pane> "/exit"         (current claude quits)
#   3. poll herdr agent get until agent_not_found
#   4. herdr pane run <pane> "cd <repo>"         (pane shell moves to the repo)
#   5. herdr agent start claude --kind claude --pane <pane>   (fresh claude, waits ready)
#
# The invoking session MUST end its turn immediately after running this script — the swap
# is what kills it.

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "herdr-switch-repo: repo root '$REPO' does not exist" >&2
  exit 2
fi

PANE="${HERDR_PANE_ID:-}"
TAB="${HERDR_TAB_ID:-}"
if [ -z "$PANE" ]; then
  echo "herdr-switch-repo: not inside a Herdr pane (HERDR_PANE_ID unset) — use launch-repo-session.sh instead" >&2
  exit 1
fi

# In this setup we're always inside a Herdr pane (HERDR_PANE_ID was set above),
# so the herdr CLI is always present — resolve its path, don't gate on existence.
HERDR_BIN="$(command -v herdr 2>/dev/null || true)"
[ -n "$HERDR_BIN" ] || HERDR_BIN="$HOME/.local/bin/herdr"

LABEL="$(basename "$REPO")"

nohup bash -c '
  H="$1"; P="$2"; T="$3"; R="$4"; L="$5"
  # 1. Wait for the invoking claude turn to finish (idle = at its prompt). Bounded.
  "$H" agent wait "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true
  # 2. Ask the current claude to exit.
  "$H" agent prompt "$P" "/exit" >/dev/null 2>&1
  # 3. Wait until the agent is actually gone (pane back at a shell prompt), then
  #    proceed IMMEDIATELY. Fast poll (0.2s) with an early break the moment the
  #    agent disappears — the old loop paced at 0.5s and padded both ends with
  #    fixed sleeps, costing ~19s of dead wait even after /exit had landed.
  for i in $(seq 100); do
    "$H" agent get "$P" 2>/dev/null | grep -q agent_not_found && break
    sleep 0.2
  done
  # 4+5. Move the pane shell to the repo, relabel the tab, boot a fresh claude natively.
  "$H" pane run "$P" "cd $(printf %q "$R") && clear" >/dev/null 2>&1
  [ -n "$T" ] && "$H" tab rename "$T" "🔍 $L · session" >/dev/null 2>&1
  "$H" agent start claude --kind claude --pane "$P" >/dev/null 2>&1
' _ "$HERDR_BIN" "$PANE" "$TAB" "$REPO" "$LABEL" >/dev/null 2>&1 &
disown

echo "switch: this tab swaps to [$LABEL] as soon as this turn ends — end the turn now."
