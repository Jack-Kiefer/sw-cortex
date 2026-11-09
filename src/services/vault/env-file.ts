import { chmod, readFile, rename, stat, writeFile } from 'node:fs/promises';

const LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/;

export interface EnvEntry {
  key: string;
  value: string;
}

function unquote(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  const hash = v.search(/\s+#/);
  return hash === -1 ? v : v.slice(0, hash).trimEnd();
}

export function parseEnv(text: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = LINE_RE.exec(line);
    if (m) entries.push({ key: m[1], value: unquote(m[2]) });
  }
  return entries;
}

export function toMap(entries: EnvEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries) map.set(e.key, e.value);
  return map;
}

function formatValue(value: string): string {
  return /[\s#"'$`\\]/.test(value) ? `"${value.replace(/(["\\$`])/g, '\\$1')}"` : value;
}

/** Upserts keys in place, keeping comments, order and every untouched line byte-for-byte. */
export function upsertEnv(text: string, updates: Map<string, string>): string {
  const pending = new Map(updates);
  const lines = text.length ? text.split('\n') : [];
  const out = lines.map((line) => {
    if (/^\s*#/.test(line)) return line;
    const m = LINE_RE.exec(line);
    if (!m || !pending.has(m[1])) return line;
    const value = pending.get(m[1]) as string;
    pending.delete(m[1]);
    return `${line.match(/^\s*(?:export\s+)?/)?.[0] ?? ''}${m[1]}=${formatValue(value)}`;
  });
  if (pending.size) {
    if (out.length && out[out.length - 1] === '') out.pop();
    for (const [k, v] of pending) out.push(`${k}=${formatValue(v)}`);
    out.push('');
  }
  return out.join('\n');
}

export async function readEnvFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

/** Atomic write (temp + rename), keeping the file's mode or defaulting to 0600. */
export async function writeEnvFile(path: string, text: string): Promise<void> {
  let mode = 0o600;
  try {
    mode = (await stat(path)).mode & 0o777;
  } catch {
    /* new file */
  }
  const tmp = `${path}.vault-${process.pid}.tmp`;
  await writeFile(tmp, text, { mode });
  await chmod(tmp, mode);
  await rename(tmp, path);
}
