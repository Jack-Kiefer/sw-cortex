#!/usr/bin/env ts-node
/**
 * Query Laravel databases for PO-related tables
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import * as dbService from '../src/services/databases.js';

async function main() {
  try {
    console.log('\n=== Querying Laravel Databases for PO-related tables ===\n');

    // Check both databases
    const databases = ['laravel_local', 'laravel_staging'];

    for (const db of databases) {
      console.log(`\n📦 ${db.toUpperCase()}`);
      console.log('='.repeat(60));

      try {
        const tables = await dbService.listTables(db);
        console.log(`\nTotal tables: ${tables.length}`);

        // Filter for PO-related tables
        const poRelated = tables.filter(
          (t) =>
            t.toLowerCase().includes('purchase') ||
            t.toLowerCase().includes('po_') ||
            t.toLowerCase().includes('_po') ||
            t.toLowerCase().includes('supplier') ||
            t.toLowerCase().includes('vendor') ||
            t.toLowerCase().includes('arrival') ||
            t.toLowerCase().includes('receiving') ||
            t.toLowerCase().includes('receipt') ||
            t.toLowerCase().includes('odoo')
        );

        if (poRelated.length > 0) {
          console.log(`\n🎯 Found ${poRelated.length} potentially relevant tables:`);
          poRelated.forEach((t) => console.log(`  - ${t}`));
        } else {
          console.log('\n❌ No obvious PO-related tables found');
        }

        // Show sample of all tables for reference
        console.log(`\n📋 All tables (first 20):`);
        tables.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
        if (tables.length > 20) {
          console.log(`  ... and ${tables.length - 20} more`);
        }
      } catch (error) {
        console.error(`Error querying ${db}:`, error instanceof Error ? error.message : error);
      }
    }

    // Close connections
    await dbService.closeAllPools();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
