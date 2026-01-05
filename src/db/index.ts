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

// Initialize database with tables
export function initDb(): void {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      github_repo TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 2,
      project_id INTEGER REFERENCES projects(id),
      due_date INTEGER,
      snoozed_until INTEGER,
      tags TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id),
      message TEXT NOT NULL,
      remind_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      slack_channel TEXT,
      snoozed_until INTEGER,
      sent_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      previous_value TEXT,
      new_value TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
  `);
}
