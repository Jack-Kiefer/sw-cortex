/**
 * Task Service - Shared business logic for task management
 * Used by both MCP server and reminder service
 *
 * TickTick-style features:
 * - Natural language date parsing
 * - Subtasks (hierarchical tasks)
 * - Checklist items (quick checkboxes within tasks)
 * - Recurring tasks
 * - Smart lists (Today, Tomorrow, This Week)
 * - Eisenhower matrix (urgency vs importance)
 * - Duration/time estimates
 */

import { eq, and, desc, asc, lte, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import {
  db,
  tasks,
  projects,
  taskActivity,
  checklistItems,
  TASK_STATUS,
  RECURRENCE_TYPE,
  type Task,
  type Project,
  type ChecklistItem,
} from '../db/index.js';
import { parseNaturalDate, formatDate, getNextRecurrence, parseRecurrence } from './date-parser.js';

// Re-export date utilities for convenience
export { parseNaturalDate, formatDate, parseRecurrence };

// Duration parsing (legacy, for backward compatibility)
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

// Parse notification time from various formats (natural language, ISO date, or duration)
export function parseNotifyAt(input: string): Date {
  // Use the new natural language parser
  const parsed = parseNaturalDate(input);
  if (parsed) {
    return parsed;
  }

  // Fall back to legacy duration parsing for backward compatibility
  const ms = parseDuration(input);
  return new Date(Date.now() + ms);
}

// Task operations (TickTick-style)
export function addTask(data: {
  title: string;
  description?: string;
  project?: string;
  priority?: number; // Urgency: 1-4
  importance?: number; // Importance: 1-4 (for Eisenhower matrix)
  startDate?: string; // When to start working (natural language or ISO)
  dueDate?: string; // When it's due (natural language or ISO)
  estimatedMinutes?: number; // How long the task should take
  parentId?: number; // For subtasks
  recurrence?: string; // "daily", "weekly", "every monday", etc.
  tags?: string[];
  notifyAt?: string; // Natural language date or duration like "2h"
  notificationChannel?: string;
}): Task {
  let projectId: number | null = null;

  if (data.project) {
    const project = getOrCreateProject(data.project);
    projectId = project.id;
  }

  // Parse recurrence if provided
  let recurrenceType: string = RECURRENCE_TYPE.NONE;
  let recurrenceRule: string | null = null;
  if (data.recurrence) {
    const parsed = parseRecurrence(data.recurrence);
    if (parsed) {
      recurrenceType = parsed.type;
      if (parsed.interval || parsed.daysOfWeek) {
        recurrenceRule = JSON.stringify(parsed);
      }
    }
  }

  const task = db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      projectId,
      priority: data.priority ?? 2,
      importance: data.importance ?? 2,
      startDate: data.startDate ? parseNotifyAt(data.startDate) : null,
      dueDate: data.dueDate ? parseNotifyAt(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      parentId: data.parentId ?? null,
      recurrenceType,
      recurrenceRule,
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

// Add a subtask to a parent task
export function addSubtask(
  parentId: number,
  data: { title: string; description?: string; priority?: number }
): Task {
  const parent = getTask(parentId);
  if (!parent) throw new Error(`Parent task ${parentId} not found`);

  // Get the max sort order for existing subtasks
  const maxOrder = db
    .select()
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .all()
    .reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1);

  const subtask = db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description,
      parentId,
      projectId: parent.projectId,
      priority: data.priority ?? parent.priority,
      sortOrder: maxOrder + 1,
      status: TASK_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();

  logActivity(subtask.id, 'created_subtask', null, { parentId });
  return subtask;
}

// Get subtasks for a parent task
export function getSubtasks(parentId: number): Task[] {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .orderBy(asc(tasks.sortOrder))
    .all();
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

// ============================================
// Checklist Items (TickTick-style quick subtasks)
// ============================================

/**
 * Add a checklist item to a task
 */
export function addChecklistItem(taskId: number, title: string): ChecklistItem {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Get max sort order
  const maxOrder = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .all()
    .reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);

  return db
    .insert(checklistItems)
    .values({
      taskId,
      title,
      sortOrder: maxOrder + 1,
      isCompleted: false,
      createdAt: new Date(),
    })
    .returning()
    .get();
}

/**
 * Toggle a checklist item's completion status
 */
export function toggleChecklistItem(id: number): ChecklistItem {
  const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
  if (!item) throw new Error(`Checklist item ${id} not found`);

  return db
    .update(checklistItems)
    .set({ isCompleted: !item.isCompleted })
    .where(eq(checklistItems.id, id))
    .returning()
    .get();
}

/**
 * Delete a checklist item
 */
export function deleteChecklistItem(id: number): boolean {
  const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
  if (!item) throw new Error(`Checklist item ${id} not found`);

  db.delete(checklistItems).where(eq(checklistItems.id, id)).run();
  return true;
}

/**
 * Get all checklist items for a task
 */
export function getChecklistItems(taskId: number): ChecklistItem[] {
  return db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(asc(checklistItems.sortOrder))
    .all();
}

// ============================================
// Smart Lists (TickTick-style filtered views)
// ============================================

/**
 * Get tasks due today
 */
export function getTasksToday(): Task[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Un-snooze tasks first
  unsnoozeExpiredTasks();

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueDate, startOfDay),
        lt(tasks.dueDate, endOfDay),
        isNull(tasks.parentId), // Only top-level tasks
        eq(tasks.status, TASK_STATUS.PENDING)
      )
    )
    .orderBy(desc(tasks.priority), asc(tasks.dueDate))
    .all();
}

