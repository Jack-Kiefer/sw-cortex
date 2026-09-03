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

// Run a TS MCP server via a single `node --import tsx` process instead of
// `npx tsx`, which spawned a wrapper (npm exec) + tsx CLI + worker = 3 procs per
// server. Collapsing to 1 proc cuts ~2 node processes and ~74MB RSS per server
// per session (verified 2026-09-03). The absolute tsx loader path is required so
// resolution is cwd-independent; keep it in sync with mcp.json.template.
const tsxServer = (name: string) => ({
  command: 'node',
  args: [
    '--import',
    resolve(projectRoot, 'node_modules/tsx/dist/loader.mjs'),
    resolve(projectRoot, `src/mcp-servers/${name}/index.ts`),
  ],
  cwd: projectRoot,
  env: {
    DOTENV_CONFIG_PATH: envPath,
  },
});

// MCP servers available in sw-cortex
const mcpServers: Record<string, object> = {
  db: tsxServer('db'),
  github: tsxServer('github'),
  knowledge: tsxServer('knowledge'),
  'slack-search': tsxServer('slack-search'),
  logs: tsxServer('logs'),
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
