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
# ALSO blocks search_code against a locally-checked-out WRITABLE repo (SERP,
# SWAC, sw-cortex) passed via the `repo` PARAMETER — that's the 79x recurring
# gap: a clean query with no embedded qualifier still slips through when
# `repo` names a repo we have on disk, where rg/Explore is correct instead.
#
# Exit 0 = allow. A deny is emitted as PreToolUse JSON on stdout.

input=$(cat)
query=$(printf '%s' "$input" | jq -r '.tool_input.query // ""' 2>/dev/null)
repo=$(printf '%s' "$input" | jq -r '.tool_input.repo // ""' 2>/dev/null)

if [ -n "$query" ] && printf '%s' "$query" | grep -qE '(repo|path|language|filename|org|user|extension|in):'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: your `query` string contains a GitHub qualifier (repo:/path:/language:/filename:/org:/user:). Those are NOT part of the query grammar here — `repo` is a SEPARATE tool PARAMETER. Send {query: \"OneDistinctiveTerm\", repo: \"sugarwish-laravel\"} instead of {query: \"term repo:owner/name\"}. ALSO: SERP, SWAC and sw-cortex are checked out locally under ~/Desktop/Projects — for those repos never use search_code at all; use rg or the Explore agent. On any parse failure, simplify to ONE distinctive term; never add qualifiers."
    }
  }'
  exit 0
fi

if [ -n "$repo" ]; then
  # Strip any 'owner/' prefix, then match the bare repo name, case-insensitively,
  # as a WHOLE-STRING match (never a substring) so sugarwish-laravel/sugarwish-odoo/
  # sugarwish-infrastructure/SWIRL/livery/swirl/sw-design never trip it.
  repo_name=$(printf '%s' "$repo" | sed 's#^.*/##')
  repo_name_lc=$(printf '%s' "$repo_name" | tr '[:upper:]' '[:lower:]')

  case "$repo_name_lc" in
    serp|swac|sw-cortex)
      jq -n --arg repo "$repo" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("BLOCKED: `repo` (\($repo)) is a locally-checked-out WRITABLE repo (SERP, SWAC, and sw-cortex are cloned under ~/Desktop/Projects). Never use mcp__github__search_code on a repo you have on disk — use rg (ripgrep) or the Explore agent instead, which are faster and see uncommitted/local state that search_code cannot. search_code is for READ-ONLY remote repos (sugarwish-laravel, sugarwish-odoo, SWIRL, sugarwish-infrastructure, livery, sw-design) that are not checked out locally.")
        }
      }'
      exit 0
      ;;
  esac
fi

exit 0
