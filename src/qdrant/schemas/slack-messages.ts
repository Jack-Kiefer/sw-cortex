import { z } from 'zod';
import { DISTANCE_METRICS, VECTOR_SIZES } from '../config';

// Payload schema for Slack message vectors
export const SlackMessagePayloadSchema = z.object({
  messageId: z.string().describe('Slack message timestamp (ts)'),
  channelId: z.string().describe('Slack channel ID'),
  channelName: z.string().optional().describe('Human-readable channel name'),
  userId: z.string().describe('Slack user ID who sent the message'),
  userName: z.string().optional().describe('Human-readable user name'),
  text: z.string().describe('Original message text'),
  timestamp: z.number().describe('Unix timestamp of the message'),
  threadTs: z.string().optional().describe('Thread timestamp if this is a reply'),
  permalink: z.string().optional().describe('Slack permalink to the message'),
  version: z.number().default(1).describe('Schema version for migrations'),
});

export type SlackMessagePayload = z.infer<typeof SlackMessagePayloadSchema>;

// Collection definition
export const SlackMessagesCollection = {
  // Collection identity
  name: 'slack_messages',
  alias: 'slack_messages_current',
  description: 'Slack message embeddings for semantic search across workspace history',

  // Vector configuration
  vectorSize: VECTOR_SIZES.OPENAI_TEXT_EMBEDDING_3_SMALL,
  distance: DISTANCE_METRICS.COSINE,

  // Schema versioning
  version: 1,
  migrations: [{ version: 1, date: '2025-01-06', changes: 'Initial schema' }],

  // Payload validation
  payloadSchema: SlackMessagePayloadSchema,

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
} as const;

// Type for the collection definition
export type SlackMessagesCollectionType = typeof SlackMessagesCollection;
