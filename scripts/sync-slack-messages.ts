#!/usr/bin/env npx tsx
/**
 * Slack Message Sync Script
 *
 * Fetches messages from Slack and indexes them in Qdrant for semantic search.
 * Uses incremental sync - only fetches new messages since last run.
 *
 * Usage:
 *   npm run slack:sync              # Sync all channels
 *   npm run slack:sync -- --verbose # With detailed logging
 *   npm run slack:sync -- --dry-run # Preview without indexing
 *   npm run slack:sync -- --reset   # Reset state and re-sync everything
 *   npm run slack:sync -- --status  # Show sync status
 */

import 'dotenv/config';
import {
  syncSlackMessages,
  getSyncStatus,
  resetSyncState,
  searchSlackMessages,
} from '../src/services/slack-sync';
import { testSlackConnection } from '../src/services/slack-fetcher';
import { testOpenAIConnection, getEmbeddingModelInfo } from '../src/services/embeddings';
import { testConnection as testQdrantConnection } from '../src/qdrant';

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  reset: args.includes('--reset'),
  status: args.includes('--status'),
  test: args.includes('--test'),
  search: args.find((a) => a.startsWith('--search='))?.split('=')[1],
  limit: parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10),
  help: args.includes('--help') || args.includes('-h'),
};

async function showHelp() {
  console.log(`
Slack Message Sync - Index Slack messages in Qdrant for semantic search

USAGE:
  npm run slack:sync [OPTIONS]

OPTIONS:
  --verbose, -v   Show detailed progress
  --dry-run       Preview what would be synced (no writes)
  --reset         Reset sync state and re-fetch all messages
  --status        Show current sync status
  --test          Test connections (Slack, OpenAI, Qdrant)
  --search=QUERY  Search indexed messages
  --help, -h      Show this help

EXAMPLES:
  npm run slack:sync                    # Sync new messages
  npm run slack:sync -- --verbose       # Sync with detailed output
  npm run slack:sync -- --dry-run       # See what would be synced
  npm run slack:sync -- --reset         # Re-sync everything
  npm run slack:sync -- --search="budget meeting"  # Search messages
`);
}

async function showStatus() {
  console.log('📊 Slack Sync Status\n');

  const state = getSyncStatus();

  if (!state.lastFullSync) {
    console.log('No sync has been performed yet.\n');
    console.log('Run `npm run slack:sync` to start indexing messages.');
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

  // Test Slack
  console.log('Slack:');
  const slack = await testSlackConnection();
  if (slack.connected) {
    console.log(`  ✅ Connected as ${slack.user} in ${slack.team}`);
    // Channel summary is slow - skip for quick test
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
    console.log(`  ✅ Connected`);
  } else {
    console.log(`  ❌ Failed: ${qdrant.error}`);
  }

  console.log('');
}

async function runSearch(query: string) {
  console.log(`🔍 Searching for: "${query}"\n`);

  try {
    const results = await searchSlackMessages(query, { limit: 10 });

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    console.log(`Found ${results.length} results:\n`);

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
  console.log('🚀 Starting Slack Message Sync\n');

  if (flags.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    const result = await syncSlackMessages({
      verbose: flags.verbose,
      dryRun: flags.dryRun,
      maxMessagesPerChannel: flags.limit || undefined,
    });

    console.log('\n✅ Sync Complete!\n');
    console.log(`  Channels synced: ${result.channelsSynced}`);
    console.log(`  Messages processed: ${result.messagesProcessed}`);
    console.log(`  Messages indexed: ${result.messagesIndexed}`);
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
    console.log('🔄 Resetting sync state...');
    resetSyncState();
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
