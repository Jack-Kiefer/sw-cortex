/**
 * Discovery Search Service - Qdrant-based semantic search for discoveries
 *
 * Replaces SQLite storage with Qdrant vector database for:
 * - Semantic search over discovery content
 * - Metadata filtering (by database, table, type, etc.)
 * - Full-text searchability of title, description, and SQL queries
 */

import * as crypto from 'crypto';
import { generateEmbedding } from './embeddings';
import { getQdrantClient, DiscoveryPayloadSchema, DiscoveriesCollection } from '../qdrant';
import type { DiscoveryPayload, DiscoveryType } from '../qdrant';

// Re-export types
export type { DiscoveryPayload, DiscoveryType };
export { DISCOVERY_TYPE } from '../qdrant';

// Collection alias for all operations
const COLLECTION = DiscoveriesCollection.alias;

// Generate unique discovery ID (UUID format)
export function generateDiscoveryId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  const combined = `discovery:${timestamp}:${randomPart}`;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Format discovery content for embedding
export function formatDiscoveryForEmbedding(
  title: string,
  description?: string | null,
  sourceQuery?: string | null
): string {
  const parts: string[] = [title];

  if (description) {
    parts.push(description);
  }

  if (sourceQuery) {
    parts.push(`SQL: ${sourceQuery}`);
  }

  return parts.join('\n\n');
}

// Input type for adding a discovery
export interface AddDiscoveryInput {
  title: string;
  description?: string;
  source: string;
  sourceDatabase?: string;
  sourceQuery?: string;
  tableName?: string;
  columnName?: string;
  type?: DiscoveryType;
  priority?: number;
  tags?: string[];
  relatedTaskId?: number;
  relatedProjectId?: number;
}

// Full discovery with ID and timestamps
export interface Discovery extends DiscoveryPayload {
  id: string; // Alias for discoveryId
}

// Convert payload to Discovery type (adds id alias)
function payloadToDiscovery(payload: DiscoveryPayload): Discovery {
  return {
    ...payload,
    id: payload.discoveryId,
  };
}

