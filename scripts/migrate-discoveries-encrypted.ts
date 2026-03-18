#!/usr/bin/env npx tsx
/**
 * Migrate discoveries from unencrypted to encrypted collection
 *
 * Reads all points from `discoveries` (via alias `discoveries_current`),
 * encrypts sensitive fields (title, description, sourceQuery),
 * and writes to `discoveries_encrypted` (alias `discoveries_enc_current`).
 *
 * The vectors (embeddings) are copied as-is — they were generated from
 * plaintext and remain unchanged.
 *
 * Usage: npx tsx scripts/migrate-discoveries-encrypted.ts
 */

import 'dotenv/config';
import { getQdrantClient } from '../src/qdrant/client.js';
import { ensureCollection } from '../src/qdrant/utils.js';
import { DiscoveriesEncryptedCollection } from '../src/qdrant/schemas/discoveries-encrypted.js';
import {
  encrypt,
  encryptField,
  isEncryptionConfigured,
  validateEncryptionKey,
} from '../src/services/encryption.js';

const OLD_COLLECTION = 'discoveries_current'; // alias for old unencrypted
const NEW_COLLECTION = DiscoveriesEncryptedCollection.alias;
const BATCH_SIZE = 100;

async function migrate() {
  // Validate encryption is configured
  if (!isEncryptionConfigured()) {
    console.error('ENCRYPTION_KEY (or SLACK_ENCRYPTION_KEY) environment variable is required.');
    console.error('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  const keyValidation = validateEncryptionKey();
  if (!keyValidation.valid) {
    console.error('Invalid encryption key:', keyValidation.error);
    process.exit(1);
  }

  const client = getQdrantClient();

  // Ensure encrypted collection exists
  console.log('Ensuring encrypted collection exists...');
  const { created } = await ensureCollection(client, DiscoveriesEncryptedCollection);
  if (created) {
    console.log('  Created new collection:', DiscoveriesEncryptedCollection.name);
  } else {
    console.log('  Collection already exists:', DiscoveriesEncryptedCollection.name);
  }

  // Count source points
  const sourceInfo = await client.getCollection(OLD_COLLECTION);
  const totalPoints = sourceInfo.points_count ?? 0;
  console.log(
    `\nMigrating ${totalPoints} discoveries from ${OLD_COLLECTION} to ${NEW_COLLECTION}...`
  );

  if (totalPoints === 0) {
    console.log('No discoveries to migrate.');
    return;
  }

  let migrated = 0;
  let offset: string | number | undefined = undefined;

  while (true) {
    // Scroll through old collection
    const batch = await client.scroll(OLD_COLLECTION, {
      limit: BATCH_SIZE,
      offset,
      with_payload: true,
      with_vector: true,
    });

    if (batch.points.length === 0) break;

    // Encrypt and prepare points for new collection
    const encryptedPoints = batch.points.map((point) => {
      const payload = point.payload as Record<string, unknown>;

      // Encrypt sensitive fields
      const encryptedTitle = encrypt(payload.title as string);
      const encryptedDescription = encryptField(payload.description as string | null);
      const encryptedSourceQuery = encryptField(payload.sourceQuery as string | null);

      return {
        id: point.id,
        vector: point.vector as number[],
        payload: {
          ...payload,
          title: encryptedTitle,
          description: encryptedDescription,
          sourceQuery: encryptedSourceQuery,
          encrypted: true,
          version: 2,
        },
      };
    });

    // Write to new collection
    await client.upsert(NEW_COLLECTION, {
      wait: true,
      points: encryptedPoints,
    });

    migrated += batch.points.length;
    console.log(`  Migrated ${migrated}/${totalPoints} discoveries`);

    // Get next offset
    offset = batch.next_page_offset ?? undefined;
    if (!offset) break;
  }

  console.log(`\nMigration complete: ${migrated} discoveries encrypted.`);
  console.log('\nNext steps:');
  console.log('  1. Restart MCP servers to pick up the new collection');
  console.log('  2. Test: mcp__discoveries__search_discoveries { query: "test" }');
  console.log('  3. Old collection kept for rollback — delete later if all looks good');
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
