#!/usr/bin/env bash
# herdr-switch-repo.sh <repo-root> [follow-on-prompt] [tab-title] — switch THIS Herdr
# pane's claude session to another repo, COLD (fresh process), optionally running a
# slash command in the new session.
#
# Used by /go (both bare "/go serp" and task "/go fix X") when the session runs inside a
# Herdr pane: instead of opening a new tab and closing this one, the SAME pane swaps in
# place — the current claude exits, the pane shell cd's to the repo, and a fresh claude
# boots there (same tab, same position).
#
# WHY COLD, NOT `/cd` (measured 2026-09-19): an in-process `/cd` warm-swap reloads cwd +
# the destination CLAUDE.md + its .mcp.json MCP servers, but does NOT re-scan the
# destination repo's project SLASH COMMANDS (`<repo>/.claude/commands/`) OR its project
# HOOKS — both stay registered from the ORIGIN repo. Symptoms after `/cd` hub→SERP:
# SERP's 61 project commands never populate the slash menu, and a sw-cortex Stop hook
# still fires inside the SERP session (stale-registration crash). There is no documented
# in-process re-scan trigger for commands/hooks — only a FRESH claude startup scans them.
# So a repo-changing /go must cold-boot. (Warm `/cd` remains fine for a same-repo
# working-dir nudge, but /go always crosses repos.) The lost hub context is acceptable:
# /go's whole job is to hand this pane off to the destination repo.
#
# Built on Herdr's native agent primitives, driven by a DETACHED helper (the invoking
# claude turn must end before the swap can run — the helper waits for that):
#   1. herdr agent wait <pane> --until idle          (invoking turn finished)
#   2. SIGINT the outgoing claude PROCESS (pid from pane process-info)  (hard-quit)
#   3. poll pane process-info until claude leaves the foreground        (pid gone)
#   3b. poll process-info until NO claude is foreground (fgpid==none)    (shell ready)
#   4+4b. send-keys ctrl+u (flush stray input) then herdr pane run <pane> "cd <repo>",
#        RE-ISSUED each tick but ONLY when the foreground is a shell, until
#        `herdr pane get`'s foreground_cwd == <repo> (+ export CLAUDE_GO_TITLE if given)
#   5. herdr agent start claude --kind claude --pane <pane>   (fresh claude, waits ready)
#   6. if a follow-on prompt was given: herdr agent prompt <pane> "<prompt>" --wait
#      (the fresh session already scanned the repo's commands at boot, so a project
#      command like /serp-analyze resolves immediately — no registration race, no sleep)
#
# WHY step 4b — the CWD GATE (measured 2026-09-20): without it, `agent start` (step 5)
# could fire while the `cd <repo>` from step 4 was still in flight, booting the fresh
# claude in the ORIGIN cwd (sw-cortex) instead of the repo. Symptom: the swap "worked"
# (old claude killed, new claude booted, pgid changed) but the new session came up in the
# hub, so the follow-on `/serp-analyze` — a SERP-only project command — errored with
# `Unknown command: /serp-analyze` and the prompt-send itself failed. The step-5 retry
# loop only guards against a BUSY shell, never against a wrong CWD, so it never caught
# this. Gating `agent start` on `pane get`'s foreground_cwd == <repo> closes the race
# deterministically. (Server log 12:05: line 695 pgid 65334 → line 716 pgid 68599, new
# claude at cwd sw-cortex, then agent.prompt outcome=error.)
#
# WHY step 3b — the SHELL-READY GATE (measured 2026-09-21): the cwd gate (4b) can only pass
# once the `cd` actually RAN, and `pane run` only runs a typed command when a ready shell owns
# the terminal. The first re-issue-the-cd fix still fired cd on every tick regardless of what
# owned the foreground, so on a slow MCP-heavy teardown every cd was typed into a still-present
# (or still-dying) claude and LOST — foreground_cwd stayed at the hub for the whole window, the
# cwd gate exhausted (gate=timed-out), and the fresh claude booted in sw-cortex. Real-world hit:
# a /go SERPY swap on 2026-09-21 timed out this way and left the follow-on /serp-analyze unrun.
# Fix: wait for fgpid==none (no foreground claude ⇒ the shell has the terminal) BEFORE typing,
# and inside the retry loop skip typing on any tick where claude is still foreground — so the cd
# only ever lands in a real shell.
#
# WHY the ctrl+u input-buffer clear (measured 2026-09-21, the SECOND miss): even with a ready
# shell (3b), the SIGINT that killed the outgoing claude can leave a PARTIAL KEYSTROKE in the
# PTY line buffer. `herdr pane run` types "<cmd>\n" AFTER that junk, so the shell actually runs
# a corrupted command — observed as "pprintf …" / "pcd /repo && clear" (a stray leading `p`):
# command-not-found, the cd never runs, foreground_cwd stays at the hub, and the gate times out
# with a READY shell (so 3b passed but the swap still failed). Fix: send-keys ctrl+u (the shell
# kill-line; herdr itself uses ctrl+u to clear its input) right before every typed command, so
# each one lands on a CLEAN prompt line. Best-effort (|| true) — a failed clear never blocks.
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
PROMPT="${2:-}"   # optional: a slash command / prompt to run in the fresh session
TITLE="${3:-}"    # optional: CLAUDE_GO_TITLE for the fresh session's tab floor
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

