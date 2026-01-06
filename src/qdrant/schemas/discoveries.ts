import { z } from 'zod';
import { DISTANCE_METRICS, VECTOR_SIZES } from '../config';

// Discovery type enum values (matching SQLite schema)
export const DISCOVERY_TYPE = {
  PATTERN: 'pattern',
  ANOMALY: 'anomaly',
  OPTIMIZATION: 'optimization',
  FACT: 'fact',
  RELATIONSHIP: 'relationship',
  INSIGHT: 'insight',
} as const;

export type DiscoveryType = (typeof DISCOVERY_TYPE)[keyof typeof DISCOVERY_TYPE];

// Payload schema for discovery vectors
export const DiscoveryPayloadSchema = z.object({
  // Identity - use string ID for Qdrant compatibility
  discoveryId: z.string().describe('Unique discovery ID (UUID format)'),

  // Core content
  title: z.string().describe('Discovery title'),
  description: z.string().nullable().describe('Detailed description of the discovery'),

  // Source context
  source: z.string().describe('Source type: database_query, manual, code_review, exploration'),
  sourceDatabase: z
    .string()
    .nullable()
    .describe('Database name: wishdesk, sugarwish, odoo, retool'),
  sourceQuery: z.string().nullable().describe('SQL query that led to this discovery'),

  // Table/Column reference
  tableName: z.string().nullable().describe('Specific table this note is about'),
  columnName: z.string().nullable().describe('Specific column (optional)'),

  // Classification
  type: z
    .enum(['pattern', 'anomaly', 'optimization', 'fact', 'relationship', 'insight'])
    .default('insight')
    .describe('Type of discovery'),
  priority: z.number().min(1).max(4).default(2).describe('Priority 1-4 (1=low, 4=critical)'),

  // Organization
  tags: z.array(z.string()).default([]).describe('Tags for categorization'),
  relatedTaskId: z.number().nullable().describe('Related task ID (for filtering)'),
  relatedProjectId: z.number().nullable().describe('Related project ID (for filtering)'),

  // Timestamps (stored as Unix milliseconds for Qdrant datetime filtering)
  createdAt: z.number().describe('Unix timestamp when created'),
  updatedAt: z.number().describe('Unix timestamp when last updated'),

  // Schema version for migrations
  version: z.number().default(1).describe('Schema version for migrations'),
});

export type DiscoveryPayload = z.infer<typeof DiscoveryPayloadSchema>;

// Collection definition
export const DiscoveriesCollection = {
  // Collection identity
  name: 'discoveries',
  alias: 'discoveries_current',
  description: 'Database discoveries and insights for semantic search',

  // Vector configuration
  vectorSize: VECTOR_SIZES.OPENAI_TEXT_EMBEDDING_3_SMALL,
  distance: DISTANCE_METRICS.COSINE,

  // Schema versioning
  version: 1,
  migrations: [
    { version: 1, date: '2026-01-06', changes: 'Initial schema - migrated from SQLite' },
  ],

  // Payload validation
  payloadSchema: DiscoveryPayloadSchema,

  // Qdrant-specific configuration
  config: {
    // Optimize for mixed search/filter workloads
    optimizers_config: {
      default_segment_number: 2,
    },
    // HNSW index parameters
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
  },

  // Payload indexes for efficient filtering
  indexes: [
    { field: 'sourceDatabase', type: 'keyword' as const },
    { field: 'tableName', type: 'keyword' as const },
    { field: 'type', type: 'keyword' as const },
    { field: 'source', type: 'keyword' as const },
    { field: 'priority', type: 'integer' as const },
    { field: 'relatedProjectId', type: 'integer' as const },
    { field: 'relatedTaskId', type: 'integer' as const },
    { field: 'createdAt', type: 'integer' as const },
  ],
} as const;

// Type for the collection definition
export type DiscoveriesCollectionType = typeof DiscoveriesCollection;
