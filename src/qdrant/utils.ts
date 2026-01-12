import { QdrantClient } from '@qdrant/js-client-rest';
import { CollectionDefinition, getAllCollections } from './collections';

export interface CollectionInfo {
  name: string;
  alias: string;
  exists: boolean;
  pointsCount: number | null;
  vectorSize: number | null;
  status: string | null;
}

// Check if a collection exists
export async function collectionExists(client: QdrantClient, name: string): Promise<boolean> {
  const collections = await client.getCollections();
  return collections.collections.some((c) => c.name === name);
}

// Ensure a collection exists, creating it if needed
export async function ensureCollection(
  client: QdrantClient,
  definition: CollectionDefinition
): Promise<{ created: boolean; name: string }> {
  const exists = await collectionExists(client, definition.name);

  if (exists) {
    return { created: false, name: definition.name };
  }

  // Create the collection
  await client.createCollection(definition.name, {
    vectors: {
      size: definition.vectorSize,
      distance: definition.distance,
    },
    ...definition.config,
  });

  // Create alias for the collection
  await client.updateCollectionAliases({
    actions: [
      {
        create_alias: {
          collection_name: definition.name,
          alias_name: definition.alias,
        },
      },
    ],
  });

  // Create payload indexes if defined (required for filtering with strict_mode)
  if (definition.payloadIndexes && definition.payloadIndexes.length > 0) {
    for (const index of definition.payloadIndexes) {
      await client.createPayloadIndex(definition.name, {
        field_name: index.field,
        field_schema: index.type,
        wait: true,
      });
    }
  }

  return { created: true, name: definition.name };
}

// Get information about a collection
export async function getCollectionInfo(
  client: QdrantClient,
  name: string
): Promise<CollectionInfo | null> {
  const exists = await collectionExists(client, name);

  if (!exists) {
    // Find definition to get alias
    const definition = getAllCollections().find((c) => c.name === name);
    return {
      name,
      alias: definition?.alias || '',
      exists: false,
      pointsCount: null,
      vectorSize: null,
      status: null,
    };
  }

  const info = await client.getCollection(name);
  const definition = getAllCollections().find((c) => c.name === name);

  // Extract vector size from config
  // Qdrant supports single vectors (with size property) or named vectors (object of vectors)
  let vectorSize: number | null = null;
  const vectors = info.config.params.vectors;
  if (vectors) {
    if (typeof vectors === 'object' && 'size' in vectors && typeof vectors.size === 'number') {
      // Single vector config: { size: number, distance: string }
      vectorSize = vectors.size;
    }
    // For named vectors, we'd need to iterate - skip for now
  }

  return {
    name,
    alias: definition?.alias || '',
    exists: true,
    pointsCount: info.points_count ?? null,
    vectorSize,
    status: info.status,
  };
}

// Get all collections status
export async function getAllCollectionsStatus(client: QdrantClient): Promise<CollectionInfo[]> {
  const definitions = getAllCollections();
  const results: CollectionInfo[] = [];

  for (const definition of definitions) {
    const info = await getCollectionInfo(client, definition.name);
    if (info) {
      results.push(info);
    }
  }

  return results;
}

// Initialize all registered collections
export async function initializeAllCollections(
  client: QdrantClient
): Promise<Array<{ name: string; created: boolean }>> {
  const definitions = getAllCollections();
  const results: Array<{ name: string; created: boolean }> = [];

  for (const definition of definitions) {
    const result = await ensureCollection(client, definition);
    results.push(result);
  }

  return results;
}

// Delete a collection (use with caution!)
export async function deleteCollection(client: QdrantClient, name: string): Promise<boolean> {
  const exists = await collectionExists(client, name);

  if (!exists) {
    return false;
  }

  await client.deleteCollection(name);
  return true;
}

// Migration helper: create new collection with updated schema
export async function createMigrationCollection(
  client: QdrantClient,
  definition: CollectionDefinition,
  newVersion: number
): Promise<string> {
  const newName = `${definition.name}_v${newVersion}`;

  await client.createCollection(newName, {
    vectors: {
      size: definition.vectorSize,
      distance: definition.distance,
    },
    ...definition.config,
  });

  return newName;
}

// Migration helper: swap alias to new collection (atomic operation)
export async function swapCollectionAlias(
  client: QdrantClient,
  alias: string,
  oldCollectionName: string,
  newCollectionName: string
): Promise<void> {
  await client.updateCollectionAliases({
    actions: [
      { delete_alias: { alias_name: alias } },
      {
        create_alias: {
          collection_name: newCollectionName,
          alias_name: alias,
        },
      },
    ],
  });
}
