#!/usr/bin/env bash
# db-describe-first-guard.sh — PreToolUse "describe-first" guard for the db MCP server.
#
# Enforces CLAUDE.md's hard gate: before the FIRST query against a shared prod/mirror table
# (serp_*/darklaunch/Laravel/Odoo/retool/wishdesk/manage), a describe_table / list_tables /
# knowledge lookup for that table must have run earlier in the SAME session. This is the
# mechanical backstop for the schema-guessing friction that pure recall keeps failing to fix.
#
# Reads the PreToolUse hook JSON on stdin. Emits a permissionDecision of "deny" when a
# mcp__db__query_database call names a GATED table that has NOT been described this session;
# otherwise prints nothing (allow). Pairs with the PostToolUse recorder db-record-described.sh,
# which populates ~/.claude/db-described/<session_id>.
#
# WHY "deny" (not "ask"): this session runs defaultMode=bypassPermissions, under which a hook
# "ask" is SWALLOWED (auto-allows) — only "deny" is still enforced (per the CC hooks docs,
# "PreToolUse hooks fire before any permission-mode check … deny blocks even in bypassPermissions").
# So "ask" would be a no-op here. "deny" is soft in practice: the message names the exact table
# and tells you to run describe_table, then re-issue the query — that IS the intended behavior.
#
# Design choices (see the scoping notes in the PR):
#   - Only GATED databases are checked; `local` (dev sqlite/Docker) is exempt.
#   - query_database_from_file is exempt (curated SQL on disk, not the ad-hoc guess queries).
#   - CTE names are subtracted; serp_ prefix is normalized on both sides.
#   - Fail-OPEN: any parse/marker error allows the query (a guard bug must never wedge queries).

set -uo pipefail

MARKER_DIR="$HOME/.claude/db-described"

# Databases whose schema is institutional knowledge (the friction zone). `local` is NOT here.
GATED_DBS="wishdesk wishdesk_dev laravel_live odoo odoo_staging retool serp_staging_replica serp_prod_replica serp_staging_darklaunch serp_prod_darklaunch live_darklaunch_db serp_app manage"

allow() { exit 0; }  # print nothing => allow

deny() {
  # $1 = reason shown to Jack. deny is the only decision enforced under bypassPermissions.
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}' 2>/dev/null
  exit 0
}

input="$(cat 2>/dev/null || true)"
[ -n "$input" ] || allow

tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null || true)"

# Self-filter: only the inline-SQL query tool. Exempt query_database_from_file (SQL on disk)
# and every non-query db tool.
case "$tool_name" in
  *query_database_from_file*) allow ;;
  *db__query_database*) : ;;
  *) allow ;;
esac

database="$(printf '%s' "$input" | jq -r '.tool_input.database // ""' 2>/dev/null || true)"
query="$(printf '%s' "$input" | jq -r '.tool_input.query // ""' 2>/dev/null || true)"
[ -n "$database" ] || allow
[ -n "$query" ] || allow

# Gate only the shared prod/mirror DBs.
gated=0
for db in $GATED_DBS; do
  [ "$database" = "$db" ] && gated=1 && break
done
[ "$gated" = "1" ] || allow

# Resolve the session id (same pattern as the recorder / tab-title hook).
sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"
[ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-}"
[ -n "$sid" ] || allow   # no session id => can't track => don't block
sid="$(printf '%s' "$sid" | tr -c 'A-Za-z0-9._-' '_')"
marker="$MARKER_DIR/$sid"

# Extract the real base tables referenced by the query (python3: FROM/JOIN/UPDATE/INTO,
# minus CTE names, normalized). The parser lives in a sibling file so no backtick-bearing
# python is nested inside a $(...) command substitution (bash mis-parses that). Fail-open.
parser="$(dirname "$0")/db-extract-tables.py"
if [ -f "$parser" ]; then
  tables="$(QUERY="$query" python3 "$parser" 2>/dev/null || true)"
else
  tables=""   # parser missing => fail open (allow)
fi

# No real tables named (SELECT 1, SELECT NOW(), SHOW ...) => nothing to gate.
[ -n "$tables" ] || allow

# If the session marked list_tables ("*") for schema exploration, treat all as satisfied.
if [ -f "$marker" ] && grep -qxF '*' "$marker" 2>/dev/null; then
  allow
fi

# Which named tables were NOT described this session?
missing=""
while IFS= read -r t; do
  [ -n "$t" ] || continue
  if [ -f "$marker" ] && grep -qxF "$t" "$marker" 2>/dev/null; then
    continue
  fi
  missing="${missing:+$missing, }$t"
done <<EOF
$tables
EOF

[ -n "$missing" ] || allow

deny "describe-first guard: no describe_table/list_tables/knowledge lookup ran this session for: ${missing} (db: ${database}). Run mcp__db__describe_table on it (or mcp__knowledge__search_knowledge), then re-issue the query. This prevents the schema-guessing that has been the #1 recurring friction — see CLAUDE.md 'HARD GATE before the FIRST query'."
