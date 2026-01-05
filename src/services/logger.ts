/**
 * Centralized Logging Service
 * Writes JSON lines to log files for easy searching via MCP
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || join(__dirname, '../../logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_LOG_FILES = 10; // Keep last 10 log files

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

// Get current log file path (rotates daily)
function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(LOG_DIR, `sw-cortex-${date}.log`);
}

// Rotate logs if needed
function rotateLogsIfNeeded(): void {
  const logFile = getLogFilePath();

  // Check size-based rotation
  if (existsSync(logFile)) {
    const stats = statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      const timestamp = Date.now();
      const rotatedPath = logFile.replace('.log', `-${timestamp}.log`);
      // Rename current file
      renameSync(logFile, rotatedPath);
    }
  }

  // Clean up old log files
  const logFiles = readdirSync(LOG_DIR)
    .filter((f) => f.startsWith('sw-cortex-') && f.endsWith('.log'))
    .map((f) => ({ name: f, path: join(LOG_DIR, f), mtime: statSync(join(LOG_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Remove oldest files if we have too many
  if (logFiles.length > MAX_LOG_FILES) {
    for (const file of logFiles.slice(MAX_LOG_FILES)) {
      unlinkSync(file.path);
    }
  }
}

// Write log entry
function writeLog(entry: LogEntry): void {
  rotateLogsIfNeeded();
  const logFile = getLogFilePath();
  const line = JSON.stringify(entry) + '\n';
  appendFileSync(logFile, line);

  // Also output to console for systemd journal
  const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.service}]`;
  if (entry.error) {
    console.error(`${prefix} ${entry.message}`, entry.data || '', entry.error);
  } else if (entry.level === 'ERROR' || entry.level === 'WARN') {
    console.error(`${prefix} ${entry.message}`, entry.data || '');
  } else {
    console.log(`${prefix} ${entry.message}`, entry.data || '');
  }
}

// Create a logger for a specific service
export function createLogger(service: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        service,
        message,
        data,
      });
    },

    info(message: string, data?: Record<string, unknown>) {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service,
        message,
        data,
      });
    },

    warn(message: string, data?: Record<string, unknown>) {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service,
        message,
        data,
      });
    },

    error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service,
        message,
        data,
      };

      if (error instanceof Error) {
        entry.error = {
          message: error.message,
          stack: error.stack,
        };
      } else if (error) {
        entry.error = {
          message: String(error),
        };
      }

      writeLog(entry);
    },
  };
}

// Export log directory for MCP tool
export const LOG_DIRECTORY = LOG_DIR;
