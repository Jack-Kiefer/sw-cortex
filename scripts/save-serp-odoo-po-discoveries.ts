#!/usr/bin/env node

import 'dotenv/config';
import * as discoveriesService from '../src/services/discoveries.js';

const discoveries = [
  {
    title: 'SERP Laravel PO System - Current Architecture',
    source: 'code_review' as const,
    description:
      'SERP has a production-ready PO system (Laravel) with: purchase_orders table (supplier_id, landed_cost, est_arrival_date, po_type enum, approval workflow timestamps), purchase_items (cost_per_item, quantity_ordered, quantity_arrived). Multi-level approval workflow with ops ($5k) and finance ($50k) thresholds. Blanket PO support, bill integration, and Slack notifications.',
    type: 'fact' as const,
    sourceDatabase: 'laravel',
    tableName: 'purchase_orders,purchase_items',
    tags: ['SERP', 'PO', 'procurement', 'inventory'],
    priority: 3,
  },
  {
    title: 'SERP Inventory System - No FIFO Costing Infrastructure',
    source: 'code_review' as const,
    description:
      'CRITICAL GAP: SERP inventory (component_inventory, raw_material_inventory) tracks only total qty per location, no batch/cost tracking. Missing equivalent to Odoo stock_valuation_layer. When goods arrive, no cost layer created. When consumed, no FIFO assignment. Cannot calculate accurate COGS without this layer.',
    type: 'anomaly' as const,
    sourceDatabase: 'laravel',
    tableName:
      'component_inventory,raw_material_inventory,component_inventory_transactions,rm_inventory_transactions',
    tags: ['SERP', 'inventory', 'FIFO', 'valuation', 'gap'],
    priority: 4,
  },
  {
    title: 'SERP-to-Odoo Migration: Inventory Valuation Layer Architecture',
    source: 'exploration' as const,
    description:
      'Migration requires new table: inventory_valuation_layers (product_id, purchase_item_id, unit_cost, quantity, remaining_qty, remaining_value, created_at). Must modify inventory consumption logic to use FIFO layer consumption. Need journal entry generation for GL posting. Odoo integration already exists via OdooAPIService, InventorySyncService, OdooXMLRPCService.',
    type: 'insight' as const,
    sourceDatabase: 'laravel,odoo',
    tableName: 'inventory_valuation_layers',
    tags: ['SERP', 'Odoo', 'migration', 'inventory', 'FIFO', 'valuation'],
    priority: 4,
  },
  {
    title: 'Odoo Stock Valuation Layer Pattern',
    source: 'code_review' as const,
    description:
      'Odoo uses stock_valuation_layer table to track FIFO cost assignments per product. Fields: product_id, stock_move_id, quantity, unit_cost, value, currency_id, create_date. Layers are consumed in FIFO order during outbound moves. Remaining_value automatically calculated. Used for COGS calculation and GL posting.',
    type: 'pattern' as const,
    sourceDatabase: 'odoo',
    tableName: 'stock_valuation_layer',
    tags: ['Odoo', 'inventory', 'FIFO', 'valuation', 'costing'],
    priority: 3,
  },
  {
    title: 'Odoo Integration Services Already Exist',
    source: 'code_review' as const,
    description:
      'Reusable Odoo integration services already implemented: OdooAPIService (for read queries), InventorySyncService (orchestration), OdooXMLRPCService (for writes). Can leverage these services for syncing valuation layers and cost assignments from SERP to Odoo.',
    type: 'fact' as const,
    sourceDatabase: 'odoo,laravel',
    tags: ['Odoo', 'SERP', 'integration', 'services'],
    priority: 2,
  },
];

async function main() {
  console.log('Saving SERP-Odoo PO migration discoveries...\n');

  let count = 0;
  for (const discovery of discoveries) {
    try {
      const result = await discoveriesService.addDiscovery({
        ...discovery,
        description: discovery.description || '',
      });
      console.log(`✓ [${++count}/${discoveries.length}] ${discovery.title}`);
      console.log(`  ID: ${result.id}\n`);
    } catch (error) {
      console.error(`✗ Failed to save: ${discovery.title}`);
      console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  console.log(`\n✅ Saved ${count} discoveries to knowledge base`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
