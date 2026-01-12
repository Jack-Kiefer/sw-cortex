import { z } from 'zod';
import { DistanceMetric } from './config';
import { SlackMessagesCollection } from './schemas/slack-messages';
import { SlackMessagesEncryptedCollection } from './schemas/slack-messages-encrypted';
import { DiscoveriesCollection } from './schemas/discoveries';

// Payload index types supported by Qdrant
export type PayloadIndexType =
  | 'keyword'
  | 'integer'
  | 'float'
  | 'bool'
  | 'geo'
  | 'datetime'
  | 'text';

// Generic collection definition type
export interface CollectionDefinition<T extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly alias: string;
  readonly description: string;
  readonly vectorSize: number;
  readonly distance: DistanceMetric;
  readonly version: number;
  readonly migrations: ReadonlyArray<{
    readonly version: number;
    readonly date: string;
    readonly changes: string;
  }>;
  readonly payloadSchema: T;
  readonly config?: {
    readonly optimizers_config?: {
      readonly default_segment_number?: number;
    };
    readonly hnsw_config?: {
      readonly m?: number;
      readonly ef_construct?: number;
    };
  };
  // Payload indexes for filtering (required when strict_mode is enabled)
  readonly payloadIndexes?: ReadonlyArray<{
    readonly field: string;
    readonly type: PayloadIndexType;
  }>;
}

// Central registry of all collections
export const COLLECTIONS = {
  slackMessages: SlackMessagesCollection,
  slackMessagesEncrypted: SlackMessagesEncryptedCollection,
  discoveries: DiscoveriesCollection,
} as const;

// Type-safe collection names
export type CollectionName = keyof typeof COLLECTIONS;

// Get collection by name
export function getCollection(name: CollectionName) {
  return COLLECTIONS[name];
}

// Get all collection definitions
export function getAllCollections() {
  return Object.values(COLLECTIONS);
}

// Get collection names
export function getCollectionNames(): CollectionName[] {
  return Object.keys(COLLECTIONS) as CollectionName[];
}
