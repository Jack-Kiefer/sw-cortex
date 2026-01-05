import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Task status enum values
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// Reminder status enum values
export const REMINDER_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  SNOOZED: 'snoozed',
} as const;

export type ReminderStatus = (typeof REMINDER_STATUS)[keyof typeof REMINDER_STATUS];

// Priority levels
export const PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// Projects table
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  githubRepo: text('github_repo'),
  color: text('color').default('#6366f1'), // Indigo default
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Tasks table
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default(TASK_STATUS.PENDING),
  priority: integer('priority').default(PRIORITY.MEDIUM),
  projectId: integer('project_id').references(() => projects.id),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  snoozedUntil: integer('snoozed_until', { mode: 'timestamp' }),
  tags: text('tags'), // JSON array stored as text
  metadata: text('metadata'), // JSON object for extensibility
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  // Notification fields (unified reminder support)
  notifyAt: integer('notify_at', { mode: 'timestamp' }), // When to send Slack notification
  notificationSent: integer('notification_sent', { mode: 'boolean' }).default(false),
  notificationChannel: text('notification_channel'), // Slack channel/DM for notification
  notificationSnoozedUntil: integer('notification_snoozed_until', {
    mode: 'timestamp',
  }), // Snooze the notification separately from task
});

// Reminders table
export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id),
  message: text('message').notNull(),
  remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default(REMINDER_STATUS.PENDING),
  slackChannel: text('slack_channel'), // DM or channel
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

// Task activity log for history
export const taskActivity = sqliteTable('task_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id),
  action: text('action').notNull(), // created, updated, completed, snoozed, etc.
  previousValue: text('previous_value'), // JSON
  newValue: text('new_value'), // JSON
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  reminders: many(reminders),
  activity: many(taskActivity),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  task: one(tasks, {
    fields: [reminders.taskId],
    references: [tasks.id],
  }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  task: one(tasks, {
    fields: [taskActivity.taskId],
    references: [tasks.id],
  }),
}));

// Type exports for use in application
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type TaskActivity = typeof taskActivity.$inferSelect;
export type NewTaskActivity = typeof taskActivity.$inferInsert;
