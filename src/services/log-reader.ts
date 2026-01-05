/**
 * Log Reader Service
 * Reads and searches JSON log files for MCP tool access
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { LOG_DIRECTORY, type LogEntry } from './logger.js';

export interface LogSearchOptions {
  service?: string;
  level?: string;
  search?: string;
  since?: string; // ISO date or duration like "1h", "24h"
  limit?: number;
}

// Parse log files and return entries
function parseLogFile(filePath: string): LogEntry[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is LogEntry => entry !== null);
}

// Get all log files sorted by date (newest first)
function getLogFiles(): string[] {
  if (!existsSync(LOG_DIRECTORY)) return [];

  return readdirSync(LOG_DIRECTORY)
    .filter((f) => f.startsWith('sw-cortex-') && f.endsWith('.log'))
    .sort()
    .reverse()
    .map((f) => join(LOG_DIRECTORY, f));
}

// Parse duration string to milliseconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(h|hr|hrs|hours?|d|days?|m|min|mins|minutes?)$/i);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return value * 60 * 1000;
  if (unit.startsWith('h')) return value * 60 * 60 * 1000;
  if (unit.startsWith('d')) return value * 24 * 60 * 60 * 1000;

  return 0;
}

// Search logs with filters
export function searchLogs(options: LogSearchOptions = {}): LogEntry[] {
  const { service, level, search, since, limit = 100 } = options;

  // Calculate time threshold
  let sinceDate: Date | null = null;
  if (since) {
    if (since.match(/^\d+[hmd]/i)) {
      // Duration format
      const ms = parseDuration(since);
      sinceDate = new Date(Date.now() - ms);
    } else {
      // ISO date format
      sinceDate = new Date(since);
    }
  }

  const results: LogEntry[] = [];
  const logFiles = getLogFiles();

  for (const logFile of logFiles) {
    const entries = parseLogFile(logFile);

    for (const entry of entries) {
      // Filter by time
      if (sinceDate && new Date(entry.timestamp) < sinceDate) {
        continue;
      }

      // Filter by service
      if (service && entry.service !== service) {
        continue;
      }

      // Filter by level
      if (level && entry.level !== level.toUpperCase()) {
        continue;
      }

      // Filter by search text (searches message and data)
      if (search) {
        const searchLower = search.toLowerCase();
        const messageMatch = entry.message.toLowerCase().includes(searchLower);
        const dataMatch =
          entry.data && JSON.stringify(entry.data).toLowerCase().includes(searchLower);
        const errorMatch =
          entry.error &&
          (entry.error.message.toLowerCase().includes(searchLower) ||
            entry.error.stack?.toLowerCase().includes(searchLower));

        if (!messageMatch && !dataMatch && !errorMatch) {
          continue;
        }
      }

      results.push(entry);

      if (results.length >= limit) {
        break;
      }
    }

    if (results.length >= limit) {
      break;
    }
  }

  // Sort by timestamp descending (newest first)
  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Get recent logs (convenience method)
export function getRecentLogs(limit = 50): LogEntry[] {
  return searchLogs({ limit });
}

// Get errors from logs
export function getRecentErrors(limit = 20): LogEntry[] {
  return searchLogs({ level: 'ERROR', limit });
}

// List available services from logs
export function listLoggedServices(): string[] {
  const services = new Set<string>();
  const logFiles = getLogFiles();

  for (const logFile of logFiles) {
    const entries = parseLogFile(logFile);
    for (const entry of entries) {
      services.add(entry.service);
    }
  }

  return Array.from(services).sort();
}

// Get log stats
export function getLogStats(): {
  totalEntries: number;
  byLevel: Record<string, number>;
  byService: Record<string, number>;
  logFiles: string[];
} {
  const stats = {
    totalEntries: 0,
    byLevel: {} as Record<string, number>,
    byService: {} as Record<string, number>,
    logFiles: getLogFiles().map((f) => f.split('/').pop()!),
  };

  for (const logFile of getLogFiles()) {
    const entries = parseLogFile(logFile);
    stats.totalEntries += entries.length;

    for (const entry of entries) {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byService[entry.service] = (stats.byService[entry.service] || 0) + 1;
    }
  }

  return stats;
}
