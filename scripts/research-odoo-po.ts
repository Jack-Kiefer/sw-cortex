#!/usr/bin/env ts-node
/**
 * Research script to understand Odoo purchase order system
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import * as dbService from '../src/services/databases.js';

async function main() {
  console.log('=== ODOO PURCHASE ORDER SYSTEM RESEARCH ===\n');

  // 1. Describe purchase_order table
  console.log('1. PURCHASE_ORDER TABLE STRUCTURE:');
  console.log('-----------------------------------');
  const poColumns = await dbService.describeTable('odoo', 'purchase_order');
  console.log(JSON.stringify(poColumns, null, 2));
  console.log('\n');

  // 2. Describe purchase_order_line table
  console.log('2. PURCHASE_ORDER_LINE TABLE STRUCTURE:');
  console.log('---------------------------------------');
  const polColumns = await dbService.describeTable('odoo', 'purchase_order_line');
  console.log(JSON.stringify(polColumns, null, 2));
  console.log('\n');

  // 3. Describe stock_picking table
  console.log('3. STOCK_PICKING TABLE STRUCTURE:');
  console.log('---------------------------------');
  const pickingColumns = await dbService.describeTable('odoo', 'stock_picking');
  console.log(JSON.stringify(pickingColumns, null, 2));
  console.log('\n');

  // 4. Describe account_move table
  console.log('4. ACCOUNT_MOVE TABLE STRUCTURE:');
  console.log('--------------------------------');
  const moveColumns = await dbService.describeTable('odoo', 'account_move');
  console.log(JSON.stringify(moveColumns, null, 2));
  console.log('\n');

  // 5. Get sample purchase orders with their states
  console.log('5. SAMPLE PURCHASE ORDERS (Recent):');
  console.log('-----------------------------------');
  const samplePOs = await dbService.queryDatabase(
    'odoo',
    `SELECT id, name, state, partner_id, date_order, date_approve,
            amount_total, invoice_status, picking_type_id, user_id
     FROM purchase_order
     ORDER BY id DESC
     LIMIT 20`,
    20
  );
  console.log(JSON.stringify(samplePOs, null, 2));
  console.log('\n');

  // 6. Get distinct states from purchase orders
  console.log('6. PURCHASE ORDER STATES:');
  console.log('------------------------');
  const states = await dbService.queryDatabase(
    'odoo',
    `SELECT DISTINCT state, COUNT(*) as count
     FROM purchase_order
     GROUP BY state
     ORDER BY count DESC`,
    50
  );
  console.log(JSON.stringify(states, null, 2));
  console.log('\n');

  // 7. Get distinct invoice_status values
  console.log('7. PURCHASE ORDER INVOICE STATUS VALUES:');
  console.log('---------------------------------------');
  const invoiceStatuses = await dbService.queryDatabase(
    'odoo',
    `SELECT DISTINCT invoice_status, COUNT(*) as count
     FROM purchase_order
     GROUP BY invoice_status
     ORDER BY count DESC`,
    50
  );
  console.log(JSON.stringify(invoiceStatuses, null, 2));
  console.log('\n');

  // 8. Get sample PO with lines
  console.log('8. SAMPLE PO WITH LINES:');
  console.log('-----------------------');
  const poWithLines = await dbService.queryDatabase(
    'odoo',
    `SELECT
       po.id as po_id,
       po.name as po_name,
       po.state,
       po.invoice_status,
       pol.id as line_id,
       pol.product_id,
       pol.product_qty,
       pol.qty_received,
       pol.qty_invoiced,
       pol.price_unit
     FROM purchase_order po
     JOIN purchase_order_line pol ON po.id = pol.order_id
     WHERE po.state != 'cancel'
     ORDER BY po.id DESC
     LIMIT 30`,
    30
  );
  console.log(JSON.stringify(poWithLines, null, 2));
  console.log('\n');

  // 9. Check relationship between PO and stock_picking
  console.log('9. PO TO STOCK_PICKING RELATIONSHIP:');
  console.log('------------------------------------');
  const poPickingRel = await dbService.queryDatabase(
    'odoo',
    `SELECT
       po.id as po_id,
       po.name as po_name,
       sp.id as picking_id,
       sp.name as picking_name,
       sp.state as picking_state,
       sp.origin
     FROM purchase_order po
     LEFT JOIN stock_picking sp ON sp.origin = po.name
     WHERE po.state != 'cancel'
     ORDER BY po.id DESC
     LIMIT 20`,
    20
  );
  console.log(JSON.stringify(poPickingRel, null, 2));
  console.log('\n');

  // 10. Check relationship between PO and account_move (bills)
  console.log('10. PO TO ACCOUNT_MOVE (BILLS) RELATIONSHIP:');
  console.log('-------------------------------------------');
  const poBillRel = await dbService.queryDatabase(
    'odoo',
    `SELECT
       po.id as po_id,
       po.name as po_name,
       po.invoice_status,
       am.id as move_id,
       am.name as move_name,
       am.move_type,
       am.state as move_state,
       am.invoice_origin
     FROM purchase_order po
     LEFT JOIN account_move am ON am.invoice_origin = po.name
     WHERE po.state != 'cancel' AND am.move_type = 'in_invoice'
     ORDER BY po.id DESC
     LIMIT 20`,
    20
  );
  console.log(JSON.stringify(poBillRel, null, 2));
  console.log('\n');

  // 11. Check stock_move for detailed goods receipt tracking
  console.log('11. STOCK_MOVE TABLE STRUCTURE (for goods receipt):');
  console.log('--------------------------------------------------');
  const stockMoveColumns = await dbService.describeTable('odoo', 'stock_move');
  console.log(JSON.stringify(stockMoveColumns, null, 2));
  console.log('\n');

  // 12. Sample stock_move records linked to PO
  console.log('12. SAMPLE STOCK_MOVE RECORDS:');
  console.log('------------------------------');
  const stockMoves = await dbService.queryDatabase(
    'odoo',
    `SELECT
       sm.id,
       sm.name,
       sm.product_id,
       sm.product_uom_qty,
       sm.quantity_done,
       sm.state,
       sm.purchase_line_id,
       sm.picking_id,
       sm.origin
     FROM stock_move sm
     WHERE sm.purchase_line_id IS NOT NULL
     ORDER BY sm.id DESC
     LIMIT 20`,
    20
  );
  console.log(JSON.stringify(stockMoves, null, 2));
  console.log('\n');

  console.log('=== RESEARCH COMPLETE ===');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
