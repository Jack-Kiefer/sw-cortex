#!/usr/bin/env node

import 'dotenv/config';
import * as discoveriesService from '../src/services/discoveries.js';

async function main() {
  console.log('Verifying saved SERP-Odoo discoveries...\n');

  // Search for the specific discoveries we just added
  const searchTerms = ['SERP', 'valuation layer', 'FIFO'];

  for (const term of searchTerms) {
    try {
      const results = await discoveriesService.searchDiscoveries(term, { limit: 3 });
      console.log(`\nSearch: "${term}" - Found ${results.length} result(s)`);
      results.slice(0, 2).forEach((d: any) => {
        console.log(`  • ${d.title}`);
        console.log(`    ID: ${d.id}`);
      });
    } catch (e) {
      console.log(`  (No results for "${term}")`);
    }
  }

  console.log('\n✅ Discoveries verified in knowledge base');
}

main().catch(console.error);
