#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const [adapterPath, sharedPath, targetPath] = process.argv.slice(2);
if (!adapterPath || !sharedPath || !targetPath) {
  console.error('usage: sync-codex-agents.mjs <adapter.md> <shared-claude.md> <target.md>');
  process.exit(2);
}

const adapter = readFileSync(adapterPath, 'utf8').trimEnd();
const shared = readFileSync(sharedPath, 'utf8').trimEnd();
const generated = `${adapter}\n\n<!-- BEGIN GENERATED SHARED CONFIG -->\n\n${shared}\n\n<!-- END GENERATED SHARED CONFIG -->\n`;

writeFileSync(targetPath, generated);
console.log(`  Generated ${targetPath} from the complete shared Claude config`);
