import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import {
  streamChannels,
  fetchChannelMessages,
  fetchThreadReplies,
  testSlackConnection,
  SlackMessage,
} from './slack-fetcher';
import { generateEmbeddings, formatSlackMessageForEmbedding } from './embeddings';
import { getQdrantClient, SlackMessageEncryptedPayloadSchema } from '../qdrant';
import type { SlackMessageEncryptedPayload } from '../qdrant';
import { encrypt, encryptField, decrypt, decryptField, validateEncryptionKey } from './encryption';

/**
 * Encrypted Slack Sync Service
 *
 * This service syncs Slack messages to a new encrypted Qdrant collection.
 * Sensitive fields (text, userName, channelName) are encrypted with AES-256-GCM.
 * The original slack_messages collection remains untouched.
 */

// Collection name for encrypted messages
const ENCRYPTED_COLLECTION = 'slack_messages_encrypted';

// Sync state tracking (separate from original)
interface ChannelSyncState {
  channelId: string;
  channelName: string;
  lastSyncedTs: string;
  messageCount: number;
  lastSyncTime: string;
}

interface SyncState {
  channels: Record<string, ChannelSyncState>;
  lastFullSync: string | null;
  totalMessages: number;
}

// State file path (separate from original)
const STATE_FILE = path.join(process.cwd(), 'tasks', 'slack-sync-encrypted-state.json');

function loadSyncState(): SyncState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load encrypted sync state, starting fresh:', error);
  }

  return {
    channels: {},
    lastFullSync: null,
    totalMessages: 0,
  };
}

