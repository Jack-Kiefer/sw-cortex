/**
 * Reminder Service - Shared business logic for reminders
 * Used by the add-reminder script, the check-reminders job, and the Slack button handler.
 */

import { eq, and, lte, asc } from 'drizzle-orm';
import { db, reminders, REMINDER_STATUS, type Reminder } from '../db/index.js';
import { parseNaturalDate } from './date-parser.js';

// Parse a duration string like "30m", "2h", "1d" into milliseconds.
export function parseDuration(duration: string): number {
  const match = duration
    .trim()
    .match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
  if (!match) throw new Error(`Invalid duration: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return value * 60 * 1000;
  if (unit.startsWith('h')) return value * 60 * 60 * 1000;
  if (unit.startsWith('d')) return value * 24 * 60 * 60 * 1000;

  throw new Error(`Unknown duration unit: ${unit}`);
}

// Parse reminder time from various formats: a duration ("30m", "2h"),
// natural language ("tomorrow at 3pm", "in 2 hours"), or an ISO date.
export function parseRemindAt(input: string): Date {
  const trimmed = input.trim();

  // Bare duration (e.g. "2h", "30m", "1d") — relative to now.
  if (/^\d+\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i.test(trimmed)) {
    return new Date(Date.now() + parseDuration(trimmed));
  }

  // Natural language / ISO ("tomorrow at 3pm", "in 2 hours", "2026-08-01").
  const natural = parseNaturalDate(trimmed);
  if (natural && !isNaN(natural.getTime())) {
    return natural;
  }

  throw new Error(`Cannot parse reminder time: ${input}`);
}

// Reminder operations
export function addReminder(data: {
  message: string;
  remindAt: string;
  slackChannel?: string;
}): Reminder {
  const remindAtDate = parseRemindAt(data.remindAt);

  return db
    .insert(reminders)
    .values({
      message: data.message,
      remindAt: remindAtDate,
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

// Shape the check-reminders job expects. taskTitle is always undefined now
// (the tasks model was removed) but kept for call-site compatibility.
type DueReminder = { reminder: Reminder; taskTitle?: string };

// Get all reminders that are due now (pending past remind_at, or snoozed past snoozed_until).
export function getDueReminders(): DueReminder[] {
  const now = new Date();

  const pendingDue = db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, REMINDER_STATUS.PENDING), lte(reminders.remindAt, now)))
    .all();

  const snoozedDue = db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, REMINDER_STATUS.SNOOZED), lte(reminders.snoozedUntil, now)))
    .all();

  return [...pendingDue, ...snoozedDue].map((reminder) => ({ reminder }));
}

// Get reminders that need re-reminding (sent but not interacted, > 24h since last reminder).
export function getRemindersNeedingRereminder(): DueReminder[] {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.status, REMINDER_STATUS.SENT),
        eq(reminders.interacted, false),
        lte(reminders.lastRemindedAt, oneDayAgo)
      )
    )
    .all()
    .map((reminder) => ({ reminder }));
}
