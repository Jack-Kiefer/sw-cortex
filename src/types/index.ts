/**
 * Centralized type definitions for sw-cortex
 *
 * Discovery types are defined in src/qdrant/schemas/discoveries.ts
 * and re-exported from src/services/discoveries.ts
 */

// Re-export Drizzle types for backend/service use
export type { Discovery, NewDiscovery, Priority } from '../db/schema.js';

// Re-export constants
export { PRIORITY, DISCOVERY_TYPE } from '../db/schema.js';

// Re-export discovery service types
export type { DiscoveryPayload, DiscoveryType } from '../services/discoveries.js';
