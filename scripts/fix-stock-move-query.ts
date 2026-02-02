#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import * as dbService from '../src/services/databases.js';

async function main() {
  // Check for quantity-related columns in stock_move
  console.log('Checking stock_move table for quantity columns:');
  const columns = await dbService.describeTable('odoo', 'stock_move');
  const qtyColumns = columns.filter(
    (col: any) =>
      col.column.toLowerCase().includes('qty') || col.column.toLowerCase().includes('quantity')
  );
  console.log(JSON.stringify(qtyColumns, null, 2));
  console.log('\n');

  // Now let's get sample stock_move records with correct column
  console.log('Sample stock_move records linked to POs:');
  const stockMoves = await dbService.queryDatabase(
    'odoo',
    `SELECT
       sm.id,
       sm.name,
       sm.product_id,
       sm.product_uom_qty,
       sm.product_qty,
       sm.state,
       sm.purchase_line_id,
       sm.picking_id,
       sm.origin,
       sm.date
     FROM stock_move sm
     WHERE sm.purchase_line_id IS NOT NULL
     ORDER BY sm.id DESC
     LIMIT 20`,
    20
  );
  console.log(JSON.stringify(stockMoves, null, 2));
}

main().catch(console.error);
