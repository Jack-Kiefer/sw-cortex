import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Priority levels (used by discoveries)
export const PRIORITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

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
  priority: integer('priority').default(PRIORITY.MEDIUM), // 1-4

  // Organization
  tags: text('tags'), // JSON array stored as text

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports for use in application
export type Discovery = typeof discoveries.$inferSelect;
export type NewDiscovery = typeof discoveries.$inferInsert;
