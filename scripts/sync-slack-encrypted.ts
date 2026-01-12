#!/usr/bin/env npx tsx
/**
 * Encrypted Slack Message Sync Script
 *
 * Fetches messages from Slack and indexes them in Qdrant with encryption.
 * Sensitive fields (text, userName, channelName) are encrypted with AES-256-GCM.
 *
 * IMPORTANT: Requires SLACK_ENCRYPTION_KEY environment variable.
 * Generate one with: openssl rand -hex 32
 *
 * Usage:
 *   npm run slack:sync-encrypted              # Sync all channels (encrypted)
 *   npm run slack:sync-encrypted -- --verbose # With detailed logging
 *   npm run slack:sync-encrypted -- --dry-run # Preview without indexing
 *   npm run slack:sync-encrypted -- --reset   # Reset state and re-sync everything
 *   npm run slack:sync-encrypted -- --status  # Show sync status
 */

import 'dotenv/config';
import {
  syncSlackMessagesEncrypted,
  getEncryptedSyncStatus,
  resetEncryptedSyncState,
  searchSlackMessagesEncrypted,
} from '../src/services/slack-sync-encrypted';
import { testSlackConnection } from '../src/services/slack-fetcher';
import { testOpenAIConnection, getEmbeddingModelInfo } from '../src/services/embeddings';
import { testConnection as testQdrantConnection } from '../src/qdrant';
import { validateEncryptionKey } from '../src/services/encryption';

// Parse CLI arguments
const args = process.argv.slice(2);
// Default to 2000 messages per channel (most recent first)
const DEFAULT_LIMIT = 2000;

const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  reset: args.includes('--reset'),
  status: args.includes('--status'),
  test: args.includes('--test'),
  search: args.find((a) => a.startsWith('--search='))?.split('=')[1],
  limit: parseInt(
    args.find((a) => a.startsWith('--limit='))?.split('=')[1] || String(DEFAULT_LIMIT),
    10
  ),
  all: args.includes('--all'), // Override to fetch all messages (no limit)
  threads: !args.includes('--no-threads'), // Threads enabled by default, use --no-threads to disable
  help: args.includes('--help') || args.includes('-h'),
};

async function showHelp() {
  console.log(`
Encrypted Slack Message Sync - Index Slack messages with AES-256-GCM encryption

IMPORTANT: Requires SLACK_ENCRYPTION_KEY environment variable.
Generate one with: openssl rand -hex 32

USAGE:
  npm run slack:sync [OPTIONS]

OPTIONS:
  --verbose, -v   Show detailed progress
  --dry-run       Preview what would be synced (no writes)
  --reset         Reset sync state and re-fetch all messages
  --status        Show current sync status
  --test          Test connections (Slack, OpenAI, Qdrant, Encryption)
  --search=QUERY  Search indexed messages (decrypted results)
  --limit=N       Max messages per channel (default: 2000, most recent first)
  --all           Fetch all messages (no limit, overrides --limit)
  --no-threads    Skip thread replies (faster, default includes threads)
  --help, -h      Show this help

EXAMPLES:
  npm run slack:sync                          # Sync 2000 most recent + thread replies
  npm run slack:sync -- --verbose             # Sync with detailed output
  npm run slack:sync -- --all                 # Sync ALL messages with threads
  npm run slack:sync -- --no-threads          # Skip threads (faster)
  npm run slack:sync -- --limit=500           # Sync only 500 most recent per channel
  npm run slack:sync -- --reset               # Re-sync everything from scratch
  npm run slack:sync -- --search="budget"     # Search encrypted messages

COLLECTION: slack_messages_encrypted (AES-256-GCM encrypted)
`);
}

async function showStatus() {
  console.log('📊 Encrypted Slack Sync Status\n');

  const state = getEncryptedSyncStatus();

  if (!state.lastFullSync) {
    console.log('No encrypted sync has been performed yet.\n');
    console.log('Run `npm run slack:sync-encrypted` to start indexing messages.');
    return;
  }

  console.log(`Last sync: ${state.lastFullSync}`);
  console.log(`Total messages indexed: ${state.totalMessages}\n`);

  console.log('Channels synced:');
  const channels = Object.values(state.channels).sort((a, b) => b.messageCount - a.messageCount);

  for (const channel of channels) {
    console.log(
      `  #${channel.channelName}: ${channel.messageCount} messages (last: ${channel.lastSyncTime})`
    );
  }
}

