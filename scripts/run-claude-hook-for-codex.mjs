#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [settingsPath, event, groupIndexText, hookIndexText] = process.argv.slice(2);
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const hook = settings.hooks?.[event]?.[Number(groupIndexText)]?.hooks?.[Number(hookIndexText)];
if (!hook || hook.type !== 'command') process.exit(0);

const raw = readFileSync(0, 'utf8');
let input;
try { input = JSON.parse(raw); } catch { input = {}; }
if (input.tool_name === 'apply_patch') {
  input.tool_name = 'Edit';
  input.tool_input ??= {};
  input.tool_input.file_path ??= input.tool_input.patch ?? input.tool_input.input ?? '';
} else if (input.tool_name === 'spawn_agent') {
  input.tool_name = 'Agent';
}

const result = spawnSync('/bin/bash', ['-lc', hook.command], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    CLAUDE_PROJECT_DIR: process.cwd(),
    CLAUDE_CODE_SESSION_ID: input.session_id ?? input.thread_id ?? '',
  },
  input: JSON.stringify(input),
  encoding: 'utf8',
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
