// Qdrant Vector Database Module
// Provides typed collection management, client access, and utilities

// Client
export { getQdrantClient, resetQdrantClient, testConnection } from './client';

// Configuration
export { getQdrantConfig, DISTANCE_METRICS, VECTOR_SIZES } from './config';
export type { QdrantConfig, DistanceMetric } from './config';

// Collections
export { COLLECTIONS, getCollection, getAllCollections, getCollectionNames } from './collections';
export type { CollectionDefinition, CollectionName } from './collections';

// Schemas
export { SlackMessagesCollection, SlackMessagePayloadSchema } from './schemas/slack-messages';
export type { SlackMessagePayload } from './schemas/slack-messages';
export {
  DiscoveriesCollection,
  DiscoveryPayloadSchema,
  DISCOVERY_TYPE,
} from './schemas/discoveries';
export type { DiscoveryPayload, DiscoveryType } from './schemas/discoveries';

// Utilities
export {
  collectionExists,
  ensureCollection,
  getCollectionInfo,
  getAllCollectionsStatus,
  initializeAllCollections,
  deleteCollection,
  createMigrationCollection,
  swapCollectionAlias,
} from './utils';
export type { CollectionInfo } from './utils';
