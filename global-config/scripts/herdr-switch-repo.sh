#!/usr/bin/env bash
# herdr-switch-repo.sh <repo-root> [follow-on-prompt] [tab-title] — switch THIS Herdr
# pane's agent session to another repo IN PLACE via the agent's own `/cd`, then optionally
# run a slash command / prompt in the same session.
#
# Used by /go (both bare "/go serp" and task "/go fix X") when the session runs inside a
# Herdr pane: the SAME session stays alive and warm-swaps into the repo — no process is
# killed, no shell is puppeteered.
#
# WHY HOT-BOOT (`/cd`), NOT A COLD RE-BOOT (verified 2026-09-21 on Claude Code v2.1.278):
#   For a long time this script cold-booted (SIGINT the outgoing claude, cd the bare shell,
#   agent-start a fresh claude) on the belief that an in-process `/cd` did NOT re-scan the
#   destination repo's project SLASH COMMANDS or HOOKS. On v2.1.278 that belief is FALSE and
#   was measured wrong:
#     - After `/cd <repo>`, the destination repo's project commands DO populate the menu
#       (`/serp-analyze`, `/creating-pr`, `/env-config`, … all show as `(project)`).
#     - The `.mcp.json` MCP servers reload (`mcp__serp-prod`, `mcp__serp-orm` become live).
#     - cwd + CLAUDE.md + the statusline re-resolve to the destination (`SERP · dev`).
#     - Project HOOKS re-register from the destination too.
#   The cold-boot's whole justification is gone, and it brought a parade of terminal-race
#   bugs (stray-keystroke corruption "pprintf"/"pcd", agent_name_taken collisions when
#   another claude was live, cd-into-a-settling-shell timeouts). Hot-boot has NONE of those:
#   it is one `herdr agent prompt "/cd <repo>"` into the SAME session.
#
#   KNOWN CAVEAT (harness limitation, not ours): `/cd` does NOT re-set $CLAUDE_PROJECT_DIR,
#   so a destination project hook that interpolates "$CLAUDE_PROJECT_DIR/.claude/hooks/…"
#   resolves to the ORIGIN repo's path and may print a non-fatal "No such file" error on the
#   first Stop after the swap. It is cosmetic (the hooks in question are telemetry that
#   exit 0 when unconfigured). Filed as Claude Code feedback 2026-09-21. If it ever matters,
#   fix the destination hook to self-locate instead of trusting $CLAUDE_PROJECT_DIR.
#
# Built on Herdr's native agent primitives, driven by a DETACHED helper (the invoking agent
# turn must END before the swap can run — the helper waits for that, then enqueues /cd + the
# prompt as the session's NEXT turns):
#   1. herdr agent wait <pane> --until idle          (invoking turn finished)
#   2. herdr agent prompt <pane> "/cd <repo>" --wait (warm-swap into the repo, same session)
#   3. if a follow-on prompt was given: herdr agent prompt <pane> "<prompt>" --wait
#      (project commands are already re-scanned by the /cd above, so /serp-analyze resolves)
#
# CLAUDE vs CODEX: both hot-swap with `/cd` — the only difference is Codex cannot run our
# Claude Code slash-analyze commands (/serp-analyze / /research), so for a Codex pane the
# follow-on prompt is sent as a PLAIN prompt (the caller already builds the right text).
# Detection is not needed here: `/cd` is valid in both agents and the follow-on prompt is
# opaque text either way. (Codex `/cd` reloads AGENTS.md; its MCP reload is unverified.)
#
# The invoking session MUST end its turn immediately after running this script — the /cd and
# the follow-on run as this SAME session's subsequent turns once this turn goes idle.

set -euo pipefail

REPO="${1:-}"
PROMPT="${2:-}"   # optional: a slash command / prompt to run after the /cd
TITLE="${3:-}"    # optional: tab title to set once we've swapped (bare /go only; a task
                  # /go's analyze command owns its own title via its rider)
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
  H="$1"; P="$2"; T="$3"; R="$4"; L="$5"; PROMPT="$6"; TITLE="$7"

  # 1. Wait for the invoking agent turn to finish (idle = at its prompt). Bounded — if it
  #    never idles we still proceed; the /cd just queues for whenever it does.
  "$H" agent wait "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true

  # 2. Warm-swap THIS session into the repo with the agent-native /cd. No kill, no shell
  #    puppeteering — the session reloads cwd + CLAUDE.md + .mcp.json MCP servers + project
  #    slash commands + hooks in place (see header). --wait so /cd fully lands before the
  #    follow-on prompt is sent (project commands must be re-scanned first).
  "$H" agent prompt "$P" "/cd $R" --wait --until idle --timeout 120000 >/dev/null 2>&1 || true

  # 2b. Bare /go (no follow-on): set a repo-floor tab title so the swapped tab reads sensibly.
  #     Use tab rename (a direct herdr call — no fragile in-session command injection). A task
  #     /go re-titles via its analyze command rider, so we only set here when there is NO
  #     follow-on prompt.
  if [ -z "$PROMPT" ] && [ -n "$T" ]; then
    "$H" tab rename "$T" "🔍 ${TITLE:-$L · session}" >/dev/null 2>&1 || true
  fi

  # 3. Follow-on prompt (a task /go: /serp-analyze … / /research … , or a raw task for Codex).
  #    /cd (step 2) already re-scanned the repo project commands, so a project slash command
  #    resolves on the first try — no registration race, no sleep. --wait keeps it a discrete
  #    turn; an analyze command owns the tab title via its own set-tab-title rider.
  if [ -n "$PROMPT" ]; then
    "$H" agent prompt "$P" "$PROMPT" --wait --until idle --timeout 60000 >/dev/null 2>&1 || true
  fi
' _ "$HERDR_BIN" "$PANE" "$TAB" "$REPO" "$LABEL" "$PROMPT" "$TITLE" >/dev/null 2>&1 &
disown

if [ -n "$PROMPT" ]; then
  echo "switch: this tab warm-swaps (/cd) into [$LABEL] and runs the command as soon as this turn ends — end the turn now."
else
  echo "switch: this tab warm-swaps (/cd) into [$LABEL] as soon as this turn ends — end the turn now."
fi
