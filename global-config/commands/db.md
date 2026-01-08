# Command: db

Query Jack's databases (read-only).

## Usage

```
/db list                           # List available databases
/db tables [database]              # List tables in a database
/db describe [database] [table]    # Show table schema
/db query [database] [sql]         # Run a SELECT query
```

## Available Databases

- `wishdesk` - WishDesk MySQL (ticketing)
- `sugarwish` - SugarWish MySQL (production orders)
- `odoo` - Odoo PostgreSQL (ERP)
- `retool` - Retool PostgreSQL (analytics)

## Examples

```
/db list
/db tables sugarwish
/db describe odoo sale_order
/db query sugarwish SELECT * FROM orders WHERE status = 'pending' LIMIT 10
```

---

## description: Query databases - list, describe, query (read-only)

# Database Command: $ARGUMENTS

Parse the arguments to determine the action:

**If "list"**: Use `mcp__db__list_databases` to show available databases.

**If "tables [database]"**: Use `mcp__db__list_tables` to list tables.

**If "describe [database] [table]"**: Use `mcp__db__describe_table` to show schema.

**If "query [database] [sql]"**: Use `mcp__db__query_database` to run the query.

IMPORTANT:

- All queries are READ-ONLY
- Always include LIMIT if not present
- Never run INSERT, UPDATE, DELETE, DROP, etc.

After querying, check if this reveals new knowledge about the database structure.
If so, save a discovery using `mcp__task-manager__add_discovery`.

Format output as a clean table for query results.
