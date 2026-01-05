#!/usr/bin/env node

import 'dotenv/config';

/**
 * Task Manager MCP Server
 *
 * Provides tools for:
 * - Task management (add, list, complete, snooze, move, delete)
 * - Reminders (add, list, cancel, snooze)
 * - Projects (list, create)
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
import * as reminderService from '../../services/reminders.js';

// Initialize task database
initDb();

const tools: Tool[] = [
  // Task tools
  {
    name: 'add_task',
    description: 'Add a new task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        project: { type: 'string', description: 'Project name' },
        priority: { type: 'number', description: 'Priority 1-4 (1=low, 4=urgent)' },
        dueDate: { type: 'string', description: 'Due date (ISO format)' },
        tags: { type: 'array', items: { type: 'string' } },
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
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'snoozed', 'all'] },
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
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'snoozed'] },
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
        duration: { type: 'string', description: 'Duration like "2h", "30m", "1d"' },
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

  // Reminder tools
  {
    name: 'add_reminder',
    description: 'Add a reminder (delivered via Slack)',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        remindAt: { type: 'string', description: 'When to remind (ISO date or duration like "2h")' },
        taskId: { type: 'number', description: 'Link to a task (optional)' },
      },
      required: ['message', 'remindAt'],
    },
  },
  {
    name: 'list_reminders',
    description: 'List reminders',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'sent', 'cancelled', 'all'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel a reminder',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  },
  {
    name: 'get_due_reminders',
    description: 'Get reminders that are due now (for reminder service)',
    inputSchema: { type: 'object', properties: {} },
  },

  // Project tools
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
];

const server = new Server(
  { name: 'task-manager', version: '1.0.0' },
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
        result = { success: taskService.deleteTask((args as { id: number }).id) };
        break;

      // Reminder operations
      case 'add_reminder':
        result = reminderService.addReminder(
          args as Parameters<typeof reminderService.addReminder>[0]
        );
        break;
      case 'list_reminders':
        result = reminderService.listReminders(
          args as Parameters<typeof reminderService.listReminders>[0]
        );
        break;
      case 'cancel_reminder':
        result = reminderService.cancelReminder((args as { id: number }).id);
        break;
      case 'get_due_reminders':
        result = reminderService.getDueReminders();
        break;

      // Project operations
      case 'list_projects':
        result = taskService.listProjects();
        break;
      case 'create_project':
        result = taskService.createProject(
          args as Parameters<typeof taskService.createProject>[0]
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Task Manager MCP Server running on stdio');
}

main().catch(console.error);
