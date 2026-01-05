/**
 * Reminder Service - Shared business logic for reminders
 * Used by both MCP server and reminder service
 */

import { eq, and, lte, asc } from 'drizzle-orm';
import { db, reminders, tasks, REMINDER_STATUS, type Reminder } from '../db/index.js';
import { parseDuration } from './tasks.js';

// Parse reminder time from various formats
export function parseRemindAt(input: string): Date {
  // Try ISO date first
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try duration (e.g., "2h", "30m", "1d")
  try {
    const ms = parseDuration(input);
    return new Date(Date.now() + ms);
  } catch {
    throw new Error(`Cannot parse reminder time: ${input}`);
  }
}

// Reminder operations
export function addReminder(data: {
  message: string;
  remindAt: string;
  taskId?: number;
  slackChannel?: string;
}): Reminder {
  const remindAtDate = parseRemindAt(data.remindAt);

  return db
    .insert(reminders)
    .values({
      message: data.message,
      remindAt: remindAtDate,
      taskId: data.taskId ?? null,
      slackChannel: data.slackChannel ?? null,
      status: REMINDER_STATUS.PENDING,
      createdAt: new Date(),
    })
    .returning()
    .get();
}

export function getReminder(id: number): Reminder | undefined {
  return db.select().from(reminders).where(eq(reminders.id, id)).get();
}

export function listReminders(filters?: { status?: string; limit?: number }): Reminder[] {
  const conditions = [];

  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(reminders.status, filters.status));
  } else if (!filters?.status) {
    conditions.push(eq(reminders.status, REMINDER_STATUS.PENDING));
  }

  return db
    .select()
    .from(reminders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(reminders.remindAt))
    .limit(filters?.limit ?? 20)
    .all();
}

export function cancelReminder(id: number): Reminder {
  const existing = getReminder(id);
  if (!existing) throw new Error(`Reminder ${id} not found`);

  return db
    .update(reminders)
    .set({ status: REMINDER_STATUS.CANCELLED })
    .where(eq(reminders.id, id))
    .returning()
    .get();
}

export function snoozeReminder(id: number, duration: string): Reminder {
  const existing = getReminder(id);
  if (!existing) throw new Error(`Reminder ${id} not found`);

  const snoozedUntil = new Date(Date.now() + parseDuration(duration));

  return db
    .update(reminders)
    .set({
      status: REMINDER_STATUS.SNOOZED,
      snoozedUntil,
    })
    .where(eq(reminders.id, id))
    .returning()
    .get();
}

export function markReminderSent(id: number, slackMessageTs?: string): Reminder {
  return db
    .update(reminders)
    .set({
      status: REMINDER_STATUS.SENT,
      sentAt: new Date(),
      lastRemindedAt: new Date(),
      slackMessageTs: slackMessageTs ?? null,
      interacted: false,
    })
    .where(eq(reminders.id, id))
    .returning()
    .get();
}

// Mark a reminder as interacted (user clicked a button)
export function markReminderInteracted(id: number): Reminder {
  return db
    .update(reminders)
    .set({ interacted: true })
    .where(eq(reminders.id, id))
    .returning()
    .get();
}

// Update the Slack message timestamp (for message updates)
export function updateReminderSlackTs(id: number, slackMessageTs: string): Reminder {
  return db
    .update(reminders)
    .set({ slackMessageTs, lastRemindedAt: new Date() })
    .where(eq(reminders.id, id))
    .returning()
    .get();
}

// Get all reminders that are due now
export function getDueReminders(): Array<{
  reminder: Reminder;
  taskTitle?: string;
}> {
  const now = new Date();

  // Pending reminders that are due
  const pendingDue = db
    .select({
      reminder: reminders,
      taskTitle: tasks.title,
    })
    .from(reminders)
    .leftJoin(tasks, eq(reminders.taskId, tasks.id))
    .where(and(eq(reminders.status, REMINDER_STATUS.PENDING), lte(reminders.remindAt, now)))
    .all();

  // Snoozed reminders that are now due
  const snoozedDue = db
    .select({
      reminder: reminders,
      taskTitle: tasks.title,
    })
    .from(reminders)
    .leftJoin(tasks, eq(reminders.taskId, tasks.id))
    .where(and(eq(reminders.status, REMINDER_STATUS.SNOOZED), lte(reminders.snoozedUntil, now)))
    .all();

  return [...pendingDue, ...snoozedDue].map((r) => ({
    reminder: r.reminder,
    taskTitle: r.taskTitle ?? undefined,
  }));
}

// Get reminders that need re-reminding (sent but not interacted, > 24h since last reminder)
export function getRemindersNeedingRereminder(): Array<{
  reminder: Reminder;
  taskTitle?: string;
}> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return db
    .select({
      reminder: reminders,
      taskTitle: tasks.title,
    })
    .from(reminders)
    .leftJoin(tasks, eq(reminders.taskId, tasks.id))
    .where(
      and(
        eq(reminders.status, REMINDER_STATUS.SENT),
        eq(reminders.interacted, false),
        lte(reminders.lastRemindedAt, oneDayAgo)
      )
    )
    .all()
    .map((r) => ({
      reminder: r.reminder,
      taskTitle: r.taskTitle ?? undefined,
    }));
}
