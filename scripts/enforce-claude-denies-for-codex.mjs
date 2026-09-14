#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const [settingsPath] = process.argv.slice(2);
if (!settingsPath) process.exit(2);

const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');

const toolAliases = {
  apply_patch: 'Edit',
  exec_command: 'Bash',
  spawn_agent: 'Agent',
};
const toolName = toolAliases[input.tool_name] ?? input.tool_name ?? '';

const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
const globMatches = (pattern, value) => {
  // Claude's historical `:*` separator means "this prefix and any arguments".
  const normalized = pattern.replace(/:\*$/u, '*');
  const expression = escapeRegExp(normalized).replace(/\*/g, '.*');
  return new RegExp(`^${expression}$`, 'u').test(value);
};

const comparableInput = (name) => {
  const toolInput = input.tool_input ?? {};
  if (name === 'Bash') return toolInput.command ?? '';
  if (name === 'Read' || name === 'Edit' || name === 'Write') {
    return toolInput.file_path ?? toolInput.path ?? toolInput.patch ?? '';
  }
  if (name === 'WebFetch') return toolInput.url ?? '';
  return '';
};

for (const rule of settings.permissions?.deny ?? []) {
  const match = /^([^()]+)(?:\((.*)\))?$/u.exec(rule);
  if (!match || match[1] !== toolName) continue;
  if (match[2] !== undefined && !globMatches(match[2], comparableInput(toolName))) continue;

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Blocked by Claude permission rule: ${rule}`,
    },
  })}\n`);
  process.exit(0);
}
