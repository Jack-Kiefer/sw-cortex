#!/usr/bin/env node
/**
 * Sync Phase 4 kit migration discoveries to Qdrant vector DB
 *
 * This script uses the discoveries service to save discoveries with semantic embeddings.
 * This enables semantic search (e.g., "Laravel kit inventory sync") to find relevant discoveries.
 *
 * Run with: npm run ts-node scripts/sync-phase4-discoveries-to-qdrant.ts
 */

import 'dotenv/config';

// Import the discoveries service to use its embedding + save logic
import * as discoveriesService from '../src/services/discoveries.js';

type DiscoverySource = 'database_query' | 'exploration' | 'code_review' | 'manual';
type DiscoveryType = 'pattern' | 'fact' | 'relationship' | 'anomaly' | 'insight' | 'optimization';

interface Discovery {
  title: string;
  source: DiscoverySource;
  sourceDatabase?: string;
  sourceQuery?: string;
  tableName?: string;
  columnName?: string;
  description: string;
  type: DiscoveryType;
  priority: number;
  tags: string[];
}

const discoveries: Discovery[] = [
  {
    title: 'Laravel Kit Architecture: Items and ComponentOrders are complementary',
    source: 'exploration',
    sourceDatabase: 'laravel_local',
    tableName: 'kits',
    description:
      'Laravel kits track order fulfillment with two complementary systems: (1) Items table tracks product selections with parent_sku for grouping components; (2) ComponentOrder tracks physical kit components with location-based inventory. Kits link to buyer_products via buyer_product_id. No kit_items junction table - composition is denormalized into items table. Key insight: Items = receiver selections, ComponentOrders = packaging materials/components.',
    type: 'fact',
    priority: 4,
    tags: ['phase-4', 'kit-architecture', 'laravel', 'migration'],
  },
  {
    title: 'Component Inventory Flow: Deduction and Location Resolution',
    source: 'exploration',
    sourceDatabase: 'laravel_local',
    tableName: 'component_orders',
    description:
      'ComponentOrder::create() triggers Component::deductInventoryByLocationId() which updates component_inventory pivot table with qty by location. Location resolution uses fallback chain: component.location_override -> buyer_product.location_id -> NULL (distributed inventory). This two-level location system allows per-component overrides while defaulting to buyer_product location. Critical for Phase 4: component_orders track same data as Odoo stock.move (component, qty, location).',
    type: 'relationship',
    priority: 4,
    tags: ['phase-4', 'inventory-flow', 'location-resolution', 'laravel'],
  },
  {
    title: 'Current Odoo → Laravel Sync is One-Way Only (REST API)',
    source: 'code_review',
    sourceDatabase: 'odoo',
    description:
      'Current sync mechanism: Odoo REST API endpoint receives inventory pushes from Odoo. NO reverse sync (Laravel -> Odoo) currently exists. NO stock.move integration. Component sync code exists but is disabled/commented out. item.odoo_sync flag tracks sync state (0=not synced, 1=syncing, 2=synced, 5=unknown) but component_orders have NO sync tracking. This one-way dependency means Laravel changes are not reflected in Odoo, blocking Phase 4 goal of making Laravel source of truth.',
    type: 'insight',
    priority: 4,
    tags: ['phase-4', 'odoo-sync', 'migration-blocker', 'inventory-sync'],
  },
  {
    title: 'Phase 4 Migration Scope: 267 Phantom BOMs + 482 Negative Inventory Records',
    source: 'database_query',
    sourceDatabase: 'odoo',
    tableName: 'mrp_bom',
    description:
      'Phase 4 migration targets: (1) 267 phantom BOMs in Odoo need migration to Laravel kits (phantoms auto-explode to parent level, affecting component costing); (2) 482 negative inventory records in Odoo need cleanup before migration (indicates sync inconsistencies); (3) ComponentOrder model already tracks physical components equivalent to Odoo stock.move; (4) Must handle: component_inventory, raw_material_inventory, odoo_inventory tables during cutover. Critical gap: No current mechanism to push Laravel changes back to Odoo stock.move.',
    type: 'fact',
    priority: 4,
    tags: ['phase-4', 'migration-scope', 'phantom-bom', 'negative-inventory'],
  },
  {
    title: 'Critical Gap for Phase 4: No Laravel -> Odoo Stock Move Sync',
    source: 'exploration',
    sourceDatabase: 'laravel_local',
    description:
      'To make Laravel source of truth, must build one-way push mechanism using Odoo stock.move XML-RPC API. ComponentOrder table structure already mirrors stock.move (component_id, qty_done, location_id). Missing pieces: (1) ComponentOrder lacks odoo_sync field for tracking; (2) No XML-RPC integration to create/update stock.move from ComponentOrder; (3) Reservation system handles pre-picks (24hr holds) but not full inventory commitment tracking. Without this sync, Laravel and Odoo inventory will diverge post-migration, breaking reporting and procurement.',
    type: 'insight',
    priority: 4,
    tags: ['phase-4', 'migration-blocker', 'stock-move-sync', 'odoo-xml-rpc'],
  },
  {
    title: 'Laravel Kits vs Odoo BOMs: Different Concerns (Fulfillment vs Procurement)',
    source: 'exploration',
    sourceDatabase: 'laravel_local',
    tableName: 'kits',
    description:
      'Laravel kits are fulfillment logic (accessory items: mugs, box cards, custom inserts) linked via component_kits junction to physical components. Odoo BOMs are ERP-level product configurations (1,244 active: 977 normal + 267 phantom) for procurement and manufacturing. Phase 4 must unify these concepts: add parent/child component relationships in ComponentOrder to auto-create child orders for BOM lines. This centralizes logic in Laravel while maintaining Odoo sync for reporting. Key: Items table has odoo_sync field; component_orders does not - must add for migration.',
    type: 'insight',
    priority: 3,
    tags: ['phase-4', 'kits', 'bom-strategy', 'fulfillment-vs-procurement'],
  },
];

async function syncDiscoveries() {
  console.log('Syncing Phase 4 Kit Migration Discoveries to Qdrant...\n');

  let savedCount = 0;
  let failedCount = 0;

  for (const discovery of discoveries) {
    try {
      const result = await discoveriesService.addDiscovery(discovery);
      console.log(`[OK] ${discovery.title}`);
      console.log(`     ID: ${result.id}\n`);
      savedCount++;
    } catch (error) {
      console.error(`[FAILED] ${discovery.title}`);
      console.error(`        Error: ${error instanceof Error ? error.message : String(error)}\n`);
      failedCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${savedCount} saved, ${failedCount} failed`);
  console.log('='.repeat(60) + '\n');

  if (failedCount === 0) {
    console.log('All Phase 4 discoveries synced successfully!');
    console.log('\nSearch examples:');
    console.log('  - "Laravel kit inventory architecture"');
    console.log('  - "Odoo Laravel sync one-way"');
    console.log('  - "component orders stock move"');
    console.log('  - "phantom BOM migration"');
    console.log('  - "phase 4 blocking issues"');
  } else {
    process.exit(1);
  }
}

syncDiscoveries().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
