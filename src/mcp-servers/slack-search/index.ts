#!/usr/bin/env node

import 'dotenv/config';

/**
 * Slack Search MCP Server
 *
 * Semantic search over encrypted Slack message history.
 * Messages are stored encrypted in Qdrant and decrypted on retrieval.
 *
 * Tools:
 * - search_slack_messages: Semantic search by topic
 * - get_slack_context: Get conversation around a message
 * - get_slack_thread: Get full thread
 * - get_slack_sync_status: Check indexing status
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as slackSync from '../../services/slack-sync-encrypted.js';

const tools: Tool[] = [
  {
    name: 'search_slack_messages',
    description:
      'Search Slack messages semantically using vector embeddings. Messages are stored encrypted and decrypted on retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query (e.g., "budget discussion", "deployment issues")',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
        },
        channelId: {
          type: 'string',
          description: 'Filter to specific channel ID (optional)',
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score 0-1 (default 0.3)',
        },
        afterDate: {
          type: 'string',
          description: 'Only include messages after this date (ISO format: "2025-12-18")',
        },
        beforeDate: {
          type: 'string',
          description: 'Only include messages before this date (ISO format: "2025-12-31")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_slack_context',
    description:
      'Get messages from a Slack channel around a specific timestamp. Use this after search_slack_messages to see the full conversation context.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (from search results)',
        },
        timestamp: {
          type: 'number',
          description: 'Unix timestamp to center the search around (from search results)',
        },
        windowMinutes: {
          type: 'number',
          description: 'Time window +/- in minutes (default 30)',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 20)',
        },
      },
      required: ['channelId', 'timestamp'],
    },
  },
  {
    name: 'get_slack_thread',
    description:
      'Get all messages in a Slack thread. Use the threadTs from search results to fetch the full conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (from search results)',
        },
        threadTs: {
          type: 'string',
          description: 'Thread timestamp (from search results, e.g. "1704067200.123456")',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 100)',
        },
      },
      required: ['channelId', 'threadTs'],
    },
  },
  {
    name: 'get_slack_sync_status',
    description: 'Get the current status of Slack message indexing (encrypted collection)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const server = new Server(
  { name: 'slack-search', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'search_slack_messages':
        result = await slackSync.searchSlackMessagesEncrypted((args as { query: string }).query, {
          limit: (args as { limit?: number }).limit,
          channelId: (args as { channelId?: string }).channelId,
          minScore: (args as { minScore?: number }).minScore,
          afterDate: (args as { afterDate?: string }).afterDate,
          beforeDate: (args as { beforeDate?: string }).beforeDate,
        });
        break;
      case 'get_slack_context':
        result = await slackSync.getSlackContextEncrypted(
          (args as { channelId: string }).channelId,
          (args as { timestamp: number }).timestamp,
          {
            windowMinutes: (args as { windowMinutes?: number }).windowMinutes,
            limit: (args as { limit?: number }).limit,
          }
        );
        break;
      case 'get_slack_thread':
        result = await slackSync.getSlackThreadEncrypted(
          (args as { channelId: string }).channelId,
          (args as { threadTs: string }).threadTs,
          {
            limit: (args as { limit?: number }).limit,
          }
        );
        break;
      case 'get_slack_sync_status':
        result = slackSync.getEncryptedSyncStatus();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Slack Search MCP Server v1.0.0 running on stdio');
}

main().catch(console.error);
