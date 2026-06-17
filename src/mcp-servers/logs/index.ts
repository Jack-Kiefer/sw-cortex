#!/usr/bin/env node

import 'dotenv/config';

/**
 * Logs MCP Server
 *
 * Searches and analyzes sw-cortex service logs. Reads the structured
 * JSON-line files written by src/services/logger.ts (one file per day at
 * ${LOG_DIR}/sw-cortex-YYYY-MM-DD.log; LOG_DIR defaults to <repo>/logs) via
 * the log-reader service. No external store — it parses the on-disk log files
 * directly, so it always reflects the current logging system.
 *
 * Tools:
 * - search_logs: Filter by service/level/free-text/since with a limit
 * - get_recent_logs: Most recent N entries across all services
 * - get_recent_errors: Most recent N ERROR entries
 * - get_log_stats: Totals by level + by service, plus available log files
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getLogStats,
  getRecentErrors,
  getRecentLogs,
  searchLogs,
} from '../../services/log-reader.js';

const tools: Tool[] = [
  {
    name: 'search_logs',
    description:
      'Search sw-cortex service logs with optional filters. Searches the message, structured ' +
      'data, and error fields of each entry. Returns matching entries newest-first.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Exact service name to filter to, e.g. "slack-handler" or "web".',
        },
        level: {
          type: 'string',
          description: 'Log level filter: DEBUG | INFO | WARN | ERROR (case-insensitive).',
        },
        search: {
          type: 'string',
          description: 'Free-text substring matched against message, data, and error fields.',
        },
        since: {
          type: 'string',
          description:
            'Time window: a duration like "1h", "30m", "24h", "7d", or an ISO date string.',
        },
        limit: { type: 'number', description: 'Max entries to return (default 100).' },
      },
    },
  },
  {
    name: 'get_recent_logs',
    description: 'Get the most recent log entries across all services, newest-first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default 50).' },
      },
    },
  },
  {
    name: 'get_recent_errors',
    description: 'Get the most recent ERROR-level log entries, newest-first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default 20).' },
      },
    },
  },
  {
    name: 'get_log_stats',
    description:
      'Summarize the logs: total entry count, counts by level and by service, and the list of ' +
      'available log files.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const server = new Server({ name: 'logs', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'search_logs':
        result = searchLogs(
          (args as {
            service?: string;
            level?: string;
            search?: string;
            since?: string;
            limit?: number;
          }) ?? {}
        );
        break;
      case 'get_recent_logs':
        result = getRecentLogs((args as { limit?: number })?.limit);
        break;
      case 'get_recent_errors':
        result = getRecentErrors((args as { limit?: number })?.limit);
        break;
      case 'get_log_stats':
        result = getLogStats();
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
  console.error('Logs MCP Server v1.0.0 running on stdio');
}

main().catch(console.error);