// Add a new discovery to Qdrant
export async function addDiscovery(data: AddDiscoveryInput): Promise<Discovery> {
  const client = getQdrantClient();
  const now = Date.now();
  const discoveryId = generateDiscoveryId();

  // Build payload
  const payload = DiscoveryPayloadSchema.parse({
    discoveryId,
    title: data.title,
    description: data.description || null,
    source: data.source,
    sourceDatabase: data.sourceDatabase || null,
    sourceQuery: data.sourceQuery || null,
    tableName: data.tableName || null,
    columnName: data.columnName || null,
    type: data.type || 'insight',
    priority: data.priority || 2,
    tags: data.tags || [],
    relatedTaskId: data.relatedTaskId || null,
    relatedProjectId: data.relatedProjectId || null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  // Generate embedding from content
  const text = formatDiscoveryForEmbedding(payload.title, payload.description, payload.sourceQuery);
  const embedding = await generateEmbedding(text);

  // Upsert to Qdrant
  await client.upsert(COLLECTION, {
    wait: true,
    points: [
      {
        id: discoveryId,
        vector: embedding,
        payload,
      },
    ],
  });

  return payloadToDiscovery(payload);
}

// Search discoveries semantically
export async function searchDiscoveries(
  query: string,
  options: {
    limit?: number;
    sourceDatabase?: string;
    tableName?: string;
    type?: string;
    source?: string;
    projectId?: number;
    minScore?: number;
  } = {}
): Promise<Array<{ score: number; discovery: Discovery }>> {
  const client = getQdrantClient();

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter conditions
  const must: Array<{ key: string; match: { value: string | number } }> = [];

  if (options.sourceDatabase) {
    must.push({ key: 'sourceDatabase', match: { value: options.sourceDatabase } });
  }
  if (options.tableName) {
    must.push({ key: 'tableName', match: { value: options.tableName } });
  }
  if (options.type) {
    must.push({ key: 'type', match: { value: options.type } });
  }
  if (options.source) {
    must.push({ key: 'source', match: { value: options.source } });
  }
  if (options.projectId) {
    must.push({ key: 'relatedProjectId', match: { value: options.projectId } });
  }

  const filter = must.length > 0 ? { must } : undefined;

  // Search Qdrant
  const results = await client.search(COLLECTION, {
    vector: queryEmbedding,
    limit: options.limit || 20,
    filter,
    score_threshold: options.minScore || 0.3,
    with_payload: true,
  });

  return results.map((result) => ({
    score: result.score,
    discovery: payloadToDiscovery(result.payload as unknown as DiscoveryPayload),
  }));
}

// Get discovery by ID
export async function getDiscovery(id: string): Promise<Discovery | null> {
  const client = getQdrantClient();

  try {
    const results = await client.retrieve(COLLECTION, {
      ids: [id],
      with_payload: true,
    });

    if (results.length === 0) {
      return null;
    }

    return payloadToDiscovery(results[0].payload as unknown as DiscoveryPayload);
  } catch {
    return null;
  }
}

// List discoveries with optional filters (no semantic search, just metadata filtering)
export async function listDiscoveries(filters?: {
  source?: string;
  sourceDatabase?: string;
  type?: string;
  projectId?: number;
  limit?: number;
}): Promise<Discovery[]> {
  const client = getQdrantClient();

  // Build filter conditions
  const must: Array<{ key: string; match: { value: string | number } }> = [];

  if (filters?.source) {
    must.push({ key: 'source', match: { value: filters.source } });
  }
  if (filters?.sourceDatabase) {
    must.push({ key: 'sourceDatabase', match: { value: filters.sourceDatabase } });
  }
  if (filters?.type) {
    must.push({ key: 'type', match: { value: filters.type } });
  }
  if (filters?.projectId) {
    must.push({ key: 'relatedProjectId', match: { value: filters.projectId } });
  }

  const filter = must.length > 0 ? { must } : undefined;

  // Use scroll to get all matching points
  const results = await client.scroll(COLLECTION, {
    filter,
    limit: filters?.limit || 100,
    with_payload: true,
    order_by: { key: 'createdAt', direction: 'desc' },
  });

  return results.points.map((point) =>
    payloadToDiscovery(point.payload as unknown as DiscoveryPayload)
  );
}

// Get notes for a specific database table
export async function getTableNotes(database: string, table: string): Promise<Discovery[]> {
  const client = getQdrantClient();

  const results = await client.scroll(COLLECTION, {
    filter: {
      must: [
        { key: 'sourceDatabase', match: { value: database } },
        { key: 'tableName', match: { value: table } },
      ],
    },
    limit: 100,
    with_payload: true,
    order_by: { key: 'createdAt', direction: 'desc' },
  });

  return results.points.map((point) =>
    payloadToDiscovery(point.payload as unknown as DiscoveryPayload)
  );
}

// Update a discovery
export async function updateDiscovery(
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    priority?: number;
    tags?: string[];
    relatedTaskId?: number | null;
    relatedProjectId?: number | null;
  }
): Promise<Discovery | null> {
  const client = getQdrantClient();

  // Get existing discovery
  const existing = await getDiscovery(id);
  if (!existing) {
    return null;
  }

  // Merge updates
  const updatedPayload = DiscoveryPayloadSchema.parse({
    ...existing,
    title: data.title ?? existing.title,
    description: data.description ?? existing.description,
    type: data.type ?? existing.type,
    priority: data.priority ?? existing.priority,
    tags: data.tags ?? existing.tags,
    relatedTaskId: data.relatedTaskId !== undefined ? data.relatedTaskId : existing.relatedTaskId,
    relatedProjectId:
      data.relatedProjectId !== undefined ? data.relatedProjectId : existing.relatedProjectId,
    updatedAt: Date.now(),
  });

  // Re-generate embedding if text content changed
  const textChanged =
    data.title !== undefined ||
    data.description !== undefined ||
    (existing.sourceQuery !== undefined && existing.sourceQuery !== null);

  let embedding: number[] | undefined;
  if (textChanged) {
    const text = formatDiscoveryForEmbedding(
      updatedPayload.title,
      updatedPayload.description,
      updatedPayload.sourceQuery
    );
    embedding = await generateEmbedding(text);
  }

  // Update in Qdrant
  if (embedding) {
    // Full update with new embedding
    await client.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id,
          vector: embedding,
          payload: updatedPayload,
        },
      ],
    });
  } else {
    // Payload-only update
    await client.setPayload(COLLECTION, {
      payload: updatedPayload,
      points: [id],
      wait: true,
    });
  }

  return payloadToDiscovery(updatedPayload);
}

