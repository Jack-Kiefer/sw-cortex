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

Every remote DB behind the `jump.sugarwish.com` bastion routes through it — the
MCP server sets the tunnel(s) up automatically. That's the private AWS RDS
(`wishdesk`, `laravel_live`) **and** the Hetzner hosts (`serp_app`, `serp_test`,
`manage`, `wishdesk_dev`), because the Hetzner firewall now trusts only the
bastion. One tunnel (`tunnelKey`) is opened per distinct remote host — DBs that
share a host share a tunnel (RDS `wishdesk`+`laravel_live`; Hetzner
`serp_app`+`serp_test`) — all using the same bastion SSH creds
(`LIVE_SSH_USER`/`LIVE_SSH_KEY_PATH`, the per-user `jump` login, not the old
shared `forge`/replit key). Only the public cloud hosts (Odoo/Retool over SSL)
still connect **directly**; the local Docker DBs (`serp_local_prod`,
`serp_local_staging`, `laravel_local`) hit `127.0.0.1:3307`. `LIVE_SSH_TUNNEL=false`
disables all tunnels (forces every DB direct — only works while a firewall still
permits it).

## Connection Pooling

MCP servers use connection pooling. Don't worry about connection management.

## Local Task Database

The task management system uses local SQLite (`tasks/tasks.db`). This is the only writable database in the system.
