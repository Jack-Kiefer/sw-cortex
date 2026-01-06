import { z } from 'zod';

// Environment configuration schema with Zod validation
const QdrantConfigSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1),
  timeout: z.number().default(30000),
});

export type QdrantConfig = z.infer<typeof QdrantConfigSchema>;

// Parse and validate environment variables
function loadConfig(): QdrantConfig {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url) {
    throw new Error('QDRANT_URL environment variable is required');
  }

  if (!apiKey) {
    throw new Error('QDRANT_API_KEY environment variable is required');
  }

  return QdrantConfigSchema.parse({
    url,
    apiKey,
    timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000', 10),
  });
}

// Lazy-loaded config (validated on first access)
let _config: QdrantConfig | null = null;

export function getQdrantConfig(): QdrantConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// Distance metrics supported by Qdrant
export const DISTANCE_METRICS = {
  COSINE: 'Cosine',
  EUCLID: 'Euclid',
  DOT: 'Dot',
} as const;

export type DistanceMetric = (typeof DISTANCE_METRICS)[keyof typeof DISTANCE_METRICS];

// Common vector sizes for popular embedding models
export const VECTOR_SIZES = {
  OPENAI_TEXT_EMBEDDING_3_SMALL: 1536,
  OPENAI_TEXT_EMBEDDING_3_LARGE: 3072,
  OPENAI_TEXT_EMBEDDING_ADA_002: 1536,
  COHERE_EMBED_V3: 1024,
  VOYAGE_2: 1024,
} as const;