/**
 * Get tasks due tomorrow
 */
export function getTasksTomorrow(): Task[] {
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  unsnoozeExpiredTasks();

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueDate, startOfTomorrow),
        lt(tasks.dueDate, endOfTomorrow),
        isNull(tasks.parentId),
        eq(tasks.status, TASK_STATUS.PENDING)
      )
    )
    .orderBy(desc(tasks.priority), asc(tasks.dueDate))
    .all();
}

/**
 * Get tasks due this week (next 7 days)
 */
export function getTasksThisWeek(): Task[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  unsnoozeExpiredTasks();

  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueDate, startOfToday),
        lt(tasks.dueDate, endOfWeek),
        isNull(tasks.parentId),
        eq(tasks.status, TASK_STATUS.PENDING)
      )
    )
    .orderBy(asc(tasks.dueDate), desc(tasks.priority))
    .all();
}

/**
 * Get overdue tasks
 */
export function getOverdueTasks(): Task[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  unsnoozeExpiredTasks();

  return db
    .select()
    .from(tasks)
    .where(
      and(
        lt(tasks.dueDate, startOfToday),
        isNull(tasks.parentId),
        eq(tasks.status, TASK_STATUS.PENDING)
      )
    )
    .orderBy(asc(tasks.dueDate), desc(tasks.priority))
    .all();
}

/**
 * Get all pending tasks (no due date filter)
 */
export function getAllPendingTasks(): Task[] {
  unsnoozeExpiredTasks();

  return db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.parentId), eq(tasks.status, TASK_STATUS.PENDING)))
    .orderBy(desc(tasks.priority), asc(tasks.createdAt))
    .all();
}

// Helper function to un-snooze expired tasks
function unsnoozeExpiredTasks(): void {
  const now = new Date();
  db.update(tasks)
    .set({ status: TASK_STATUS.PENDING, snoozedUntil: null, updatedAt: now })
    .where(and(eq(tasks.status, TASK_STATUS.SNOOZED), lte(tasks.snoozedUntil, now)))
    .run();
}

// ============================================
// Eisenhower Matrix (TickTick-style)
// ============================================

export interface EisenhowerMatrix {
  doFirst: Task[]; // Urgent + Important (priority >= 3, importance >= 3)
  schedule: Task[]; // Not Urgent + Important (priority < 3, importance >= 3)
  delegate: Task[]; // Urgent + Not Important (priority >= 3, importance < 3)
  eliminate: Task[]; // Not Urgent + Not Important (priority < 3, importance < 3)
}

