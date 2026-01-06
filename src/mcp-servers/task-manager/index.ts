#!/usr/bin/env node

import 'dotenv/config';

/**
 * Task Manager MCP Server v2.0
 *
 * Unified task and notification model:
 * - Tasks can have optional notifications (replacing separate reminders)
 * - Notifications are time-triggered Slack messages linked to tasks
 * - Projects organize tasks into logical groups
 *
 * Tools:
 * - Task management (add, list, complete, snooze, move, delete)
 * - Notifications (set, snooze, clear on tasks)
 * - Projects (list, create)
 * - Legacy reminder tools (deprecated, create tasks internally)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { initDb } from '../../db/index.js';
import * as taskService from '../../services/tasks.js';
import * as habitService from '../../services/habits.js';
import * as logReader from '../../services/log-reader.js';
import * as discoveriesService from '../../services/discoveries.js';
import * as slackSync from '../../services/slack-sync.js';

// Initialize task database
initDb();

const tools: Tool[] = [
  // ==================
  // Task Tools (TickTick-style)
  // ==================
  {
    name: 'add_task',
    description:
      'Add a new task with TickTick-style features. Supports natural language dates like "tomorrow", "next monday", "in 2 hours".',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        project: {
          type: 'string',
          description: 'Project name (auto-created if new)',
        },
        priority: {
          type: 'number',
          description: 'Urgency 1-4 (1=low, 4=urgent)',
        },
        importance: {
          type: 'number',
          description: 'Importance 1-4 for Eisenhower matrix (1=low, 4=critical)',
        },
        startDate: {
          type: 'string',
          description: 'When to start working (natural language: "tomorrow", "next monday")',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (natural language: "friday", "in 3 days", "Dec 25")',
        },
        estimatedMinutes: {
          type: 'number',
          description: 'Estimated time to complete in minutes',
        },
        parentId: {
          type: 'number',
          description: 'Parent task ID for creating subtasks',
        },
        recurrence: {
          type: 'string',
          description: 'Recurrence pattern: "daily", "weekly", "monthly", "every monday", etc.',
        },
        tags: { type: 'array', items: { type: 'string' } },
        notifyAt: {
          type: 'string',
          description: 'When to send Slack notification (natural language or duration)',
        },
        notificationChannel: {
          type: 'string',
          description: 'Slack channel for notification (defaults to DM)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'snoozed', 'all'],
        },
        project: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  // ==================
  // Smart Lists (TickTick-style)
  // ==================
  {
    name: 'get_tasks_today',
    description: 'Get all tasks due today (TickTick-style smart list)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_tasks_tomorrow',
    description: 'Get all tasks due tomorrow (TickTick-style smart list)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_tasks_this_week',
    description: 'Get all tasks due in the next 7 days (TickTick-style smart list)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get all overdue tasks (TickTick-style smart list)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_eisenhower_matrix',
    description:
      'Get tasks organized by Eisenhower matrix: Do First (urgent+important), Schedule (important), Delegate (urgent), Eliminate (neither)',
    inputSchema: { type: 'object', properties: {} },
  },
  // ==================
  // Subtasks (TickTick-style)
  // ==================
  {
    name: 'add_subtask',
    description: 'Add a subtask to an existing task',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'number', description: 'Parent task ID' },
        title: { type: 'string', description: 'Subtask title' },
        description: { type: 'string', description: 'Subtask description' },
        priority: { type: 'number', description: 'Priority 1-4' },
      },
      required: ['parentId', 'title'],
    },
  },
  {
    name: 'get_subtasks',
    description: 'Get all subtasks for a task',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'number', description: 'Parent task ID' },
      },
      required: ['parentId'],
    },
  },
  // ==================
  // Checklist Items (TickTick-style quick checkboxes)
  // ==================
  {
    name: 'add_checklist_item',
    description: 'Add a quick checklist item to a task (simpler than subtasks)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'number', description: 'Task ID' },
        title: { type: 'string', description: 'Checklist item text' },
      },
      required: ['taskId', 'title'],
    },
  },
  {
    name: 'toggle_checklist_item',
    description: 'Toggle a checklist item as completed/uncompleted',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Checklist item ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_checklist_item',
    description: 'Delete a checklist item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Checklist item ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_checklist_items',
    description: 'Get all checklist items for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'number', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  // ==================
  // Task Details
  // ==================
  {
    name: 'get_task_details',
    description: 'Get a task with all its details: subtasks, checklist items, and project info',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'snoozed'],
        },
        priority: { type: 'number' },
        dueDate: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },
  {
    name: 'snooze_task',
    description: 'Snooze a task for a duration (e.g., "2h", "1d")',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        duration: {
          type: 'string',
          description: 'Duration like "2h", "30m", "1d"',
        },
      },
      required: ['id', 'duration'],
    },
  },
  {
    name: 'move_task',
    description: 'Move a task to a project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        project: { type: 'string' },
      },
      required: ['id', 'project'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },

  // ==================
  // Notification Tools (unified with tasks)
  // ==================
  {
    name: 'set_task_notification',
    description:
      'Set or update a Slack notification for a task. The notification will be sent at the specified time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID' },
        notifyAt: {
          type: 'string',
          description: 'When to notify (ISO date or duration like "2h")',
        },
        channel: {
          type: 'string',
          description: 'Slack channel (optional, defaults to DM)',
        },
      },
      required: ['id', 'notifyAt'],
    },
  },
  {
    name: 'snooze_task_notification',
    description:
      "Snooze a task's notification (delays the Slack message without changing the task status)",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID' },
        duration: {
          type: 'string',
          description: 'Duration like "15m", "1h", "1d"',
        },
      },
      required: ['id', 'duration'],
    },
  },
  {
    name: 'clear_task_notification',
    description: "Remove a task's notification (task remains, notification is cleared)",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_tasks_due_for_notification',
    description: 'Get tasks with notifications that are due now (for notification service)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tasks_with_notifications',
    description: 'List all tasks that have pending notifications',
    inputSchema: { type: 'object', properties: {} },
  },

  // ==================
  // Project Tools
  // ==================
  {
    name: 'list_projects',
    description: 'List all projects',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_project',
    description: 'Create a new project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        githubRepo: { type: 'string' },
      },
      required: ['name'],
    },
  },

  // ==================
  // Legacy Reminder Tools (deprecated - create tasks internally)
  // ==================
  {
    name: 'add_reminder',
    description: '[DEPRECATED: Use add_task with notifyAt] Creates a task with a notification',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Reminder message (becomes task title)' },
        remindAt: {
          type: 'string',
          description: 'When to remind (ISO date or duration)',
        },
        project: { type: 'string', description: 'Project to assign to' },
      },
      required: ['message', 'remindAt'],
    },
  },
  {
    name: 'list_reminders',
    description: '[DEPRECATED: Use list_tasks_with_notifications] Lists tasks with notifications',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },

  // ==================
  // Habit Tracking (TickTick-style)
  // ==================
  {
    name: 'create_habit',
    description: 'Create a new habit to track',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Habit name' },
        description: { type: 'string', description: 'Habit description' },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'custom'],
          description: 'How often to do the habit',
        },
        frequencyDays: {
          type: 'array',
          items: { type: 'string' },
          description: 'Days of week for weekly habits: ["mon", "wed", "fri"]',
        },
        targetCount: {
          type: 'number',
          description: 'How many times per period (default 1)',
        },
        reminderTime: {
          type: 'string',
          description: 'Time to remind (e.g., "09:00")',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_habits',
    description: 'List all habits',
    inputSchema: {
      type: 'object',
      properties: {
        includeArchived: {
          type: 'boolean',
          description: 'Include archived habits (default false)',
        },
      },
    },
  },
  {
    name: 'complete_habit',
    description: 'Log a habit completion for today',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Habit ID' },
        note: { type: 'string', description: 'Optional note about the completion' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_habit_stats',
    description: 'Get comprehensive statistics for a habit (streaks, completion rates)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Habit ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_today_habits',
    description: "Get today's habits status (which are completed, which need to be done)",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'archive_habit',
    description: 'Archive a habit (soft delete)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Habit ID' },
      },
      required: ['id'],
    },
  },

  // ==================
  // Discoveries (Database Insights)
  // ==================
  {
    name: 'add_discovery',
    description:
      'Save an important insight or discovery from database exploration. Use this to capture knowledge for future reference.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the discovery' },
        description: { type: 'string', description: 'Detailed description of the insight' },
        source: {
          type: 'string',
          description: 'Source type: "database_query", "manual", "code_review", "exploration"',
        },
        sourceDatabase: {
          type: 'string',
          description: 'Database name if from query: wishdesk, sugarwish, odoo, retool',
        },
        sourceQuery: { type: 'string', description: 'The SQL query that led to this discovery' },
        tableName: {
          type: 'string',
          description: 'Specific table this note is about (for table-level documentation)',
        },
        columnName: {
          type: 'string',
          description: 'Specific column this note is about (optional, requires tableName)',
        },
        type: {
          type: 'string',
          enum: ['pattern', 'anomaly', 'optimization', 'fact', 'relationship', 'insight'],
          description: 'Type of discovery',
        },
        priority: { type: 'number', description: 'Priority 1-4 (1=low, 4=critical)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        relatedTaskId: { type: 'number', description: 'Link to a related task' },
        relatedProjectId: { type: 'number', description: 'Link to a related project' },
      },
      required: ['title', 'source'],
    },
  },
  {
    name: 'list_discoveries',
    description: 'List saved discoveries with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Filter by source type' },
        sourceDatabase: { type: 'string', description: 'Filter by database name' },
        type: { type: 'string', description: 'Filter by discovery type' },
        projectId: { type: 'number', description: 'Filter by project' },
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
  },
  {
    name: 'get_discovery',
    description: 'Get full details of a discovery including related task and project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_discovery',
    description: 'Update a discovery',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string' },
        priority: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
        relatedTaskId: { type: 'number' },
        relatedProjectId: { type: 'number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_discovery',
    description: 'Delete a discovery',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Discovery ID (UUID)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_discoveries',
    description:
      'Search discoveries semantically using vector embeddings. Returns discoveries similar to your query with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query (e.g., "order fulfillment workflow", "authentication tables")',
        },
        sourceDatabase: { type: 'string', description: 'Filter by database name' },
        tableName: { type: 'string', description: 'Filter by table name' },
        type: { type: 'string', description: 'Filter by discovery type' },
        source: { type: 'string', description: 'Filter by source type' },
        projectId: { type: 'number', description: 'Filter by project ID' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
        minScore: { type: 'number', description: 'Minimum similarity score 0-1 (default 0.3)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'export_discoveries',
    description: 'Export discoveries to markdown or JSON format for documentation',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Export format (default: markdown)',
        },
        sourceDatabase: { type: 'string', description: 'Filter by database' },
        projectId: { type: 'number', description: 'Filter by project' },
      },
    },
  },
  {
    name: 'get_table_notes',
    description:
      'Get all notes/discoveries for a specific database table. Use this to retrieve context when working with a table.',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name: wishdesk, sugarwish, odoo, retool',
        },
        table: { type: 'string', description: 'Table name' },
      },
      required: ['database', 'table'],
    },
  },

  // ==================
  // Log Tools
  // ==================
  {
    name: 'search_logs',
    description:
      'Search sw-cortex service logs. Use this to understand what happened recently or debug issues.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Filter by service name (e.g., "slack-handler", "reminders")',
        },
        level: {
          type: 'string',
          enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
          description: 'Filter by log level',
        },
        search: {
          type: 'string',
          description: 'Text to search for in log messages',
        },
        since: {
          type: 'string',
          description: 'Time filter: duration like "1h", "24h" or ISO date',
        },
        limit: {
          type: 'number',
          description: 'Max entries to return (default 100)',
        },
      },
    },
  },
  {
    name: 'get_recent_logs',
    description: 'Get the most recent log entries across all services',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of entries (default 50)',
        },
      },
    },
  },
  {
    name: 'get_recent_errors',
    description: 'Get recent ERROR level logs to identify issues',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of errors (default 20)',
        },
      },
    },
  },
  {
    name: 'get_log_stats',
    description: 'Get statistics about logs (counts by level, service, etc.)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ==================
  // Slack Search Tools
  // ==================
  {
    name: 'search_slack_messages',
    description:
      'Search Slack messages semantically using vector embeddings. Returns messages similar to your query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query (e.g., "budget discussion", "deployment issues")',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
        },
        channelId: {
          type: 'string',
          description: 'Filter to specific channel ID (optional)',
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score 0-1 (default 0.3)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_slack_context',
    description:
      'Get messages from a Slack channel around a specific timestamp. Use this after search_slack_messages to see the full conversation context.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID (from search results)',
        },
        timestamp: {
          type: 'number',
          description: 'Unix timestamp to center the search around (from search results)',
        },
        windowMinutes: {
          type: 'number',
          description: 'Time window +/- in minutes (default 30)',
        },
        limit: {
          type: 'number',
          description: 'Max messages to return (default 20)',
        },
      },
      required: ['channelId', 'timestamp'],
    },
  },
  {
    name: 'get_slack_sync_status',
    description: 'Get the current status of Slack message indexing',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const server = new Server(
  { name: 'task-manager', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // Task operations
      case 'add_task':
        result = taskService.addTask(args as Parameters<typeof taskService.addTask>[0]);
        break;
      case 'list_tasks':
        result = taskService.listTasks(args as Parameters<typeof taskService.listTasks>[0]);
        break;
      case 'update_task':
        result = taskService.updateTask(
          (args as { id: number }).id,
          args as Parameters<typeof taskService.updateTask>[1]
        );
        break;
      case 'complete_task':
        result = taskService.completeTask((args as { id: number }).id);
        break;
      case 'snooze_task':
        result = taskService.snoozeTask(
          (args as { id: number; duration: string }).id,
          (args as { id: number; duration: string }).duration
        );
        break;
      case 'move_task':
        result = taskService.moveTask(
          (args as { id: number; project: string }).id,
          (args as { id: number; project: string }).project
        );
        break;
      case 'delete_task':
        result = {
          success: taskService.deleteTask((args as { id: number }).id),
        };
        break;

      // Smart Lists (TickTick-style)
      case 'get_tasks_today':
        result = taskService.getTasksToday();
        break;
      case 'get_tasks_tomorrow':
        result = taskService.getTasksTomorrow();
        break;
      case 'get_tasks_this_week':
        result = taskService.getTasksThisWeek();
        break;
      case 'get_overdue_tasks':
        result = taskService.getOverdueTasks();
        break;
      case 'get_eisenhower_matrix':
        result = taskService.getEisenhowerMatrix();
        break;

      // Subtasks (TickTick-style)
      case 'add_subtask':
        result = taskService.addSubtask((args as { parentId: number }).parentId, {
          title: (args as { title: string }).title,
          description: (args as { description?: string }).description,
          priority: (args as { priority?: number }).priority,
        });
        break;
      case 'get_subtasks':
        result = taskService.getSubtasks((args as { parentId: number }).parentId);
        break;

      // Checklist Items (TickTick-style)
      case 'add_checklist_item':
        result = taskService.addChecklistItem(
          (args as { taskId: number }).taskId,
          (args as { title: string }).title
        );
        break;
      case 'toggle_checklist_item':
        result = taskService.toggleChecklistItem((args as { id: number }).id);
        break;
      case 'delete_checklist_item':
        result = { success: taskService.deleteChecklistItem((args as { id: number }).id) };
        break;
      case 'get_checklist_items':
        result = taskService.getChecklistItems((args as { taskId: number }).taskId);
        break;

      // Task Details
      case 'get_task_details':
        result = taskService.getTaskWithDetails((args as { id: number }).id);
        break;

      // Notification operations
      case 'set_task_notification':
        result = taskService.setTaskNotification(
          (args as { id: number; notifyAt: string; channel?: string }).id,
          (args as { id: number; notifyAt: string; channel?: string }).notifyAt,
          (args as { id: number; notifyAt: string; channel?: string }).channel
        );
        break;
      case 'snooze_task_notification':
        result = taskService.snoozeTaskNotification(
          (args as { id: number; duration: string }).id,
          (args as { id: number; duration: string }).duration
        );
        break;
      case 'clear_task_notification':
        result = taskService.clearTaskNotification((args as { id: number }).id);
        break;
      case 'get_tasks_due_for_notification':
        result = taskService.getTasksDueForNotification();
        break;
      case 'list_tasks_with_notifications':
        result = taskService.listTasksWithNotifications();
        break;

      // Project operations
      case 'list_projects':
        result = taskService.listProjects();
        break;
      case 'create_project':
        result = taskService.createProject(args as Parameters<typeof taskService.createProject>[0]);
        break;

      // Legacy reminder operations (create tasks internally)
      case 'add_reminder': {
        const reminderArgs = args as {
          message: string;
          remindAt: string;
          project?: string;
        };
        console.error('[DEPRECATED] add_reminder called - use add_task with notifyAt instead');
        result = taskService.addTask({
          title: reminderArgs.message,
          project: reminderArgs.project ?? 'Personal',
          notifyAt: reminderArgs.remindAt,
        });
        break;
      }
      case 'list_reminders': {
        console.error(
          '[DEPRECATED] list_reminders called - use list_tasks_with_notifications instead'
        );
        result = taskService.listTasksWithNotifications();
        break;
      }

      // Habit operations (TickTick-style)
      case 'create_habit':
        result = habitService.createHabit(args as Parameters<typeof habitService.createHabit>[0]);
        break;
      case 'list_habits':
        result = habitService.listHabits(
          (args as { includeArchived?: boolean }).includeArchived ?? false
        );
        break;
      case 'complete_habit':
        result = habitService.completeHabit(
          (args as { id: number }).id,
          (args as { note?: string }).note
        );
        break;
      case 'get_habit_stats':
        result = habitService.getHabitStats((args as { id: number }).id);
        break;
      case 'get_today_habits':
        result = habitService.getTodayHabitsStatus();
        break;
      case 'archive_habit':
        result = habitService.archiveHabit((args as { id: number }).id);
        break;

      // Discovery operations (Qdrant-based - all async)
      case 'add_discovery':
        result = await discoveriesService.addDiscovery(
          args as unknown as Parameters<typeof discoveriesService.addDiscovery>[0]
        );
        break;
      case 'list_discoveries':
        result = await discoveriesService.listDiscoveries(
          args as Parameters<typeof discoveriesService.listDiscoveries>[0]
        );
        break;
      case 'get_discovery':
        result = await discoveriesService.getDiscoveryDetails((args as { id: string }).id);
        break;
      case 'update_discovery':
        result = await discoveriesService.updateDiscovery(
          (args as { id: string }).id,
          args as Parameters<typeof discoveriesService.updateDiscovery>[1]
        );
        break;
      case 'delete_discovery':
        result = { success: await discoveriesService.deleteDiscovery((args as { id: string }).id) };
        break;
      case 'search_discoveries':
        result = await discoveriesService.searchDiscoveries((args as { query: string }).query, {
          sourceDatabase: (args as { sourceDatabase?: string }).sourceDatabase,
          tableName: (args as { tableName?: string }).tableName,
          type: (args as { type?: string }).type,
          source: (args as { source?: string }).source,
          projectId: (args as { projectId?: number }).projectId,
          limit: (args as { limit?: number }).limit,
          minScore: (args as { minScore?: number }).minScore,
        });
        break;
      case 'export_discoveries':
        result = await discoveriesService.exportDiscoveries(
          args as Parameters<typeof discoveriesService.exportDiscoveries>[0]
        );
        break;
      case 'get_table_notes':
        result = await discoveriesService.getTableNotes(
          (args as { database: string; table: string }).database,
          (args as { database: string; table: string }).table
        );
        break;

      // Log operations
      case 'search_logs':
        result = logReader.searchLogs(args as Parameters<typeof logReader.searchLogs>[0]);
        break;
      case 'get_recent_logs':
        result = logReader.getRecentLogs((args as { limit?: number }).limit);
        break;
      case 'get_recent_errors':
        result = logReader.getRecentErrors((args as { limit?: number }).limit);
        break;
      case 'get_log_stats':
        result = logReader.getLogStats();
        break;

      // Slack Search Tools
      case 'search_slack_messages':
        result = await slackSync.searchSlackMessages((args as { query: string }).query, {
          limit: (args as { limit?: number }).limit,
          channelId: (args as { channelId?: string }).channelId,
          minScore: (args as { minScore?: number }).minScore,
        });
        break;
      case 'get_slack_context':
        result = await slackSync.getSlackContext(
          (args as { channelId: string }).channelId,
          (args as { timestamp: number }).timestamp,
          {
            windowMinutes: (args as { windowMinutes?: number }).windowMinutes,
            limit: (args as { limit?: number }).limit,
          }
        );
        break;
      case 'get_slack_sync_status':
        result = slackSync.getSyncStatus();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Task Manager MCP Server v3.0.0 (TickTick-style) running on stdio');
}

main().catch(console.error);
