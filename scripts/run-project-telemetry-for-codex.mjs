#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(0, 'utf8');
let input;
try { input = JSON.parse(raw); } catch { process.exit(0); }

const root = input.cwd || process.cwd();
const settingsPath = join(root, '.claude', 'settings.json');
if (!existsSync(settingsPath)) process.exit(0);

// A repo-generated Codex Stop hook already bridges its Claude hooks; do not upload twice.
const codexHooksPath = join(root, '.codex', 'hooks.json');
if (existsSync(codexHooksPath)) {
  const codexHooks = JSON.parse(readFileSync(codexHooksPath, 'utf8'));
  const hasGeneratedStop = (codexHooks.hooks?.Stop ?? []).some((group) =>
    (group.hooks ?? []).some((hook) => String(hook.statusMessage ?? '').startsWith('[claude-sync]'))
  );
  if (hasGeneratedStop) process.exit(0);
}

const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const localPath = join(root, '.claude', 'settings.local.json');
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
const telemetryHooks = (settings.hooks?.Stop ?? [])
  .flatMap((group) => group.hooks ?? [])
  .filter((hook) => hook.type === 'command' && /send-assistant-response\.sh/.test(hook.command));

for (const hook of telemetryHooks) {
  const result = spawnSync('/bin/bash', ['-lc', hook.command], {
    cwd: root,
    env: {
      ...local.env,
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_CODE_SESSION_ID: input.session_id ?? '',
    },
    input: raw,
    encoding: 'utf8',
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
