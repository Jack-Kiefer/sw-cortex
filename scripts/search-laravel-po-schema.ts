#!/usr/bin/env ts-node
/**
 * Search Laravel repo for PO-related schema files
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import * as githubService from '../src/services/github.js';

async function main() {
  console.log('\n=== Searching Laravel Repo for PO Schema ===\n');

  try {
    // Search for purchase order files
    console.log('1. Searching for purchase_order files...');
    const poResults = await githubService.searchCode('purchase_order path:database', {
      repo: 'sugarwish-laravel',
      limit: 30,
    });
    console.log(`Found ${poResults.total} results:`);
    poResults.items.forEach((item) => {
      console.log(`  - ${item.path}`);
    });

    // Search for supplier files
    console.log('\n2. Searching for supplier files...');
    const supplierResults = await githubService.searchCode('supplier path:database', {
      repo: 'sugarwish-laravel',
      limit: 30,
    });
    console.log(`Found ${supplierResults.total} results:`);
    supplierResults.items.forEach((item) => {
      console.log(`  - ${item.path}`);
    });

    // Search for component files
    console.log('\n3. Searching for component files...');
    const componentResults = await githubService.searchCode('component path:database', {
      repo: 'sugarwish-laravel',
      limit: 30,
    });
    console.log(`Found ${componentResults.total} results:`);
    componentResults.items.forEach((item) => {
      console.log(`  - ${item.path}`);
    });

    // Try to list migrations directory
    console.log('\n4. Listing migrations directory...');
    try {
      const migrations = await githubService.listFiles('sugarwish-laravel', {
        path: 'database/migrations',
      });
      const poRelated = migrations.filter(
        (f) =>
          f.name.includes('purchase') ||
          f.name.includes('supplier') ||
          f.name.includes('component') ||
          f.name.includes('arrival')
      );
      console.log(`Found ${poRelated.length} PO-related migrations:`);
      poRelated.forEach((f) => console.log(`  - ${f.name}`));
    } catch (error) {
      console.error('Could not list migrations directory:', error);
    }

    // Search for Model files
    console.log('\n5. Searching for PO-related Models...');
    const modelResults = await githubService.searchCode(
      'class PurchaseOrder OR class Supplier path:app/Models',
      {
        repo: 'sugarwish-laravel',
        limit: 10,
      }
    );
    console.log(`Found ${modelResults.total} model files:`);
    modelResults.items.forEach((item) => {
      console.log(`  - ${item.path}`);
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

main();
