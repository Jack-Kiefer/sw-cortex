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
#
# Scan the PROMPT ONLY, never the description. The description is incidental prose
# ("Post-push hook liveness probe", "Research the deploy pipeline"), and including
# it made the guard fail open on read-only work: a probe whose description merely
# contained the word "push" sailed through while Claude sat at 98%.
#
# Match an IMPERATIVE opening a sentence or list item ("Edit the module.",
# "- Commit the change") rather than the bare verb anywhere in free text, so
# "research how the deploy works" or "explain why the fix broke" stay routable.
# "push" and "fix" are dropped entirely — they read as narration far more often
# than as instructions, and the explicit-intent pass below catches the real cases.
write_verbs='edit|modify|rewrite|refactor|implement|patch|commit|migrate|deploy|delete|rename'
if printf '%s' "$prompt" | grep -qiE "(^|[.!?]['\"]?[[:space:]]+|(^|[[:space:]])[-*][[:space:]]+|[[:space:]][0-9]+[.)][[:space:]]+)($write_verbs)\b"; then
  exit 0
fi

# Belt and braces: unambiguous write intent phrased as an instruction about files
# or repos, wherever it appears in the prompt.
# `git push` must be phrased as something to RUN ("then git commit", "run git push"),
# not merely named — "find where the git push step is implemented" is read-only and
# belongs on Codex like any other search.
if printf '%s' "$prompt" | grep -qiE '\b(open|land|ship|submit)\b[^.]{0,40}\b(pr|pull request)\b|(^|[[:space:]])(run|then|and|execute)[[:space:]]+git[[:space:]]+(commit|push|merge)\b|\bwrite[[:space:]]+(it|the|a|an|new)?[[:space:]]*(file|test|tests|code|patch|script)\b|\b(apply|make)[[:space:]]+the[[:space:]]+(fix|change|edit|patch)\b'; then
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
