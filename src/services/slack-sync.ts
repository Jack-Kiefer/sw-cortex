import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  streamChannels,
  fetchChannelMessages,
  testSlackConnection,
  SlackMessage,
} from './slack-fetcher';
import { generateEmbeddings, formatSlackMessageForEmbedding } from './embeddings';
import { getQdrantClient, SlackMessagePayloadSchema } from '../qdrant';
import type { SlackMessagePayload } from '../qdrant';

// Sync state tracking
interface ChannelSyncState {
  channelId: string;
  channelName: string;
  lastSyncedTs: string; // Most recent message timestamp synced
  messageCount: number; // Total messages synced
  lastSyncTime: string; // ISO timestamp of last sync
}

interface SyncState {
  channels: Record<string, ChannelSyncState>;
  lastFullSync: string | null;
  totalMessages: number;
}

// State file path
const STATE_FILE = path.join(process.cwd(), 'tasks', 'slack-sync-state.json');

// Load sync state from file
function loadSyncState(): SyncState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load sync state, starting fresh:', error);
  }

  return {
    channels: {},
    lastFullSync: null,
    totalMessages: 0,
  };
}

// Save sync state to file
function saveSyncState(state: SyncState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Convert SlackMessage to Qdrant payload
function messageToPayload(message: SlackMessage): SlackMessagePayload {
  return SlackMessagePayloadSchema.parse({
    messageId: message.ts,
    channelId: message.channelId,
    channelName: message.channelName,
    userId: message.userId,
    userName: message.userName,
    text: message.text,
    timestamp: message.timestamp,
    threadTs: message.threadTs,
    version: 1,
  });
}

// Generate unique point ID from message ts (Qdrant needs uint64 or UUID)
function generatePointId(channelId: string, messageTs: string): string {
  // Use channel + ts as composite key, generate deterministic UUID via crypto
  const combined = `${channelId}:${messageTs}`;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  // Format as UUID v4 style: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Sync options
export interface SyncOptions {
  channels?: string[]; // Specific channel IDs to sync (empty = all)
  maxMessagesPerChannel?: number; // Limit per channel (0 = all)
  includeThreads?: boolean; // Fetch thread replies
  dryRun?: boolean; // Don't actually write to Qdrant
  verbose?: boolean; // Extra logging
}

// Sync result
export interface SyncResult {
  channelsSynced: number;
  messagesProcessed: number;
  messagesIndexed: number;
  messagesSkipped: number;
  errors: string[];
  duration: number;
}

// Main sync function
export async function syncSlackMessages(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    channelsSynced: 0,
    messagesProcessed: 0,
    messagesIndexed: 0,
    messagesSkipped: 0,
    errors: [],
    duration: 0,
  };

  const state = loadSyncState();
  const client = getQdrantClient();

  // Test connections
  console.log('Testing Slack connection...');
  const slackTest = await testSlackConnection();
  if (!slackTest.connected) {
    throw new Error(`Slack connection failed: ${slackTest.error}`);
  }
  console.log(`Connected to Slack as ${slackTest.user} in ${slackTest.team}`);

  // Process channels as we find them (streaming)
  console.log('Scanning and syncing channels...\n');
  let channelCount = 0;

  for await (const channel of streamChannels(options.verbose)) {
    // Skip if filtering to specific channels
    if (options.channels && options.channels.length > 0) {
      if (!options.channels.includes(channel.id)) continue;
    }

    channelCount++;
    try {
      // Always show which channel we're on
      const channelLabel = channel.isDm ? `DM: ${channel.name}` : `#${channel.name}`;
      process.stdout.write(`[${channelCount}] ${channelLabel}... `);

      if (options.verbose) {
        console.log(''); // newline for verbose mode
      }

      // Get last synced timestamp for incremental sync
      const channelState = state.channels[channel.id];
      const oldestTs = channelState?.lastSyncedTs;

      if (options.verbose && oldestTs) {
        // Note: this prints after the channel label
        process.stdout.write(
          `(since ${new Date(parseFloat(oldestTs) * 1000).toLocaleDateString()}) `
        );
      }

      // Fetch messages
      const messages = await fetchChannelMessages(channel.id, channel.name, {
        oldest: oldestTs,
        limit: options.maxMessagesPerChannel,
      });

      if (messages.length === 0) {
        console.log('up to date');
        continue;
      }

      console.log(`${messages.length} new messages`);
      result.messagesProcessed += messages.length;

      if (options.dryRun) {
        console.log(`    [DRY RUN] Would index ${messages.length} messages`);
        result.messagesSkipped += messages.length;
        continue;
      }

      // Generate embeddings in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);

        // Format messages for embedding
        const texts = batch.map((msg) =>
          formatSlackMessageForEmbedding(msg.text, msg.userName, msg.channelName, msg.timestamp)
        );

        // Generate embeddings
        const embeddings = await generateEmbeddings(texts);

        // Prepare points for Qdrant
        const points = batch.map((msg, idx) => ({
          id: generatePointId(msg.channelId, msg.ts),
          vector: embeddings[idx],
          payload: messageToPayload(msg),
        }));

        // Upsert to Qdrant (idempotent - safe to re-run)
        await client.upsert('slack_messages', {
          wait: true,
          points,
        });

        result.messagesIndexed += batch.length;

        if (options.verbose) {
          console.log(
            `    Indexed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messages.length / BATCH_SIZE)}`
          );
        }
      }

      // Update sync state
      const newestMessage = messages.reduce((a, b) =>
        parseFloat(a.ts) > parseFloat(b.ts) ? a : b
      );

      state.channels[channel.id] = {
        channelId: channel.id,
        channelName: channel.name,
        lastSyncedTs: newestMessage.ts,
        messageCount: (channelState?.messageCount || 0) + messages.length,
        lastSyncTime: new Date().toISOString(),
      };

      result.channelsSynced++;
      saveSyncState(state);
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      const errorMsg = `Failed to sync channel ${channel.name}: ${errorDetail}`;
      console.error(errorMsg);
      if (error instanceof Error && error.stack && options.verbose) {
        console.error('Stack:', error.stack);
      }
      result.errors.push(errorMsg);
    }
  }

  // Update total state
  state.totalMessages = Object.values(state.channels).reduce((sum, c) => sum + c.messageCount, 0);
  state.lastFullSync = new Date().toISOString();
  saveSyncState(state);

  result.duration = Date.now() - startTime;
  return result;
}

