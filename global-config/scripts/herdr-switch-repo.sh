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
#   1. herdr agent wait <pane> --until idle          (invoking turn finished)
#   2. SIGINT the outgoing claude PROCESS (pid from pane process-info)  (hard-quit)
#   3. poll pane process-info until claude leaves the foreground        (shell back)
#   4. herdr pane run <pane> "cd <repo>"             (pane shell moves to the repo)
#   5. herdr agent start claude --kind claude --pane <pane>   (fresh claude, waits ready)
#
# WHY the process-signal + process-info approach (measured, 2026-08-19):
#   - "/exit" submitted as a prompt (herdr agent prompt) does NOT reliably quit claude,
#     and claude's graceful exit is slow — the swap ate ~20s of dead wait.
#   - The real killer was DETECTION lag: even after SIGKILL drops the claude process in
#     0.05s, `herdr agent get` keeps reporting the agent ALIVE for >10s. So polling
#     `agent get` for agent_not_found always hit its ceiling regardless of poll cadence.
#   - `pane process-info` reflects the OS process table instantly, so we signal the pid
#     directly and poll process-info: claude leaves the foreground in ~0.5s, shell is back,
#     and `agent start` boots the new session (~4s incl. MCP servers). ~20s → ~5s.
#   - We discard the outgoing session anyway, so skipping its graceful /exit (transcript
#     flush + Stop hooks) is intentional.
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

# Python helper: read `herdr pane process-info` JSON on stdin, print the pid of the
# foreground `claude` process, or "none" if the foreground is already back at the shell.
# Kept single-quoted (no shell interpolation) and using single-quoted Python string
# literals so no " needs escaping — see ~/CLAUDE.md on python-in-heredoc quoting.
HELPER="$(mktemp -t herdr-switch-fgpid.XXXXXX.py)"
cat >"$HELPER" <<'PY'
import json, sys
try:
    procs = json.load(sys.stdin)['result']['process_info']['foreground_processes']
except Exception:
    print('none'); sys.exit(0)
for p in procs:
    if p.get('argv0') == 'claude':
        print(p.get('pid') or 'none'); break
else:
    print('none')
PY

nohup bash -c '
  H="$1"; P="$2"; T="$3"; R="$4"; L="$5"; HELPER="$6"
  fgpid() { "$H" pane process-info --pane "$P" 2>/dev/null | python3 "$HELPER" 2>/dev/null; }

  # 1. Wait for the invoking claude turn to finish (idle = at its prompt). Bounded.
  "$H" agent wait "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true

  # 2. HARD-QUIT the outgoing claude by SIGNALLING ITS PROCESS (see header for why the
  #    prompt/send-keys/agent-get approaches all failed). SIGINT first (claude quits
  #    cleanly on it and the shell returns in ~0.5s); escalate to SIGKILL if it lingers.
  PID="$(fgpid)"
  if [ -n "$PID" ] && [ "$PID" != none ]; then
    kill -INT "$PID" 2>/dev/null || true
    # 3. Poll PROCESS-INFO (reflects the OS instantly, unlike agent get) until claude
    #    leaves the foreground. ~2-3 ticks in practice; ceiling is a safety bound.
    gone=""
    for i in $(seq 25); do
      cur="$(fgpid)"
      if [ "$cur" = none ] || [ "$cur" != "$PID" ]; then gone=1; break; fi
      sleep 0.2
    done
    # Still there after ~5s? Force it.
    if [ -z "$gone" ]; then
      kill -KILL "$PID" 2>/dev/null || true
      for i in $(seq 15); do
        cur="$(fgpid)"
        if [ "$cur" = none ] || [ "$cur" != "$PID" ]; then break; fi
        sleep 0.2
      done
    fi
  fi

  # 4. Move the pane shell to the repo and relabel the tab.
  "$H" pane run "$P" "cd $(printf %q "$R") && clear" >/dev/null 2>&1
  [ -n "$T" ] && "$H" tab rename "$T" "🔍 $L · session" >/dev/null 2>&1

  # 5. Boot a fresh claude — but `agent start` requires the pane to be AT its interactive
  #    shell prompt, and the cd/clear from step 4 may still be running. Retry a few times
  #    (agent start is a no-op-safe call that just fails if the shell is busy) until it
  #    reports the agent started. Without this the very first call raced the cd and the
  #    swap silently left a bare shell (measured 2026-08-19).
  for i in $(seq 15); do
    out="$("$H" agent start claude --kind claude --pane "$P" --timeout 30000 2>&1)"
    case "$out" in *agent_started*) break;; esac
    sleep 0.4
  done
  rm -f "$HELPER" 2>/dev/null || true
' _ "$HERDR_BIN" "$PANE" "$TAB" "$REPO" "$LABEL" "$HELPER" >/dev/null 2>&1 &
disown

echo "switch: this tab swaps to [$LABEL] as soon as this turn ends — end the turn now."
