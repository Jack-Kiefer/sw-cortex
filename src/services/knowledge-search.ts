import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateEmbedding, generateEmbeddings } from './embeddings.js';

/**
 * Knowledge Search
 *
 * Semantic search over plain markdown knowledge files. No external vector DB:
 * files are chunked by heading, embedded via OpenAI, and the vectors are cached
 * in a local JSON file keyed by chunk content hash. On every search the source
 * files' hashes are checked — if a file changed, only the new/edited chunks are
 * re-embedded. Editing the markdown is the only "ingest" step.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_PATH = path.join(REPO_ROOT, 'knowledge', 'kb', 'embeddings-cache.json');
const DEFAULT_FILES = ['DICTIONARY.md'];
const MAX_CHUNK_CHARS = 6000; // text-embedding-3-small caps at 8191 tokens; stay well under
const CACHE_VERSION = 1;

interface Chunk {
  hash: string; // sha256 of breadcrumb + text — the embedding cache key
  file: string; // repo-relative path
  breadcrumb: string; // "TL;DR — Read This First > The id / odoo_id Join Invariant"
  text: string;
}

interface IndexedChunk extends Chunk {
  embedding: number[];
}

interface CacheFile {
  version: number;
  files: Record<string, string>; // repo-relative path -> file content sha256
  chunks: IndexedChunk[];
}

export interface SearchResult {
  score: number;
  file: string;
  section: string;
  text: string;
  truncated: boolean;
}

// Recursively collect every markdown file under a directory.
function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(abs));
    else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) out.push(abs);
  }
  return out;
}

// Resolve KNOWLEDGE_FILES (or the default) into a flat, sorted list of markdown
// file paths. Each entry may be a file OR a directory: a directory is expanded
// into its *.md files recursively. Entries that don't exist are skipped (so a
// stale path can't take down the whole index) — directories with no markdown
// simply contribute nothing.
function knowledgeFiles(): string[] {
  const env = process.env.KNOWLEDGE_FILES;
  const names = env
    ? env
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : DEFAULT_FILES;

  const resolved = new Set<string>();
  for (const name of names) {
    const abs = path.isAbsolute(name) ? name : path.join(REPO_ROOT, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      console.error(`[knowledge] skipping missing KNOWLEDGE_FILES entry: ${abs}`);
      continue;
    }
    if (stat.isDirectory()) {
      for (const f of walkMarkdown(abs)) resolved.add(f);
    } else {
      resolved.add(abs);
    }
  }
  return [...resolved].sort();
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Split a markdown document into heading-scoped chunks. Sections are cut at every
// heading (any level); each chunk carries its full heading breadcrumb. Oversized
// sections are split on blank lines.
export function chunkMarkdown(content: string, file: string): Chunk[] {
  const lines = content.split('\n');
  const chunks: Chunk[] = [];
  const trail: { level: number; title: string }[] = [];
  let body: string[] = [];

  const flush = () => {
    const text = body.join('\n').trim();
    body = [];
    if (!text) return;
    const breadcrumb = trail.map((t) => t.title).join(' > ') || path.basename(file);
    for (const piece of splitOversized(text)) {
      chunks.push({ hash: sha256(`${breadcrumb}\n${piece}`), file, breadcrumb, text: piece });
    }
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      while (trail.length && trail[trail.length - 1].level >= level) trail.pop();
      trail.push({ level, title: heading[2].trim() });
    } else {
      body.push(line);
    }
  }
  flush();
  return chunks;
}

function splitOversized(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const pieces: string[] = [];
  let current = '';
  for (const para of text.split(/\n\n+/)) {
    if (current && current.length + para.length + 2 > MAX_CHUNK_CHARS) {
      pieces.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
    // A single paragraph (e.g. a giant table) can still exceed the cap — hard-split it.
    while (current.length > MAX_CHUNK_CHARS) {
      pieces.push(current.slice(0, MAX_CHUNK_CHARS));
      current = current.slice(MAX_CHUNK_CHARS);
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function readCache(): CacheFile | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as CacheFile;
    return raw.version === CACHE_VERSION ? raw : null;
  } catch {
    return null;
  }
}

function writeCache(cache: CacheFile): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

let memoryIndex: CacheFile | null = null;

// Build (or incrementally refresh) the index. Cheap when nothing changed:
// one hash per file. When a file changed, only chunks whose content hash
// isn't already cached get embedded.
export async function getIndex(): Promise<CacheFile> {
  const files = knowledgeFiles();
  const fileHashes: Record<string, string> = {};
  const contents: Record<string, string> = {};
  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs);
    const content = fs.readFileSync(abs, 'utf-8');
    contents[rel] = content;
    fileHashes[rel] = sha256(content);
  }

  const upToDate = (idx: CacheFile): boolean =>
    Object.keys(fileHashes).length === Object.keys(idx.files).length &&
    Object.entries(fileHashes).every(([f, h]) => idx.files[f] === h);

  if (memoryIndex && upToDate(memoryIndex)) return memoryIndex;
  const cached = readCache();
  if (cached && upToDate(cached)) {
    memoryIndex = cached;
    return cached;
  }

  const previous = new Map<string, number[]>(
    (cached?.chunks ?? []).map((c) => [c.hash, c.embedding])
  );
  const allChunks = Object.entries(contents).flatMap(([rel, content]) =>
    chunkMarkdown(content, rel)
  );

  const toEmbed = allChunks.filter((c) => !previous.has(c.hash));
  const newEmbeddings = await generateEmbeddings(
    toEmbed.map((c) => `${c.breadcrumb}\n\n${c.text}`)
  );
  const embedded = new Map(toEmbed.map((c, i) => [c.hash, newEmbeddings[i]]));

  const index: CacheFile = {
    version: CACHE_VERSION,
    files: fileHashes,
    chunks: allChunks.map((c) => ({
      ...c,
      embedding: previous.get(c.hash) ?? embedded.get(c.hash)!,
    })),
  };
  writeCache(index);
  memoryIndex = index;
  return index;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const RESULT_TEXT_CAP = 3000;

export async function searchKnowledge(
  query: string,
  options: { limit?: number; minScore?: number } = {}
): Promise<{ results: SearchResult[]; indexedChunks: number }> {
  const limit = options.limit ?? 5;
  const minScore = options.minScore ?? 0.2;
  const [index, queryEmbedding] = await Promise.all([getIndex(), generateEmbedding(query)]);

  const results = index.chunks
    .map((c) => ({ chunk: c, score: cosine(queryEmbedding, c.embedding) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      score: Math.round(score * 1000) / 1000,
      file: chunk.file,
      section: chunk.breadcrumb,
      text: chunk.text.length > RESULT_TEXT_CAP ? chunk.text.slice(0, RESULT_TEXT_CAP) : chunk.text,
      truncated: chunk.text.length > RESULT_TEXT_CAP,
    }));

  return { results, indexedChunks: index.chunks.length };
}

// Fetch the full text of every chunk whose breadcrumb matches (case-insensitive
// substring) — the follow-up for truncated search results.
export async function getKnowledgeSection(section: string): Promise<{
  matches: { file: string; section: string; text: string }[];
}> {
  const index = await getIndex();
  const needle = section.toLowerCase();
  const matches = index.chunks
    .filter((c) => c.breadcrumb.toLowerCase().includes(needle))
    .map((c) => ({ file: c.file, section: c.breadcrumb, text: c.text }));
  return { matches };
}
