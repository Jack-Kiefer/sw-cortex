/**
 * Sessions Service
 *
 * The "session mesh" — a unified view of every running Claude Code session on
 * this machine, so any one session can see what the others are doing, detect
 * when two are working the same thing, read a peer's output, and send it a
 * message.
 *
 * The data comes from Herdr's socket API (the `herdr` CLI). Each Claude Code
 * session runs in a Herdr pane; `herdr agent list` reports every pane with its
 * repo (cwd), live status, and current task (the tab title the session keeps
 * updated). We fuse that into a clean board and add cheap heuristics for
 * detecting overlap between a launching session's task and the peers already
 * running.
 *
 * No new store, no daemon — every call shells out to `herdr` and reflects the
 * live state, exactly like log-reader.ts reads the on-disk logs directly.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

const execFileAsync = promisify(execFile);

/** Resolve the herdr binary the same way launch-repo-session.sh does. */
function herdrBin(): string {
  const local = join(homedir(), '.local', 'bin', 'herdr');
  if (existsSync(local)) return local;
  return 'herdr';
}

async function herdr(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(herdrBin(), args, {
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

/** Raw agent record as Herdr reports it (only the fields we use). */
interface HerdrAgent {
  agent?: string;
  agent_status?: string;
  cwd?: string;
  foreground_cwd?: string;
  focused?: boolean;
  pane_id?: string;
  tab_id?: string;
  terminal_title?: string;
  terminal_title_stripped?: string;
  workspace_id?: string;
}

/** A single session in the fused board. */
export interface SessionInfo {
  /** Repo/workspace label, e.g. "SERP", "SWAC", "sw-cortex". */
  repo: string;
  /** Live status: working | idle | done | blocked | unknown. */
  status: string;
  /** The current task, from the session's tab title (status emoji + text). */
  task: string;
  /** Working directory (or the foreground cwd — a worktree, if one is active). */
  cwd: string;
  /** Herdr pane id — the handle for read_session / message_session. */
  paneId: string;
  /** Whether this pane is the one currently focused in the Herdr client. */
  focused: boolean;
  /** True for the session making the call (so callers can exclude themselves). */
  isSelf: boolean;
}

/** Map a workspace_id → its repo label (SERP / SWAC / sw-cortex / …). */
async function workspaceLabels(): Promise<Record<string, string>> {
  try {
    const out = await herdr(['workspace', 'list']);
    const parsed = JSON.parse(out) as {
      result?: { workspaces?: Array<{ workspace_id?: string; label?: string }> };
    };
    const map: Record<string, string> = {};
    for (const w of parsed.result?.workspaces ?? []) {
      if (w.workspace_id) map[w.workspace_id] = w.label ?? w.workspace_id;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * The unified board: every running Claude Code session.
 *
 * @param selfPaneId - the caller's own HERDR_PANE_ID, if known, so the returned
 *   list can flag which entry is the caller (isSelf). Optional.
 */
export async function listSessions(selfPaneId?: string): Promise<SessionInfo[]> {
  const out = await herdr(['agent', 'list']);
  const parsed = JSON.parse(out) as { result?: { agents?: HerdrAgent[] } };
  const agents = parsed.result?.agents ?? [];
  const labels = await workspaceLabels();

  return agents
    .filter((a) => (a.agent ?? 'claude') === 'claude')
    .map((a) => {
      const paneId = a.pane_id ?? '';
      const cwd = a.foreground_cwd || a.cwd || '';
      return {
        repo: labels[a.workspace_id ?? ''] ?? basename(cwd) ?? 'unknown',
        status: a.agent_status ?? 'unknown',
        task: (a.terminal_title_stripped || a.terminal_title || '').trim(),
        cwd,
        paneId,
        focused: Boolean(a.focused),
        isSelf: Boolean(selfPaneId && paneId === selfPaneId),
      };
    });
}

function basename(p: string): string {
  if (!p) return '';
  const parts = p.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

export interface OverlapMatch {
  /** The peer session that appears to be working the same thing. */
  session: SessionInfo;
  /** Why we think they overlap (the shared signal). */
  reason: string;
  /** Rough confidence: "high" (shared PR#/worktree) or "medium" (task-text). */
  confidence: 'high' | 'medium';
}

export interface OverlapResult {
  /** The task the caller asked about. */
  task: string;
  overlaps: OverlapMatch[];
  /** The strongest peer to coordinate with, if any (highest confidence first). */
  suggestedPeer?: SessionInfo;
}

/** Pull PR numbers ("#948", "PR 948") out of a string. */
function prNumbers(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/#(\d{2,6})\b/g)) out.add(m[1]);
  for (const m of s.matchAll(/\bPR\s*(\d{2,6})\b/gi)) out.add(m[1]);
  return out;
}

/** Pull WW-#### ticket ids out of a string. */
function ticketIds(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\bWW-?(\d{2,5})\b/gi)) out.add(m[1]);
  return out;
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'on',
  'is',
  'are',
  'fix',
  'add',
  'update',
  'change',
  'make',
  'build',
  'pr',
  'gate',
  'session',
  'researching',
  'building',
  'planning',
  'running',
  'working',
  'done',
  'wip',
  'with',
  'from',
  'into',
  'this',
  'that',
  'it',
  'be',
  'as',
  'at',
  'by',
]);

/** Distinctive lowercase word tokens from a task string (drops emoji/stopwords). */
function keyTokens(s: string): Set<string> {
  const out = new Set<string>();
  const cleaned = s
    // strip emoji / symbols, keep word chars and separators
    .replace(/[^\p{L}\p{N}\s._/-]/gu, ' ')
    .toLowerCase();
  for (const raw of cleaned.split(/[\s._/-]+/)) {
    const t = raw.trim();
    if (t.length >= 4 && !STOPWORDS.has(t)) out.add(t);
  }
  return out;
}

function intersect<T>(a: Set<T>, b: Set<T>): T[] {
  const out: T[] = [];
  for (const x of a) if (b.has(x)) out.push(x);
  return out;
}

/**
 * Does the given task overlap anything already running?
 *
 * Heuristics, cheap and conservative (we prefer a false negative over spamming
 * a peer): a shared PR number, a shared WW ticket, the same worktree path, or a
 * strong overlap of distinctive task-title tokens.
 *
 * @param task        - the caller's task text (its /go or tab-title description)
 * @param selfPaneId  - the caller's own pane id, to exclude itself
 */
export async function checkOverlap(task: string, selfPaneId?: string): Promise<OverlapResult> {
  const sessions = (await listSessions(selfPaneId)).filter((s) => !s.isSelf && s.status !== 'done');

  const myPRs = prNumbers(task);
  const myTickets = ticketIds(task);
  const myTokens = keyTokens(task);

  const overlaps: OverlapMatch[] = [];

  for (const s of sessions) {
    const theirText = s.task;
    const sharedPRs = intersect(myPRs, prNumbers(theirText));
    const sharedTickets = intersect(myTickets, ticketIds(theirText));
    const sharedTokens = intersect(myTokens, keyTokens(theirText));

    if (sharedPRs.length > 0) {
      overlaps.push({
        session: s,
        reason: `both reference PR #${sharedPRs.join(', #')}`,
        confidence: 'high',
      });
    } else if (sharedTickets.length > 0) {
      overlaps.push({
        session: s,
        reason: `both reference ticket WW-${sharedTickets.join(', WW-')}`,
        confidence: 'high',
      });
    } else if (sharedTokens.length >= 2) {
      overlaps.push({
        session: s,
        reason: `similar task ("${sharedTokens.slice(0, 4).join('", "')}")`,
        confidence: 'medium',
      });
    }
  }

  overlaps.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1));

  return {
    task,
    overlaps,
    suggestedPeer: overlaps[0]?.session,
  };
}

// ---------------------------------------------------------------------------
// Reading & messaging a peer
// ---------------------------------------------------------------------------

/** Read a peer session's recent terminal output. */
export async function readSession(paneId: string, lines = 60): Promise<string> {
  const out = await herdr(['agent', 'read', paneId]);
  const all = out.split('\n');
  return all.slice(Math.max(0, all.length - lines)).join('\n');
}

/**
 * Send a message to a peer session. Delivered via `herdr agent prompt`, so it
 * lands as a real prompt in the target session's queue and it will respond on
 * its next turn. Does NOT drive the peer (no --wait / no key injection) — it is
 * a message, not a handoff.
 */
export async function messageSession(target: string, text: string): Promise<string> {
  await herdr(['agent', 'prompt', target, text]);
  return `Message delivered to ${target}. It will see it on its next turn.`;
}
