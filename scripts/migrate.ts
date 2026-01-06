/**
 * Database Migration Script
 *
 * Applies pending migrations from the drizzle/ folder
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database path - can be overridden by environment variable
const DB_PATH = process.env.TASK_DB_PATH || resolve(__dirname, '../tasks/tasks.db');

// Ensure the directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log('Migrating database at:', DB_PATH);

// Create SQLite connection with WAL mode for better concurrency
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance
const db = drizzle(sqlite);

// Run migrations
const migrationsFolder = resolve(__dirname, '../drizzle');
console.log('Running migrations from:', migrationsFolder);

try {
  migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