/**
 * Get tasks organized by Eisenhower matrix
 */
export function getEisenhowerMatrix(): EisenhowerMatrix {
  unsnoozeExpiredTasks();

  const pendingTasks = db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.parentId), eq(tasks.status, TASK_STATUS.PENDING)))
    .all();

  const matrix: EisenhowerMatrix = {
    doFirst: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };

  for (const task of pendingTasks) {
    const isUrgent = (task.priority ?? 2) >= 3;
    const isImportant = (task.importance ?? 2) >= 3;

    if (isUrgent && isImportant) {
      matrix.doFirst.push(task);
    } else if (!isUrgent && isImportant) {
      matrix.schedule.push(task);
    } else if (isUrgent && !isImportant) {
      matrix.delegate.push(task);
    } else {
      matrix.eliminate.push(task);
    }
  }

  // Sort each quadrant by due date, then priority
  const sortFn = (a: Task, b: Task) => {
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (b.priority ?? 2) - (a.priority ?? 2);
  };

  matrix.doFirst.sort(sortFn);
  matrix.schedule.sort(sortFn);
  matrix.delegate.sort(sortFn);
  matrix.eliminate.sort(sortFn);

  return matrix;
}

// ============================================
// Recurring Tasks (TickTick-style)
// ============================================

/**
 * Complete a recurring task - creates the next occurrence
 */
export function completeRecurringTask(id: number): { completed: Task; next: Task | null } {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  // Complete the current task
  const completed = db
    .update(tasks)
    .set({
      status: TASK_STATUS.COMPLETED,
      completedAt: new Date(),
      lastRecurrence: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  logActivity(id, 'completed', existing.status, TASK_STATUS.COMPLETED);

  // If not a recurring task, we're done
  if (!existing.recurrenceType || existing.recurrenceType === RECURRENCE_TYPE.NONE) {
    return { completed, next: null };
  }

  // Check if recurrence has ended
  if (existing.recurrenceEndDate && new Date() > existing.recurrenceEndDate) {
    return { completed, next: null };
  }

  // Calculate next due date
  const baseDueDate = existing.dueDate || new Date();
  const nextDueDate = getNextRecurrence(
    existing.recurrenceType,
    existing.recurrenceRule,
    baseDueDate
  );

  // Create the next occurrence
  const next = db
    .insert(tasks)
    .values({
      title: existing.title,
      description: existing.description,
      projectId: existing.projectId,
      priority: existing.priority,
      importance: existing.importance,
      dueDate: nextDueDate,
      startDate: existing.startDate
        ? new Date(nextDueDate.getTime() - (baseDueDate.getTime() - existing.startDate.getTime()))
        : null,
      estimatedMinutes: existing.estimatedMinutes,
      recurrenceType: existing.recurrenceType,
      recurrenceRule: existing.recurrenceRule,
      recurrenceEndDate: existing.recurrenceEndDate,
      tags: existing.tags,
      status: TASK_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      notifyAt: existing.notifyAt
        ? new Date(nextDueDate.getTime() - (baseDueDate.getTime() - existing.notifyAt.getTime()))
        : null,
      notificationChannel: existing.notificationChannel,
    })
    .returning()
    .get();

  logActivity(next.id, 'created_from_recurrence', null, { previousTaskId: id });

  return { completed, next };
}

// ============================================
// Task with Full Details (TickTick-style)
// ============================================

export interface TaskWithDetails extends Task {
  subtasks: Task[];
  checklistItems: ChecklistItem[];
  project: Project | null;
}

/**
 * Get a task with all its details (subtasks, checklist items, project)
 */
export function getTaskWithDetails(id: number): TaskWithDetails | null {
  const task = getTask(id);
  if (!task) return null;

  const subtasks = getSubtasks(id);
  const items = getChecklistItems(id);
  const project = task.projectId
    ? (db.select().from(projects).where(eq(projects.id, task.projectId)).get() ?? null)
    : null;

  return {
    ...task,
    subtasks,
    checklistItems: items,
    project,
  };
}
