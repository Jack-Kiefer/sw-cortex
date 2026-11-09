import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const PROJECTS = join(homedir(), 'Desktop', 'Projects');

/** Files the vault may touch. Override with VAULT_ALLOWED_PATHS (comma-separated globs; `*` = one path segment). */
const DEFAULT_GLOBS = [
  `${PROJECTS}/SERP/.env`,
  `${PROJECTS}/SERP/.worktrees/*/.env`,
  `${PROJECTS}/SWAC/.env`,
  `${PROJECTS}/sw-cortex/.env`,
  `${PROJECTS}/sw-cortex/secret.txt`,
  '/private/tmp/*/.env',
];

export const DROP_BOX = process.env.VAULT_DROP_BOX ?? `${PROJECTS}/sw-cortex/secret.txt`;

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return new RegExp(`^${body}$`);
}

function allowedPatterns(): RegExp[] {
  const raw = process.env.VAULT_ALLOWED_PATHS;
  const globs = raw ? raw.split(',').map((g) => g.trim()).filter(Boolean) : DEFAULT_GLOBS;
  return globs.map(globToRegExp);
}

async function canonical(path: string): Promise<string> {
  const abs = resolve(path.replace(/^~(?=\/)/, homedir()));
  try {
    return await realpath(abs);
  } catch {
    // File may not exist yet (a new .env): canonicalise its directory instead.
    return join(await realpath(dirname(abs)), basename(abs));
  }
}

/**
 * Resolves symlinks before checking, so a symlink planted at an allowed path
 * (e.g. /tmp/x/.env -> ~/.ssh/id_rsa) is refused.
 */
export async function assertAllowed(path: string): Promise<string> {
  const real = await canonical(path);
  if (!allowedPatterns().some((re) => re.test(real))) {
    throw new Error(`Path not in the vault allowlist: ${real}`);
  }
  return real;
}
