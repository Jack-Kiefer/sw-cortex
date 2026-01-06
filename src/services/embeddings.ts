import OpenAI from 'openai';
import { z } from 'zod';

// Configuration schema
const EmbeddingConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default('text-embedding-3-small'),
  dimensions: z.number().default(1536),
  batchSize: z.number().default(100), // OpenAI supports up to 2048, but smaller batches are safer
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// Singleton client
let _client: OpenAI | null = null;
let _config: EmbeddingConfig | null = null;

function getConfig(): EmbeddingConfig {
  if (!_config) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    _config = EmbeddingConfigSchema.parse({ apiKey });
  }
  return _config;
}

function getClient(): OpenAI {
  if (!_client) {
    const config = getConfig();
    _client = new OpenAI({ apiKey: config.apiKey });
  }
  return _client;
}

// Generate embeddings for a batch of texts
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const config = getConfig();
  const client = getClient();

  // Split into batches if needed
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += config.batchSize) {
    batches.push(texts.slice(i, i + config.batchSize));
  }

  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const response = await client.embeddings.create({
      model: config.model,
      input: batch,
      dimensions: config.dimensions,
    });

    // Sort by index to maintain order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sorted.map((d) => d.embedding));
  }

  return allEmbeddings;
}

// Generate embedding for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

// Format a Slack message for embedding (includes context)
export function formatSlackMessageForEmbedding(
  text: string,
  userName?: string,
  channelName?: string,
  timestamp?: number
): string {
  const parts: string[] = [];

  if (userName) {
    parts.push(`${userName}:`);
  }

  parts.push(text);

  if (channelName) {
    parts.push(`[in #${channelName}]`);
  }

  if (timestamp) {
    const date = new Date(timestamp * 1000);
    parts.push(`[${date.toISOString().split('T')[0]}]`);
  }

  return parts.join(' ');
}

// Test connection to OpenAI
export async function testOpenAIConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const embedding = await generateEmbedding('test');
    return {
      connected: embedding.length === getConfig().dimensions,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get embedding model info
export function getEmbeddingModelInfo(): {
  model: string;
  dimensions: number;
  batchSize: number;
} {
  const config = getConfig();
  return {
    model: config.model,
    dimensions: config.dimensions,
    batchSize: config.batchSize,
  };
}
