# Database Access Rules

## Critical: Read-Only Production Access

All production database queries MUST be read-only. Never execute:

- INSERT, UPDATE, DELETE
- DROP, TRUNCATE, ALTER
- Any DDL statements

## Database Mapping

| Database        | Type       | MCP Database Name | Purpose              |
| --------------- | ---------- | ----------------- | -------------------- |
| WishDesk        | MySQL      | `wishdesk`        | WishDesk ticketing   |
| SugarWish       | MySQL      | `sugarwish`       | Production orders    |
| Odoo            | PostgreSQL | `odoo`            | ERP data (prod)      |
| Odoo Staging    | PostgreSQL | `odoo_staging`    | ERP data (staging)   |
| Retool          | PostgreSQL | `retool`          | Analytics/dashboards |
| Laravel Local   | MySQL      | `laravel_local`   | Local Laravel dev    |
| Laravel Staging | MySQL      | `laravel_staging` | Laravel staging      |

All databases are accessed via unified MCP tools:

- `mcp__db__query_database { database: "...", query: "..." }`
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

Remote databases are accessed via SSH tunnel through bastion host. The MCP server handles tunnel setup automatically.

## Connection Pooling

MCP servers use connection pooling. Don't worry about connection management.

## Local Task Database

The task management system uses local SQLite (`tasks/tasks.db`). This is the only writable database in the system.