function saveSyncState(state: SyncState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Convert SlackMessage to encrypted Qdrant payload
function messageToEncryptedPayload(message: SlackMessage): SlackMessageEncryptedPayload {
  return SlackMessageEncryptedPayloadSchema.parse({
    messageId: message.ts,
    channelId: message.channelId,
    channelName: encryptField(message.channelName), // ENCRYPTED
    userId: message.userId,
    userName: encryptField(message.userName), // ENCRYPTED
    text: encrypt(message.text), // ENCRYPTED (required field)
    timestamp: message.timestamp,
    threadTs: message.threadTs,
    version: 1,
    encrypted: true,
  });
}

// Decrypt payload for returning to caller
export function decryptPayload(payload: SlackMessageEncryptedPayload): {
  messageId: string;
  channelId: string;
  channelName?: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: number;
  threadTs?: string;
  permalink?: string;
} {
  return {
    messageId: payload.messageId,
    channelId: payload.channelId,
    channelName: decryptField(payload.channelName),
    userId: payload.userId,
    userName: decryptField(payload.userName),
    text: decrypt(payload.text),
    timestamp: payload.timestamp,
    threadTs: payload.threadTs,
    permalink: payload.permalink,
  };
}

// Generate unique point ID from message ts
function generatePointId(channelId: string, messageTs: string): string {
  const combined = `${channelId}:${messageTs}:encrypted`;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Sync options
export interface EncryptedSyncOptions {
  channels?: string[];
  maxMessagesPerChannel?: number;
  includeThreads?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

// Sync result
export interface EncryptedSyncResult {
  channelsSynced: number;
  messagesProcessed: number;
  messagesIndexed: number;
  messagesSkipped: number;
  threadsFetched: number;
  threadRepliesIndexed: number;
  errors: string[];
  duration: number;
}

// Channel data collected during pre-scan
interface ChannelData {
  id: string;
  name: string;
  isDm: boolean;
  messages: SlackMessage[];
  threadParents: SlackMessage[];
}

// Format duration for display
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

// Main sync function for encrypted collection
export async function syncSlackMessagesEncrypted(
  options: EncryptedSyncOptions = {}
): Promise<EncryptedSyncResult> {
  const startTime = Date.now();
  const result: EncryptedSyncResult = {
    channelsSynced: 0,
    messagesProcessed: 0,
    messagesIndexed: 0,
    messagesSkipped: 0,
    threadsFetched: 0,
    threadRepliesIndexed: 0,
    errors: [],
    duration: 0,
  };

  // Validate encryption key first
  const keyValidation = validateEncryptionKey();
  if (!keyValidation.valid) {
    throw new Error(`Encryption key validation failed: ${keyValidation.error}`);
  }

  const state = loadSyncState();
  const client = getQdrantClient();

  // Test connections
  console.log('Testing Slack connection...');
  const slackTest = await testSlackConnection();
  if (!slackTest.connected) {
    throw new Error(`Slack connection failed: ${slackTest.error}`);
  }
  console.log(`Connected to Slack as ${slackTest.user} in ${slackTest.team}`);
  console.log(`Syncing to ENCRYPTED collection: ${ENCRYPTED_COLLECTION}\n`);

  // ========================================
  // PHASE 1: Pre-scan all channels
  // ========================================
  console.log('Phase 1: Scanning channels for new messages...\n');
  const channelsToSync: ChannelData[] = [];
  let scanCount = 0;

  for await (const channel of streamChannels(options.verbose)) {
    if (options.channels && options.channels.length > 0) {
      if (!options.channels.includes(channel.id)) continue;
    }

    scanCount++;
    const channelLabel = channel.isDm ? `DM: ${channel.name}` : `#${channel.name}`;
    process.stdout.write(`\r  Scanning [${scanCount}] ${channelLabel}...`.padEnd(60));

    try {
      const channelState = state.channels[channel.id];
      const oldestTs = channelState?.lastSyncedTs;

      const messages = await fetchChannelMessages(channel.id, channel.name, {
        oldest: oldestTs,
        limit: options.maxMessagesPerChannel,
      });

      if (messages.length > 0) {
        const threadParents = options.includeThreads
          ? messages.filter((m) => m.isThreadParent)
          : [];
        channelsToSync.push({
          id: channel.id,
          name: channel.name,
          isDm: channel.isDm,
          messages,
          threadParents,
        });
      }
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to scan channel ${channel.name}: ${errorDetail}`);
    }
  }
  console.log(`\r  Scanned ${scanCount} channels`.padEnd(60));

  // ========================================
  // Calculate totals and display summary
  // ========================================
  const totalMessages = channelsToSync.reduce((sum, ch) => sum + ch.messages.length, 0);
  const totalThreads = channelsToSync.reduce((sum, ch) => sum + ch.threadParents.length, 0);
  const channelsWithUpdates = channelsToSync.length;

  if (channelsWithUpdates === 0) {
    console.log('\nAll channels up to date. Nothing to sync.\n');
    result.duration = Date.now() - startTime;
    return result;
  }

  // Estimate time:
  // - ~0.5s per thread (parallel fetching with SDK rate limit handling)
  // - ~0.5s per message batch of 50 (embedding + upsert)
  const SECONDS_PER_THREAD = 0.5;
  const SECONDS_PER_BATCH = 0.5;
  const BATCH_SIZE = 50;

  const threadTime = totalThreads * SECONDS_PER_THREAD;
  const batchCount = Math.ceil(totalMessages / BATCH_SIZE);
  const processingTime = batchCount * SECONDS_PER_BATCH;
  const estimatedTotalSeconds = Math.ceil(threadTime + processingTime);

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│                    SYNC SUMMARY                         │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(
    `│  Channels to sync:    ${String(channelsWithUpdates).padStart(6)}                          │`
  );
  console.log(
    `│  Messages to fetch:   ${String(totalMessages).padStart(6)}                          │`
  );
  if (options.includeThreads) {
    console.log(
      `│  Threads to fetch:    ${String(totalThreads).padStart(6)}                          │`
    );
  }
  console.log(
    `│  Estimated time:      ${formatDuration(estimatedTotalSeconds).padStart(6)}                          │`
  );
  console.log('└─────────────────────────────────────────────────────────┘\n');

  // Channel breakdown
  console.log('Channels with new messages:');
  for (const ch of channelsToSync) {
    const label = ch.isDm ? `DM: ${ch.name}` : `#${ch.name}`;
    const threadInfo =
      options.includeThreads && ch.threadParents.length > 0
        ? ` (${ch.threadParents.length} threads)`
        : '';
    console.log(`  ${label}: ${ch.messages.length} messages${threadInfo}`);
  }
  console.log('');

  // ========================================
  // PHASE 2: Fetch threads and index
  // ========================================
  console.log('Phase 2: Fetching threads and indexing...\n');

  for (let chIdx = 0; chIdx < channelsToSync.length; chIdx++) {
    const channelData = channelsToSync[chIdx];
    const channelLabel = channelData.isDm ? `DM: ${channelData.name}` : `#${channelData.name}`;

    try {
      process.stdout.write(`[${chIdx + 1}/${channelsWithUpdates}] ${channelLabel}... `);

      const allMessages = [...channelData.messages];

      // Fetch thread replies if enabled
      if (options.includeThreads && channelData.threadParents.length > 0) {
        const threadCount = channelData.threadParents.length;
        console.log(`fetching ${threadCount} threads (parallel)...`);
        let threadReplyCount = 0;
        let completedThreads = 0;
        const threadStartTime = Date.now();

        // Parallel fetching with concurrency limit
        // SDK handles rate limits automatically - 5 concurrent is safe
        const THREAD_CONCURRENCY = 5;
        const limit = pLimit(THREAD_CONCURRENCY);

        const threadResults = await Promise.all(
          channelData.threadParents.map((parent) =>
            limit(async () => {
              try {
                const replies = await fetchThreadReplies(
                  channelData.id,
                  channelData.name,
                  parent.ts
                );
                completedThreads++;
                threadReplyCount += replies.length;
                result.threadsFetched++;

                // Update progress
                const elapsed = (Date.now() - threadStartTime) / 1000;
                const avgPerThread = elapsed / completedThreads;
                const remainingThisChannel = Math.ceil(
                  avgPerThread * (threadCount - completedThreads)
                );

                const remainingThreadsOtherChannels = channelsToSync
                  .slice(chIdx + 1)
                  .reduce((sum, ch) => sum + ch.threadParents.length, 0);
                const remainingOther = Math.ceil(remainingThreadsOtherChannels * avgPerThread);
                const totalRemaining = remainingThisChannel + remainingOther;

                const etaStr = formatDuration(Math.ceil(totalRemaining));
                const progress = `    Threads: ${completedThreads}/${threadCount} (${threadReplyCount} replies) | ETA: ${etaStr}`;
                process.stdout.write(`\r${progress.padEnd(75)}`);

                if (options.verbose) {
                  console.log(` - Thread ${parent.ts}: ${replies.length} replies`);
                }

                return replies;
              } catch (error) {
                if (options.verbose) {
                  console.error(`\n    Failed to fetch thread ${parent.ts}: ${error}`);
                }
                return [];
              }
            })
          )
        );

        // Collect all replies
        for (const replies of threadResults) {
          allMessages.push(...replies);
        }

        const totalTime = Math.ceil((Date.now() - threadStartTime) / 1000);
        console.log(
          `\r    Threads: ${threadCount}/${threadCount} → ${threadReplyCount} replies (${formatDuration(totalTime)})`.padEnd(
            75
          )
        );
        result.threadRepliesIndexed += threadReplyCount;
      } else if (channelData.threadParents.length === 0) {
        console.log(`${channelData.messages.length} messages (no threads)`);
      } else {
        console.log(`${channelData.messages.length} messages`);
      }

      result.messagesProcessed += allMessages.length;

      if (options.dryRun) {
        console.log(`    [DRY RUN] Would encrypt and index ${allMessages.length} messages`);
        result.messagesSkipped += allMessages.length;
        continue;
      }

      // Generate embeddings in batches
      for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
        const batch = allMessages.slice(i, i + BATCH_SIZE);

        const texts = batch.map((msg) =>
          formatSlackMessageForEmbedding(msg.text, msg.userName, msg.channelName, msg.timestamp)
        );

        const embeddings = await generateEmbeddings(texts);

        const points = batch.map((msg, idx) => ({
          id: generatePointId(msg.channelId, msg.ts),
          vector: embeddings[idx],
          payload: messageToEncryptedPayload(msg),
        }));

        await client.upsert(ENCRYPTED_COLLECTION, {
          wait: true,
          points,
        });

        result.messagesIndexed += batch.length;

        if (options.verbose) {
          console.log(
            `    Indexed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allMessages.length / BATCH_SIZE)} (encrypted)`
          );
        }
      }

      // Update sync state
      const channelState = state.channels[channelData.id];
      const newestMessage = channelData.messages.reduce((a, b) =>
        parseFloat(a.ts) > parseFloat(b.ts) ? a : b
      );

      state.channels[channelData.id] = {
        channelId: channelData.id,
        channelName: channelData.name,
        lastSyncedTs: newestMessage.ts,
        messageCount: (channelState?.messageCount || 0) + channelData.messages.length,
        lastSyncTime: new Date().toISOString(),
      };

      result.channelsSynced++;
      saveSyncState(state);
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      const errorMsg = `Failed to sync channel ${channelData.name}: ${errorDetail}`;
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

// Get current sync status for encrypted collection
export function getEncryptedSyncStatus(): SyncState {
  return loadSyncState();
}

// Reset sync state for encrypted collection
export function resetEncryptedSyncState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
  console.log('Encrypted sync state reset. Next sync will fetch all messages.');
}

// Search encrypted Slack messages semantically
export async function searchSlackMessagesEncrypted(
  query: string,
  options: {
    limit?: number;
    channelId?: string;
    minScore?: number;
    afterDate?: string;
    beforeDate?: string;
  } = {}
): Promise<
  Array<{
    score: number;
    message: ReturnType<typeof decryptPayload>;
  }>
> {
  const client = getQdrantClient();
  const { generateEmbedding } = await import('./embeddings');

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter conditions
  const mustConditions: Array<Record<string, unknown>> = [];

  if (options.channelId) {
    mustConditions.push({ key: 'channelId', match: { value: options.channelId } });
  }

  const rangeFilter: { gte?: number; lte?: number } = {};

  if (options.afterDate) {
    const afterTs = new Date(options.afterDate).getTime() / 1000;
    if (!isNaN(afterTs)) {
      rangeFilter.gte = afterTs;
    }
  }

  if (options.beforeDate) {
    const beforeTs = new Date(options.beforeDate).getTime() / 1000;
    if (!isNaN(beforeTs)) {
      rangeFilter.lte = beforeTs;
    }
  }

  if (rangeFilter.gte !== undefined || rangeFilter.lte !== undefined) {
    mustConditions.push({ key: 'timestamp', range: rangeFilter });
  }

  const filter = mustConditions.length > 0 ? { must: mustConditions } : undefined;

  // Search Qdrant
  const results = await client.search(ENCRYPTED_COLLECTION, {
    vector: queryEmbedding,
    limit: options.limit || 10,
    filter,
    score_threshold: options.minScore || 0.3,
    with_payload: true,
  });

  // Decrypt and return results
  return results.map((result) => ({
    score: result.score,
    message: decryptPayload(result.payload as unknown as SlackMessageEncryptedPayload),
  }));
}

// Get all messages in a thread from encrypted collection
export async function getSlackThreadEncrypted(
  channelId: string,
  threadTs: string,
  options: {
    limit?: number;
  } = {}
): Promise<ReturnType<typeof decryptPayload>[]> {
  const client = getQdrantClient();

  // Find thread parent and all replies by threadTs
  const results = await client.scroll(ENCRYPTED_COLLECTION, {
    filter: {
      should: [
        // Thread parent (messageId equals threadTs)
        {
          must: [
            { key: 'channelId', match: { value: channelId } },
            { key: 'messageId', match: { value: threadTs } },
          ],
        },
        // Thread replies (threadTs equals the thread timestamp)
        {
          must: [
            { key: 'channelId', match: { value: channelId } },
            { key: 'threadTs', match: { value: threadTs } },
          ],
        },
      ],
    },
    limit: options.limit || 100,
    with_payload: true,
    with_vector: false,
  });

  // Decrypt and sort by timestamp
  const messages = results.points.map((p) =>
    decryptPayload(p.payload as unknown as SlackMessageEncryptedPayload)
  );
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

// Get context around a message from encrypted collection
export async function getSlackContextEncrypted(
  channelId: string,
  timestamp: number,
  options: {
    windowMinutes?: number;
    limit?: number;
  } = {}
): Promise<ReturnType<typeof decryptPayload>[]> {
  const client = getQdrantClient();
  const windowMinutes = options.windowMinutes || 30;
  const windowSeconds = windowMinutes * 60;

  const minTime = timestamp - windowSeconds;
  const maxTime = timestamp + windowSeconds;

  const results = await client.scroll(ENCRYPTED_COLLECTION, {
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

  // Decrypt and sort by timestamp
  const messages = results.points.map((p) =>
    decryptPayload(p.payload as unknown as SlackMessageEncryptedPayload)
  );
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
