#!/usr/bin/env npx tsx
/**
 * Qdrant Status Script
 *
 * Shows the status of all registered Qdrant collections.
 *
 * Usage: npm run qdrant:status
 */

import 'dotenv/config';
import {
  getQdrantClient,
  testConnection,
  getAllCollectionsStatus,
  getAllCollections,
} from '../src/qdrant';

async function main() {
  console.log('🔌 Connecting to Qdrant...');

  // Test connection first
  const connectionTest = await testConnection();
  if (!connectionTest.connected) {
    console.error('❌ Failed to connect to Qdrant:', connectionTest.error);
    process.exit(1);
  }
  console.log('✅ Connected to Qdrant\n');

  // Get all collection definitions
  const definitions = getAllCollections();
  console.log(`📋 Registered Collections: ${definitions.length}`);

  for (const def of definitions) {
    console.log(`  - ${def.name} (v${def.version}): ${def.description}`);
  }

  // Show status of all collections
  console.log('\n📊 Collection Status:');
  const client = getQdrantClient();
  const status = await getAllCollectionsStatus(client);

  for (const collection of status) {
    const icon = collection.exists ? '✅' : '❌';
    console.log(`\n  ${icon} ${collection.name}:`);
    console.log(`      Alias: ${collection.alias}`);

    if (collection.exists) {
      console.log(`      Points: ${collection.pointsCount ?? 0}`);
      console.log(`      Vector Size: ${collection.vectorSize ?? 'N/A'}`);
      console.log(`      Status: ${collection.status ?? 'unknown'}`);
    } else {
      console.log('      Status: NOT CREATED');
      console.log('      Run `npm run qdrant:init` to create');
    }
  }

  // Get raw collection list from Qdrant
  const rawCollections = await client.getCollections();
  const registeredNames = new Set(definitions.map((d) => d.name));
  const unregisteredCollections = rawCollections.collections.filter(
    (c) => !registeredNames.has(c.name) && !c.name.includes('_v')
  );

  if (unregisteredCollections.length > 0) {
    console.log('\n⚠️  Unregistered Collections in Qdrant:');
    for (const col of unregisteredCollections) {
      console.log(`  - ${col.name}`);
    }
  }

  console.log('\n');
}

main().catch((error) => {
  console.error('❌ Status check failed:', error);
  process.exit(1);
});
