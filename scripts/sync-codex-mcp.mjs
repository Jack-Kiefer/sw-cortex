#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = process.argv[2];
if (!source) {
  console.error('usage: sync-codex-mcp.mjs <expanded-mcp.json>');
  process.exit(2);
}

const config = JSON.parse(readFileSync(source, 'utf8'));
const servers = config.mcpServers ?? {};

console.log('  Codex MCP servers:');
for (const [name, server] of Object.entries(servers)) {
  if (!server || typeof server !== 'object' || typeof server.command !== 'string') continue;

  const env = server.env ?? {};
  spawnSync('codex', ['mcp', 'remove', name], { stdio: 'ignore' });
  const args = ['mcp', 'add', name];
  for (const [key, value] of Object.entries(env)) args.push('--env', `${key}=${value}`);
  args.push('--', server.command, ...(Array.isArray(server.args) ? server.args : []));
  const result = spawnSync('codex', args, { stdio: 'ignore' });
  if (result.status !== 0) {
    console.error(`    ! ${name} failed to install`);
    process.exitCode = 1;
  } else {
    console.log(`    + ${name}`);
  }
}
