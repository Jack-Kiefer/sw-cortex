#!/usr/bin/env node

import 'dotenv/config';
import * as discoveriesService from '../src/services/discoveries.js';

async function main() {
  console.log('Recent discoveries (code_review and exploration sources):\n');

  const results = await discoveriesService.listDiscoveries({
    source: 'code_review',
    limit: 5,
  });

  console.log(`Found ${results.length} discoveries from code_review:\n`);
  results.forEach((d: any) => {
    console.log(`• ${d.title}`);
    console.log(`  ID: ${d.id}`);
    console.log(`  Type: ${d.type} | Priority: ${d.priority}`);
    console.log(`  DB: ${d.sourceDatabase} | Table: ${d.tableName}\n`);
  });
}

main().catch(console.error);
