# Database Access Rules

## Critical: Read-Only Production Access

All production database queries MUST be read-only. Never execute:

- INSERT, UPDATE, DELETE
- DROP, TRUNCATE, ALTER
- Any DDL statements

## Database Mapping

These are the exact keys wired in `src/services/databases.ts` (the server the
hub's `mcp__db__*` tools call). MCP server changes need a Claude Code restart to
take effect.

| Database           | Type       | MCP Database Name    | Purpose                                                                           |
| ------------------ | ---------- | -------------------- | --------------------------------------------------------------------------------- |
| WishDesk           | MySQL      | `wishdesk`           | WishDesk ticketing (via SSH tunnel)                                               |
| WishDesk Dev       | MySQL      | `wishdesk_dev`       | WishDesk dev/staging (direct)                                                     |
| Laravel Live       | MySQL      | `laravel_live`       | **Production** SugarWish e-commerce/orders (AWS RDS, via SSH tunnel)              |
| Manage             | MySQL      | `manage`             | Laravel **staging** (direct)                                                      |
| Odoo               | PostgreSQL | `odoo`               | ERP data (prod, direct/SSL)                                                       |
| Odoo Staging       | PostgreSQL | `odoo_staging`       | ERP data (staging, direct/SSL)                                                    |
| Retool             | PostgreSQL | `retool`             | Analytics/dashboards (direct/SSL)                                                 |
| SERP Local Prod    | MySQL      | `serp_local_prod`    | Local Docker (serp-mysql, `127.0.0.1:3307`, devuser) — local SERP prod schema     |
| SERP Local Staging | MySQL      | `serp_local_staging` | Local Docker (same container) — local SERP staging schema                         |
| Laravel Local      | MySQL      | `laravel_local`      | Local Docker (same container) — 13 Laravel catalog tables, schema-only            |
| SERP App           | MySQL      | `serp_app`           | **Live/prod SERP app DB** on Hetzner (`LIVE_DARKLAUNCH_DB_*` host, DB `serp_app`) |
| SERP Test          | MySQL      | `serp_test`          | **Staging SERP / darklaunch mirror** on Hetzner (same host, DB `serp_test`)       |

All databases are accessed via unified MCP tools:

- `mcp__db__query_database { database: "...", query: "..." }`
- `mcp__db__query_database_from_file { database: "...", path: "..." }` — for SQL too long to inline (reads the file off disk; must resolve under `~/Desktop/Projects`)
- `mcp__db__list_tables { database: "..." }`
- `mcp__db__describe_table { database: "...", table: "..." }`

## Query Best Practices

### Always Include LIMIT

```sql
SELECT * FROM orders LIMIT 100;  -- Good
SELECT * FROM orders;            -- Bad (could return millions)
```

### Use Specific Columns

```sql
SELECT id, name, email FROM users;  -- Good
SELECT * FROM users;                -- Avoid when possible
```

### Index-Friendly Queries

- Use indexed columns in WHERE clauses
- Avoid functions on indexed columns: `WHERE YEAR(created_at) = 2024` is slow
- Prefer: `WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'`

## SSH Tunnel

Only the two DBs on the private AWS RDS — `wishdesk` and `laravel_live` — route
through the live bastion (a single shared tunnel; the MCP server sets it up
automatically). Every other remote DB (Odoo/Retool cloud over SSL, the Hetzner
`serp_app`/`serp_test` hosts) connects **directly**; the local Docker DBs
(`serp_local_prod`, `serp_local_staging`, `laravel_local`) hit `127.0.0.1:3307`.

## Connection Pooling

MCP servers use connection pooling. Don't worry about connection management.

## Local Task Database

The task management system uses local SQLite (`tasks/tasks.db`). This is the only writable database in the system.
