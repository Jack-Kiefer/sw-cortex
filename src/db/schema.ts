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

// Priority levels (urgency - when does it need to be done)
export const PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// Importance levels (for Eisenhower matrix - how important is it)
export const IMPORTANCE = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export type Importance = (typeof IMPORTANCE)[keyof typeof IMPORTANCE];

// Recurrence patterns (TickTick-style)
export const RECURRENCE_TYPE = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom', // Uses recurrenceRule for complex patterns
} as const;

export type RecurrenceType = (typeof RECURRENCE_TYPE)[keyof typeof RECURRENCE_TYPE];

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

// Tasks table (TickTick-style features)
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default(TASK_STATUS.PENDING),
  priority: integer('priority').default(PRIORITY.MEDIUM), // Urgency (1-4)
  importance: integer('importance').default(IMPORTANCE.MEDIUM), // For Eisenhower matrix (1-4)
  projectId: integer('project_id').references(() => projects.id),

  // Dates (TickTick-style)
  startDate: integer('start_date', { mode: 'timestamp' }), // When to start working
  dueDate: integer('due_date', { mode: 'timestamp' }), // When it's due
  snoozedUntil: integer('snoozed_until', { mode: 'timestamp' }),

  // Duration/Time estimates (TickTick-style)
  estimatedMinutes: integer('estimated_minutes'), // How long the task should take
  actualMinutes: integer('actual_minutes'), // How long it actually took

  // Subtasks support (TickTick-style)
  parentId: integer('parent_id'), // For subtasks (self-reference handled in relations)
  sortOrder: integer('sort_order').default(0), // Order within parent or list

  // Recurrence (TickTick-style)
  recurrenceType: text('recurrence_type').default(RECURRENCE_TYPE.NONE),
  recurrenceRule: text('recurrence_rule'), // RRULE format for complex patterns
  recurrenceEndDate: integer('recurrence_end_date', { mode: 'timestamp' }),
  lastRecurrence: integer('last_recurrence', { mode: 'timestamp' }), // Last time this recurring task was completed

  // Organization
  tags: text('tags'), // JSON array stored as text
  metadata: text('metadata'), // JSON object for extensibility

  // Timestamps
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

// Checklist items (quick subtasks within a task - TickTick-style)
export const checklistItems = sqliteTable('checklist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Habits table (TickTick-style habit tracking)
export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  frequency: text('frequency').notNull().default('daily'), // daily, weekly, custom
  frequencyDays: text('frequency_days'), // JSON array of days for weekly (e.g., ["mon", "wed", "fri"])
  targetCount: integer('target_count').default(1), // How many times per frequency period
  color: text('color').default('#6366f1'),
  reminderTime: text('reminder_time'), // Time of day to remind (e.g., "09:00")
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Habit completions (tracking when habits are done)
export const habitCompletions = sqliteTable('habit_completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id')
    .notNull()
    .references(() => habits.id, { onDelete: 'cascade' }),
  completedAt: integer('completed_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  note: text('note'), // Optional note about the completion
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

// Discovery type enum values
export const DISCOVERY_TYPE = {
  PATTERN: 'pattern',
  ANOMALY: 'anomaly',
  OPTIMIZATION: 'optimization',
  FACT: 'fact',
  RELATIONSHIP: 'relationship',
  INSIGHT: 'insight',
} as const;

export type DiscoveryType = (typeof DISCOVERY_TYPE)[keyof typeof DISCOVERY_TYPE];

// Discoveries table - for saving insights from database queries and exploration
export const discoveries = sqliteTable('discoveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),

  // Source context
  source: text('source').notNull(), // 'database_query', 'manual', 'code_review', 'exploration', etc.
  sourceDatabase: text('source_database'), // wishdesk, sugarwish, odoo, retool
  sourceQuery: text('source_query'), // The SQL query that led to this discovery

  // Table/Column reference (for schema documentation)
  tableName: text('table_name'), // Specific table this note is about
  columnName: text('column_name'), // Specific column (optional)

  // Classification
  type: text('type').default(DISCOVERY_TYPE.INSIGHT), // pattern, anomaly, optimization, fact, relationship, insight
  priority: integer('priority').default(PRIORITY.MEDIUM), // 1-4 like tasks

  // Organization
  tags: text('tags'), // JSON array stored as text
  relatedTaskId: integer('related_task_id').references(() => tasks.id),
  relatedProjectId: integer('related_project_id').references(() => projects.id),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  discoveries: many(discoveries),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, { relationName: 'subtasks' }),
  checklistItems: many(checklistItems),
  reminders: many(reminders),
  activity: many(taskActivity),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  task: one(tasks, {
    fields: [checklistItems.taskId],
    references: [tasks.id],
  }),
}));

export const habitsRelations = relations(habits, ({ many }) => ({
  completions: many(habitCompletions),
}));

export const habitCompletionsRelations = relations(habitCompletions, ({ one }) => ({
  habit: one(habits, {
    fields: [habitCompletions.habitId],
    references: [habits.id],
  }),
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

export const discoveriesRelations = relations(discoveries, ({ one }) => ({
  relatedTask: one(tasks, {
    fields: [discoveries.relatedTaskId],
    references: [tasks.id],
  }),
  relatedProject: one(projects, {
    fields: [discoveries.relatedProjectId],
    references: [projects.id],
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
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type HabitCompletion = typeof habitCompletions.$inferSelect;
export type NewHabitCompletion = typeof habitCompletions.$inferInsert;
export type Discovery = typeof discoveries.$inferSelect;
export type NewDiscovery = typeof discoveries.$inferInsert;
