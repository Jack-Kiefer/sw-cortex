#!/usr/bin/env ts-node
/**
 * Save Odoo PO discoveries to the knowledge base
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import * as discoveries from '../src/services/discoveries.js';

interface Discovery {
  title: string;
  source: string;
  sourceDatabase?: string;
  tableName?: string;
  columnName?: string;
  sourceQuery?: string;
  description: string;
  type: string;
  priority?: number;
  tags?: string[];
}

async function main() {
  console.log('Loading discoveries from JSON...');
  const jsonPath = resolve(__dirname, 'save-odoo-po-discoveries.json');
  const discoveryData: Discovery[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`Found ${discoveryData.length} discoveries to save\n`);

  for (let i = 0; i < discoveryData.length; i++) {
    const discovery = discoveryData[i];
    console.log(`[${i + 1}/${discoveryData.length}] Saving: ${discovery.title}`);

    try {
      const result = await discoveries.addDiscovery({
        title: discovery.title,
        source: discovery.source as any,
        sourceDatabase: discovery.sourceDatabase,
        tableName: discovery.tableName,
        columnName: discovery.columnName,
        sourceQuery: discovery.sourceQuery,
        description: discovery.description,
        type: discovery.type as any,
        priority: discovery.priority,
        tags: discovery.tags,
      });

      console.log(`  ✓ Saved with ID: ${result.id}`);
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n=== COMPLETE ===');
  console.log(`Saved ${discoveryData.length} discoveries about Odoo PO system`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
