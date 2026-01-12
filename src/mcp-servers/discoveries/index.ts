#!/usr/bin/env node

import 'dotenv/config';

/**
 * Discoveries MCP Server
 *
 * Knowledge base for database and codebase insights.
 * Stores discoveries in Qdrant with semantic search capabilities.
 *
 * Tools:
 * - add_discovery: Save a new insight
 * - list_discoveries: List with filters
 * - get_discovery: Get full details
 * - update_discovery: Update existing
 * - delete_discovery: Remove
 * - search_discoveries: Semantic search
 * - export_discoveries: Export to markdown/JSON
 * - get_table_notes: Get notes for a specific table
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as discoveriesService from '../../services/discoveries.js';

const tools: Tool[] = [
  {
    name: 'add_discovery',
    description:
      'Save an important insight or discovery from database exploration. Use this to capture knowledge for future reference.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the discovery' },
        description: { type: 'string', description: 'Detailed description of the insight' },
        source: {
          type: 'string',
          description: 'Source type: "database_query", "manual", "code_review", "exploration"',
        },
        sourceDatabase: {
          type: 'string',
          description: 'Database name if from query: wishdesk, sugarwish, odoo, retool',
        },
        sourceQuery: { type: 'string', description: 'The SQL query that led to this discovery' },
        tableName: {
          type: 'string',
          description: 'Specific table this note is about (for table-level documentation)',
        },
        columnName: {
          type: 'string',
          description: 'Specific column this note is about (optional, requires tableName)',
        },
        type: {
          type: 'string',
          enum: ['pattern', 'anomaly', 'optimization', 'fact', 'relationship', 'insight'],
          description: 'Type of discovery',
        },
        priority: { type: 'number', description: 'Priority 1-4 (1=low, 4=critical)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
      },
      required: ['title', 'source'],
    },
  },
  {
    name: 'list_discoveries',
    description: 'List saved discoveries with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Filter by source type' },
        sourceDatabase: { type: 'string', description: 'Filter by database name' },
        type: { type: 'string', description: 'Filter by discovery type' },
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
  },
  {
    name: 'get_discovery',
    description: 'Get full details of a discovery',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_discovery',
    description:
      'Update a discovery. Use this to correct outdated or wrong information. All fields are updatable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
        title: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description' },
        type: {
          type: 'string',
          description:
            'Discovery type: pattern, anomaly, optimization, fact, relationship, insight',
        },
        priority: { type: 'number', description: 'Priority 1-4 (1=low, 4=critical)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
        source: {
          type: 'string',
          description: 'Source type: database_query, manual, code_review, exploration',
        },
        sourceDatabase: {
          type: 'string',
          description: 'Database name: wishdesk, sugarwish, odoo, retool (null to clear)',
        },
        sourceQuery: {
          type: 'string',
          description: 'SQL query that led to this discovery (null to clear)',
        },
        tableName: {
          type: 'string',
          description: 'Table name this discovery is about (null to clear)',
        },
        columnName: {
          type: 'string',
          description: 'Column name this discovery is about (null to clear)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_discovery',
    description: 'Delete a discovery',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_discoveries',
    description:
      'Search discoveries semantically using vector embeddings. Returns discoveries similar to your query with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query (e.g., "order fulfillment workflow", "authentication tables")',
        },
        sourceDatabase: { type: 'string', description: 'Filter by database name' },
        tableName: { type: 'string', description: 'Filter by table name' },
        type: { type: 'string', description: 'Filter by discovery type' },
        source: { type: 'string', description: 'Filter by source type' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
        minScore: { type: 'number', description: 'Minimum similarity score 0-1 (default 0.3)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'export_discoveries',
    description: 'Export discoveries to markdown or JSON format for documentation',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Export format (default: markdown)',
        },
        sourceDatabase: { type: 'string', description: 'Filter by database' },
      },
    },
  },
  {
    name: 'get_table_notes',
    description:
      'Get all notes/discoveries for a specific database table. Use this to retrieve context when working with a table.',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name: wishdesk, sugarwish, odoo, retool',
        },
        table: { type: 'string', description: 'Table name' },
      },
      required: ['database', 'table'],
    },
  },
];

const server = new Server(
  { name: 'discoveries', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'add_discovery':
        result = await discoveriesService.addDiscovery(
          args as unknown as Parameters<typeof discoveriesService.addDiscovery>[0]
        );
        break;
      case 'list_discoveries':
        result = await discoveriesService.listDiscoveries(
          args as Parameters<typeof discoveriesService.listDiscoveries>[0]
        );
        break;
      case 'get_discovery':
        result = await discoveriesService.getDiscoveryDetails((args as { id: string }).id);
        break;
      case 'update_discovery':
        result = await discoveriesService.updateDiscovery(
          (args as { id: string }).id,
          args as Parameters<typeof discoveriesService.updateDiscovery>[1]
        );
        break;
      case 'delete_discovery':
        result = { success: await discoveriesService.deleteDiscovery((args as { id: string }).id) };
        break;
      case 'search_discoveries':
        result = await discoveriesService.searchDiscoveries((args as { query: string }).query, {
          sourceDatabase: (args as { sourceDatabase?: string }).sourceDatabase,
          tableName: (args as { tableName?: string }).tableName,
          type: (args as { type?: string }).type,
          source: (args as { source?: string }).source,
          limit: (args as { limit?: number }).limit,
          minScore: (args as { minScore?: number }).minScore,
        });
        break;
      case 'export_discoveries':
        result = await discoveriesService.exportDiscoveries(
          args as Parameters<typeof discoveriesService.exportDiscoveries>[0]
        );
        break;
      case 'get_table_notes':
        result = await discoveriesService.getTableNotes(
          (args as { database: string; table: string }).database,
          (args as { database: string; table: string }).table
        );
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
  console.error('Discoveries MCP Server v1.0.0 running on stdio');
}

main().catch(console.error);
