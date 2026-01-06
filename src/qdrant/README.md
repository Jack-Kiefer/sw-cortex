# Qdrant Vector Database Module

This module provides typed collection management for Qdrant vector database.

## Quick Start

```bash
# Initialize all collections
npm run qdrant:init

# Check collection status
npm run qdrant:status
```

## Environment Variables

```env
QDRANT_URL=https://your-instance.cloud.qdrant.io
QDRANT_API_KEY=your-api-key
QDRANT_TIMEOUT=30000  # optional, defaults to 30s
```

## Usage

### Basic Client Usage

```typescript
import { getQdrantClient, testConnection } from './qdrant';

// Test connection
const { connected, error } = await testConnection();
if (!connected) {
  console.error('Failed to connect:', error);
}

// Get client for operations
const client = getQdrantClient();
const collections = await client.getCollections();
```

### Working with Collections

```typescript
import { ensureCollection, getCollectionInfo, SlackMessagesCollection } from './qdrant';

// Ensure collection exists
const client = getQdrantClient();
const result = await ensureCollection(client, SlackMessagesCollection);
console.log(result.created ? 'Created' : 'Already exists');

// Get collection info
const info = await getCollectionInfo(client, 'slack_messages');
console.log(`Points: ${info?.pointsCount}`);
```

### Inserting Vectors

```typescript
import { getQdrantClient, SlackMessagePayloadSchema } from './qdrant';

const client = getQdrantClient();

// Validate payload before insertion
const payload = SlackMessagePayloadSchema.parse({
  messageId: '1234567890.123456',
  channelId: 'C123ABC',
  userId: 'U456DEF',
  text: 'Hello world',
  timestamp: Date.now(),
  version: 1,
});

// Insert into collection (use alias for production)
await client.upsert('slack_messages_current', {
  points: [
    {
      id: crypto.randomUUID(),
      vector: embeddings, // Your embedding vector
      payload,
    },
  ],
});
```

### Searching Vectors

```typescript
const results = await client.search('slack_messages_current', {
  vector: queryEmbedding,
  limit: 10,
  with_payload: true,
});

for (const result of results) {
  console.log(`Score: ${result.score}, Text: ${result.payload?.text}`);
}
```

## Adding a New Collection

1. Create schema file in `src/qdrant/schemas/`:

```typescript
// src/qdrant/schemas/my-collection.ts
import { z } from 'zod';
import { DISTANCE_METRICS, VECTOR_SIZES } from '../config';

export const MyPayloadSchema = z.object({
  id: z.string(),
  content: z.string(),
  version: z.number().default(1),
});

export type MyPayload = z.infer<typeof MyPayloadSchema>;

export const MyCollection = {
  name: 'my_collection',
  alias: 'my_collection_current',
  description: 'What this collection stores',
  vectorSize: VECTOR_SIZES.OPENAI_TEXT_EMBEDDING_3_SMALL,
  distance: DISTANCE_METRICS.COSINE,
  version: 1,
  migrations: [{ version: 1, date: '2025-01-06', changes: 'Initial schema' }],
  payloadSchema: MyPayloadSchema,
} as const;
```

2. Export from `src/qdrant/schemas/index.ts`:

```typescript
export * from './my-collection';
```

3. Register in `src/qdrant/collections.ts`:

```typescript
import { MyCollection } from './schemas/my-collection';

export const COLLECTIONS = {
  slackMessages: SlackMessagesCollection,
  myCollection: MyCollection, // Add here
} as const;
```

4. Run initialization:

```bash
npm run qdrant:init
```

## Migration Strategy

Qdrant doesn't have built-in migrations. Use collection aliases for zero-downtime schema changes:

1. **Create new collection** with updated schema:

   ```typescript
   const newName = await createMigrationCollection(client, MyCollection, 2);
   ```

2. **Migrate data** from old collection to new (custom script)

3. **Swap alias** atomically:

   ```typescript
   await swapCollectionAlias(client, 'my_collection_current', 'my_collection', 'my_collection_v2');
   ```

4. **Delete old collection** when safe

## File Structure

```
src/qdrant/
├── README.md           # This file
├── index.ts            # Public exports
├── client.ts           # Singleton client factory
├── config.ts           # Environment configuration
├── collections.ts      # Collection registry
├── utils.ts            # Helper functions
└── schemas/
    ├── index.ts        # Schema exports
    └── slack-messages.ts  # Slack messages collection
```

## Best Practices

1. **Always use aliases** for queries in production code
2. **Validate payloads** with Zod before insertion
3. **Include version field** in all payloads for future migrations
4. **Check connection** before operations in scripts
5. **Never change vector size** without creating new collection
