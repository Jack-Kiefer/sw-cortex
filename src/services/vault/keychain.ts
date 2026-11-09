import { spawn } from 'node:child_process';

/** Reference stored in an .env in place of a secret: keychain://<item>/<KEY>. */
export const KEYCHAIN_REF_RE = /^keychain:\/\/([A-Za-z0-9_.-]+)\/([A-Za-z_][A-Za-z0-9_.-]*)$/;

const SERVICE_PREFIX = process.env.VAULT_KEYCHAIN_SERVICE ?? 'sw-vault';

function service(item: string): string {
  return `${SERVICE_PREFIX}:${item}`;
}

export function keychainRef(item: string, key: string): string {
  return `keychain://${item}/${key}`;
}

function runSecurity(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/security', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`security ${args[0] ?? '-i'} failed: ${err.trim()}`))
    );
    child.stdin.end(stdin ?? '');
  });
}

const quote = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Stores each value as a generic password (service sw-vault:<item>, account <KEY>).
 * Commands go through `security -i` on stdin, so values never appear in argv / `ps`.
 */
export async function storeItem(item: string, values: Map<string, string>): Promise<Map<string, string>> {
  const lines: string[] = [];
  for (const [key, value] of values) {
    if (/[\r\n]/.test(value)) throw new Error(`Value for ${key} contains a newline; not supported`);
    lines.push(`add-generic-password -U -s ${quote(service(item))} -a ${quote(key)} -w ${quote(value)}`);
  }
  await runSecurity(['-i'], `${lines.join('\n')}\n`);
  return new Map([...values.keys()].map((k) => [k, keychainRef(item, k)]));
}

/** Resolves a keychain:// reference; callers must only ever report its length. */
export async function readRef(ref: string): Promise<string> {
  const m = KEYCHAIN_REF_RE.exec(ref);
  if (!m) throw new Error(`Not a keychain reference: ${ref}`);
  const out = await runSecurity(['find-generic-password', '-s', service(m[1]), '-a', m[2], '-w']);
  return out.replace(/\n$/, '');
}

export async function deleteRef(ref: string): Promise<void> {
  const m = KEYCHAIN_REF_RE.exec(ref);
  if (!m) throw new Error(`Not a keychain reference: ${ref}`);
  await runSecurity(['delete-generic-password', '-s', service(m[1]), '-a', m[2]]);
}

/** Returns a copy of env with every keychain:// value replaced by the stored secret. */
export async function resolveEnv(env: Map<string, string>): Promise<Map<string, string>> {
  const out = new Map(env);
  for (const [k, v] of env) {
    if (KEYCHAIN_REF_RE.test(v)) out.set(k, await readRef(v));
  }
  return out;
}
