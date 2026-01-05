#!/usr/bin/env node

/**
 * Database MCP Server
 *
 * Read-only access to:
 * - WishDesk (MySQL)
 * - SugarWish Live (MySQL)
 * - Odoo (PostgreSQL)
 * - Retool (PostgreSQL)
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as dbService from '../../services/databases.js';

const tools: Tool[] = [
  {
    name: 'query_database',
    description: 'Execute a read-only SQL query against a database (wishdesk, sugarwish, odoo, retool)',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Database name: wishdesk, sugarwish, odoo, retool' },
        query: { type: 'string', description: 'SQL query (SELECT only)' },
        limit: { type: 'number', description: 'Max rows to return' },
      },
      required: ['database', 'query'],
    },
  },
  {
    name: 'list_tables',
    description: 'List tables in a database',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Database name: wishdesk, sugarwish, odoo, retool' },
      },
      required: ['database'],
    },
  },
  {
    name: 'describe_table',
    description: 'Get column information for a table',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string' },
        table: { type: 'string' },
      },
      required: ['database', 'table'],
    },
  },
  {
    name: 'list_databases',
    description: 'List available databases',
    inputSchema: { type: 'object', properties: {} },
  },
];

const server = new Server(
  { name: 'db', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'query_database':
        result = await dbService.queryDatabase(
          (args as { database: string; query: string; limit?: number }).database,
          (args as { database: string; query: string; limit?: number }).query,
          (args as { database: string; query: string; limit?: number }).limit
        );
        break;
      case 'list_tables':
        result = await dbService.listTables((args as { database: string }).database);
        break;
      case 'describe_table':
        result = await dbService.describeTable(
          (args as { database: string; table: string }).database,
          (args as { database: string; table: string }).table
        );
        break;
      case 'list_databases':
        result = dbService.listDatabases();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Database MCP Server running on stdio (read-only mode)');
}

main().catch(console.error);
