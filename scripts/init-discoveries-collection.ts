#!/usr/bin/env npx tsx
/**
 * Initialize Discoveries Collection in Qdrant
 *
 * Creates the discoveries collection and sets up payload indexes
 * for efficient filtering. Safe to run multiple times.
 *
 * Usage: npm run qdrant:init-discoveries
 */

import 'dotenv/config';
import { getQdrantClient, testConnection, DiscoveriesCollection } from '../src/qdrant';
import { ensureCollection, collectionExists } from '../src/qdrant/utils';

const COLLECTION = DiscoveriesCollection.alias;

async function main() {
  console.log('🔌 Connecting to Qdrant...');

  // Test connection first
  const connectionTest = await testConnection();
  if (!connectionTest.connected) {
    console.error('❌ Failed to connect to Qdrant:', connectionTest.error);
    process.exit(1);
  }
  console.log('✅ Connected to Qdrant');

  const client = getQdrantClient();

  // Check if collection exists
  const exists = await collectionExists(client, DiscoveriesCollection.name);
  if (exists) {
    console.log(`\n📦 Collection '${DiscoveriesCollection.name}' already exists`);
  } else {
    console.log(`\n📦 Creating collection '${DiscoveriesCollection.name}'...`);
    await ensureCollection(client, DiscoveriesCollection);
    console.log('✅ Collection created');
  }

  // Create payload indexes for efficient filtering
  console.log('\n📇 Setting up payload indexes...');
  const indexes = DiscoveriesCollection.indexes || [];

  for (const { field, type } of indexes) {
    try {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: type,
        wait: true,
      });
      console.log(`  ✓ Created index: ${field} (${type})`);
    } catch (error) {
      // Index may already exist
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`  ✓ Index exists: ${field} (${type})`);
      } else {
        console.warn(`  ⚠ Failed to create index for ${field}:`, error);
      }
    }
  }

  // Get collection info
  console.log('\n📊 Collection Status:');
  try {
    const info = await client.getCollection(COLLECTION);
    console.log(`  Name: ${DiscoveriesCollection.name}`);
    console.log(`  Alias: ${COLLECTION}`);
    console.log(`  Points: ${info.points_count}`);
    console.log(`  Vectors: ${info.vectors_count}`);
    console.log(`  Status: ${info.status}`);
    console.log(`  Indexed Vectors: ${info.indexed_vectors_count}`);

    // Show payload schema indexes
    if (info.payload_schema) {
      console.log('\n  Payload Indexes:');
      for (const [key, schema] of Object.entries(info.payload_schema)) {
        console.log(`    - ${key}: ${JSON.stringify(schema)}`);
      }
    }
  } catch (error) {
    console.error('  Failed to get collection info:', error);
  }

  console.log('\n✅ Discoveries collection initialization complete');
}

main().catch((error) => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});
