/**
 * Save discoveries from Odoo to Laravel kit migration research session
 *
 * These discoveries document critical findings about:
 * 1. Component orders missing odoo_sync field (migration blocker)
 * 2. Items vs component_orders structure differences
 * 3. Laravel kit structure for accessories
 * 4. Odoo BOM scale (1,244 active BOMs)
 * 5. Proposed BOM migration strategy
 *
 * Run with: npm run ts-node scripts/save-kit-migration-discoveries.ts
 */

import { DiscoveriesClient } from '../src/mcp-servers/discoveries/client';

const discoveries = [
  {
    title: 'component_orders table missing odoo_sync field - CRITICAL GAP',
    source: 'database_query' as const,
    sourceDatabase: 'sugarwish',
    tableName: 'component_orders',
    description:
      'Critical finding: items table has odoo_sync field (0=not synced, 1=syncing, 2=synced, 5=unknown) with 14.4M rows. component_orders table (2.1M rows) does NOT have odoo_sync field. This is the key missing piece for syncing component orders to Odoo. Items sync to Odoo via odoo_sync flag; component_orders has NO sync tracking. This blocks automated BOM migration.',
    type: 'anomaly' as const,
    priority: 4,
    tags: ['odoo-sync', 'migration-blocker', 'component-orders'],
  },
  {
    title: 'items vs component_orders table structure differences',
    source: 'database_query' as const,
    sourceDatabase: 'sugarwish',
    tableName: 'items',
    description:
      'Both tables track orders but serve different purposes. Items: tracks products with product_id, product_sku, odoo_sync, vendor_cost, parent_sku/name (14.4M rows). Component_orders: tracks component fulfillment with component_id, component_sku, location_id, accessory_images_id (2.1M rows). KEY INSIGHT: items syncs to Odoo via odoo_sync; component_orders does not. This suggests items are synced BOMs while component_orders are local fulfillment tracking.',
    type: 'relationship' as const,
    priority: 3,
    tags: ['table-structure', 'odoo-sync', 'bom-migration'],
  },
  {
    title: 'Laravel kits structure for accessories, not product BOMs',
    source: 'database_query' as const,
    sourceDatabase: 'sugarwish',
    tableName: 'kits',
    description:
      'Laravel kits link to buyer_products via buyer_product_id. Junction table component_kits links kits to components with quantities. Kits are for ACCESSORIES (mugs, box cards, custom items) - NOT for product BOMs. This is local fulfillment logic. Contrast with Odoo BOMs (1,244 active) which are ERP-level product configurations. Migration strategy: These are separate concerns - kits are fulfillment; BOMs are procurement/manufacturing.',
    type: 'insight' as const,
    priority: 2,
    tags: ['kits', 'accessories', 'fulfillment'],
  },
  {
    title: 'Odoo BOM scale: 977 normal + 267 phantom (1,244 total active)',
    source: 'database_query' as const,
    sourceDatabase: 'odoo',
    tableName: 'mrp_bom',
    description:
      'Odoo has 1,244 active BOMs: 977 normal + 267 phantom. Phantom BOMs are virtual assemblies (kit-like, auto-explode to parent level). Scale is significant. All need potential migration to Laravel or SERP for component order automation. Phantom BOMs especially important as they affect component costing and order composition.',
    type: 'fact' as const,
    priority: 3,
    tags: ['bom-scale', 'phantom-bom', 'odoo-migration'],
  },
  {
    title: 'Proposed BOM migration strategy: Move from Odoo to Laravel/SERP',
    source: 'exploration' as const,
    sourceDatabase: 'sugarwish',
    description:
      'From Oct 2025 Slack discussions: Proposed approach to move BOM logic from Odoo to SERP (now potentially Laravel). Add parent/child component relationships in Laravel. When parent component_order detected, auto-create child component_orders for each BOM line. Keep all data in SugarWish database. This avoids Odoo API calls and centralizes logic. Requires adding odoo_sync or BOM tracking to component_orders table.',
    type: 'insight' as const,
    priority: 4,
    tags: ['migration-strategy', 'bom-automation', 'component-orders'],
  },
];

async function saveDiscoveries() {
  const client = new DiscoveriesClient();

  for (const discovery of discoveries) {
    try {
      const result = await client.addDiscovery(discovery);
      console.log(`Saved: ${discovery.title}`);
      console.log(`  ID: ${result.id}`);
    } catch (error) {
      console.error(`Failed to save: ${discovery.title}`, error);
    }
  }
}

saveDiscoveries().catch(console.error);
