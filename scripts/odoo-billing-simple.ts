#!/usr/bin/env tsx
import * as dbService from '../src/services/databases.js';

async function main() {
  // Just describe one table at a time
  const table = process.argv[2] || 'account_move';
  console.log(`Describing ${table}...`);
  const result = await dbService.describeTable('odoo', table);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
