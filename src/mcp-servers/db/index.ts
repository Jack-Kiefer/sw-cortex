#!/usr/bin/env node

/**
 * Database MCP Server
 *
 * Read-only access to:
 * - WishDesk (MySQL)
 * - WishDesk Dev (MySQL)
 * - Laravel Live (MySQL)
 * - Odoo (PostgreSQL)
 * - Odoo Staging (PostgreSQL)
 * - Retool (PostgreSQL)
 * - Local (MySQL) — user-chosen local DB
 * - Manage (MySQL) — Laravel staging
 * - SERP local DBs (MySQL, on the local Docker MySQL alongside `local`):
 *   - serp_staging_replica — pure manage-mirror
 *   - serp_prod_replica — pure live-mirror
 *   - serp_staging_darklaunch — manage + Odoo staging merge
 *   - serp_prod_darklaunch — live + Odoo prod merge
 * - live_darklaunch_db (MySQL) — live darklaunch DB on Hetzner (LIVE_DARKLAUNCH_DB_*)
 */

import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import { homedir } from 'os';
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

// Directories the `query_database_from_file` tool may read from. Resolved
// paths must start with one of these prefixes. Default is the user's
// ~/Desktop/Projects root, which covers SERP, sw-cortex, and any other
// project sitting alongside them. Override (or narrow) via the colon-
// separated MCP_DB_ALLOWED_DIRS env var if you need a tighter or broader
// allowlist.
const DEFAULT_ALLOWED_DIRS = [resolve(homedir(), 'Desktop/Projects')];
const ALLOWED_BASE_DIRS: string[] = process.env.MCP_DB_ALLOWED_DIRS
  ? process.env.MCP_DB_ALLOWED_DIRS.split(':')
      .filter(Boolean)
      .map((p) => resolve(p))
  : DEFAULT_ALLOWED_DIRS;

const tools: Tool[] = [
  {
    name: 'query_database',
    description:
      'Execute a read-only SQL query against a database (wishdesk, wishdesk_dev, laravel_live, odoo, odoo_staging, retool, local, manage, serp_staging_replica, serp_prod_replica, serp_staging_darklaunch, serp_prod_darklaunch, live_darklaunch_db)',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description:
            'Database name: wishdesk, wishdesk_dev, laravel_live, odoo, odoo_staging, retool, local, manage, serp_staging_replica, serp_prod_replica, serp_staging_darklaunch, serp_prod_darklaunch, live_darklaunch_db',
        },
        query: { type: 'string', description: 'SQL query (SELECT only)' },
        limit: { type: 'number', description: 'Max rows to return' },
      },
      required: ['database', 'query'],
    },
  },
  {
    name: 'query_database_from_file',
    description:
      'Execute a read-only SQL query loaded from a file path. Use this when ' +
      'the SQL is too long or awkward to inline. The file must live under ' +
      '~/Desktop/Projects (or whatever MCP_DB_ALLOWED_DIRS is set to).',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description:
            'Database name: wishdesk, wishdesk_dev, laravel_live, odoo, odoo_staging, retool, local, manage, serp_staging_replica, serp_prod_replica, serp_staging_darklaunch, serp_prod_darklaunch, live_darklaunch_db',
        },
        path: {
          type: 'string',
          description:
            'Absolute path to a SQL file (or relative to the MCP server cwd). Must resolve under an allowed base directory.',
        },
        limit: { type: 'number', description: 'Max rows to return' },
      },
      required: ['database', 'path'],
    },
  },
  {
    name: 'list_tables',
    description: 'List tables in a database',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description:
            'Database name: wishdesk, wishdesk_dev, laravel_live, odoo, odoo_staging, retool, local, manage, serp_staging_replica, serp_prod_replica, serp_staging_darklaunch, serp_prod_darklaunch, live_darklaunch_db',
        },
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

/**
 * Resolve a user-supplied path and verify it sits under one of the allowed
 * base directories. Returns the absolute path on success; throws otherwise.
 *
 * `path.resolve` collapses `..` segments, so traversal attempts (e.g. passing
 * `~/Desktop/Projects/SERP/../../../etc/passwd`) end up outside the allowed
 * prefix and fail the startsWith check.
 */
function resolveAllowedPath(input: string): string {
  const expanded = input.startsWith('~/') ? resolve(homedir(), input.slice(2)) : input;
  const absolute = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
  const allowed = ALLOWED_BASE_DIRS.some(
    (base) => absolute === base || absolute.startsWith(base + '/')
  );
  if (!allowed) {
    throw new Error(
      `Path is outside allowed directories: ${absolute}. ` +
        `Allowed: ${ALLOWED_BASE_DIRS.join(', ')}`
    );
  }
  return absolute;
}

const server = new Server({ name: 'db', version: '1.0.0' }, { capabilities: { tools: {} } });

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
      case 'query_database_from_file': {
        const params = args as { database: string; path: string; limit?: number };
        const absolutePath = resolveAllowedPath(params.path);
        const sql = await readFile(absolutePath, 'utf-8');
        result = await dbService.queryDatabase(params.database, sql, params.limit);
        break;
      }
      case 'list_tables':
        result = await dbService.listTables((args as { database: string }).database);
        break;
      case 'describe_table': {
        const database = (args as { database: string; table: string }).database;
        const table = (args as { database: string; table: string }).table;
        const columns = await dbService.describeTable(database, table);

        result = { columns };
        break;
      }
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
      content: [
        { type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
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
