# Odoo to Laravel Kit Migration - Discovery Session (Jan 2026)

## Session Overview

Research session exploring the feasibility and requirements for moving kit/BOM management from Odoo to Laravel. Discovered critical schema gaps and proposed migration strategy.

## 5 Critical Discoveries Saved to Knowledge Base

### Discovery 1: component_orders Missing odoo_sync Field (CRITICAL GAP)

**Type**: anomaly | **Priority**: 4 (critical) | **Database**: sugarwish

The `items` table (14.4M rows) has an `odoo_sync` field for Odoo synchronization tracking. The `component_orders` table (2.1M rows) does NOT have this field - this is the critical missing piece.

**Field Values in items.odoo_sync**:

- 0 = not synced
- 1 = syncing
- 2 = synced
- 5 = unknown

**Impact**: Without `odoo_sync` on component_orders, there's no way to track which component orders have been synced to Odoo or are currently syncing. This blocks automated BOM migration.

**Required Action**: Add `odoo_sync` field (or equivalent BOM tracking) to component_orders table before proceeding with migration.

---

### Discovery 2: Items vs Component_Orders Structure (Different Purposes)

**Type**: relationship | **Priority**: 3 | **Database**: sugarwish

These two tables serve fundamentally different purposes:

**items table** (14.4M rows):

- Tracks product orders
- Key fields: order_id, quantity, order_type, created_at
- Product info: product_id, product_sku, product_name, qty_ordered
- Sync tracking: `odoo_sync`, vendor_cost
- Parent references: parent_sku, parent_name

**component_orders table** (2.1M rows):

- Tracks component fulfillment
- Key fields: order_id, quantity, order_type, created_at
- Component info: component_id, component_sku, component_name
- Fulfillment: location_id, accessory_images_id
- NO sync tracking

**Critical Insight**:

- Items table = synced BOMs (connected to Odoo via odoo_sync flag)
- Component_orders = local fulfillment tracking (no Odoo connection)
- This suggests component_orders were historically managed separately from Odoo BOMs

---

### Discovery 3: Laravel Kits Are for Accessories, Not BOMs

**Type**: insight | **Priority**: 2 | **Database**: sugarwish

Laravel's kit system is for accessory management, NOT product BOMs:

**Structure**:

- `kits` table links to `buyer_products` via `buyer_product_id`
- `component_kits` junction table links kits to components with quantities
- Examples: mugs, box cards, custom items

**Important Distinction**:

- **Laravel kits** = fulfillment accessories (local concern)
- **Odoo BOMs** = product configurations (ERP-level concern)
- These are separate concerns that should not be conflated

**Strategic Implication**: Kit migration to Laravel is NOT the same as BOM migration. Each serves a different business purpose.

---

### Discovery 4: Odoo BOM Scale (1,244 Active)

**Type**: fact | **Priority**: 3 | **Database**: odoo | **Table**: mrp_bom

**BOM Inventory**:

- 977 normal BOMs
- 267 phantom BOMs
- 1,244 total active

**Phantom BOM Details**:

- Virtual assemblies (not physically assembled)
- Auto-explode to parent level
- Affect component costing and order composition

**Migration Scope**: All 1,244 BOMs would need to be migrated or replicated in Laravel for component order automation.

---

### Discovery 5: Proposed BOM Migration Strategy

**Type**: insight | **Priority**: 4 (critical) | **Database**: sugarwish

From Slack discussions (Oct 2025), the proposed approach is:

**Move BOM Logic from Odoo to Laravel/SERP**:

1. Add parent/child component relationships in Laravel
2. When parent component_order is detected → auto-create child component_orders for each BOM line
3. Keep all data in SugarWish database
4. Avoids Odoo API calls; centralizes logic in Laravel/SERP

**Key Requirements**:

- Add `odoo_sync` or BOM tracking to component_orders table
- Implement BOM lookup from Odoo (or cache in Laravel)
- Auto-spawn child component_orders from parent

**Benefits**:

- No Odoo API dependency for component ordering
- Centralized logic (all in Laravel)
- Potential for offline BOM processing

---

## Related Tables & Relationships

### SugarWish Database

| Table            | Rows  | Purpose                | Sync to Odoo           |
| ---------------- | ----- | ---------------------- | ---------------------- |
| items            | 14.4M | Product orders         | YES (odoo_sync)        |
| component_orders | 2.1M  | Component fulfillment  | NO (missing odoo_sync) |
| kits             | ?     | Accessory groupings    | No                     |
| component_kits   | ?     | Kit-component junction | No                     |

### Odoo Database

| Table        | Rows  | Purpose                                      |
| ------------ | ----- | -------------------------------------------- |
| mrp_bom      | 1,244 | Bill of materials (977 normal + 267 phantom) |
| mrp_bom_line | ?     | BOM line items                               |
| sale_order   | ?     | Sales orders                                 |

---

## Next Steps for Implementation

1. **Schema Change**: Add `odoo_sync` or `bom_id` column to component_orders
2. **BOM Sync**: Decide how to populate BOMs in Laravel (API sync vs cache)
3. **Logic Implementation**: Auto-create child component_orders when parent is detected
4. **Testing**: Verify all 1,244 BOMs work correctly in Laravel flow
5. **Phantom BOM Handling**: Test auto-explosion behavior

---

## Files & References

- **Discoveries Saved Script**: `/home/jackk/sw-cortex/scripts/save-kit-migration-discoveries.ts`
- **Database Rules**: `/home/jackk/sw-cortex/.claude/rules/databases.md`
- **Discovery Guidelines**: `/home/jackk/sw-cortex/.claude/rules/db-discoveries.md`

---

## Search Queries for Future Reference

To find these discoveries later:

- `component_orders odoo_sync`
- `items odoo_sync`
- `kits component_orders`
- `BOM migration Laravel`
- `phantom BOM`
