#!/usr/bin/env node

/**
 * n8n MCP Server - Read-Only Access
 *
 * Provides read-only tools for the live self-hosted n8n instance via its
 * public REST API (/api/v1):
 * - list_workflows: workflow summaries (id/name/active/tags)
 * - get_workflow:   one workflow's full JSON (nodes, connections)
 * - list_executions: recent run history
 * - get_execution:  one run's detail
 *
 * NO write operations are available. This is intentional (mirrors github/db/logs).
 * Config: N8N_HOST + N8N_API_KEY in sw-cortex/.env.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as n8nService from '../../services/n8n.js';

const tools: Tool[] = [
  {
    name: 'list_workflows',
    description:
      'List workflows on the live n8n instance (summaries only: id, name, active, tags). ' +
      'Optionally filter to active/inactive workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        active: {
          type: 'boolean',
          description: 'Filter to only active (true) or only inactive (false) workflows.',
        },
        limit: { type: 'number', description: 'Max workflows to return (default 100).' },
      },
    },
  },
  {
    name: 'get_workflow',
    description:
      "Get one workflow's full JSON (nodes, connections, settings) from the live n8n instance.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Workflow id (from list_workflows).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_executions',
    description:
      'List recent workflow executions (run history) newest-first. Optionally filter by ' +
      'workflow id and/or status.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Limit to executions of this workflow id.' },
        status: {
          type: 'string',
          enum: ['success', 'error', 'waiting'],
          description: 'Filter by execution status.',
        },
        limit: { type: 'number', description: 'Max executions to return (default 20).' },
      },
    },
  },
  {
    name: 'get_execution',
    description:
      "Get one execution's detail. Set include_data to pull full run data (node inputs/outputs); " +
      'omit for a lighter summary.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Execution id (from list_executions).' },
        include_data: {
          type: 'boolean',
          description: 'Include full run data (node inputs/outputs). Default false.',
        },
      },
      required: ['id'],
    },
  },
];

const server = new Server({ name: 'n8n', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'list_workflows':
        result = await n8nService.listWorkflows({
          active: (args as { active?: boolean }).active,
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'get_workflow':
        result = await n8nService.getWorkflow((args as { id: string }).id);
        break;

      case 'list_executions':
        result = await n8nService.listExecutions({
          workflowId: (args as { workflowId?: string }).workflowId,
          status: (args as { status?: 'success' | 'error' | 'waiting' }).status,
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'get_execution':
        result = await n8nService.getExecution(
          (args as { id: string }).id,
          (args as { include_data?: boolean }).include_data
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
  console.error('n8n MCP Server v1.0.0 running on stdio (read-only mode)');
}

main().catch(console.error);
