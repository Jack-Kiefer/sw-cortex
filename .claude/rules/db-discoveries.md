# Database Discovery Documentation

## ⛔ MANDATORY: Save Discoveries After ANY DB Learning

**STOP. After ANY `mcp__db__*` tool call, ask yourself:**

> "Did I learn something new about this database or table?"

If YES → Call `mcp__task-manager__add_discovery()` IMMEDIATELY, before responding to the user.

**This is not optional.** Every piece of knowledge gained should be saved for future sessions.

---

## When to Save (ALWAYS save when you learn...)

- **Table structure** - After `describe_table`, save what the table is for and key columns
- **Column meanings** - What a field actually represents (not obvious from name)
- **Relationships** - Foreign keys, how tables connect
- **Status/enum values** - What different status values mean
- **Business logic** - Workflows, calculations, rules encoded in schema
- **Naming patterns** - Prefixes, conventions (e.g., `swcrm_*`, `ec_*`)
- **Integration flags** - Fields that sync with other systems (Odoo, Avatax, etc.)
- **Data patterns** - Common values, distributions, anomalies
- **Useful queries** - Complex queries that were helpful

## When NOT to Save

- Repeated lookups of already-documented tables
- Simple row counts with no insight
- Test/debug queries that didn't reveal anything

---

## Maintaining Discoveries (Update or Delete)

Discoveries can become outdated or contain errors. **Always check existing discoveries before adding new ones** to avoid duplicates and keep the knowledge base accurate.

### Before Adding: Search First

```
mcp__task-manager__search_discoveries({ query: "topic you're about to document" })
```

If relevant discoveries exist, decide: **update** or **delete and recreate**.

### When to UPDATE an Existing Discovery

Use `update_discovery` when:

- **Minor corrections** - Typos, clarifications, small additions
- **Same topic, better understanding** - You learned more about the same thing
- **Wrong details but right context** - The table/database is correct but description was wrong
- **Priority/type change** - Reclassifying importance or category

```
mcp__task-manager__update_discovery({
  id: "discovery-uuid-here",
  description: "Corrected description with accurate info",
  priority: 3  // Upgraded importance
})
```

### When to DELETE and Recreate

Use `delete_discovery` + `add_discovery` when:

- **Completely wrong** - Discovery is about the wrong table/database entirely
- **Superseded** - New discovery replaces it with fundamentally different info
- **Consolidating** - Merging multiple discoveries into one comprehensive one

```
mcp__task-manager__delete_discovery({ id: "wrong-discovery-uuid" })
mcp__task-manager__add_discovery({ ... correct info ... })
```

### Updating All Fields

All discovery fields are now updatable:

| Field            | When to Update                         |
| ---------------- | -------------------------------------- |
| `title`          | Better summary of the insight          |
| `description`    | More accurate/complete explanation     |
| `type`           | Reclassify (fact → relationship, etc.) |
| `priority`       | Change importance (1-4)                |
| `tags`           | Add/remove categorization              |
| `source`         | Correct the source type                |
| `sourceDatabase` | Fix if wrong database was recorded     |
| `sourceQuery`    | Update with better/correct SQL         |
| `tableName`      | Fix if wrong table was recorded        |
| `columnName`     | Fix if wrong column was recorded       |

### Periodic Review

When exploring a table you've documented before:

1. Search for existing discoveries about that table
2. Verify they're still accurate
3. Update outdated info or delete obsolete discoveries
4. Add new discoveries for anything not yet documented

---

## How to Save Discoveries

```
mcp__task-manager__add_discovery({
  title: "Brief descriptive title",
  source: "database_query",
  sourceDatabase: "wishdesk|sugarwish|odoo|retool",
  sourceQuery: "the SQL query that led to this",
  tableName: "table_name",           // Include for table-specific knowledge
  columnName: "column_name",         // Include for column-specific knowledge
  description: "What you learned and why it matters",
  type: "pattern|fact|relationship|anomaly|insight",
  priority: 1-4                      // 1=low, 4=critical
})
```

### Discovery Types

| Type           | Use for                                 |
| -------------- | --------------------------------------- |
| `fact`         | Concrete knowledge about a table/column |
| `relationship` | How tables connect to each other        |
| `pattern`      | Naming conventions, repeated structures |
| `anomaly`      | Unexpected data, inconsistencies        |
| `insight`      | Business logic, workflow understanding  |

---

## Examples

### After describing a table:

```
mcp__task-manager__add_discovery({
  title: "ec_order table - ecard fulfillment",
  source: "database_query",
  sourceDatabase: "sugarwish",
  sourceQuery: "DESCRIBE ec_order",
  tableName: "ec_order",
  description: "Tracks physical shipment of ecard orders. Key fields: giftcards_card_id (links to card), sw_fulfill (SugarWish vs vendor), production_slip_batch (batch processing), avatax_status (tax integration)",
  type: "fact",
  priority: 2
})
```

### After discovering a relationship:

```
mcp__task-manager__add_discovery({
  title: "ec_order links to giftcards table",
  source: "database_query",
  sourceDatabase: "sugarwish",
  sourceQuery: "SELECT * FROM ec_order WHERE giftcards_card_id = 123",
  tableName: "ec_order",
  columnName: "giftcards_card_id",
  description: "ec_order.giftcards_card_id -> giftcards.id. One giftcard can have multiple ec_orders (reshipping, replacements)",
  type: "relationship",
  priority: 2
})
```

### After finding a pattern:

```
mcp__task-manager__add_discovery({
  title: "WishDesk Gmail integration tables",
  source: "database_query",
  sourceDatabase: "wishdesk",
  sourceQuery: "SHOW TABLES LIKE 'swcrm_z_gmail%'",
  description: "20+ swcrm_z_gmail_* tables handle full email: messages, drafts, labels, attachments, signatures, scheduling, sync",
  type: "pattern",
  priority: 2
})
```

---

## Checklist Before Responding

After any database exploration session:

- [ ] Did I run `describe_table`? → Save what I learned about the table
- [ ] Did I see new column types/enums? → Save their meanings
- [ ] Did I discover how tables relate? → Save the relationship
- [ ] Did I find unexpected data? → Save the anomaly
- [ ] Did I understand business logic? → Save the insight

**If you didn't save anything, you probably missed something. Look again.**
