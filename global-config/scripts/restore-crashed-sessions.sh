#!/usr/bin/env bash
# restore-crashed-sessions.sh — rebuild the Herdr tabs lost when the machine crashed
# (or Herdr's server died), each resumed onto its ORIGINAL Claude conversation.
#
# Usage:
#   restore-crashed-sessions.sh [--dry-run] [--max N] [--since HOURS]
#
#   --dry-run     Print what would be restored; create nothing.
#   --max N       Restore at most N sessions (default 12; newest first).
#   --since H     Only sessions whose last activity is within H hours (default 24).
#
# How it works — nothing here depends on today's crash:
#   Herdr persists its layout to ~/.config/herdr/session.json (tab titles + cwds), and
#   every Claude conversation is a .jsonl under ~/.claude/projects/<slug>/. The tab-title
#   log dir (~/.claude/tab-titles/<session-id>.log) is what ties them together: its last
#   line is the same "--did" trail the tab was showing. So we walk the tab-title logs
#   newest-first, resolve each to its project dir, and reopen it with `claude --resume`.
#
#   Sessions already live in Herdr are skipped, so this is safe to re-run.

set -euo pipefail

DRY=0; MAX=12; SINCE_H=24
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --max)     shift; MAX="${1:-12}"; shift ;;
    --since)   shift; SINCE_H="${1:-24}"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

HERDR_BIN="$(command -v herdr 2>/dev/null || echo "$HOME/.local/bin/herdr")"
[ -x "$HERDR_BIN" ] || { echo "herdr CLI not found" >&2; exit 1; }
if ! "$HERDR_BIN" status >/dev/null 2>&1; then
  echo "herdr server is not running — start it (open Herdr) and re-run." >&2
  exit 1
fi
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }

TT="$HOME/.claude/tab-titles"
PROJ="$HOME/.claude/projects"
[ -d "$TT" ] || { echo "no tab-titles dir at $TT" >&2; exit 1; }

# Panes already running in Herdr — never double-restore one.
LIVE="$("$HERDR_BIN" agent list 2>/dev/null | jq -r '.result.agents[].cwd' 2>/dev/null | sort -u || true)"

json_field() { printf '%s' "$1" | jq -r "[.. | objects | .$2 // empty] | first // empty" 2>/dev/null; }

# Map a project-dir slug back to a real path: the slug is the path with / -> -.
# Ambiguous because real dirs contain '-' too, so verify by existence, longest first.
slug_to_path() { # $1 = slug like -Users-jackkief-Desktop-Projects-SWAC--claude-worktrees-X
  local slug="$1" cand
  cand="$(printf '%s' "$slug" | sed 's|--|/.|g; s|-|/|g')"
  [ -d "$cand" ] && { printf '%s' "$cand"; return; }
  cand="$(printf '%s' "$slug" | sed 's|-|/|g')"
  [ -d "$cand" ] && { printf '%s' "$cand"; return; }
  printf ''
}

label_for() { # $1 = cwd -> the Herdr workspace label (repo name, worktrees included)
  case "$1" in
    */Desktop/Projects/SERP*)      printf 'SERP' ;;
    */Desktop/Projects/SWAC*)      printf 'SWAC' ;;
    */Desktop/Projects/sw-cortex*) printf 'sw-cortex' ;;
    *) basename "$1" ;;
  esac
}

ws_for() { # $1=label $2=cwd
  local id
  id="$("$HERDR_BIN" workspace list 2>/dev/null \
    | jq -r --arg l "$1" '.result.workspaces[] | select(.label == $l) | .workspace_id' 2>/dev/null | head -1)"
  [ -n "$id" ] || id="$(json_field "$("$HERDR_BIN" workspace create --cwd "$2" --label "$1" --no-focus 2>/dev/null)" workspace_id)"
  printf '%s' "$id"
}

restore_one() { # $1=cwd $2=session-id $3=title
  local cwd="$1" sid="$2" title="$3" label ws tab_json tab_id pane_id ls
  label="$(label_for "$cwd")"
  ws="$(ws_for "$label" "$cwd")"
  [ -n "$ws" ] || { printf '  FAIL  %s (no workspace)\n' "$title"; return; }

  tab_json="$("$HERDR_BIN" tab create --workspace "$ws" --cwd "$cwd" \
    --env "CLAUDE_GO_TITLE=$title" --no-focus 2>/dev/null)" || { printf '  FAIL  %s\n' "$title"; return; }
  tab_id="$(json_field "$tab_json" tab_id)"
  pane_id="$(json_field "$tab_json" pane_id)"
  [ -n "$pane_id" ] || { printf '  FAIL  %s (no pane)\n' "$title"; return; }
  [ -n "$tab_id" ] && "$HERDR_BIN" tab rename "$tab_id" "$title" >/dev/null 2>&1 || true

  # Self-deleting launch script so the pane doesn't echo the command; the OSC 0 seed
  # paints the title before claude boots (same shape as launch-repo-session.sh).
  ls="$(mktemp /tmp/restore-launch-XXXXXX)"
  {
    printf 'export CLAUDE_GO_TITLE=%q\n' "$title"
    printf "printf '\\\\033]0;%%s\\\\007' %q\n" "$title"
    printf 'clear\n'
    printf 'claude --resume %q\n' "$sid"
  } > "$ls"
  "$HERDR_BIN" pane run "$pane_id" "source $ls ; rm -f $ls" >/dev/null 2>&1 \
    || { rm -f "$ls"; printf '  FAIL  %s (pane run)\n' "$title"; return; }
  printf '  OK    %-52s %s\n' "${title:0:52}" "$tab_id"
}

CUTOFF=$(( $(date +%s) - SINCE_H * 3600 ))
count=0

# Newest tab-title log first; each is one session that was live in a tab.
while IFS= read -r log; do
  [ -f "$log" ] || continue
  mtime=$(stat -f %m "$log" 2>/dev/null || echo 0)
  [ "$mtime" -ge "$CUTOFF" ] || continue

  sid="$(basename "$log" .log)"
  jsonl="$(find "$PROJ" -name "$sid.jsonl" -maxdepth 2 2>/dev/null | head -1)"
  [ -n "$jsonl" ] || continue                       # no conversation on disk

  cwd="$(slug_to_path "$(basename "$(dirname "$jsonl")")")"
  [ -n "$cwd" ] || continue                         # project dir is gone
  printf '%s\n' "$LIVE" | grep -qxF "$cwd" && continue   # already running

  did="$(tail -1 "$log" 2>/dev/null | sed 's/^[0-9:]* *//')"
  title="$(head -1 "$log" 2>/dev/null | sed 's/^[0-9:]* *//')"
  [ -n "$title" ] || title="$did"
  [ -n "$title" ] || title="🔨 $(basename "$cwd") session"
  [ ${#title} -gt 60 ] && title="${title:0:59}…"

  count=$((count + 1))
  [ "$count" -gt "$MAX" ] && { echo "  … stopping at --max $MAX"; break; }

  if [ "$DRY" = 1 ]; then
    printf '  WOULD %-52s %s\n' "${title:0:52}" "$(basename "$cwd")"
  else
    restore_one "$cwd" "$sid" "$title"
  fi
done < <(ls -t "$TT"/*.log 2>/dev/null)

[ "$count" -eq 0 ] && { echo "Nothing to restore — no crashed sessions in the last ${SINCE_H}h."; exit 0; }
echo
if [ "$DRY" = 1 ]; then
  echo "Dry run — nothing created. Re-run without --dry-run to restore."
else
  echo "Restored $count session(s). Check the Herdr window."
fi
