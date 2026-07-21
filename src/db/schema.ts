// Drizzle schema for the local SQLite reminder DB.

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Reminder status enum values
export const REMINDER_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  SNOOZED: 'snoozed',
} as const;

export type ReminderStatus = (typeof REMINDER_STATUS)[keyof typeof REMINDER_STATUS];

// Reminders table
export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  message: text('message').notNull(),
  remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default(REMINDER_STATUS.PENDING),
  snoozedUntil: integer('snoozed_until', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  // Button interaction tracking
  slackMessageTs: text('slack_message_ts'), // Slack message timestamp for updates
  interacted: integer('interacted', { mode: 'boolean' }).default(false), // User clicked a button
  lastRemindedAt: integer('last_reminded_at', { mode: 'timestamp' }), // For daily re-reminders
});

// Type exports for use in application
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
