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
import * as logReader from '../../services/log-reader.js';

// Initialize task database
initDb();

const tools: Tool[] = [
  // ==================
  // Task Tools
  // ==================
  {
    name: 'add_task',
    description: 'Add a new task. Can optionally include a notification time for Slack reminders.',
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
          description: 'Priority 1-4 (1=low, 4=urgent)',
        },
        dueDate: { type: 'string', description: 'Due date (ISO format)' },
        tags: { type: 'array', items: { type: 'string' } },
        notifyAt: {
          type: 'string',
          description: 'When to send Slack notification (ISO date or duration like "2h", "1d")',
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
];

const server = new Server(
  { name: 'task-manager', version: '2.0.0' },
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
  console.error('Task Manager MCP Server v2.0 (Unified Model) running on stdio');
}

main().catch(console.error);
