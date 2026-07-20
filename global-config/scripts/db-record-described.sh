#!/usr/bin/env bash
# db-record-described.sh — PostToolUse marker writer for the describe-first DB guard.
#
# Pairs with db-describe-first-guard.sh (PreToolUse). Whenever a schema-lookup tool runs
# — mcp__db__describe_table, mcp__db__list_tables, or mcp__knowledge__search_knowledge —
# this records what was looked up into a per-session marker file so the PreToolUse guard
# can tell "a describe/KB lookup already ran this session" for a given table.
#
# Reads the PostToolUse hook JSON on stdin. Records to ~/.claude/db-described/<session_id>,
# one normalized token per line:
#   - describe_table  -> the table name (serp_ prefix stripped for dual-name matching)
#   - list_tables     -> "*"  (blanket: "you looked at this DB's schema")
#   - knowledge search -> best-effort table-like tokens pulled from the query text
# Always exits 0 and prints nothing — a PostToolUse hook must never block.

set -uo pipefail

MARKER_DIR="$HOME/.claude/db-described"

input="$(cat 2>/dev/null || true)"
[ -n "$input" ] || exit 0

tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null || true)"

# Resolve the session id (same pattern as tab-title-hook.sh / repo-write-guard.sh).
sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"
[ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-}"
[ -n "$sid" ] || exit 0

# Sanitize the session id for use as a filename (defensive — ids are uuid-ish already).
sid="$(printf '%s' "$sid" | tr -c 'A-Za-z0-9._-' '_')"

mkdir -p "$MARKER_DIR" 2>/dev/null || exit 0
marker="$MARKER_DIR/$sid"

# Normalize a table token: lowercase, strip quotes/backticks and a leading schema., strip
# a leading serp_ so a describe on `stock_move` satisfies a query on `serp_stock_move`.
normalize() {
  printf '%s' "$1" \
    | tr 'A-Z' 'a-z' \
    | tr -d '`"'"'" \
    | sed -E 's/^[a-z0-9_]+\.//; s/^serp_//'
}

case "$tool_name" in
  *describe_table*)
    tbl="$(printf '%s' "$input" | jq -r '.tool_input.table // empty' 2>/dev/null || true)"
    [ -n "$tbl" ] && printf '%s\n' "$(normalize "$tbl")" >> "$marker"
    ;;
  *list_tables*)
    # No single table — mark a blanket sentinel so any query in a looked-at DB is satisfied.
    printf '%s\n' "*" >> "$marker"
    ;;
  *search_knowledge*)
    # No structured table field — best-effort: pull table-like tokens (contain "_") from
    # the free-text query and record their normalized forms. Never fails the hook.
    q="$(printf '%s' "$input" | jq -r '.tool_input.query // empty' 2>/dev/null || true)"
    if [ -n "$q" ]; then
      printf '%s' "$q" \
        | tr 'A-Z' 'a-z' \
        | grep -oE '[a-z][a-z0-9_]*_[a-z0-9_]+' 2>/dev/null \
        | while IFS= read -r tok; do
            [ -n "$tok" ] && printf '%s\n' "$(normalize "$tok")"
          done >> "$marker"
    fi
    ;;
esac

exit 0
