#!/usr/bin/env bash
# agent-budget.sh — decide which provider should run a DELEGATED agent.
#
# Reads both weekly limits and prints a routing verdict. Consumed at spawn time
# by /go and by research fan-outs, so subagents land on whichever subscription
# has headroom, preserving Claude for the main session (and for cutover week).
#
#   claude   — Claude has room (or Codex is just as full); spawn on Claude
#   codex    — Claude is tight AND Codex has headroom; delegate to `codex exec`
#   split    — middle ground; Codex has room, so prefer it for cheap fan-out
#
# codex/split are only ever chosen when Codex genuinely has headroom — if both
# lanes are near their ceiling the verdict falls back to `claude`, since routing
# to an equally-full Codex helps nobody.
#
# Usage:
#   agent-budget.sh            # human-readable one-liner + verdict
#   agent-budget.sh --json     # machine-readable, for scripts
#   agent-budget.sh --verdict  # just the word, for `if` statements
#   agent-budget.sh --reserve  # force `codex` regardless of usage (cutover mode)
#
# WHY reset time matters: 96% with a day left is not the same as 96% with six
# days left. The raw percentage alone would treat them identically, so the
# verdict is weighted by how soon the window resets — near-ceiling right before
# a reset is far less dire than near-ceiling with most of the week to go.
#
# Claude's number comes from a cache the statusline writes (it is the only place
# rate_limits.seven_day is exposed). A STALE cache is a wrong verdict, not a
# missing one, so anything older than CACHE_MAX_AGE is treated as unknown.

set -uo pipefail

CACHE="$HOME/.claude/usage-cache.json"
CACHE_MAX_AGE=900            # 15 min; the statusline repaints far more often
CODEX_QUOTA="$(dirname "$0")/codex-quota.py"
CODEX_CACHE="$HOME/.claude/codex-usage-cache.json"
CODEX_CACHE_TTL=300          # the RPC costs ~0.6-0.8s; don't pay it per call

MODE=human
RESERVE=0
for arg in "$@"; do
  case "$arg" in
    --json)    MODE=json ;;
    --verdict) MODE=verdict ;;
    --reserve) RESERVE=1 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
  esac
done

now=$(date +%s)

# ── Claude: read the statusline cache, honouring staleness ──
claude_pct=""; claude_reset=""; claude_state=unknown
if [[ -f "$CACHE" ]]; then
  cache_age=$(( now - $(stat -f %m "$CACHE" 2>/dev/null || echo 0) ))
  if (( cache_age <= CACHE_MAX_AGE )); then
    claude_pct=$(jq -r '.claude_weekly_percent // empty' "$CACHE" 2>/dev/null)
    claude_reset=$(jq -r '.claude_weekly_resets_at // empty' "$CACHE" 2>/dev/null)
    [[ -n "$claude_pct" ]] && claude_state=fresh
  else
    claude_state=stale
  fi
fi

# ── Codex: live RPC, cached briefly; falls back to rollout files internally ──
codex_pct=""; codex_reset=""; codex_state=unknown
if [[ -f "$CODEX_CACHE" ]] \
   && (( now - $(stat -f %m "$CODEX_CACHE" 2>/dev/null || echo 0) < CODEX_CACHE_TTL )); then
  codex_raw=$(cat "$CODEX_CACHE" 2>/dev/null)
elif [[ -x "$CODEX_QUOTA" ]] || command -v python3 >/dev/null 2>&1; then
  # No `timeout` on stock macOS; codex-quota.py enforces its own deadline.
  codex_raw=$(python3 "$CODEX_QUOTA" 2>/dev/null)
  [[ -n "$codex_raw" ]] && printf '%s' "$codex_raw" > "$CODEX_CACHE" 2>/dev/null
fi
if [[ -n "${codex_raw:-}" ]] && [[ "$(jq -r '.ok // false' <<<"$codex_raw" 2>/dev/null)" == "true" ]]; then
  codex_pct=$(jq -r '.used_percent // empty' <<<"$codex_raw" 2>/dev/null)
  codex_reset=$(jq -r '.resets_at // empty' <<<"$codex_raw" 2>/dev/null)
  [[ -n "$codex_pct" ]] && codex_state=$(jq -r '.source // "ok"' <<<"$codex_raw" 2>/dev/null)
fi

