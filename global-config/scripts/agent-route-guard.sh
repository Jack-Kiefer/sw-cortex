#!/usr/bin/env bash
# agent-route-guard.sh — PreToolUse hook on the `Agent` tool.
#
# Makes the subscription router MECHANICAL instead of advisory. A CLAUDE.md rule
# saying "check the budget before spawning agents" only ENCOURAGES — it gets
# forgotten (it was, within twenty minutes of being written). This hook ENFORCES:
# when Claude's weekly limit is under real pressure, an `Agent` spawn is denied
# and the session is told to shell out to `codex exec` with the same prompt.
#
# A PreToolUse hook cannot REWRITE a tool call — only allow or deny — so the
# redirect rides in the denial reason, which the model sees and acts on.
#
# Wiring (~/.claude/settings.json):
#   "PreToolUse": [{ "matcher": "Agent",
#     "hooks": [{ "type": "command",
#                 "command": "/Users/jackkief/.claude/scripts/agent-route-guard.sh" }] }]
#
# Deliberately NARROW: it fires only on the `codex` verdict, when Claude is
# genuinely near its ceiling. On `claude`, `split`, or any failure it stays
# silent and the spawn proceeds. A guard that blocks subagents in the middle
# band would be intrusive for little gain, and one that blocks them when it is
# broken would be worse than not having it.

set -uo pipefail

input=$(cat)

BUDGET="$(dirname "$0")/agent-budget.sh"
[[ -x "$BUDGET" ]] || exit 0          # not installed → never block

# FAIL OPEN. This runs before every subagent spawn; a bug here must not cost
# Jack the ability to delegate. Any failure means "allow".
verdict=$("$BUDGET" --verdict 2>/dev/null) || exit 0
[[ "$verdict" == "codex" ]] || exit 0

# Escape hatch: a session that must stay on Claude (guarded writes, a task that
# genuinely needs Claude's tooling) can set this for its own spawns.
[[ -n "${CLAUDE_AGENT_ROUTE_OVERRIDE:-}" ]] && exit 0

status=$("$BUDGET" 2>/dev/null | head -1)
prompt=$(printf '%s' "$input" | jq -r '.tool_input.prompt // ""' 2>/dev/null)
desc=$(printf '%s' "$input" | jq -r '.tool_input.description // ""' 2>/dev/null)
atype=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // "general-purpose"' 2>/dev/null)

# Writes must NOT go to Codex: repo-write-guard.sh has no Codex-side equivalent
# yet, so a Codex agent editing SERP/SWAC would be outside the write guard.
# Heuristic on the prompt — imperfect, but it errs toward keeping work on Claude,
# which is the safe direction.
if printf '%s %s' "$desc" "$prompt" | grep -qiE '\b(edit|write|commit|push|patch|refactor|implement|fix|migrat|deploy|delete|rename)\b'; then
  exit 0
fi

reason="Claude's weekly limit is under pressure — route this agent to Codex instead.

  $status

This spawn was blocked by agent-route-guard.sh so delegated work lands on the
subscription with headroom, preserving Claude for this session (and for cutover
week). Re-run the SAME task as a Codex fan-out:

  printf '%s' \"<the agent prompt>\" | codex exec --skip-git-repo-check \\
      -C \"\$PWD\" --sandbox read-only

Notes:
  • The prompt goes in on STDIN; --skip-git-repo-check is needed outside a trusted dir.
  • --sandbox read-only for research/review; the guard already lets write-shaped
    tasks through to Claude, since Codex has no write-guard port yet.
  • A Codex agent inherits NO ~/CLAUDE.md, MCP servers, or KB gate — carry the
    KB-search requirement and any repo conventions INLINE in the prompt.
  • Needs Claude for a real reason? Set CLAUDE_AGENT_ROUTE_OVERRIDE=1 and respawn.
  • Blocked agent type was: $atype"

jq -n --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'
exit 0