// Delete a discovery
export async function deleteDiscovery(id: string): Promise<boolean> {
  const client = getQdrantClient();

  try {
    await client.delete(COLLECTION, {
      wait: true,
      points: [id],
    });
    return true;
  } catch {
    return false;
  }
}

// Get discovery details with related task and project info
// Note: Since Qdrant doesn't have JOINs, we return IDs only
// The MCP layer can hydrate from SQLite if needed
export async function getDiscoveryDetails(id: string): Promise<{
  discovery: Discovery;
  relatedTaskId: number | null;
  relatedProjectId: number | null;
} | null> {
  const discovery = await getDiscovery(id);
  if (!discovery) return null;

  return {
    discovery,
    relatedTaskId: discovery.relatedTaskId,
    relatedProjectId: discovery.relatedProjectId,
  };
}

// Export discoveries to JSON or Markdown format
export async function exportDiscoveries(options?: {
  format?: 'json' | 'markdown';
  sourceDatabase?: string;
  projectId?: number;
}): Promise<string> {
  const format = options?.format || 'markdown';
  const items = await listDiscoveries({
    sourceDatabase: options?.sourceDatabase,
    projectId: options?.projectId,
    limit: 1000, // Higher limit for exports
  });

  if (format === 'json') {
    return JSON.stringify(items, null, 2);
  }

  // Markdown format
  const lines: string[] = ['# Database Discoveries', ''];

  // Group by source database
  const byDatabase: Record<string, Discovery[]> = {};
  for (const item of items) {
    const db = item.sourceDatabase || 'Other';
    if (!byDatabase[db]) byDatabase[db] = [];
    byDatabase[db].push(item);
  }

  for (const [database, dbItems] of Object.entries(byDatabase)) {
    lines.push(`## ${database}`, '');

    for (const item of dbItems) {
      const tags = item.tags.join(', ');
      const priority = ['', 'Low', 'Medium', 'High', 'Critical'][item.priority || 2];

      lines.push(`### ${item.title}`);
      lines.push('');
      if (item.description) {
        lines.push(item.description);
        lines.push('');
      }
      lines.push(`- **Type**: ${item.type || 'insight'}`);
      lines.push(`- **Priority**: ${priority}`);
      lines.push(`- **Source**: ${item.source}`);
      if (tags) lines.push(`- **Tags**: ${tags}`);
      if (item.sourceQuery) {
        lines.push('');
        lines.push('```sql');
        lines.push(item.sourceQuery);
        lines.push('```');
      }
      lines.push('');
      lines.push(`*Created: ${new Date(item.createdAt).toISOString().split('T')[0]}*`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Get discovery statistics
export async function getDiscoveryStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byDatabase: Record<string, number>;
  bySource: Record<string, number>;
}> {
  const all = await listDiscoveries({ limit: 10000 });

  const byType: Record<string, number> = {};
  const byDatabase: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const item of all) {
    const type = item.type || 'insight';
    const database = item.sourceDatabase || 'unknown';
    const source = item.source;

    byType[type] = (byType[type] || 0) + 1;
    byDatabase[database] = (byDatabase[database] || 0) + 1;
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    total: all.length,
    byType,
    byDatabase,
    bySource,
  };
}

// Initialize the discoveries collection (creates if not exists)
export async function initializeDiscoveriesCollection(): Promise<void> {
  const client = getQdrantClient();
  const { ensureCollection } = await import('../qdrant/utils');

  // Create collection if it doesn't exist
  await ensureCollection(client, DiscoveriesCollection);

  // Create payload indexes for efficient filtering
  const indexes = DiscoveriesCollection.indexes || [];
  for (const { field, type } of indexes) {
    try {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: type,
        wait: true,
      });
    } catch (error) {
      // Index may already exist, that's okay
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn(`Failed to create index for ${field}:`, error.message);
      }
    }
  }
}
