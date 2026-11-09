#!/usr/bin/env node

/**
 * Vault MCP Server — lets Claude manage .env secrets without ever seeing a value.
 *
 * Claude decides WHAT to change; this local process touches the values. Every
 * response goes through the redaction gate (services/vault/redact.ts), which
 * strips any secret value, or any 8-char run copied out of one, that it read
 * during the call. Values are described only by length and a keyed fingerprint.
 *
 * env_ask hands the real file contents to a LOCAL model (Ollama, loopback only,
 * unloaded after each call) for questions that need judgment.
 *
 * Paths are limited to an allowlist (services/vault/paths.ts), checked after
 * resolving symlinks.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { parseEnv, readEnvFile, toMap, upsertEnv, writeEnvFile } from '../../services/vault/env-file.js';
import { askLocalModel, VAULT_MODEL } from '../../services/vault/ollama.js';
import { createItem, OP_REF_RE, readRef } from '../../services/vault/onepassword.js';
import { assertAllowed, DROP_BOX } from '../../services/vault/paths.js';
import { describeValue, MIN_SECRET_LEN, redact, type Secret } from '../../services/vault/redact.js';

const fileProp = { type: 'string', description: 'Absolute path to an allowlisted .env file' };
const keysProp = { type: 'array', items: { type: 'string' } };

const tools: Tool[] = [
  {
    name: 'env_list_keys',
    description:
      'List the keys in an .env file. Values are never shown, only length and a stable fingerprint ' +
      '(same value => same fingerprint across files and calls).',
    inputSchema: { type: 'object', properties: { file: fileProp }, required: ['file'] },
  },
  {
    name: 'env_diff',
    description: 'Compare two .env files by key: only-in-a, only-in-b, same value, different value.',
    inputSchema: {
      type: 'object',
      properties: { file_a: fileProp, file_b: fileProp },
      required: ['file_a', 'file_b'],
    },
  },
  {
    name: 'env_copy',
    description:
      'Copy the values of the given keys from one .env file to another, value-blind. Use this to ' +
      'propagate a secret to worktrees or between repos. With from = the sw-cortex drop box ' +
      `(${DROP_BOX}) and wipe_source=true it finishes a /paste-secret: values are wired in and ` +
      'the drop box is truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        from: fileProp,
        to: fileProp,
        keys: { ...keysProp, description: 'Keys to copy (default: every non-empty key in `from`)' },
        wipe_source: { type: 'boolean', description: 'Truncate `from` afterward (drop box only)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'env_set',
    description:
      'Set NON-secret values (ports, DB names, flags) that you already know. For secrets use ' +
      '/paste-secret + env_copy so the value never passes through you.',
    inputSchema: {
      type: 'object',
      properties: {
        file: fileProp,
        values: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['file', 'values'],
    },
  },
  {
    name: 'env_to_1password',
    description:
      'Move secrets from an .env file into one 1Password item (a concealed field per key), value-blind. ' +
      'With rewrite_env=true the .env lines become op:// references, so the app must then be started ' +
      'via `op run --env-file=<file> -- <cmd>`. Default false: store only, leave the file as is.',
    inputSchema: {
      type: 'object',
      properties: {
        file: fileProp,
        vault: { type: 'string', description: '1Password vault name' },
        item: { type: 'string', description: 'Item title, e.g. "serp-local-env" (no slashes)' },
        keys: { ...keysProp, description: 'Keys to move (default: every value of 6+ chars)' },
        rewrite_env: { type: 'boolean' },
      },
      required: ['file', 'vault', 'item'],
    },
  },
  {
    name: 'env_check_refs',
    description:
      'Check that every op:// reference in an .env file resolves in 1Password. Reports ok + length per key.',
    inputSchema: { type: 'object', properties: { file: fileProp }, required: ['file'] },
  },
  {
    name: 'env_ask',
    description:
      `Ask the LOCAL model (${VAULT_MODEL} via Ollama) a question that needs the real values, e.g. ` +
      '"which of these DB settings point at prod?" or "is this URL well-formed?". The answer is ' +
      'redacted before you see it. Slow (model loads per call, ~5 GB RAM): treat it as a heavy run.',
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' }, description: 'Allowlisted .env paths' },
        question: { type: 'string' },
      },
      required: ['files', 'question'],
    },
  },
];

const ListKeys = z.object({ file: z.string() });
const Diff = z.object({ file_a: z.string(), file_b: z.string() });
const Copy = z.object({
  from: z.string(),
  to: z.string(),
  keys: z.array(z.string()).optional(),
  wipe_source: z.boolean().optional(),
});
const SetValues = z.object({ file: z.string(), values: z.record(z.string()) });
const ToOnePassword = z.object({
  file: z.string(),
  vault: z.string().min(1).regex(/^[^/]+$/),
  item: z.string().min(1).regex(/^[^/]+$/),
  keys: z.array(z.string()).optional(),
  rewrite_env: z.boolean().optional(),
});
const Ask = z.object({ files: z.array(z.string()).min(1).max(6), question: z.string() });

/** Collects every value read during one call, so the gate can strip them from the response. */
class CallScope {
  readonly secrets: Secret[] = [];

