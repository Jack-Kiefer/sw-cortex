#!/usr/bin/env node

/**
 * Terminal fallback for /paste-secret when the macOS dialog can't show (SSH, no GUI).
 * Jack runs it himself; each value is read with echo off and written value-blind.
 *
 *   npm run vault:paste -- --file <.env> [--keychain <item>] KEY [KEY...]
 */

import { spawn } from 'node:child_process';

import { assertAllowed } from '../../services/vault/paths.js';
import { KEY_RE, writeSecrets } from '../../services/vault/prompt.js';

function parseArgs(argv: string[]): { file: string; item?: string; keys: string[] } {
  let file = '';
  let item: string | undefined;
  const keys: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) file = argv[++i];
    else if (argv[i] === '--keychain' && argv[i + 1]) item = argv[++i];
    else if (KEY_RE.test(argv[i])) keys.push(argv[i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!file || !keys.length) {
    throw new Error('Usage: npm run vault:paste -- --file <.env> [--keychain <item>] KEY [KEY...]');
  }
  if (item !== undefined && !/^[A-Za-z0-9_.-]+$/.test(item))
    throw new Error(`Invalid keychain item: ${item}`);
  return { file, item, keys };
}

/** Reads one line from the terminal with echo off; the value comes back over a pipe. */
function readHidden(prompt: string): Promise<string> {
  process.stderr.write(prompt);
  return new Promise((resolve, reject) => {
    const sh = spawn(
      '/bin/sh',
      [
        '-c',
        'stty -echo </dev/tty; IFS= read -r v </dev/tty; s=$?; stty echo </dev/tty; printf %s "$v"; exit $s',
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] }
    );
    let out = '';
    sh.stdout.on('data', (d: Buffer) => (out += d.toString()));
    sh.on('error', reject);
    sh.on('close', () => {
      process.stderr.write('\n');
      resolve(out.trim());
    });
  });
}

async function main(): Promise<void> {
  const { file, item, keys } = parseArgs(process.argv.slice(2));
  const real = await assertAllowed(file);
  const values = new Map<string, string>();
  for (const key of keys) {
    const value = await readHidden(`${key} (input hidden, Enter to skip): `);
    if (value) values.set(key, value);
    process.stderr.write(value ? `  ${key}: ${value.length} chars\n` : `  ${key}: skipped\n`);
  }
  if (values.size) await writeSecrets(real, values, item);
  process.stderr.write(
    `vault-paste: wrote ${values.size} key(s) to ${item ? `Keychain "${item}" + ` : ''}${real}\n`
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`vault-paste: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
