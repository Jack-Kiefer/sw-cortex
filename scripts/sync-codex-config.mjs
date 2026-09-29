#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) {
  console.error('usage: sync-codex-config.mjs <source.toml> <target.toml>');
  process.exit(2);
}

const source = readFileSync(sourcePath, 'utf8');
const target = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
const keys = ['status_line', 'status_line_use_colors'];
const rootKeys = ['project_doc_max_bytes', 'approval_policy', 'sandbox_mode'];

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

// Codex OTEL export, built from ~/.claude/telemetry.env so the Grafana secret never lands in git.
// Codex only takes literal headers in config.toml; resource attributes come from OTEL_RESOURCE_ATTRIBUTES.
const otelStart = filtered.findIndex((line) => /^\s*\[otel(\.[^\]]*)?\]\s*$/.test(line));
if (otelStart !== -1) {
  let end = otelStart + 1;
  while (end < filtered.length && !/^\s*\[(?!otel[.\]])/.test(filtered[end])) end += 1;
  filtered.splice(otelStart, end - otelStart);
}
const telemetryEnv = join(homedir(), '.claude', 'telemetry.env');
if (existsSync(telemetryEnv)) {
  const vars = Object.fromEntries(
    readFileSync(telemetryEnv, 'utf8')
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^"(.*)"$/, '$1')])
  );
  const endpoint = vars.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = (vars.OTEL_EXPORTER_OTLP_HEADERS ?? '')
    .split(',')
    .filter((pair) => pair.includes('='))
    .map((pair) => {
      const i = pair.indexOf('=');
      return `${JSON.stringify(pair.slice(0, i).trim())} = ${JSON.stringify(pair.slice(i + 1).trim())}`;
    })
    .join(', ');
  if (endpoint && headers) {
    const exporter = (path) =>
      `{ otlp-http = { endpoint = ${JSON.stringify(`${endpoint}${path}`)}, protocol = "binary", headers = { ${headers} } } }`;
    filtered.push(
      '',
      '[otel]',
      'environment = "prod"',
      'log_user_prompt = true',
      // Logs only: Grafana's OTLP gateway rejects Codex's metrics payload (HTTP 400, verified 2026-09-29).
      `exporter = ${exporter('/v1/logs')}`
    );
    console.log('  Updated Codex [otel] export from ~/.claude/telemetry.env');
  }
}
writeFileSync(targetPath, `${filtered.join('\n').replace(/\n+$/, '')}\n`);
console.log(`  Updated ${targetPath} status line`);