# Second helper: read `herdr pane get` JSON on stdin, print the pane's foreground_cwd
# (the shell/claude working dir), or empty. Same file-not-inline pattern as HELPER so no
# quoting collides with the single-quoted detached `bash -c` block below.
CWDHELPER="$(mktemp -t herdr-switch-panecwd.XXXXXX.py)"
cat >"$CWDHELPER" <<'PY'
import json, sys
try:
    print(json.load(sys.stdin)['result']['pane']['foreground_cwd'] or '')
except Exception:
    print('')
PY

nohup bash -c '
  H="$1"; P="$2"; T="$3"; R="$4"; L="$5"; HELPER="$6"; PROMPT="$7"; TITLE="$8"; CWDHELPER="$9"
  fgpid() { "$H" pane process-info --pane "$P" 2>/dev/null | python3 "$HELPER" 2>/dev/null; }
  # foreground_cwd of the pane (the shell/claude cwd, per `herdr pane get`), or empty.
  panecwd() { "$H" pane get "$P" 2>/dev/null | python3 "$CWDHELPER" 2>/dev/null; }
  # Discard any stray bytes sitting on the shell input line before we TYPE a command.
  # When the outgoing claude is SIGINT-killed it can leave a partial keystroke in the PTY
  # line buffer; `herdr pane run` then types "<cmd>\n" AFTER that junk, so the shell runs
  # e.g. "pcd /repo && clear" (command not found) and the cd never takes — the observed
  # "pprintf"/"pcd" corruption (2026-09-21). ctrl+u is the shell kill-line (herdr uses it
  # for exactly this); send it so every command lands on a CLEAN prompt.
  clearline() { "$H" pane send-keys "$P" ctrl+u >/dev/null 2>&1 || true; }

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

  # 3b. SHELL-READY GATE — wait until the pane foreground is a SHELL, not claude, before
  #     typing anything into it. THIS is the fix for the recurring gate=timed-out (measured
  #     2026-09-21): `herdr pane run` just TYPES "<cmd>\n" into the pane, and it only EXECUTES
  #     when a ready interactive shell owns the terminal. Steps 2-3 only guarantee the OLD
  #     claude PID is gone from the foreground — on a slow, MCP-heavy teardown the terminal
  #     can still be settling (a claude child/wrapper briefly foreground, or the shell not yet
  #     redrawn) when step 4 starts firing `cd`. Every cd typed into that not-yet-a-shell
  #     terminal is LOST, foreground_cwd never becomes the repo, the cwd gate exhausts, and
  #     the ⚠️ warning fires with the fresh claude booted in the ORIGIN cwd. So: poll fgpid
  #     until it reports `none` (no foreground claude = shell has the terminal) BEFORE any cd.
  #     Bounded generously — a heavy teardown legitimately takes several seconds.
  for i in $(seq 50); do
    [ "$(fgpid)" = none ] && break
    sleep 0.2
  done

  # 4 + 4b. Move the pane shell to the repo, RE-ISSUING the cd until foreground_cwd confirms
  #    it took — but ONLY type when the foreground is a shell (fgpid==none), never into a
  #    still-present claude (see 3b). `agent start` has NO --cwd, so the shell must cd there
  #    first; if we boot claude before the cd lands it comes up in the ORIGIN cwd and a
  #    follow-on project command like /serp-analyze errors. (TITLE given: export
  #    CLAUDE_GO_TITLE so the fresh claude adopts that floor at SessionStart and its analyze
  #    rider owns the title — no hard-rename. Bare /go: plain repo-floor rename, once.)
  cd_cmd="cd $(printf %q "$R") && clear"
  [ -n "$TITLE" ] && cd_cmd="export CLAUDE_GO_TITLE=$(printf %q "$TITLE") ; $cd_cmd"
  [ -z "$TITLE" ] && [ -n "$T" ] && "$H" tab rename "$T" "🔍 $L · session" >/dev/null 2>&1
  in_repo=""
  for i in $(seq 60); do
    if [ "$(panecwd)" = "$R" ]; then in_repo=1; break; fi
    # Only type the cd when a shell actually owns the terminal — typing into a lingering
    # claude prompt box is exactly how the cd got lost and the gate timed out.
    if [ "$(fgpid)" = none ]; then
      clearline                                   # flush any stray buffered input first
      "$H" pane run "$P" "$cd_cmd" >/dev/null 2>&1
    fi
    sleep 0.3
  done

  # 5. Boot a fresh claude — but `agent start` requires the pane to be AT its interactive
  #    shell prompt, and the cd/clear from step 4 may still be running. Retry a few times
  #    (agent start is a no-op-safe call that just fails if the shell is busy) until it
  #    reports the agent started. Without this the very first call raced the cd and the
  #    swap silently left a bare shell (measured 2026-08-19).
  started=""
  for i in $(seq 15); do
    out="$("$H" agent start claude --kind claude --pane "$P" --timeout 30000 2>&1)"
    case "$out" in *agent_started*) started=1; break;; esac
    sleep 0.4
  done

  # 5b. FINAL CWD CHECK — after the fresh claude booted, confirm it really came up in the
  #     repo (foreground_cwd now tracks the new session cwd). If the gate above timed out
  #     OR the boot still landed outside the repo, do NOT inject the follow-on prompt into
  #     a wrong-cwd session — that is exactly the /serp-analyze-in-the-hub failure. Instead
  #     leave a visible line in the pane so the swap fails LOUDLY, not silently.
  boot_cwd="$(panecwd)"
  if [ "$boot_cwd" != "$R" ]; then
    gated="gate=$([ -n "$in_repo" ] && echo hit || echo timed-out)"
    clearline
    "$H" pane run "$P" "printf %s\\\\n \"⚠️ /go swap: fresh session did not land in $R (cwd=$boot_cwd, $gated) — cd there and rerun the command manually.\"" >/dev/null 2>&1 || true
    rm -f "$HELPER" "$CWDHELPER" 2>/dev/null || true
    exit 0
  fi

  # 6. If a follow-on prompt was given (a task /go: /serp-analyze … / /research … ), send
  #    it into the now-fresh session. The cold boot already scanned the repo project
  #    commands, so a project slash command resolves on the first try — no sleep/race
  #    (that race only afflicts the in-process /cd warm-swap this cold path replaces).
  #    --wait --until idle keeps it a discrete turn; the analyze command then owns the tab
  #    via its own set-tab-title rider.
  if [ -n "$started" ] && [ -n "$PROMPT" ]; then
    "$H" agent prompt "$P" "$PROMPT" --wait --until idle --timeout 60000 >/dev/null 2>&1 || true
  fi
  rm -f "$HELPER" "$CWDHELPER" 2>/dev/null || true
' _ "$HERDR_BIN" "$PANE" "$TAB" "$REPO" "$LABEL" "$HELPER" "$PROMPT" "$TITLE" "$CWDHELPER" >/dev/null 2>&1 &
disown

if [ -n "$PROMPT" ]; then
  echo "switch: this tab cold-boots into [$LABEL] and runs the command as soon as this turn ends — end the turn now."
else
  echo "switch: this tab swaps to [$LABEL] as soon as this turn ends — end the turn now."
fi
