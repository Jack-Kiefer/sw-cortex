#!/usr/bin/env npx tsx
/**
 * Qdrant Collection Initialization Script
 *
 * Ensures all registered collections exist in Qdrant.
 * Safe to run multiple times - will skip existing collections.
 *
 * Usage: npm run qdrant:init
 */

import 'dotenv/config';
import {
  getQdrantClient,
  testConnection,
  initializeAllCollections,
  getAllCollectionsStatus,
} from '../src/qdrant';

async function main() {
  console.log('🔌 Connecting to Qdrant...');

  // Test connection first
  const connectionTest = await testConnection();
  if (!connectionTest.connected) {
    console.error('❌ Failed to connect to Qdrant:', connectionTest.error);
    process.exit(1);
  }
  console.log('✅ Connected to Qdrant');

  // Initialize collections
  console.log('\n📦 Initializing collections...');
  const client = getQdrantClient();
  const results = await initializeAllCollections(client);

  for (const result of results) {
    if (result.created) {
      console.log(`  ✨ Created: ${result.name}`);
    } else {
      console.log(`  ✓ Exists: ${result.name}`);
    }
  }

  // Show status of all collections
  console.log('\n📊 Collection Status:');
  const status = await getAllCollectionsStatus(client);

  for (const collection of status) {
    console.log(`\n  ${collection.name}:`);
    console.log(`    Alias: ${collection.alias}`);
    console.log(`    Exists: ${collection.exists}`);
    if (collection.exists) {
      console.log(`    Points: ${collection.pointsCount ?? 'N/A'}`);
      console.log(`    Vector Size: ${collection.vectorSize ?? 'N/A'}`);
      console.log(`    Status: ${collection.status ?? 'N/A'}`);
    }
  }

  console.log('\n✅ Qdrant initialization complete');
}

main().catch((error) => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});
