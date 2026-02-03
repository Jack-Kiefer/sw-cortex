# Phase 4 Kit Migration Discoveries

This directory contains critical findings from the Phase 4 kit migration research session (February 2026).

## Overview

Phase 4 aims to make Laravel the source of truth for all product inventories by:

1. Unifying Laravel kit architecture with Odoo BOM logic
2. Building bidirectional inventory sync
3. Migrating 267 phantom BOMs from Odoo to Laravel
4. Consolidating inventory tracking across 3 systems (component_inventory, raw_material_inventory, odoo_inventory)

## Key Findings

### 1. Laravel Kit Architecture (discovery-phase4-1)

- **Items table**: Tracks product selections with parent_sku for component grouping
- **ComponentOrder table**: Tracks physical kit components with location-based inventory
- **Kits table**: Links to buyer_products via buyer_product_id
- **Structure**: No kit_items junction table - composition is denormalized into items table
- **Priority**: CRITICAL (P4)

### 2. Component Inventory Flow (discovery-phase4-2)

- **Mechanism**: ComponentOrder::create() triggers Component::deductInventoryByLocationId()
- **Tracking**: component_inventory pivot table tracks qty by location
- **Location Resolution**: component.location_override → buyer_product.location_id → NULL
- **Equivalence**: component_orders = Odoo stock.move (same semantic meaning)
- **Priority**: CRITICAL (P4)

### 3. Current One-Way Sync (discovery-phase4-3)

- **Current Flow**: Odoo → Laravel via REST API only
- **Missing**: No Laravel → Odoo reverse sync
- **Gap**: No stock.move integration
- **Blocker**: item.odoo_sync flag exists; component_orders lacks sync tracking
- **Status**: MIGRATION BLOCKER (P4)

### 4. Migration Scope (discovery-phase4-4)

- **BOMs**: 977 normal + 267 phantom = 1,244 total active BOMs in Odoo
- **Data Issues**: 482 negative inventory records need cleanup before migration
- **Tables**: Must handle component_inventory, raw_material_inventory, odoo_inventory
- **Model**: ComponentOrder already mirrors stock.move structure (component_id, qty_done, location_id)
- **Priority**: CRITICAL (P4)

### 5. Critical Gap: No Stock Move Sync (discovery-phase4-5)

- **Problem**: Cannot push Laravel inventory changes to Odoo stock.move
- **Solution**: Must build XML-RPC integration to create/update stock.move
- **Prerequisites**:
  1. Add odoo_sync field to component_orders table
  2. Implement XML-RPC API calls to Odoo
  3. Handle reservation system for 24hr pre-pick holds
- **Risk**: Without this, Laravel and Odoo inventories diverge post-migration
- **Status**: MIGRATION BLOCKER (P4)

### 6. Architectural Mismatch (discovery-phase4-6)

- **Laravel Kits**: Fulfillment logic (accessories: mugs, box cards, custom inserts)
- **Odoo BOMs**: Procurement/manufacturing product configurations
- **Strategy**: Add parent/child component relationships in ComponentOrder to auto-explode BOMs
- **Benefit**: Centralizes logic in Laravel while maintaining Odoo sync for reporting
- **Gap**: Items table has odoo_sync; component_orders does not - must add
- **Priority**: HIGH (P3)

## Files

### JSON Discovery Data

- `phase4-kit-discoveries.json` - Structured discovery data for import into Qdrant vector DB

### Scripts

#### save-phase4-kit-discoveries.ts

Saves discoveries to JSON file for documentation.

```bash
npx tsx scripts/save-phase4-kit-discoveries.ts
```

#### sync-phase4-discoveries-to-qdrant.ts

Syncs discoveries to Qdrant vector DB with semantic embeddings for search.

```bash
npx tsx scripts/sync-phase4-discoveries-to-qdrant.ts
```

## Searching Discoveries

In future Claude Code sessions, search discoveries semantically:

```
mcp__discoveries__search_discoveries { query: "Laravel kit inventory architecture" }
```

Example queries:

- "Laravel kit inventory architecture"
- "Odoo Laravel sync one-way"
- "component orders stock move"
- "phantom BOM migration"
- "phase 4 blocking issues"
- "component inventory flow"
- "location resolution fallback"

## Migration Checklist

### Phase 4 Prerequisites

- [ ] Review all 6 discoveries above
- [ ] Understand current one-way sync limitations
- [ ] Plan bidirectional sync implementation
- [ ] Identify stock.move XML-RPC requirements
- [ ] Add odoo_sync field to component_orders
- [ ] Clean up 482 negative inventory records

### Migration Steps

1. [ ] Migrate 267 phantom BOMs to Laravel ComponentOrder BOM structure
2. [ ] Implement parent/child component relationships
3. [ ] Build stock.move XML-RPC sync from ComponentOrder
4. [ ] Add odoo_sync tracking to component_orders
5. [ ] Test bidirectional inventory sync
6. [ ] Consolidate component_inventory tables
7. [ ] Verify reporting accuracy post-migration

### Post-Migration Verification

- [ ] All BOMs migrated (267 phantom + 977 normal)
- [ ] No inventory divergence between Laravel and Odoo
- [ ] Finance reports generate correctly (4 required monthly reports)
- [ ] Reservation system respects 24hr pre-pick holds
- [ ] Stock.move updates reflect in Odoo

## Related Documentation

- `po-system-migration-discoveries.json` - Related PO/billing migration findings
- `/home/jackk/sw-cortex/CLAUDE.md` - Architecture and integration notes
- `/home/jackk/sw-cortex/.claude/rules/db-discoveries.md` - Discovery logging guidelines

## Session Notes

**Research Date**: February 2, 2026
**Scope**: Laravel kit architecture, component ordering, inventory flow, Odoo sync analysis
**Status**: 6 discoveries saved, ready for Phase 4 implementation planning
**Next Steps**: Implement XML-RPC stock.move sync and odoo_sync field on component_orders
