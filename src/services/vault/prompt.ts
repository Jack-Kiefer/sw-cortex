import { spawn } from 'node:child_process';

import { upsertEnv, readEnvFile, writeEnvFile } from './env-file.js';
import { storeItem } from './keychain.js';

export const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const PROMPT_TIMEOUT_S = 300;

const asString = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function run(
  cmd: string,
  args: string[],
  stdin: string
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, out, err }));
    child.stdin.end(stdin);
  });
}

/**
 * Asks Jack for one secret in a native macOS dialog with a hidden (bulleted) answer field.
 * The script goes in on stdin and the answer comes back on stdout, so the value never
 * touches disk, argv or an editor. Returns null when he skips, cancels or lets it time out.
 * VAULT_PROMPT_CMD swaps osascript for a stub in tests.
 */
export async function promptHidden(key: string, target: string): Promise<string | null> {
  if (!KEY_RE.test(key)) throw new Error(`Invalid key name: ${key}`);
  const script = [
    `set r to display dialog ${asString(`Paste the value for ${key}\n-> ${target}\n\nClaude never sees it.`)} ¬`,
    `  default answer "" with hidden answer with title "sw-cortex vault" ¬`,
    `  buttons {"Skip", "Save"} default button "Save" cancel button "Skip" ¬`,
    `  giving up after ${PROMPT_TIMEOUT_S}`,
    'if gave up of r then error number -128',
    'return text returned of r',
  ].join('\n');
  const cmd = process.env.VAULT_PROMPT_CMD ?? '/usr/bin/osascript';
  const { code, out, err } = await run(cmd, ['-'], script);
  if (code !== 0) {
    if (/-128/.test(err)) return null;
    throw new Error(`Secret prompt failed for ${key} (exit ${code}): ${err.trim().slice(0, 200)}`);
  }
  const value = out.replace(/\r?\n$/, '').trim();
  return value === '' ? null : value;
}

/**
 * Writes secrets into an .env, or into the Keychain with keychain:// references in the .env.
 * Callers must only ever report key names, lengths and fingerprints.
 */
export async function writeSecrets(
  file: string,
  values: Map<string, string>,
  keychainItem?: string
): Promise<void> {
  for (const [key, value] of values) {
    if (/[\r\n]/.test(value)) throw new Error(`Value for ${key} contains a newline; not supported`);
  }
  const toWrite = keychainItem ? await storeItem(keychainItem, values) : values;
  await writeEnvFile(file, upsertEnv(await readEnvFile(file), toWrite));
}
