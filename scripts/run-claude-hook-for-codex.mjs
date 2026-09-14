#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [settingsPath, event, groupIndexText, hookIndexText] = process.argv.slice(2);
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const localSettingsPath = join(dirname(settingsPath), 'settings.local.json');
const localSettings = existsSync(localSettingsPath)
  ? JSON.parse(readFileSync(localSettingsPath, 'utf8'))
  : {};
const hook = settings.hooks?.[event]?.[Number(groupIndexText)]?.hooks?.[Number(hookIndexText)];
if (!hook || hook.type !== 'command') process.exit(0);

const raw = readFileSync(0, 'utf8');
let input;
try { input = JSON.parse(raw); } catch { input = {}; }
if (input.tool_name === 'apply_patch') {
  input.tool_name = 'Edit';
  input.tool_input ??= {};
  input.tool_input.file_path ??=
    input.tool_input.patch ?? input.tool_input.input ?? input.tool_input.command ?? '';
} else if (input.tool_name === 'spawn_agent') {
  input.tool_name = 'Agent';
}

const result = spawnSync('/bin/bash', ['-lc', hook.command], {
  cwd: process.cwd(),
  env: {
    ...localSettings.env,
    ...process.env,
    CLAUDE_PROJECT_DIR: process.cwd(),
    CLAUDE_CODE_SESSION_ID: input.session_id ?? input.thread_id ?? '',
  },
  input: JSON.stringify(input),
  encoding: 'utf8',
});

let stdout = result.stdout ?? '';
if (stdout.trim()) {
  try {
    const output = JSON.parse(stdout);
    const sequence = typeof output.terminalSequence === 'string' ? output.terminalSequence : '';
    const title = sequence.match(/\x1b\]0;([^\x07\x1b]*)\x07/)?.[1];
    if (title && process.env.HERDR_TAB_ID) {
      const herdr = process.env.HERDR_BIN || 'herdr';
      spawnSync(herdr, ['tab', 'rename', process.env.HERDR_TAB_ID, title], {
        stdio: 'ignore',
      });
      if (process.env.HERDR_PANE_ID) {
        spawnSync(herdr, [
          'pane', 'report-metadata', process.env.HERDR_PANE_ID,
          '--source', 'codex-hook-title', '--title', title,
        ], { stdio: 'ignore' });
      }
    }
    if (sequence) {
      delete output.terminalSequence;
      delete output.suppressOutput;
      stdout = Object.keys(output).length ? `${JSON.stringify(output)}\n` : '';
    }
  } catch {
    // Non-JSON output follows Codex's event-specific plain-text behavior.
  }
}
if (stdout) process.stdout.write(stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
