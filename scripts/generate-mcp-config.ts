#!/usr/bin/env npx tsx
/**
 * Generate MCP Configuration
 *
 * Generates ~/.mcp.json with paths configured for the current installation.
 * Run: npx tsx scripts/generate-mcp-config.ts
 * Or:  npm run generate:mcp
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const projectRoot = process.env.SW_CORTEX_ROOT || process.cwd();
const envPath = resolve(projectRoot, '.env');
const tasksDbPath = process.env.TASK_DB_PATH || resolve(projectRoot, 'tasks/tasks.db');

// MCP servers available in sw-cortex
const mcpServers: Record<string, object> = {
  db: {
    command: 'npx',
    args: ['tsx', resolve(projectRoot, 'src/mcp-servers/db/index.ts')],
    cwd: projectRoot,
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  },
  github: {
    command: 'npx',
    args: ['tsx', resolve(projectRoot, 'src/mcp-servers/github/index.ts')],
    cwd: projectRoot,
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  },
  discoveries: {
    command: 'npx',
    args: ['tsx', resolve(projectRoot, 'src/mcp-servers/discoveries/index.ts')],
    cwd: projectRoot,
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  },
  'slack-search': {
    command: 'npx',
    args: ['tsx', resolve(projectRoot, 'src/mcp-servers/slack-search/index.ts')],
    cwd: projectRoot,
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  },
  logs: {
    command: 'npx',
    args: ['tsx', resolve(projectRoot, 'src/mcp-servers/logs/index.ts')],
    cwd: projectRoot,
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  },
};

// Check which servers actually exist
const availableServers: Record<string, object> = {};
for (const [name, config] of Object.entries(mcpServers)) {
  const serverPath = resolve(projectRoot, `src/mcp-servers/${name}/index.ts`);
  if (existsSync(serverPath)) {
    availableServers[name] = config;
  } else {
    console.log(`  Skipping ${name} (not found at ${serverPath})`);
  }
}

const mcpConfig = {
  mcpServers: availableServers,
};

const outputPath = resolve(homedir(), '.mcp.json');

// Check if file exists and warn
if (existsSync(outputPath)) {
  console.log(`\nWarning: ${outputPath} already exists. It will be overwritten.`);
}

writeFileSync(outputPath, JSON.stringify(mcpConfig, null, 2));
console.log(`\nGenerated MCP config at ${outputPath}`);
console.log(`\nConfigured ${Object.keys(availableServers).length} MCP servers:`);
for (const name of Object.keys(availableServers)) {
  console.log(`  - ${name}`);
}
console.log('\nRestart Claude Code to pick up the new configuration.');
