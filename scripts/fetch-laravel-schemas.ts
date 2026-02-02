import * as githubService from '../src/services/github.js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

async function main() {
  const files = [
    'database/skeema/purchase_orders.sql',
    'database/skeema/purchase_items.sql',
    'database/skeema/suppliers.sql',
    'database/skeema/bills.sql',
    'database/skeema/component_orders.sql',
    'database/skeema/supplier_product.sql',
  ];

  for (const file of files) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FILE: ${file}`);
    console.log('='.repeat(80));
    try {
      const content = await githubService.getFile('sugarwish-laravel', file);
      console.log(content.content);
    } catch (error: unknown) {
      console.error(`Error fetching ${file}:`, (error as Error).message);
    }
  }
}

main();
