import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Values shorter than this are treated as config (ports, flags), not secrets. */
export const MIN_SECRET_LEN = 6;
/** Any run of this many characters copied from a secret counts as a leak. */
const WINDOW = 8;

const KEY_PATH =
  process.env.VAULT_FINGERPRINT_KEY_PATH ?? join(homedir(), '.config', 'sw-vault', 'fingerprint.key');

let hmacKey: Buffer | undefined;
function fingerprintKey(): Buffer {
  if (hmacKey) return hmacKey;
  if (!existsSync(KEY_PATH)) {
    mkdirSync(dirname(KEY_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(KEY_PATH, randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  hmacKey = Buffer.from(readFileSync(KEY_PATH, 'utf8').trim(), 'hex');
  return hmacKey;
}

/** Keyed, stable fingerprint: lets Claude tell values apart without being able to brute-force them. */
export function fingerprint(value: string): string {
  return createHmac('sha256', fingerprintKey()).update(value).digest('hex').slice(0, 10);
}

export function describeValue(value: string): string {
  if (value === '') return '(empty)';
  return `len=${value.length} fp=${fingerprint(value)}`;
}

export interface Secret {
  key: string;
  value: string;
}

/**
 * The redaction gate. Every string that leaves the vault server passes through here.
 * Replaces each full secret value, then any WINDOW-length run copied out of one, so a
 * model that quotes part of a key still can't move it into Claude's context.
 */
export function redact(text: string, secrets: Secret[]): string {
  const candidates = secrets
    .filter((s) => s.value.length >= MIN_SECRET_LEN)
    .sort((a, b) => b.value.length - a.value.length);
  let out = text;
  for (const s of candidates) {
    out = out.split(s.value).join(`«redacted:${s.key}»`);
  }
  for (const s of candidates) {
    if (s.value.length < WINDOW) continue;
    for (let i = 0; i + WINDOW <= s.value.length; i++) {
      const chunk = s.value.slice(i, i + WINDOW);
      if (out.includes(chunk)) out = out.split(chunk).join(`«redacted-part:${s.key}»`);
    }
  }
  return out;
}
