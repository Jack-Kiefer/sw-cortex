import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { parseEnv, upsertEnv } from './env-file.js';
import { redact } from './redact.js';

const SECRET = 'sk_live_9f8e7d6c5b4a3210ZZYYXX';

test('parseEnv handles quotes, export, comments', () => {
  const entries = parseEnv('# c\nexport A=1\nB="two words"\nC=x # trailing\nD=\n');
  assert.deepEqual(entries, [
    { key: 'A', value: '1' },
    { key: 'B', value: 'two words' },
    { key: 'C', value: 'x' },
    { key: 'D', value: '' },
  ]);
});

test('upsertEnv replaces in place and appends new keys', () => {
  const out = upsertEnv('# head\nA=1\nB=2\n', new Map([['B', 'new'], ['C', 'has space']]));
  assert.equal(out, '# head\nA=1\nB=new\nC="has space"\n');
});

test('redact strips full values and copied fragments', () => {
  const secrets = [{ key: 'STRIPE', value: SECRET }, { key: 'PORT', value: '5003' }];
  const out = redact(`full ${SECRET} part ${SECRET.slice(5, 17)} port 5003`, secrets);
  assert.ok(!out.includes(SECRET));
  assert.ok(!out.includes(SECRET.slice(5, 13)));
  assert.match(out, /«redacted:STRIPE»/);
  assert.match(out, /port 5003/);
});

test('MCP server never returns a secret value', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'vault-test-')));
  const a = join(dir, 'a.env');
  const b = join(dir, 'b.env');
  const drop = join(dir, 'secret.txt');
  await writeFile(a, `STRIPE=${SECRET}\nPORT=5003\nONLY_A=abcdefgh123\n`);
  await writeFile(b, 'PORT=5004\n');
  await writeFile(drop, `NEW_TOKEN=${SECRET}xyz\n`);
  await symlink('/etc/hosts', join(dir, 'evil.env'));
  const fakeOp = join(dir, 'op');
  await writeFile(
    fakeOp,
    `#!/bin/sh\necho "$@" >> "${dir}/op-argv.log"\n` +
      `case "$1" in item) cat > "${dir}/op-stdin.json"; echo '{}';; read) printf '%s' '${SECRET}';; esac\n`,
    { mode: 0o755 }
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', fileURLToPath(new URL('../../mcp-servers/vault/index.ts', import.meta.url))],
    env: {
      ...(process.env as Record<string, string>),
      VAULT_ALLOWED_PATHS: `${dir}/*.env,${drop}`,
      VAULT_DROP_BOX: drop,
      VAULT_OP_BIN: fakeOp,
      VAULT_FINGERPRINT_KEY_PATH: join(dir, 'fp.key'),
      VAULT_OLLAMA_URL: 'http://127.0.0.1:1',
    },
  });
  const client = new Client({ name: 'vault-test', version: '0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const res = await client.callTool({ name, arguments: args });
    return (res.content as Array<{ text: string }>)[0].text;
  };

  try {
    const listed = await call('env_list_keys', { file: a });
    assert.match(listed, /STRIPE/);
    assert.ok(!listed.includes(SECRET));

    const diff = JSON.parse(await call('env_diff', { file_a: a, file_b: b }));
    assert.deepEqual(diff.different, ['PORT']);
    assert.deepEqual(diff.only_in_a, ['STRIPE', 'ONLY_A']);

    const copied = await call('env_copy', { from: a, to: b, keys: ['STRIPE', 'MISSING'] });
    assert.ok(!copied.includes(SECRET));
    assert.match(await readFile(b, 'utf8'), new RegExp(`STRIPE=${SECRET}`));

    const refused = await call('env_copy', { from: a, to: b, wipe_source: true });
    assert.match(refused, /only allowed when copying from the drop box/);

    const imported = await call('env_copy', { from: drop, to: b, wipe_source: true });
    assert.ok(!imported.includes(SECRET));
    assert.match(imported, /"source_wiped": true/);
    assert.equal(await readFile(drop, 'utf8'), '');
    assert.match(await readFile(b, 'utf8'), new RegExp(`NEW_TOKEN=${SECRET}xyz`));

    const moved = await call('env_to_1password', { file: a, vault: 'Dev', item: 'a-env', rewrite_env: true });
    assert.ok(!moved.includes(SECRET));
    const stored = JSON.parse(await readFile(join(dir, 'op-stdin.json'), 'utf8'));
    assert.deepEqual(stored.fields.map((f: { label: string }) => f.label), ['STRIPE', 'ONLY_A']);
    assert.ok(!(await readFile(join(dir, 'op-argv.log'), 'utf8')).includes(SECRET));
    const rewritten = await readFile(a, 'utf8');
    assert.match(rewritten, /^STRIPE=op:\/\/Dev\/a-env\/STRIPE$/m);
    assert.match(rewritten, /^PORT=5003$/m);

    const checked = await call('env_check_refs', { file: a });
    assert.match(checked, new RegExp(`"STRIPE": "ok len=${SECRET.length}"`));
    assert.ok(!checked.includes(SECRET));

    const outside = await call('env_list_keys', { file: join(dir, 'evil.env') });
    assert.match(outside, /not in the vault allowlist/);

    const asked = await call('env_ask', { files: [a], question: 'anything?' });
    assert.match(asked, /Local model unreachable/);
    assert.ok(!asked.includes(SECRET));
  } finally {
    await client.close();
  }
});
