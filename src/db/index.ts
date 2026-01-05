import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database path - can be overridden by environment variable
const DB_PATH = process.env.TASK_DB_PATH || resolve(__dirname, '../../tasks/tasks.db');

// Ensure the directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection with WAL mode for better concurrency
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from './schema.js';

// Close database connection (for cleanup)
export function closeDb(): void {
  sqlite.close();
}

// Initialize database - runs migrations
export function initDb(): void {
  // Migrations are handled by drizzle-kit
  // Run: npm run db:migrate
  console.log('Database initialized at:', DB_PATH);
}
