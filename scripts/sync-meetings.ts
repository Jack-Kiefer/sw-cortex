#!/usr/bin/env npx tsx
/**
 * Knowledge Sync Script
 *
 * Reads markdown files from knowledge directories and ~/.claude/plans/,
 * chunks them, generates embeddings, encrypts content, and upserts to
 * the slack_messages_encrypted Qdrant collection.
 *
 * Usage:
 *   npm run meetings:sync                    # Sync meetings + plans
 *   npm run meetings:sync -- --meetings-only # Sync only meetings
 *   npm run meetings:sync -- --plans-only    # Sync only plans
 *   npm run meetings:sync -- --verbose       # With detailed logging
 *   npm run meetings:sync -- --dry-run       # Preview without indexing
 */

import 'dotenv/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateEmbeddings } from '../src/services/embeddings';
import { getQdrantClient } from '../src/qdrant';
import { encrypt, validateEncryptionKey } from '../src/services/encryption';

const ENCRYPTED_COLLECTION = 'slack_messages_encrypted';
const CHUNK_SIZE = 2000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const BATCH_SIZE = 50;

const SOURCES = {
  meetings: {
    dir: path.join(process.cwd(), 'knowledge', 'meetings'),
    channelId: 'meetings',
    channelName: 'Meeting Notes',
    label: 'Meeting',
    pointPrefix: 'meeting',
  },
  plans: {
    dir: path.join(os.homedir(), '.claude', 'plans'),
    channelId: 'plans',
    channelName: 'Claude Plans',
    label: 'Plan',
    pointPrefix: 'plan',
  },
};

const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  meetingsOnly: args.includes('--meetings-only'),
  plansOnly: args.includes('--plans-only'),
};

interface DocChunk {
  source: keyof typeof SOURCES;
  file: string;
  title: string;
  date: string;
  chunkIndex: number;
  text: string;
  timestamp: number;
}

function parseFilename(
  dir: string,
  filename: string
): { title: string; date: string; timestamp: number } {
  const base = filename.replace(/\.md$/, '');

  // ISO date prefix: 2026-03-01-some-title
  const isoMatch = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (isoMatch) {
    const date = isoMatch[1];
    const title = isoMatch[2].replace(/-/g, ' ');
    return { title, date, timestamp: new Date(date).getTime() / 1000 };
  }

  // Compact date prefix: 20260301-some-title
  const compactMatch = base.match(/^(\d{8})-(.+)$/);
  if (compactMatch) {
    const raw = compactMatch[1];
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const title = compactMatch[2].replace(/-/g, ' ');
    return { title, date, timestamp: new Date(date).getTime() / 1000 };
  }

  // Fallback: use mtime
  const stat = fs.statSync(path.join(dir, filename));
  const date = stat.mtime.toISOString().split('T')[0];
  return {
    title: base.replace(/-/g, ' '),
    date,
    timestamp: stat.mtime.getTime() / 1000,
  };
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 20);
}

function generatePointId(prefix: string, filename: string, chunkIndex: number): string {
  const combined = `${prefix}:${filename}:chunk:${chunkIndex}`;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function loadChunksFromSource(sourceKey: keyof typeof SOURCES): DocChunk[] {
  const source = SOURCES[sourceKey];
  if (!fs.existsSync(source.dir)) {
    console.log(`  Directory not found: ${source.dir}`);
    return [];
  }

  const files = fs
    .readdirSync(source.dir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const allChunks: DocChunk[] = [];

  for (const file of files) {
    const filePath = path.join(source.dir, file);
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) continue;

    const { title, date, timestamp } = parseFilename(source.dir, file);
    const rawChunks = chunkText(content);

    for (let i = 0; i < rawChunks.length; i++) {
      allChunks.push({
        source: sourceKey,
        file,
        title,
        date,
        chunkIndex: i,
        text: rawChunks[i],
        timestamp,
      });
    }

    if (flags.verbose) {
      console.log(`  ${file}: ${rawChunks.length} chunks`);
    }
  }

  return allChunks;
}

async function syncChunks(chunks: DocChunk[]): Promise<number> {
  const client = getQdrantClient();
  let totalIndexed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const texts = batch.map((chunk) => {
      const src = SOURCES[chunk.source];
      return `[${src.label}: ${chunk.title}] [${chunk.date}]\n${chunk.text}`;
    });

    const embeddings = await generateEmbeddings(texts);

    const points = batch.map((chunk, idx) => {
      const src = SOURCES[chunk.source];
      return {
        id: generatePointId(src.pointPrefix, chunk.file, chunk.chunkIndex),
        vector: embeddings[idx],
        payload: {
          messageId: `${src.pointPrefix}:${chunk.file}:${chunk.chunkIndex}`,
          channelId: src.channelId,
          channelName: encrypt(src.channelName),
          userId: src.pointPrefix,
          userName: encrypt(src.channelName),
          text: encrypt(`[${src.label}: ${chunk.title}] [${chunk.date}]\n${chunk.text}`),
          timestamp: chunk.timestamp,
          threadTs: encrypt(chunk.file),
          permalink: null,
          version: 1,
          encrypted: true,
        },
      };
    });

    await client.upsert(ENCRYPTED_COLLECTION, { wait: true, points });
    totalIndexed += batch.length;

    if (flags.verbose) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      console.log(`  Batch ${batchNum}/${totalBatches} indexed`);
    }
  }

  return totalIndexed;
}

async function main() {
  const keyCheck = validateEncryptionKey();
  if (!keyCheck.valid) {
    console.error(`Encryption key error: ${keyCheck.error}`);
    process.exit(1);
  }

  const sourcesToSync: (keyof typeof SOURCES)[] = flags.plansOnly
    ? ['plans']
    : flags.meetingsOnly
      ? ['meetings']
      : ['meetings', 'plans'];

  let grandTotal = 0;

  for (const sourceKey of sourcesToSync) {
    const src = SOURCES[sourceKey];
    console.log(`\nLoading ${sourceKey} from ${src.dir}...`);
    const chunks = loadChunksFromSource(sourceKey);

    if (chunks.length === 0) {
      console.log(`  No files found.`);
      continue;
    }

    const files = [...new Set(chunks.map((c) => c.file))];
    console.log(`  ${files.length} files, ${chunks.length} total chunks`);
    for (const file of files) {
      const n = chunks.filter((c) => c.file === file).length;
      console.log(`    ${file}: ${n} chunks`);
    }

    if (flags.dryRun) {
      console.log(`  [DRY RUN] Would index ${chunks.length} chunks`);
      continue;
    }

    const indexed = await syncChunks(chunks);
    console.log(`  Indexed ${indexed} chunks`);
    grandTotal += indexed;
  }

  if (!flags.dryRun) {
    console.log(`\nDone. Total indexed: ${grandTotal} chunks`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
