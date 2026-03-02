#!/usr/bin/env npx tsx
/**
 * Meeting Notes Sync Script
 *
 * Reads markdown files from knowledge/meetings/, chunks them, generates embeddings,
 * encrypts content, and upserts to the slack_messages_encrypted Qdrant collection.
 *
 * Usage:
 *   npm run meetings:sync              # Sync all meeting notes
 *   npm run meetings:sync -- --verbose # With detailed logging
 *   npm run meetings:sync -- --dry-run # Preview without indexing
 */

import 'dotenv/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { generateEmbeddings } from '../src/services/embeddings';
import { getQdrantClient } from '../src/qdrant';
import { encrypt, validateEncryptionKey } from '../src/services/encryption';

const ENCRYPTED_COLLECTION = 'slack_messages_encrypted';
const MEETINGS_DIR = path.join(process.cwd(), 'knowledge', 'meetings');
const CHUNK_SIZE = 2000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
};

interface MeetingChunk {
  file: string;
  title: string;
  date: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  timestamp: number;
}

/**
 * Parse meeting title and date from filename.
 * Expected format: YYYY-MM-DD-title.md or YYYYMMDDTHHMMSS-title.md
 */
function parseFilename(filename: string): { title: string; date: string; timestamp: number } {
  const base = filename.replace(/\.md$/, '');

  // Try ISO date prefix: 2026-03-01-meeting-name
  const isoMatch = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (isoMatch) {
    const date = isoMatch[1];
    const title = isoMatch[2].replace(/-/g, ' ');
    return { title, date, timestamp: new Date(date).getTime() / 1000 };
  }

  // Try compact date prefix: 20260301-meeting-name
  const compactMatch = base.match(/^(\d{8})-(.+)$/);
  if (compactMatch) {
    const raw = compactMatch[1];
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const title = compactMatch[2].replace(/-/g, ' ');
    return { title, date, timestamp: new Date(date).getTime() / 1000 };
  }

  // Fallback: use file mtime
  const filePath = path.join(MEETINGS_DIR, filename);
  const stat = fs.statSync(filePath);
  const date = stat.mtime.toISOString().split('T')[0];
  return { title: base.replace(/-/g, ' '), date, timestamp: stat.mtime.getTime() / 1000 };
}

/**
 * Split text into overlapping chunks.
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.length > 20); // Skip tiny remnants
}

/**
 * Generate a stable UUID from meeting file + chunk index.
 */
function generateMeetingPointId(filename: string, chunkIndex: number): string {
  const combined = `meeting:${filename}:chunk:${chunkIndex}`;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Load and chunk all meeting files.
 */
function loadMeetingChunks(): MeetingChunk[] {
  if (!fs.existsSync(MEETINGS_DIR)) {
    console.log(`Meetings directory not found: ${MEETINGS_DIR}`);
    return [];
  }

  const files = fs
    .readdirSync(MEETINGS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const allChunks: MeetingChunk[] = [];

  for (const file of files) {
    const filePath = path.join(MEETINGS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8').trim();

    if (!content) continue;

    const { title, date, timestamp } = parseFilename(file);
    const rawChunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    for (let i = 0; i < rawChunks.length; i++) {
      allChunks.push({
        file,
        title,
        date,
        chunkIndex: i,
        totalChunks: rawChunks.length,
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

async function main() {
  console.log('Meeting Notes Sync\n');

  // Validate encryption key
  const keyCheck = validateEncryptionKey();
  if (!keyCheck.valid) {
    console.error(`Encryption key error: ${keyCheck.error}`);
    process.exit(1);
  }

  // Load chunks
  console.log(`Loading meetings from ${MEETINGS_DIR}...`);
  const chunks = loadMeetingChunks();

  if (chunks.length === 0) {
    console.log('No meeting notes found. Add .md files to knowledge/meetings/');
    return;
  }

  const files = [...new Set(chunks.map((c) => c.file))];
  console.log(`Found ${files.length} meeting files, ${chunks.length} total chunks`);
  for (const file of files) {
    const n = chunks.filter((c) => c.file === file).length;
    console.log(`  ${file}: ${n} chunks`);
  }

  if (flags.dryRun) {
    console.log('\n[DRY RUN] Would index the following:');
    for (const file of files) {
      const fileChunks = chunks.filter((c) => c.file === file);
      console.log(`  ${file}: ${fileChunks.length} chunks`);
    }
    return;
  }

  // Connect to Qdrant
  const client = getQdrantClient();
  const BATCH_SIZE = 50;
  let totalIndexed = 0;

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    // Format text for embedding: include title and date for context
    const texts = batch.map((chunk) => `[Meeting: ${chunk.title}] [${chunk.date}]\n${chunk.text}`);

    const embeddings = await generateEmbeddings(texts);

    const points = batch.map((chunk, idx) => ({
      id: generateMeetingPointId(chunk.file, chunk.chunkIndex),
      vector: embeddings[idx],
      payload: {
        // Use meeting_ prefix for channelId so search results can identify source
        messageId: `meeting:${chunk.file}:${chunk.chunkIndex}`,
        channelId: 'meetings',
        channelName: encrypt('meetings'),
        userId: 'meeting-notes',
        userName: encrypt('Meeting Notes'),
        text: encrypt(`[Meeting: ${chunk.title}] [${chunk.date}]\n${chunk.text}`),
        timestamp: chunk.timestamp,
        threadTs: encrypt(chunk.file), // Use file as thread so all chunks group together
        permalink: null,
        version: 1,
        encrypted: true,
      },
    }));

    await client.upsert(ENCRYPTED_COLLECTION, { wait: true, points });
    totalIndexed += batch.length;

    if (flags.verbose) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      console.log(`  Batch ${batchNum}/${totalBatches} indexed`);
    }
  }

  console.log(`\nDone. Indexed ${totalIndexed} chunks from ${files.length} meeting files.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
