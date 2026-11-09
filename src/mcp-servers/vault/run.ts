#!/usr/bin/env node

/**
 * vault-run: start a command with keychain:// references in an .env resolved.
 *
 *   vault-run.sh [--env-file <path>]... -- <command> [args...]
 *
 * Only keys whose value is a keychain://<item>/<KEY> reference are exported; the
 * app's own dotenv still loads the rest of the file. dotenv does not override
 * variables already in the environment, so the resolved secrets win.
 */

import { spawn } from 'node:child_process';

import { parseEnv, readEnvFile, toMap } from '../../services/vault/env-file.js';
import { KEYCHAIN_REF_RE, resolveEnv } from '../../services/vault/keychain.js';

function parseArgs(argv: string[]): { envFiles: string[]; command: string[] } {
  const sep = argv.indexOf('--');
  const opts = sep === -1 ? argv : argv.slice(0, sep);
  const command = sep === -1 ? [] : argv.slice(sep + 1);
  const envFiles: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] === '--env-file' && opts[i + 1]) envFiles.push(opts[++i]);
    else throw new Error(`Unknown option: ${opts[i]}`);
  }
  if (!command.length) throw new Error('Usage: vault-run.sh [--env-file <path>]... -- <command> [args...]');
  return { envFiles: envFiles.length ? envFiles : ['.env'], command };
}

async function main(): Promise<void> {
  const { envFiles, command } = parseArgs(process.argv.slice(2));
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  let resolved = 0;
  for (const file of envFiles) {
    const refs = new Map([...toMap(parseEnv(await readEnvFile(file)))].filter(([, v]) => KEYCHAIN_REF_RE.test(v)));
    for (const [k, v] of await resolveEnv(refs)) {
      childEnv[k] = v;
      resolved++;
    }
  }
  process.stderr.write(`vault-run: resolved ${resolved} keychain secret(s)\n`);

  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env: childEnv });
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sig, () => child.kill(sig));
  child.on('error', (err) => {
    process.stderr.write(`vault-run: ${err.message}\n`);
    process.exit(127);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 128 : 1)));
}

main().catch((err: Error) => {
  process.stderr.write(`vault-run: ${err.message}\n`);
  process.exit(1);
});
