#!/usr/bin/env tsx
/**
 * Research Odoo billing and accounting workflow
 */

import * as dbService from '../src/services/databases.js';

async function main() {
  console.log('=== Odoo Billing Research ===\n');

  // 1. Describe account_move table (vendor bills)
  console.log('1. account_move table structure:');
  const accountMoveColumns = await dbService.describeTable('odoo', 'account_move');
  console.log(JSON.stringify(accountMoveColumns, null, 2));
  console.log('\n');

  // 2. Describe account_payment table
  console.log('2. account_payment table structure:');
  const accountPaymentColumns = await dbService.describeTable('odoo', 'account_payment');
  console.log(JSON.stringify(accountPaymentColumns, null, 2));
  console.log('\n');

  // 3. Describe purchase_order table
  console.log('3. purchase_order table structure:');
  const purchaseOrderColumns = await dbService.describeTable('odoo', 'purchase_order');
  console.log(JSON.stringify(purchaseOrderColumns, null, 2));
  console.log('\n');

  // 4. Describe stock_picking table
  console.log('4. stock_picking table structure:');
  const stockPickingColumns = await dbService.describeTable('odoo', 'stock_picking');
  console.log(JSON.stringify(stockPickingColumns, null, 2));
  console.log('\n');

  // 5. Sample purchase order with bill
  console.log('5. Sample purchase order with linked bill:');
  const poWithBill = await dbService.queryDatabase(
    'odoo',
    `SELECT
      po.id as po_id,
      po.name as po_name,
      po.state as po_state,
      po.invoice_status,
      am.id as bill_id,
      am.name as bill_name,
      am.state as bill_state,
      am.move_type,
      am.payment_state
    FROM purchase_order po
    LEFT JOIN account_move am ON am.invoice_origin = po.name
    WHERE po.state = 'purchase'
    AND am.id IS NOT NULL
    LIMIT 5`,
    5
  );
  console.log(JSON.stringify(poWithBill, null, 2));
  console.log('\n');

  // 6. Sample bill with payment
  console.log('6. Sample bill with payment:');
  const billWithPayment = await dbService.queryDatabase(
    'odoo',
    `SELECT
      am.id as bill_id,
      am.name as bill_name,
      am.state as bill_state,
      am.payment_state,
      am.amount_total,
      ap.id as payment_id,
      ap.name as payment_name,
      ap.state as payment_state,
      ap.amount as payment_amount,
      ap.payment_type
    FROM account_move am
    LEFT JOIN account_payment ap ON ap.id = ANY(
      SELECT unnest(payment_id) FROM account_move_line aml WHERE aml.move_id = am.id
    )
    WHERE am.move_type = 'in_invoice'
    AND am.payment_state IN ('paid', 'in_payment')
    LIMIT 5`,
    5
  );
  console.log(JSON.stringify(billWithPayment, null, 2));
  console.log('\n');

  // 7. Check for stock_move to account_move relationship
  console.log('7. Sample stock receipt with billing:');
  const receiptWithBill = await dbService.queryDatabase(
    'odoo',
    `SELECT
      sp.id as picking_id,
      sp.name as picking_name,
      sp.state as picking_state,
      sp.picking_type_id,
      po.id as po_id,
      po.name as po_name,
      am.id as bill_id,
      am.name as bill_name,
      am.state as bill_state
    FROM stock_picking sp
    JOIN purchase_order po ON sp.purchase_id = po.id
    LEFT JOIN account_move am ON am.invoice_origin = po.name
    WHERE sp.state = 'done'
    AND sp.picking_type_id IN (SELECT id FROM stock_picking_type WHERE code = 'incoming')
    LIMIT 5`,
    5
  );
  console.log(JSON.stringify(receiptWithBill, null, 2));
  console.log('\n');

  // 8. Check invoice_status values on PO
  console.log('8. Purchase order invoice_status values:');
  const invoiceStatuses = await dbService.queryDatabase(
    'odoo',
    `SELECT
      invoice_status,
      COUNT(*) as count
    FROM purchase_order
    WHERE state != 'cancel'
    GROUP BY invoice_status
    ORDER BY count DESC`,
    10
  );
  console.log(JSON.stringify(invoiceStatuses, null, 2));
  console.log('\n');

  // 9. Check payment_state values on account_move
  console.log('9. Vendor bill payment_state values:');
  const paymentStates = await dbService.queryDatabase(
    'odoo',
    `SELECT
      payment_state,
      COUNT(*) as count
    FROM account_move
    WHERE move_type = 'in_invoice'
    GROUP BY payment_state
    ORDER BY count DESC`,
    10
  );
  console.log(JSON.stringify(paymentStates, null, 2));
}

main().catch(console.error);
