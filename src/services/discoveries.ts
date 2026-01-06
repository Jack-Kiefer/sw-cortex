/**
 * Discoveries Service - Capture and manage insights from database queries
 *
 * This module now uses Qdrant vector database for storage and semantic search.
 * All operations are handled by the discovery-search service.
 *
 * @see ./discovery-search.ts for implementation details
 */

// Re-export everything from discovery-search for backward compatibility
export {
  // Types
  type Discovery,
  type DiscoveryPayload,
  type DiscoveryType,
  type AddDiscoveryInput,
  DISCOVERY_TYPE,
  // Core operations
  addDiscovery,
  getDiscovery,
  getDiscoveryDetails,
  updateDiscovery,
  deleteDiscovery,
  // List and search
  listDiscoveries,
  searchDiscoveries,
  getTableNotes,
  // Export and stats
  exportDiscoveries,
  getDiscoveryStats,
  // Initialization
  initializeDiscoveriesCollection,
} from './discovery-search';

// Legacy type alias for backward compatibility with MCP tools
// The MCP tools expect NewDiscovery type
export type { AddDiscoveryInput as NewDiscovery } from './discovery-search';