// Get current sync status
export function getSyncStatus(): SyncState {
  return loadSyncState();
}

// Reset sync state (will re-sync everything)
export function resetSyncState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
  console.log('Sync state reset. Next sync will fetch all messages.');
}

// Search Slack messages semantically
export async function searchSlackMessages(
  query: string,
  options: {
    limit?: number;
    channelId?: string;
    minScore?: number;
  } = {}
): Promise<
  Array<{
    score: number;
    message: SlackMessagePayload;
  }>
> {
  const client = getQdrantClient();
  const { generateEmbedding } = await import('./embeddings');

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter
  const filter = options.channelId
    ? {
        must: [{ key: 'channelId', match: { value: options.channelId } }],
      }
    : undefined;

  // Search Qdrant
  const results = await client.search('slack_messages', {
    vector: queryEmbedding,
    limit: options.limit || 10,
    filter,
    score_threshold: options.minScore || 0.3,
    with_payload: true,
  });

  return results.map((result) => ({
    score: result.score,
    message: result.payload as unknown as SlackMessagePayload,
  }));
}

// Get messages from a channel around a specific timestamp
export async function getSlackContext(
  channelId: string,
  timestamp: number,
  options: {
    windowMinutes?: number; // Time window +/- in minutes (default 30)
    limit?: number; // Max messages (default 20)
  } = {}
): Promise<SlackMessagePayload[]> {
  const client = getQdrantClient();
  const windowMinutes = options.windowMinutes || 30;
  const windowSeconds = windowMinutes * 60;

  // Calculate time range
  const minTime = timestamp - windowSeconds;
  const maxTime = timestamp + windowSeconds;

  // Query Qdrant with filter
  const results = await client.scroll('slack_messages', {
    filter: {
      must: [
        { key: 'channelId', match: { value: channelId } },
        { key: 'timestamp', range: { gte: minTime, lte: maxTime } },
      ],
    },
    limit: options.limit || 20,
    with_payload: true,
    with_vector: false,
  });

  // Sort by timestamp and return
  const messages = results.points.map((p) => p.payload as unknown as SlackMessagePayload);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
