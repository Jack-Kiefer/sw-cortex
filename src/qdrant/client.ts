import { QdrantClient } from '@qdrant/js-client-rest';
import { getQdrantConfig } from './config';

// Singleton client instance
let _client: QdrantClient | null = null;

// Get or create the Qdrant client singleton
export function getQdrantClient(): QdrantClient {
  if (!_client) {
    const config = getQdrantConfig();
    _client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
  }
  return _client;
}

// Reset the client (useful for testing or reconnection)
export function resetQdrantClient(): void {
  _client = null;
}

// Test connection to Qdrant
export async function testConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const client = getQdrantClient();
    await client.getCollections();
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