  async load(path: string): Promise<{ path: string; text: string; map: Map<string, string> }> {
    const real = await assertAllowed(path);
    const text = await readEnvFile(real);
    const entries = parseEnv(text);
    this.secrets.push(...entries);
    return { path: real, text, map: toMap(entries) };
  }
}

async function handle(name: string, args: unknown, scope: CallScope): Promise<unknown> {
  switch (name) {
    case 'env_list_keys': {
      const { file } = ListKeys.parse(args);
      const env = await scope.load(file);
      return {
        file: env.path,
        keys: [...env.map].map(([key, value]) => ({ key, value: describeValue(value) })),
      };
    }
    case 'env_diff': {
      const { file_a, file_b } = Diff.parse(args);
      const a = await scope.load(file_a);
      const b = await scope.load(file_b);
      const result = { only_in_a: [] as string[], only_in_b: [] as string[], same: [] as string[], different: [] as string[] };
      for (const [k, v] of a.map) {
        if (!b.map.has(k)) result.only_in_a.push(k);
        else (b.map.get(k) === v ? result.same : result.different).push(k);
      }
      for (const k of b.map.keys()) if (!a.map.has(k)) result.only_in_b.push(k);
      return { a: a.path, b: b.path, ...result };
    }
    case 'env_copy': {
      const { from, to, keys, wipe_source } = Copy.parse(args);
      const src = await scope.load(from);
      const dst = await scope.load(to);
      if (wipe_source && src.path !== (await assertAllowed(DROP_BOX))) {
        throw new Error('wipe_source is only allowed when copying from the drop box');
      }
      const wanted = keys ?? [...src.map].filter(([, v]) => v !== '').map(([k]) => k);
      const updates = new Map<string, string>();
      const skipped: string[] = [];
      for (const k of wanted) {
        const v = src.map.get(k);
        if (v === undefined || v === '') skipped.push(k);
        else updates.set(k, v);
      }
      if (updates.size) await writeEnvFile(dst.path, upsertEnv(dst.text, updates));
      if (wipe_source) await writeEnvFile(src.path, '');
      return {
        to: dst.path,
        written: [...updates].map(([key, value]) => ({ key, value: describeValue(value) })),
        skipped_blank_or_missing: skipped,
        source_wiped: Boolean(wipe_source),
      };
    }
    case 'env_set': {
      const { file, values } = SetValues.parse(args);
      const env = await scope.load(file);
      const updates = new Map(Object.entries(values));
      await writeEnvFile(env.path, upsertEnv(env.text, updates));
      return { file: env.path, set: [...updates.keys()] };
    }
    case 'env_to_1password': {
      const { file, vault, item, keys, rewrite_env } = ToOnePassword.parse(args);
      const env = await scope.load(file);
      const wanted =
        keys ?? [...env.map].filter(([, v]) => v.length >= MIN_SECRET_LEN && !OP_REF_RE.test(v)).map(([k]) => k);
      const values = new Map<string, string>();
      for (const k of wanted) {
        const v = env.map.get(k);
        if (v === undefined || v === '') throw new Error(`Key ${k} is missing or empty in ${env.path}`);
        if (OP_REF_RE.test(v)) throw new Error(`Key ${k} is already a 1Password reference`);
        values.set(k, v);
      }
      if (!values.size) throw new Error('Nothing to move');
      const refs = await createItem(vault, item, values);
      if (rewrite_env) await writeEnvFile(env.path, upsertEnv(env.text, refs));
      return { file: env.path, item: `${vault}/${item}`, moved: Object.fromEntries(refs), env_rewritten: Boolean(rewrite_env) };
    }
    case 'env_check_refs': {
      const { file } = ListKeys.parse(args);
      const env = await scope.load(file);
      const results: Record<string, string> = {};
      for (const [k, ref] of env.map) {
        if (!OP_REF_RE.test(ref)) continue;
        try {
          const value = await readRef(ref);
          scope.secrets.push({ key: k, value });
          results[k] = `ok len=${value.length}`;
        } catch (err) {
          results[k] = `FAIL ${(err as Error).message}`;
        }
      }
      return { file: env.path, refs: results };
    }
    case 'env_ask': {
      const { files, question } = Ask.parse(args);
      const blocks: string[] = [];
      for (const f of files) {
        const env = await scope.load(f);
        blocks.push(`### ${env.path}\n${env.text}`);
      }
      const answer = await askLocalModel(blocks.join('\n\n'), question);
      return { model: VAULT_MODEL, answer };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server({ name: 'vault', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const scope = new CallScope();
  try {
    const result = await handle(request.params.name, request.params.arguments, scope);
    return { content: [{ type: 'text', text: redact(JSON.stringify(result, null, 2), scope.secrets) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${redact(message, scope.secrets)}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