# ── Reset-aware pressure ──
# Scale usage by how much of the window remains. Burning 96% with 25h left on a
# 7-day window is near its natural end; the same 96% with six days left is a
# genuine problem. hours_left/168 gives the fraction of the window still to
# cover, so pressure rises as remaining time grows.
pressure() {
  local pct="$1" reset="$2"
  [[ -z "$pct" ]] && { echo ""; return; }
  if [[ -z "$reset" || "$reset" == "null" ]]; then echo "$pct"; return; fi
  awk -v p="$pct" -v r="$reset" -v n="$now" 'BEGIN{
    h=(r-n)/3600; if(h<0)h=0; if(h>168)h=168;
    # Weight 0.88 (reset imminent) .. 1.12 (most of the week left). The band is
    # deliberately NARROW: an imminent reset should SOFTEN a high number, never
    # rescue it. A wider discount let 97%-with-25h-left fall to 66 and route to
    # Claude anyway, defeating the point of the router.
    w=0.88+(h/168)*0.24;
    v=p*w; if(v>100)v=100;
    # A genuinely near-ceiling lane stays near-ceiling regardless of timing.
    if(p>=95 && v<90) v=90;
    printf "%.0f", v;
  }'
}
claude_pressure=$(pressure "$claude_pct" "$claude_reset")
codex_pressure=$(pressure "$codex_pct" "$codex_reset")

# Codex is only a valid target when it genuinely has room. At/above this
# pressure it is no safer than Claude, so routing to it just shoves work onto an
# equally full lane — the whole point of the router is to use the subscription
# WITH headroom. Checked in BOTH the codex-ceiling and the split band below;
# previously only the former looked at Codex, so a `split` verdict routed to
# Codex without ever checking how full it was (it happily suggested Codex at
# 93%). CODEX_FULL sits a touch below the reset-discounted number a maxed lane
# shows — e.g. 93% used discounts to ~88 pressure — so a near-ceiling Codex is
# correctly seen as "no room". Unknown Codex (empty pressure) is NOT room:
# without a number we cannot claim headroom, so we keep the work on Claude.
CODEX_FULL=85
codex_has_room() { [[ -n "$codex_pressure" ]] && (( codex_pressure < CODEX_FULL )); }

# ── Verdict ──
reason=""
if (( RESERVE )); then
  verdict=codex; reason="--reserve: forcing Codex to protect Claude headroom"
elif [[ "$claude_state" == "stale" ]]; then
  verdict=split; reason="Claude usage cache is stale (>15m); routing conservatively"
elif [[ -z "$claude_pressure" ]]; then
  # Absent data must NOT default to Claude: if the cache has never been written
  # (or the session is mid-cold-start) we may well be at 97% and not know it.
  # Unknown is treated like the middle band — cheap fan-out to Codex — so a
  # missing number can never silently spend the lane we are trying to protect.
  verdict=split; reason="no Claude usage data yet; routing conservatively"
elif (( claude_pressure >= 85 )); then
  if codex_has_room; then
    verdict=codex; reason="Claude weekly is under pressure; delegate to Codex"
  else
    verdict=claude; reason="both lanes near their ceiling; Codex is no safer"
  fi
elif (( claude_pressure >= 65 )); then
  if codex_has_room; then
    verdict=split; reason="Claude is warming up; send cheap fan-out to Codex"
  else
    verdict=claude; reason="Claude is warming up but Codex has no headroom either; staying on Claude"
  fi
else
  verdict=claude; reason="Claude has headroom"
fi

fmt() { [[ -n "$1" ]] && echo "$1%" || echo "n/a"; }
hours_left() {
  [[ -z "$1" || "$1" == "null" ]] && { echo "?"; return; }
  awk -v r="$1" -v n="$now" 'BEGIN{h=(r-n)/3600; if(h<0)h=0; printf "%.0fh", h}'
}

case "$MODE" in
  verdict) echo "$verdict" ;;
  json)
    jq -n --arg v "$verdict" --arg reason "$reason" \
          --arg cp "$claude_pct" --arg cpr "$claude_pressure" \
          --arg cs "$claude_state" --arg crs "$claude_reset" \
          --arg xp "$codex_pct" --arg xpr "$codex_pressure" \
          --arg xs "$codex_state" --arg xrs "$codex_reset" \
      '{verdict:$v, reason:$reason,
        claude:{used_percent:$cp, pressure:$cpr, state:$cs, resets_at:$crs},
        codex:{used_percent:$xp, pressure:$xpr, state:$xs, resets_at:$xrs}}'
    ;;
  *)
    printf 'claude %s (in %s) · codex %s (in %s) → %s\n  %s\n' \
      "$(fmt "$claude_pct")" "$(hours_left "$claude_reset")" \
      "$(fmt "$codex_pct")"  "$(hours_left "$codex_reset")" \
      "$verdict" "$reason"
    ;;
esac
