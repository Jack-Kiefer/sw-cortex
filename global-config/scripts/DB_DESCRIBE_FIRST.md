# describe-first DB guard

Mechanical backstop for the #1 recurring Claude-Code friction: **SQL schema-guessing** —
firing a query against a shared prod/mirror table with a column that doesn't exist
(`mrp_production.qty_produced`, `stock_move.quantity_done`, `stock_move_line.reserved_qty`,
`odoo_sync_queue_live.origin`, …). That cluster survived **9 straight `/start-day` windows** and
8 memory rewrites because it depended on recall. This makes it mechanical: a `describe_table`
(or KB lookup) must run **before** the first query against a table, in the same session — exactly
CLAUDE.md's "HARD GATE before the FIRST query."

## How it works — two hooks + a marker file

| Script | Hook | Job |
| --- | --- | --- |
| `db-record-described.sh` | **PostToolUse** on `mcp__db__describe_table` / `list_tables` / `mcp__knowledge__search_knowledge` | Records each looked-up table into `~/.claude/db-described/<session_id>` (one normalized token per line; `list_tables` writes a blanket `*`). |
| `db-describe-first-guard.sh` | **PreToolUse** on `mcp__db__query_database` | Extracts the query's base tables (via `db-extract-tables.py`), and **denies** if any *gated* table wasn't recorded this session — the deny message names the table(s). |
| `db-extract-tables.py` | (helper) | Pulls base tables from SQL: `FROM`/`JOIN`/`UPDATE`/`INTO`, minus CTE names, `serp_`-normalized, `information_schema`/`pg_catalog` excluded. Standalone file so no backtick-python nests inside a bash `$(...)`. |

The marker is cleaned up by the existing **SessionEnd** hook (extended to `rm -f` the
`db-described/<sid>` file alongside the tab-title files).

## Why `deny`, not `ask`

The session runs `defaultMode: bypassPermissions`. Per the Claude Code hooks docs, a PreToolUse
hook `"ask"` is **swallowed** under bypass (auto-allows) — only `"deny"` is still enforced
("PreToolUse hooks fire before any permission-mode check … deny blocks even in
bypassPermissions"). So `ask` would be a no-op here. `deny` is soft in practice: it names the
exact table and tells you to `describe_table` it, then re-issue — which is the intended behavior.

## What it does NOT gate (minimal friction)

- **`local` DB** — the dev sqlite/Docker DB (your own schema; no institutional-knowledge trap).
- **Trivial queries** — no `FROM`/`JOIN` (`SELECT 1`, `SELECT NOW()`, `SHOW …`).
- **`information_schema` / `pg_catalog`** — those *are* the schema lookup.
- **CTE names** — `WITH x AS (…)` `x` is not a real table.
- **`query_database_from_file`** — curated SQL on disk, not the ad-hoc guess queries (blind spot:
  the SQL isn't in the tool input, so it's exempted rather than read off disk).
- Fail-**open**: any parse/marker error allows the query — a guard bug must never wedge queries.

Gated DBs: `wishdesk`, `wishdesk_dev`, `laravel_live`, `odoo`, `odoo_staging`, `retool`,
`serp_staging_replica`, `serp_prod_replica`, `serp_staging_darklaunch`, `serp_prod_darklaunch`,
`live_darklaunch_db`, `serp_app`, `manage` — everything except `local`.

## Wiring

Lives in `~/.claude/settings.json` (user-level — the friction is global, the db MCP is a global
server): a PreToolUse entry (matcher `mcp__db__query_database`), a PostToolUse entry (matcher
`mcp__db__describe_table|mcp__db__list_tables|mcp__knowledge__search_knowledge`), and the extended
SessionEnd cleanup. `settings.json` is not part of `sync-global-config.sh`; the three scripts here
are (they sync to `~/.claude/scripts/`). The guard finds its sibling parser via `$(dirname "$0")`,
so all three stay co-located.
