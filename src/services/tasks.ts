/**
 * Task Service - Shared business logic for task management
 * Used by both MCP server and reminder service
 */

import { eq, and, desc, asc, lte, isNotNull } from 'drizzle-orm';
import {
  db,
  tasks,
  projects,
  taskActivity,
  TASK_STATUS,
  type Task,
  type Project,
} from '../db/index.js';

// Duration parsing
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
  if (!match) throw new Error(`Invalid duration: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return value * 60 * 1000;
  if (unit.startsWith('h')) return value * 60 * 60 * 1000;
  if (unit.startsWith('d')) return value * 24 * 60 * 60 * 1000;

  throw new Error(`Unknown duration unit: ${unit}`);
}

// Activity logging
function logActivity(
  taskId: number,
  action: string,
  previousValue?: unknown,
  newValue?: unknown
): void {
  db.insert(taskActivity)
    .values({
      taskId,
      action,
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      createdAt: new Date(),
    })
    .run();
}

// Project operations
export function getProjectByName(name: string): Project | undefined {
  return db.select().from(projects).where(eq(projects.name, name)).get();
}

export function getOrCreateProject(name: string): Project {
  const existing = getProjectByName(name);
  if (existing) return existing;

  return db
    .insert(projects)
    .values({
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

export function listProjects(): Project[] {
  return db.select().from(projects).orderBy(asc(projects.name)).all();
}

export function createProject(data: {
  name: string;
  description?: string;
  githubRepo?: string;
}): Project {
  return db
    .insert(projects)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

// Parse notification time from various formats (ISO date or duration)
export function parseNotifyAt(input: string): Date {
  // Try ISO date first
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try duration (e.g., "2h", "30m", "1d")
  const ms = parseDuration(input);
  return new Date(Date.now() + ms);
}

// Task operations
export function addTask(data: {
  title: string;
  description?: string;
  project?: string;
  priority?: number;
  dueDate?: string;
  tags?: string[];
  notifyAt?: string; // ISO date or duration like "2h"
  notificationChannel?: string;
}): Task {
  let projectId: number | null = null;

  if (data.project) {
    const project = getOrCreateProject(data.project);
    projectId = project.id;
  }

  const task = db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      projectId,
      priority: data.priority ?? 2,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      status: TASK_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      notifyAt: data.notifyAt ? parseNotifyAt(data.notifyAt) : null,
      notificationSent: false,
      notificationChannel: data.notificationChannel ?? null,
    })
    .returning()
    .get();

  logActivity(task.id, 'created', null, task);
  return task;
}

export function getTask(id: number): Task | undefined {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

export function listTasks(filters?: { status?: string; project?: string; limit?: number }): Task[] {
  // Un-snooze tasks that are past their snooze time
  const now = new Date();
  db.update(tasks)
    .set({ status: TASK_STATUS.PENDING, snoozedUntil: null, updatedAt: now })
    .where(and(eq(tasks.status, TASK_STATUS.SNOOZED), lte(tasks.snoozedUntil, now)))
    .run();

  const conditions = [];

  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(tasks.status, filters.status));
  }

  if (filters?.project) {
    const project = getProjectByName(filters.project);
    if (project) {
      conditions.push(eq(tasks.projectId, project.id));
    }
  }

  return db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.priority), asc(tasks.createdAt))
    .limit(filters?.limit ?? 20)
    .all();
}

export function updateTask(
  id: number,
  data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: number;
    dueDate?: string;
  }
): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const updates: Partial<Task> = { updatedAt: new Date() };

  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.status !== undefined) updates.status = data.status;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.dueDate !== undefined) updates.dueDate = new Date(data.dueDate);

  const updated = db.update(tasks).set(updates).where(eq(tasks.id, id)).returning().get();

  logActivity(id, 'updated', existing, updated);
  return updated;
}

export function completeTask(id: number): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const completed = db
    .update(tasks)
    .set({
      status: TASK_STATUS.COMPLETED,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'completed', existing.status, TASK_STATUS.COMPLETED);
  return completed;
}

export function snoozeTask(id: number, duration: string): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const snoozedUntil = new Date(Date.now() + parseDuration(duration));

  const snoozed = db
    .update(tasks)
    .set({
      status: TASK_STATUS.SNOOZED,
      snoozedUntil,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'snoozed', null, { snoozedUntil });
  return snoozed;
}

export function moveTask(id: number, projectName: string): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const project = getOrCreateProject(projectName);

  const moved = db
    .update(tasks)
    .set({
      projectId: project.id,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'moved', { projectId: existing.projectId }, { projectId: project.id });
  return moved;
}

export function deleteTask(id: number): boolean {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  // Delete activity log
  db.delete(taskActivity).where(eq(taskActivity.taskId, id)).run();
  // Delete task
  db.delete(tasks).where(eq(tasks.id, id)).run();

  return true;
}

// ============================================
// Notification Operations (Unified Reminders)
// ============================================

/**
 * Set or update notification for a task
 */
export function setTaskNotification(id: number, notifyAt: string, channel?: string): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const updated = db
    .update(tasks)
    .set({
      notifyAt: parseNotifyAt(notifyAt),
      notificationSent: false,
      notificationChannel: channel ?? existing.notificationChannel,
      notificationSnoozedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'notification_set', null, { notifyAt: updated.notifyAt });
  return updated;
}

/**
 * Clear notification from a task
 */
export function clearTaskNotification(id: number): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const updated = db
    .update(tasks)
    .set({
      notifyAt: null,
      notificationSent: false,
      notificationSnoozedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'notification_cleared', null, null);
  return updated;
}

/**
 * Snooze a task's notification (separate from snoozing the task itself)
 */
export function snoozeTaskNotification(id: number, duration: string): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const snoozedUntil = new Date(Date.now() + parseDuration(duration));

  const updated = db
    .update(tasks)
    .set({
      notificationSnoozedUntil: snoozedUntil,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'notification_snoozed', null, { snoozedUntil });
  return updated;
}

/**
 * Mark a task's notification as sent
 */
export function markTaskNotificationSent(id: number): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  return db
    .update(tasks)
    .set({
      notificationSent: true,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();
}

/**
 * Get all tasks that have notifications due now
 * Used by the notification service to send Slack messages
 */
export function getTasksDueForNotification(): Task[] {
  const now = new Date();

  // Un-snooze notifications that are past their snooze time
  db.update(tasks)
    .set({ notificationSnoozedUntil: null })
    .where(lte(tasks.notificationSnoozedUntil, now))
    .run();

  // Get tasks with notifications due
  return db
    .select()
    .from(tasks)
    .where(and(lte(tasks.notifyAt, now), eq(tasks.notificationSent, false)))
    .all()
    .filter((task) => {
      // Exclude if notification is snoozed
      if (task.notificationSnoozedUntil && task.notificationSnoozedUntil > now) {
        return false;
      }
      return true;
    });
}

/**
 * List tasks with pending notifications
 */
export function listTasksWithNotifications(): Task[] {
  return db
    .select()
    .from(tasks)
    .where(and(isNotNull(tasks.notifyAt), eq(tasks.notificationSent, false)))
    .orderBy(asc(tasks.notifyAt))
    .all();
}
