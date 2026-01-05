# Database Access Rules

## Critical: Read-Only Production Access
All production database queries MUST be read-only. Never execute:
- INSERT, UPDATE, DELETE
- DROP, TRUNCATE, ALTER
- Any DDL statements

## Database Mapping

| Database | Type | MCP Tool | Purpose |
|----------|------|----------|---------|
| WishDesk | MySQL | `mcp__wishdesk-db__query` | WishDesk ticketing |
| Live SugarWish | MySQL | `mcp__sugarwish-live-db__query` | Production orders |
| Odoo | PostgreSQL | `mcp__odoo-db__query` | ERP data |
| Retool | PostgreSQL | `mcp__retool-db__query` | Analytics/dashboards |

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
