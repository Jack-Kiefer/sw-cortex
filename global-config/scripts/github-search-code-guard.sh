#!/bin/bash
# PreToolUse guard for mcp__github__search_code.
#
# Blocks the ONE mechanical mistake that accounts for every parse failure in this
# cluster: GitHub qualifiers (repo:/path:/language:/filename:/org:/user:) written
# INSIDE the `query` string. `repo` is a separate tool PARAMETER, not part of the
# query grammar, so an embedded qualifier returns
# ERROR_TYPE_QUERY_PARSING_FATAL every time.
#
# Prose in ~/CLAUDE.md and a session memory failed to close this over four
# windows, so it is enforced mechanically here.
#
# Exit 0 = allow. A deny is emitted as PreToolUse JSON on stdout.

input=$(cat)
query=$(printf '%s' "$input" | jq -r '.tool_input.query // ""' 2>/dev/null)

[ -z "$query" ] && exit 0

if printf '%s' "$query" | grep -qE '(repo|path|language|filename|org|user|extension|in):'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: your `query` string contains a GitHub qualifier (repo:/path:/language:/filename:/org:/user:). Those are NOT part of the query grammar here — `repo` is a SEPARATE tool PARAMETER. Send {query: \"OneDistinctiveTerm\", repo: \"sugarwish-laravel\"} instead of {query: \"term repo:owner/name\"}. ALSO: SERP, SWAC and sw-cortex are checked out locally under ~/Desktop/Projects — for those repos never use search_code at all; use rg or the Explore agent. On any parse failure, simplify to ONE distinctive term; never add qualifiers."
    }
  }'
  exit 0
fi

exit 0
