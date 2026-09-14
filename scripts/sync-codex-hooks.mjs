#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [settingsPath, targetPath, adapterPath] = process.argv.slice(2);
if (!settingsPath || !targetPath || !adapterPath) {
  console.error('usage: sync-codex-hooks.mjs <claude-settings.json> <codex-hooks.json> <adapter.mjs>');
  process.exit(2);
}

const supportedEvents = new Set([
  'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PreCompact', 'PostCompact',
  'UserPromptSubmit', 'SubagentStop', 'Stop', 'Interrupt', 'SessionStart',
  'SubagentStart', 'SessionEnd',
]);
const source = JSON.parse(readFileSync(settingsPath, 'utf8'));
let target = { hooks: {} };
if (existsSync(targetPath)) {
  const existing = readFileSync(targetPath, 'utf8').trim();
  if (existing) target = JSON.parse(existing);
}
target.hooks ??= {};

for (const [event, groups] of Object.entries(target.hooks)) {
  target.hooks[event] = groups
    .map((group) => ({
      ...group,
      hooks: (group.hooks ?? []).filter((hook) => !String(hook.statusMessage ?? '').startsWith('[claude-sync]')),
    }))
    .filter((group) => group.hooks.length > 0);
  if (target.hooks[event].length === 0) delete target.hooks[event];
}

const translateMatcher = (matcher = '') => matcher
  .split('|')
  .flatMap((part) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(part) ? ['apply_patch'] : [part === 'Agent' ? 'spawn_agent' : part])
  .filter((part, index, all) => part && all.indexOf(part) === index)
  .join('|');

let generated = 0;
for (const [event, groups] of Object.entries(source.hooks ?? {})) {
  if (!supportedEvents.has(event)) {
    console.log(`  Codex hooks: skipped unsupported Claude event ${event}`);
    continue;
  }
  for (const [groupIndex, group] of groups.entries()) {
    const hooks = [];
    for (const [hookIndex, hook] of (group.hooks ?? []).entries()) {
      if (hook.type !== 'command') {
        console.log(`  Codex hooks: skipped unsupported ${hook.type} handler in ${event}`);
        continue;
      }
      hooks.push({
        type: 'command',
        command: `node ${JSON.stringify(adapterPath)} ${JSON.stringify(settingsPath)} ${JSON.stringify(event)} ${groupIndex} ${hookIndex}`,
        timeout: hook.timeout,
        statusMessage: `[claude-sync] ${event}`,
      });
      generated += 1;
    }
    if (hooks.length) {
      target.hooks[event] ??= [];
      target.hooks[event].push({ matcher: translateMatcher(group.matcher), hooks });
    }
  }
}

writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(`  Generated ${generated} Codex hooks from Claude settings (existing native hooks preserved)`);