async function testConnections() {
  console.log('🔌 Testing Connections...\n');

  // Test Encryption Key
  console.log('Encryption:');
  const keyValidation = validateEncryptionKey();
  if (keyValidation.valid) {
    console.log('  ✅ SLACK_ENCRYPTION_KEY configured (64 hex chars)');
  } else {
    console.log(`  ❌ Failed: ${keyValidation.error}`);
    console.log('  💡 Generate a key with: openssl rand -hex 32');
  }

  // Test Slack
  console.log('\nSlack:');
  const slack = await testSlackConnection();
  if (slack.connected) {
    console.log(`  ✅ Connected as ${slack.user} in ${slack.team}`);
  } else {
    console.log(`  ❌ Failed: ${slack.error}`);
  }

  // Test OpenAI
  console.log('\nOpenAI:');
  const openai = await testOpenAIConnection();
  if (openai.connected) {
    const info = getEmbeddingModelInfo();
    console.log(`  ✅ Connected (model: ${info.model}, dims: ${info.dimensions})`);
  } else {
    console.log(`  ❌ Failed: ${openai.error}`);
  }

  // Test Qdrant
  console.log('\nQdrant:');
  const qdrant = await testQdrantConnection();
  if (qdrant.connected) {
    console.log('  ✅ Connected');
  } else {
    console.log(`  ❌ Failed: ${qdrant.error}`);
  }

  console.log('');
}

async function runSearch(query: string) {
  console.log(`🔍 Searching encrypted messages for: "${query}"\n`);

  try {
    const results = await searchSlackMessagesEncrypted(query, { limit: 10 });

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    console.log(`Found ${results.length} results (decrypted):\n`);

    for (const { score, message } of results) {
      const date = new Date(message.timestamp * 1000).toLocaleDateString();
      const scorePercent = (score * 100).toFixed(1);

      console.log(
        `[${scorePercent}%] #${message.channelName} - ${message.userName || message.userId} (${date})`
      );
      console.log(`  ${message.text.substring(0, 200)}${message.text.length > 200 ? '...' : ''}\n`);
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

async function runSync() {
  console.log('🔐 Starting Encrypted Slack Message Sync\n');

  // Validate encryption key first
  const keyValidation = validateEncryptionKey();
  if (!keyValidation.valid) {
    console.error(`❌ Encryption key error: ${keyValidation.error}`);
    console.log('\n💡 Generate a key with: openssl rand -hex 32');
    console.log('   Then add to .env.local: SLACK_ENCRYPTION_KEY=<your-key>');
    process.exit(1);
  }

  console.log('✅ Encryption key validated');
  console.log('📦 Target collection: slack_messages_encrypted');

  // Determine message limit
  const messageLimit = flags.all ? 0 : flags.limit;
  if (messageLimit > 0) {
    console.log(`📊 Limit: ${messageLimit} messages per channel (most recent)`);
  } else {
    console.log('📊 Limit: none (fetching all messages)');
  }

  if (flags.threads) {
    console.log('🧵 Threads: enabled (will fetch thread replies)');
  }
  console.log('');

  if (flags.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    const result = await syncSlackMessagesEncrypted({
      verbose: flags.verbose,
      dryRun: flags.dryRun,
      maxMessagesPerChannel: messageLimit || undefined,
      includeThreads: flags.threads,
    });

    console.log('\n✅ Encrypted Sync Complete!\n');
    console.log(`  Channels synced: ${result.channelsSynced}`);
    console.log(`  Messages processed: ${result.messagesProcessed}`);
    console.log(`  Messages indexed: ${result.messagesIndexed}`);
    if (flags.threads) {
      console.log(`  Threads fetched: ${result.threadsFetched}`);
      console.log(`  Thread replies: ${result.threadRepliesIndexed}`);
    }
    if (result.messagesSkipped > 0) {
      console.log(`  Messages skipped: ${result.messagesSkipped}`);
    }
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

async function main() {
  if (flags.help) {
    await showHelp();
    return;
  }

  if (flags.status) {
    await showStatus();
    return;
  }

  if (flags.test) {
    await testConnections();
    return;
  }

  if (flags.reset) {
    console.log('🔄 Resetting encrypted sync state...');
    resetEncryptedSyncState();
  }

  if (flags.search) {
    await runSearch(flags.search);
    return;
  }

  await runSync();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
