#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) {
  console.error('usage: sync-codex-config.mjs <source.toml> <target.toml>');
  process.exit(2);
}

const source = readFileSync(sourcePath, 'utf8');
const target = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
const keys = ['status_line', 'status_line_use_colors'];
const rootKeys = ['project_doc_max_bytes'];

const valueFor = (key) => {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  if (!match) throw new Error(`missing [tui] ${key} in ${sourcePath}`);
  return match[1];
};

const lines = target.split('\n');
let table = '';
const filtered = lines.filter((line) => {
  const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
  if (header) table = header[1];
  if (table === 'tui' && keys.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(line))) {
    return false;
  }
  if (!table && rootKeys.some((key) => new RegExp(`^\\s*${key}\\s*=`).test(line))) {
    return false;
  }
  return !keys.some((key) => new RegExp(`^\\s*tui\\.${key}\\s*=`).test(line));
});

filtered.unshift(...rootKeys.map((key) => `${key} = ${valueFor(key)}`), '');

let tuiIndex = filtered.findIndex((line) => /^\s*\[tui\]\s*$/.test(line));
if (tuiIndex === -1) {
  const childIndex = filtered.findIndex((line) => /^\s*\[tui\./.test(line));
  tuiIndex = childIndex === -1 ? filtered.length : childIndex;
  filtered.splice(tuiIndex, 0, '[tui]');
}

filtered.splice(tuiIndex + 1, 0, ...keys.map((key) => `${key} = ${valueFor(key)}`));
writeFileSync(targetPath, `${filtered.join('\n').replace(/\n+$/, '')}\n`);
console.log(`  Updated ${targetPath} status line`);
