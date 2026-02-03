# Discoveries Documentation Index

This directory contains institutional knowledge from research sessions, saved for future reference and semantic search.

## Current Projects

### Phase 4 Kit Migration (February 2026)

Latest research findings on Laravel kit architecture and Odoo integration.

**Read First**: [PHASE4-DISCOVERIES-README.md](./PHASE4-DISCOVERIES-README.md)

**6 Critical Discoveries**:

1. Laravel Kit Architecture (P4 CRITICAL)
2. Component Inventory Flow (P4 CRITICAL)
3. Current One-Way Odoo Sync (P4 BLOCKER)
4. Migration Scope (P4 CRITICAL)
5. Stock Move Sync Gap (P4 BLOCKER)
6. Kits vs BOMs Mismatch (P3 HIGH)

**Files**:

- `phase4-kit-discoveries.json` - Structured discovery data
- `PHASE4-DISCOVERIES-README.md` - Detailed documentation
- `../scripts/save-phase4-kit-discoveries.ts` - Logger script
- `../scripts/sync-phase4-discoveries-to-qdrant.ts` - Qdrant sync

**To Search**: In Claude Code, use:

```
mcp__discoveries__search_discoveries { query: "phase 4" }
```

---

### PO System Migration

Related findings on purchase order and billing system migration.

**File**: `po-system-migration-discoveries.json`

**To Search**:

```
mcp__discoveries__search_discoveries { query: "purchase order" }
```

---

## How Discoveries Work

### What Are Discoveries?

Discoveries are structured knowledge captured during research sessions:

- Database schema insights
- Architecture patterns
- Integration behaviors
- Blocking issues and gotchas
- Solutions and workarounds

### Why Save Them?

1. **Build institutional knowledge** - Future sessions can benefit
2. **Enable semantic search** - Find related insights by topic
3. **Track blocking issues** - Identify problems early
4. **Document decisions** - Explain why choices were made

### How to Save Discoveries

In any Claude Code session:

```
mcp__discoveries__add_discovery {
  title: "Brief title",
  source: "exploration|code_review|database_query|manual",
  sourceDatabase: "laravel_local|odoo|sugarwish|...",
  tableName: "table_name (optional)",
  description: "Detailed explanation",
  type: "fact|relationship|pattern|anomaly|insight",
  priority: 1-4,
  tags: ["tag1", "tag2"]
}
```

**CRITICAL**: Always log discoveries from database research sessions.

See `../.claude/rules/db-discoveries.md` for detailed guidelines.

### How to Search Discoveries

In any Claude Code session:

```
mcp__discoveries__search_discoveries { query: "search term" }
```

Examples:

- "Laravel inventory sync"
- "Odoo BOM structure"
- "stock move XML-RPC"
- "component orders"
- "phantom BOM"

---

## File Organization

```
docs/
├── DISCOVERIES-INDEX.md (you are here)
├── PHASE4-DISCOVERIES-README.md (Phase 4 kit migration)
├── phase4-kit-discoveries.json (structured data)
├── po-system-migration-discoveries.json (PO/billing)
└── ... other discovery files
```

---

## Most Recent Research Sessions

1. **Phase 4 Kit Migration** (Feb 2, 2026)
   - 6 discoveries about Laravel kits, inventory flow, Odoo sync
   - Priority: P3-P4 (critical blockers)
   - Status: Ready for implementation planning

2. **PO System Migration** (Earlier session)
   - Financial reporting, payment status, billing patterns
   - Status: Integrated into planning

---

## Next Steps for Phase 4

To continue Phase 4 implementation:

1. Sync discoveries to Qdrant:

   ```bash
   npx tsx scripts/sync-phase4-discoveries-to-qdrant.ts
   ```

2. Review critical blockers:
   - No Laravel → Odoo stock.move sync
   - component_orders lacks odoo_sync field
   - 482 negative inventory records in Odoo
   - Architectural mismatch (kits vs BOMs)

3. Plan implementation:
   - XML-RPC integration (highest priority)
   - Schema changes (odoo_sync field)
   - Parent/child component relationships
   - Data cleanup and validation

See `PHASE4-DISCOVERIES-README.md` for detailed checklist.

---

## Related Documentation

- `../.claude/rules/db-discoveries.md` - Discovery logging guidelines
- `../CLAUDE.md` - Project architecture and conventions
- `../README.md` - If it exists

---

_Last Updated: February 2, 2026_
