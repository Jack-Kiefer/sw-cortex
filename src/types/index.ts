/**
 * Centralized type definitions for sw-cortex
 *
 * Strategy:
 * - Drizzle types (Task, Reminder, Project) are the source of truth for DB operations
 * - API types (*Response) represent JSON-serialized data with string dates
 * - Frontend components use API types since they receive JSON from the server
 */

// Re-export Drizzle types for backend/service use
export type {
  Task,
  NewTask,
  Reminder,
  NewReminder,
  Project,
  NewProject,
  TaskActivity,
  NewTaskActivity,
  TaskStatus,
  ReminderStatus,
  Priority,
} from '../db/schema.js';

// Re-export constants
export { TASK_STATUS, REMINDER_STATUS, PRIORITY } from '../db/schema.js';

/**
 * Frontend/API types - JSON serialized versions with string dates
 * These match what the API returns after JSON.stringify
 */

export interface TaskResponse {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: number | null;
  projectId: number | null;
  dueDate: string | null;
  snoozedUntil: string | null;
  tags: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notifyAt: string | null;
  notificationSent: boolean | null;
  notificationChannel: string | null;
  notificationSnoozedUntil: string | null;
}

export interface ReminderResponse {
  id: number;
  taskId: number | null;
  message: string;
  remindAt: string;
  status: string;
  slackChannel: string | null;
  snoozedUntil: string | null;
  sentAt: string | null;
  createdAt: string;
  slackMessageTs: string | null;
  interacted: boolean | null;
  lastRemindedAt: string | null;
}

export interface ProjectResponse {
  id: number;
  name: string;
  description: string | null;
  githubRepo: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}
