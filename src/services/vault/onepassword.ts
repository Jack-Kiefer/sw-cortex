import { spawn } from 'node:child_process';

export const OP_BIN = process.env.VAULT_OP_BIN ?? 'op';

export const OP_REF_RE = /^op:\/\/[^/]+\/[^/]+\/[^/]+$/;

/** Runs `op`, feeding secrets through stdin only (never argv, which `ps` can see). */
function runOp(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(OP_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', (e) =>
      reject(new Error(`1Password CLI not runnable (${OP_BIN}): ${e.message}`))
    );
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`op ${args[0]} ${args[1] ?? ''} failed: ${err.trim()}`))
    );
    child.stdin.end(stdin ?? '');
  });
}

/** Creates one item holding every key as a concealed field; returns key -> op:// reference. */
export async function createItem(
  vault: string,
  title: string,
  values: Map<string, string>
): Promise<Map<string, string>> {
  const template = {
    title,
    category: 'SECURE_NOTE',
    fields: [...values].map(([key, value]) => ({ id: key, label: key, type: 'CONCEALED', value })),
  };
  await runOp(['item', 'create', '--vault', vault, '--format', 'json'], JSON.stringify(template));
  return new Map([...values.keys()].map((k) => [k, `op://${vault}/${title}/${k}`]));
}

/** Resolves a reference; the caller must only ever report its length. */
export async function readRef(ref: string): Promise<string> {
  return (await runOp(['read', '--no-newline', ref])).toString();
}
