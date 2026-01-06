import { WebClient } from '@slack/web-api';
import { z } from 'zod';

// Configuration
const SlackConfigSchema = z.object({
  userToken: z.string().startsWith('xoxp-'),
});

// Singleton client (uses USER token for reading)
let _client: WebClient | null = null;

function getClient(): WebClient {
  if (!_client) {
    const userToken = process.env.SLACK_USER_TOKEN;
    if (!userToken) {
      throw new Error('SLACK_USER_TOKEN environment variable is required for reading messages');
    }
    SlackConfigSchema.parse({ userToken });
    _client = new WebClient(userToken);
  }
  return _client;
}

// Types
export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isDm: boolean;
  isGroupDm: boolean;
  memberCount?: number;
}

export interface SlackMessage {
  ts: string; // Unique message ID
  channelId: string;
  channelName: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: number;
  threadTs?: string;
  isThreadParent: boolean;
  permalink?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
}

// Cache for users to avoid repeated API calls
const userCache = new Map<string, SlackUser>();

// Rate limiting: 50 requests/min = 1.2s between requests
const RATE_LIMIT_DELAY = 1200;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch user info with caching
export async function fetchUser(userId: string): Promise<SlackUser | null> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    const client = getClient();
    const result = await client.users.info({ user: userId });

    if (result.user) {
      const user: SlackUser = {
        id: result.user.id!,
        name: result.user.name || 'unknown',
        realName: result.user.real_name || result.user.name || 'Unknown',
      };
      userCache.set(userId, user);
      return user;
    }
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
  }

  return null;
}

// Fetch all channels the user has access to
export async function fetchAllChannels(verbose = false): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  for await (const channel of streamChannels(verbose)) {
    channels.push(channel);
  }
  return channels;
}

// Stream channels one at a time (faster feedback)
export async function* streamChannels(verbose = false): AsyncGenerator<SlackChannel> {
  const client = getClient();

  // Fetch public and private channels
  if (verbose) console.log('  Scanning channels...');
  let cursor: string | undefined;
  let count = 0;
  do {
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 200,
      cursor,
    });

    for (const channel of result.channels || []) {
      if (channel.is_member) {
        count++;
        yield {
          id: channel.id!,
          name: channel.name || 'unknown',
          isPrivate: channel.is_private || false,
          isDm: false,
          isGroupDm: false,
          memberCount: channel.num_members,
        };
      }
    }

    cursor = result.response_metadata?.next_cursor;
    if (cursor) await delay(RATE_LIMIT_DELAY);
  } while (cursor);

  if (verbose) console.log(`  Found ${count} channels`);

  // Fetch DMs
  cursor = undefined;
  let dmCount = 0;
  do {
    const result = await client.conversations.list({
      types: 'im',
      limit: 200,
      cursor,
    });

    for (const channel of result.channels || []) {
      dmCount++;
      yield {
        id: channel.id!,
        name: `DM-${channel.user}`,
        isPrivate: true,
        isDm: true,
        isGroupDm: false,
      };
    }

    cursor = result.response_metadata?.next_cursor;
    if (cursor) await delay(RATE_LIMIT_DELAY);
  } while (cursor);

  if (verbose && dmCount > 0) console.log(`  Found ${dmCount} DMs`);

  // Fetch Group DMs
  cursor = undefined;
  let mpimCount = 0;
  do {
    const result = await client.conversations.list({
      types: 'mpim',
      limit: 200,
      cursor,
    });

    for (const channel of result.channels || []) {
      mpimCount++;
      yield {
        id: channel.id!,
        name: channel.name || 'Group DM',
        isPrivate: true,
        isDm: false,
        isGroupDm: true,
      };
    }

    cursor = result.response_metadata?.next_cursor;
    if (cursor) await delay(RATE_LIMIT_DELAY);
  } while (cursor);

  if (verbose && mpimCount > 0) console.log(`  Found ${mpimCount} Group DMs`);
}

// Fetch messages from a channel
export async function fetchChannelMessages(
  channelId: string,
  channelName: string,
  options: {
    oldest?: string; // Only messages after this timestamp
    limit?: number; // Max messages to fetch (0 = all)
  } = {}
): Promise<SlackMessage[]> {
  const client = getClient();
  const messages: SlackMessage[] = [];
  const maxMessages = options.limit || 0;

  let cursor: string | undefined;
  do {
    const result = await client.conversations.history({
      channel: channelId,
      oldest: options.oldest,
      limit: 200,
      cursor,
    });

    for (const msg of result.messages || []) {
      // Skip non-user messages (joins, leaves, etc.)
      if (!msg.user || !msg.text) continue;

      // Get user info
      const user = await fetchUser(msg.user);

      const message: SlackMessage = {
        ts: msg.ts!,
        channelId,
        channelName,
        userId: msg.user,
        userName: user?.realName,
        text: msg.text,
        timestamp: parseFloat(msg.ts!),
        threadTs: msg.thread_ts,
        isThreadParent: msg.thread_ts === msg.ts,
        permalink: undefined, // Could fetch with chat.getPermalink but expensive
      };

      messages.push(message);

      // Check limit
      if (maxMessages > 0 && messages.length >= maxMessages) {
        return messages;
      }
    }

    cursor = result.response_metadata?.next_cursor;
    if (cursor) await delay(RATE_LIMIT_DELAY);
  } while (cursor);

  return messages;
}

// Fetch thread replies
export async function fetchThreadReplies(
  channelId: string,
  channelName: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const client = getClient();
  const messages: SlackMessage[] = [];

  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
    });

    for (const msg of result.messages || []) {
      // Skip the parent message (first one) and non-user messages
      if (msg.ts === threadTs || !msg.user || !msg.text) continue;

      const user = await fetchUser(msg.user);

      messages.push({
        ts: msg.ts!,
        channelId,
        channelName,
        userId: msg.user,
        userName: user?.realName,
        text: msg.text,
        timestamp: parseFloat(msg.ts!),
        threadTs: msg.thread_ts,
        isThreadParent: false,
        permalink: undefined,
      });
    }
  } catch (error) {
    console.error(`Failed to fetch thread ${threadTs}:`, error);
  }

  return messages;
}

// Test connection
export async function testSlackConnection(): Promise<{
  connected: boolean;
  user?: string;
  team?: string;
  error?: string;
}> {
  try {
    const client = getClient();
    const result = await client.auth.test();

    return {
      connected: true,
      user: result.user,
      team: result.team,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get channel count summary
export async function getChannelSummary(): Promise<{
  public: number;
  private: number;
  dms: number;
  groupDms: number;
  total: number;
}> {
  const channels = await fetchAllChannels();

  return {
    public: channels.filter((c) => !c.isPrivate && !c.isDm && !c.isGroupDm).length,
    private: channels.filter((c) => c.isPrivate && !c.isDm && !c.isGroupDm).length,
    dms: channels.filter((c) => c.isDm).length,
    groupDms: channels.filter((c) => c.isGroupDm).length,
    total: channels.length,
  };
}
