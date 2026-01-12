import { z } from 'zod';
import { DISTANCE_METRICS, VECTOR_SIZES } from '../config';

/**
 * Encrypted Slack Messages Collection
 *
 * This collection stores Slack messages with sensitive fields encrypted using AES-256-GCM.
 * The original `slack_messages` collection remains unchanged for reference/rollback.
 *
 * Encrypted fields: text, userName, channelName
 * Plain fields: messageId, channelId, userId, timestamp, threadTs, permalink (needed for filtering)
 *
 * Encrypted field format: "iv:authTag:ciphertext" (all base64)
 */

// Payload schema for encrypted Slack message vectors
export const SlackMessageEncryptedPayloadSchema = z.object({
  messageId: z.string().describe('Slack message timestamp (ts) - plain for deduplication'),
  channelId: z.string().describe('Slack channel ID - plain for filtering'),
  channelName: z.string().optional().describe('ENCRYPTED: Human-readable channel name'),
  userId: z.string().describe('Slack user ID - plain for filtering'),
  userName: z.string().optional().describe('ENCRYPTED: Human-readable user name'),
  text: z.string().describe('ENCRYPTED: Original message text'),
  timestamp: z.number().describe('Unix timestamp - plain for date filtering'),
  threadTs: z.string().optional().describe('Thread timestamp if reply - plain'),
  permalink: z.string().optional().describe('Slack permalink - plain'),
  version: z.number().default(1).describe('Schema version for migrations'),
  encrypted: z.boolean().default(true).describe('Flag indicating fields are encrypted'),
});

export type SlackMessageEncryptedPayload = z.infer<typeof SlackMessageEncryptedPayloadSchema>;

// Collection definition
export const SlackMessagesEncryptedCollection = {
  // Collection identity
  name: 'slack_messages_encrypted',
  alias: 'slack_messages_encrypted_current',
  description: 'Encrypted Slack message embeddings for secure semantic search',

  // Vector configuration (same as original - embeddings are not encrypted)
  vectorSize: VECTOR_SIZES.OPENAI_TEXT_EMBEDDING_3_SMALL,
  distance: DISTANCE_METRICS.COSINE,

  // Schema versioning
  version: 1,
  migrations: [{ version: 1, date: '2025-01-12', changes: 'Initial encrypted schema' }],

  // Payload validation
  payloadSchema: SlackMessageEncryptedPayloadSchema,

  // Qdrant-specific configuration
  config: {
    // Optimize for search performance
    optimizers_config: {
      default_segment_number: 2,
    },
    // HNSW index parameters
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
  },

  // Payload indexes for filtering (required with strict_mode enabled)
  payloadIndexes: [
    { field: 'channelId', type: 'keyword' as const },
    { field: 'userId', type: 'keyword' as const },
    { field: 'messageId', type: 'keyword' as const },
    { field: 'threadTs', type: 'keyword' as const },
    { field: 'timestamp', type: 'float' as const },
  ],
} as const;

// Type for the collection definition
export type SlackMessagesEncryptedCollectionType = typeof SlackMessagesEncryptedCollection;
