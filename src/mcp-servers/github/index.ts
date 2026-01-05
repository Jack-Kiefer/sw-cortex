#!/usr/bin/env node

/**
 * GitHub MCP Server - Read-Only Access
 *
 * Provides read-only tools for accessing configured GitHub repositories:
 * - Jack-Kiefer/SERP
 * - jasonbkiefer/SWAC
 * - sethfinley/sugarwish-odoo
 * - sethfinley/sugarwish-laravel
 *
 * NO write operations are available. This is intentional.
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

import * as githubService from '../../services/github.js';

// Define read-only tools
const tools: Tool[] = [
  {
    name: 'list_repos',
    description: 'List configured GitHub repositories available for querying',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_repo_info',
    description: 'Get information about a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name (e.g., "SERP", "sugarwish-odoo")',
        },
      },
      required: ['repo'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code across configured repositories',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports GitHub code search syntax)',
        },
        repo: {
          type: 'string',
          description: 'Limit search to specific repo (optional)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_file',
    description: 'Get the contents of a file from a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        path: {
          type: 'string',
          description: 'File path within the repository',
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit SHA (optional, defaults to default branch)',
        },
      },
      required: ['repo', 'path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory within a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        path: {
          type: 'string',
          description: 'Directory path (optional, defaults to root)',
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit SHA (optional)',
        },
      },
      required: ['repo'],
    },
  },
  {
    name: 'list_branches',
    description: 'List branches in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        limit: {
          type: 'number',
          description: 'Max branches to return (default 30)',
        },
      },
      required: ['repo'],
    },
  },
  {
    name: 'list_commits',
    description: 'List recent commits in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        branch: {
          type: 'string',
          description: 'Branch name (optional)',
        },
        path: {
          type: 'string',
          description: 'Filter to commits affecting this path (optional)',
        },
        limit: {
          type: 'number',
          description: 'Max commits to return (default 20)',
        },
      },
      required: ['repo'],
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'PR state filter (default: open)',
        },
        limit: {
          type: 'number',
          description: 'Max PRs to return (default 20)',
        },
      },
      required: ['repo'],
    },
  },
  {
    name: 'get_pull_request',
    description: 'Get details of a specific pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        pr_number: {
          type: 'number',
          description: 'Pull request number',
        },
      },
      required: ['repo', 'pr_number'],
    },
  },
];

// Create MCP server
const server = new Server({ name: 'github', version: '1.0.0' }, { capabilities: { tools: {} } });

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'list_repos':
        result = githubService.listRepos();
        break;

      case 'get_repo_info':
        result = await githubService.getRepoInfo((args as { repo: string }).repo);
        break;

      case 'search_code':
        result = await githubService.searchCode((args as { query: string }).query, {
          repo: (args as { repo?: string }).repo,
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'get_file':
        result = await githubService.getFile(
          (args as { repo: string }).repo,
          (args as { path: string }).path,
          { ref: (args as { ref?: string }).ref }
        );
        break;

      case 'list_files':
        result = await githubService.listFiles(
          (args as { repo: string }).repo,
          (args as { path?: string }).path,
          { ref: (args as { ref?: string }).ref }
        );
        break;

      case 'list_branches':
        result = await githubService.listBranches((args as { repo: string }).repo, {
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'list_commits':
        result = await githubService.listCommits((args as { repo: string }).repo, {
          branch: (args as { branch?: string }).branch,
          path: (args as { path?: string }).path,
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'list_pull_requests':
        result = await githubService.listPullRequests((args as { repo: string }).repo, {
          state: (args as { state?: 'open' | 'closed' | 'all' }).state,
          limit: (args as { limit?: number }).limit,
        });
        break;

      case 'get_pull_request':
        result = await githubService.getPullRequest(
          (args as { repo: string }).repo,
          (args as { pr_number: number }).pr_number
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub MCP Server running on stdio (read-only mode)');
}

main().catch(console.error);
