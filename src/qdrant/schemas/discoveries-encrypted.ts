import { z } from 'zod';
import { DISTANCE_METRICS, VECTOR_SIZES } from '../config';

/**
 * Encrypted Discoveries Collection
 *
 * Stores discoveries with sensitive fields encrypted using AES-256-GCM.
 * The original `discoveries` collection remains for reference/rollback.
 *
 * Encrypted fields: title, description, sourceQuery
 * Plain fields: discoveryId, source, sourceDatabase, tableName, columnName,
 *               type, priority, tags, createdAt, updatedAt, version
 *
 * Encrypted field format: "iv:authTag:ciphertext" (all base64)
 */

export const DISCOVERY_ENCRYPTED_TYPE = {
  PATTERN: 'pattern',
  ANOMALY: 'anomaly',
  OPTIMIZATION: 'optimization',
  FACT: 'fact',
  RELATIONSHIP: 'relationship',
  INSIGHT: 'insight',
} as const;

export type DiscoveryEncryptedType =
  (typeof DISCOVERY_ENCRYPTED_TYPE)[keyof typeof DISCOVERY_ENCRYPTED_TYPE];

export const DiscoveryEncryptedPayloadSchema = z.object({
  // Identity
  discoveryId: z.string().describe('Unique discovery ID (UUID format)'),

  // ENCRYPTED content fields
  title: z.string().describe('ENCRYPTED: Discovery title'),
  description: z.string().nullable().describe('ENCRYPTED: Detailed description'),
  sourceQuery: z.string().nullable().describe('ENCRYPTED: SQL query that led to this'),

  // Plain metadata (needed for Qdrant filtering)
  source: z.string().describe('Source type: database_query, manual, code_review, exploration'),
  sourceDatabase: z.string().nullable().describe('Database name — plain for filtering'),
  tableName: z.string().nullable().describe('Table name — plain for filtering'),
  columnName: z.string().nullable().describe('Column name'),
  type: z
    .enum(['pattern', 'anomaly', 'optimization', 'fact', 'relationship', 'insight'])
    .default('insight')
    .describe('Type of discovery — plain for filtering'),
  priority: z.number().min(1).max(4).default(2).describe('Priority 1-4 — plain for filtering'),
  tags: z.array(z.string()).default([]).describe('Tags for categorization'),
  createdAt: z.number().describe('Unix timestamp when created'),
  updatedAt: z.number().describe('Unix timestamp when last updated'),
  version: z.number().default(2).describe('Schema version'),
  encrypted: z.boolean().default(true).describe('Flag indicating fields are encrypted'),
});

export type DiscoveryEncryptedPayload = z.infer<typeof DiscoveryEncryptedPayloadSchema>;

export const DiscoveriesEncryptedCollection = {
  name: 'discoveries_encrypted',
  alias: 'discoveries_enc_current',
  description: 'Encrypted discoveries with semantic search',

  vectorSize: VECTOR_SIZES.OPENAI_TEXT_EMBEDDING_3_SMALL,
  distance: DISTANCE_METRICS.COSINE,

  version: 2,
  migrations: [
    { version: 1, date: '2026-01-06', changes: 'Initial schema - migrated from SQLite' },
    {
      version: 2,
      date: '2026-03-18',
      changes: 'Encrypted sensitive fields (title, description, sourceQuery)',
    },
  ],

  payloadSchema: DiscoveryEncryptedPayloadSchema,

  config: {
    optimizers_config: {
      default_segment_number: 2,
    },
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
  },

  // Same indexes as original — only on plain fields
  payloadIndexes: [
    { field: 'sourceDatabase', type: 'keyword' as const },
    { field: 'tableName', type: 'keyword' as const },
    { field: 'type', type: 'keyword' as const },
    { field: 'source', type: 'keyword' as const },
    { field: 'priority', type: 'integer' as const },
    { field: 'createdAt', type: 'integer' as const },
  ],
} as const;

export type DiscoveriesEncryptedCollectionType = typeof DiscoveriesEncryptedCollection;
