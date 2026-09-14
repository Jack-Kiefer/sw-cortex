#!/usr/bin/env bash
# Claude Code statusline: worktree │ branch + git state │ server dot + ports │ DB env │ model │ ctx │ cost │ 5h limit
# Receives session JSON on stdin; prints one line.

input=$(cat)
# \x1f separator: empty fields must not collapse (tab is whitespace, so
# consecutive tabs merge in `read` and later fields shift left a slot)
IFS=$'\x1f' read -r cwd model ctx rl5 rl5reset rl7 rl7reset sname < <(echo "$input" | jq -r '[
  (.workspace.current_dir // .cwd // ""),
  (.model.display_name // ""),
  (.context_window.used_percentage | if . == null then "" else round end),
  (.rate_limits.five_hour.used_percentage | if . == null then "" else round end),
  (.rate_limits.five_hour.resets_at // ""),
  (.rate_limits.seven_day.used_percentage | if . == null then "" else round end),
  (.rate_limits.seven_day.resets_at // ""),
  (.session_name // "")
] | join("")')
[[ -n "$cwd" && -d "$cwd" ]] || cwd=$(pwd)

# ── Cache the weekly limit for the agent router ──
# rate_limits.seven_day only exists on THIS stdin payload — no CLI flag or API
# exposes it, so a standalone script cannot fetch it. The statusline repaints
# constantly, so writing it here keeps a fresh copy on disk for agent-budget.sh.
# mtime is the freshness signal: the router treats a stale file as unknown.
if [[ -n "$rl7" ]]; then
  _uc="$HOME/.claude/usage-cache.json"
  printf '{"claude_weekly_percent":%s,"claude_weekly_resets_at":"%s","written_at":%s}\n' \
    "$rl7" "$rl7reset" "$(date +%s)" > "$_uc".tmp 2>/dev/null \
    && mv -f "$_uc".tmp "$_uc" 2>/dev/null
fi

DIM=$'\033[2m'; CYAN=$'\033[36m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; R=$'\033[0m'
SEP=" ${DIM}·${R} "

root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$root" ]]; then
  echo "${DIM}${cwd/#$HOME/~}${R}"
  exit 0
fi

# ── Worktree label ──
case "$root" in
  */.worktrees/*)        label="${GREEN}🌳 ${root##*/.worktrees/}${R}" ;;
  */.claude/worktrees/*) label="${GREEN}🌳 ${root##*/.claude/worktrees/}${R}" ;;
  *)                     label="${CYAN}$(basename "$root")${R}" ;;
esac

# ── Branch + dirty + ahead/behind ──
branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
[[ -n "$branch" ]] || branch="detached @ $(git -C "$cwd" rev-parse --short HEAD 2>/dev/null)"
gitbits=""
porcelain=$(git -C "$cwd" status --porcelain 2>/dev/null)
dirty=0
[[ -n "$porcelain" ]] && dirty=$(echo "$porcelain" | wc -l | tr -d ' ')
[[ "$dirty" -gt 0 ]] && gitbits+=" ${YELLOW}✚$dirty${R}"
if ab=$(git -C "$cwd" rev-list --left-right --count '@{upstream}...HEAD' 2>/dev/null); then
  behind=${ab%%	*}; ahead=${ab##*	}
  [[ "$ahead"  -gt 0 ]] && gitbits+=" ${CYAN}↑$ahead${R}"
  [[ "$behind" -gt 0 ]] && gitbits+=" ${RED}↓$behind${R}"
fi

# ── Dev-server dot + ports + DB routing (from this checkout's .env) ──
server=""
if [[ -f "$root/.env" ]]; then
  fe=$(grep -E '^FRONTEND_PORT=' "$root/.env" | tail -1 | cut -d= -f2)
  if [[ -n "$fe" ]]; then
    if lsof -nP -iTCP:"$fe" -sTCP:LISTEN -t >/dev/null 2>&1; then dot="${GREEN}●${R}"; else dot="${DIM}○${R}"; fi
    server="${dot} http://localhost:$fe"
  fi
fi

# ── Model │ context │ cost │ 5h rate limit (from session JSON) ──
session=""
# This session's mesh NAME (e.g. Kate) — the address peers use with
# message_session. Read from the pane's Herdr label, which the sessions MCP
# auto-assigns; falls back to the raw pane id when unnamed (or herdr is down),
# so the row always identifies the session somehow. Cached per pane for 60s —
# the status line repaints constantly and each `herdr pane get` is a socket
# round-trip.
if [[ -n "$HERDR_PANE_ID" ]]; then
  _nc="${TMPDIR:-/tmp}/.claude-pane-name-${HERDR_PANE_ID//:/_}"
  if [[ -f "$_nc" ]] && [[ $(( $(date +%s) - $(stat -f %m "$_nc" 2>/dev/null || echo 0) )) -lt 60 ]]; then
    _pane_name=$(<"$_nc")
  else
    _pane_name=$(herdr pane get "$HERDR_PANE_ID" 2>/dev/null       | sed -n 's/.*"label":"\([^"]*\)".*/\1/p')
    [[ -z "$_pane_name" ]] && _pane_name="$HERDR_PANE_ID"
    printf '%s' "$_pane_name" > "$_nc" 2>/dev/null
  fi
  session+="${CYAN}${_pane_name}${R}${SEP}"
fi
[[ -n "$model" ]] && session+="$model"
if [[ -n "$ctx" ]]; then
  if   [[ "$ctx" -ge 85 ]]; then cc=$RED
  elif [[ "$ctx" -ge 60 ]]; then cc=$YELLOW
  else cc=$GREEN; fi
  session+="${SEP}${cc}ctx ${ctx}%${R}"
fi
if [[ -n "$rl5" ]]; then
  if [[ "$rl5" -ge 85 ]]; then rc=$RED; else rc=$DIM; fi
  reset=""
  [[ -n "$rl5reset" ]] && reset=" ↻ $(date -r "$rl5reset" +%-l:%M%p | tr 'APM' 'apm')"
  session+="${SEP}${rc}${rl5}%${reset}${R}"
fi
# Weekly (7-day) limit — the ceiling that actually gates a heavy week.
# Lower thresholds than the 5h window: a weekly burn is far harder to recover from.
if [[ -n "$rl7" ]]; then
  if   [[ "$rl7" -ge 90 ]]; then wc=$RED
  elif [[ "$rl7" -ge 75 ]]; then wc=$YELLOW
  else wc=$DIM; fi
  wreset=""
  [[ -n "$rl7reset" ]] && wreset=" ↻ $(date -r "$rl7reset" +%-a\ %-l%p | tr 'APM' 'apm')"
  session+="${SEP}${wc}wk ${rl7}%${wreset}${R}"
fi
# ── Codex/OpenAI weekly limit (cached by agent-budget.sh) ──
# Cache-only by design: the app-server RPC costs ~0.7s and the statusline
# repaints constantly. A missing/stale cache simply prints nothing.
_cxc="$HOME/.claude/codex-usage-cache.json"
if [[ -f "$_cxc" ]]; then
  cx=$(jq -r 'if (.ok // false) then (.used_percent | floor) else empty end' "$_cxc" 2>/dev/null)
  cxreset=$(jq -r 'if (.ok // false) then (.resets_at // empty) else empty end' "$_cxc" 2>/dev/null)
  if [[ -n "$cx" ]]; then
    if   [[ "$cx" -ge 90 ]]; then xc=$RED
    elif [[ "$cx" -ge 75 ]]; then xc=$YELLOW
    else xc=$DIM; fi
    # Codex's weekly window ROLLS — resets_at drifts forward with use rather than
    # landing on a fixed weekly boundary like Claude's. Shown in the same day+hour
    # form as `wk`, but read it as approximate, not a deadline.
    xreset=""
    [[ -n "$cxreset" && "$cxreset" != "null" ]] \
      && xreset=" ↻ $(date -r "$cxreset" +%-a\ %-l%p 2>/dev/null | tr 'APM' 'apm')"
    session+="${SEP}${xc}gpt ${cx}%${xreset}${R}"
  fi
fi
summary_line=""
if [[ -n "$sname" ]]; then
  [[ ${#sname} -gt 80 ]] && sname="${sname:0:80}…"
  summary_line="${DIM}${sname}${R}"
fi

# ── Render as a card: header rail, body rows, summary footer ──
rows=()
rows+=("${label}${SEP}${branch}${gitbits}")
[[ -n "$server" ]] && rows+=("$server")
[[ -n "$session" ]] && rows+=("$session")
[[ -n "$summary_line" ]] && rows+=("$summary_line")

n=${#rows[@]}
if [[ $n -eq 1 ]]; then
  echo "${rows[0]}"
else
  for i in "${!rows[@]}"; do
    if   [[ $i -eq 0 ]];        then rail="${DIM}╭─${R}"
    elif [[ $i -eq $((n-1)) ]]; then rail="${DIM}╰─${R}"
    else                             rail="${DIM}│ ${R}"
    fi
    echo "$rail ${rows[$i]}"
  done
fi
