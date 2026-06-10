#!/usr/bin/env node

import 'dotenv/config';

/**
 * Knowledge MCP Server
 *
 * Semantic search over the markdown knowledge dictionary (DICTIONARY.md by
 * default; override with KNOWLEDGE_FILES). There is no external vector DB and
 * no ingest step: edit the markdown, and the next search re-indexes only the
 * changed sections (embeddings cached locally by chunk hash in
 * knowledge/kb/embeddings-cache.json).
 *
 * Tools:
 * - search_knowledge: Semantic search, returns the most relevant sections
 * - get_knowledge_section: Full text of sections matching a breadcrumb
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { getKnowledgeSection, searchKnowledge } from '../../services/knowledge-search.js';

const tools: Tool[] = [
  {
    name: 'search_knowledge',
    description:
      'Semantic search over the SugarWish institutional knowledge base (systems, databases, ' +
      'people, business rules, gotchas). Use BEFORE reasoning about any SugarWish system, ' +
      'database table, or cross-system flow — the obvious inference is often documented as wrong.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language question or topic, e.g. "how do SERP and Odoo ids join"',
        },
        limit: { type: 'number', description: 'Max sections to return (default 5)' },
        minScore: { type: 'number', description: 'Minimum similarity score 0-1 (default 0.2)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_knowledge_section',
    description:
      'Fetch the full text of knowledge-base sections whose heading breadcrumb contains the ' +
      'given string (case-insensitive). Use to expand a truncated search_knowledge result.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'Substring of the section breadcrumb, e.g. "Serpy" or "13-Database Landscape"',
        },
      },
      required: ['section'],
    },
  },
];

const server = new Server(
  { name: 'knowledge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'search_knowledge':
        result = await searchKnowledge((args as { query: string }).query, {
          limit: (args as { limit?: number }).limit,
          minScore: (args as { minScore?: number }).minScore,
        });
        break;
      case 'get_knowledge_section':
        result = await getKnowledgeSection((args as { section: string }).section);
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
  console.error('Knowledge MCP Server v1.0.0 running on stdio');
}

main().catch(console.error);
