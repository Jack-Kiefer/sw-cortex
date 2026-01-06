/**
 * MSW API Handlers for testing
 *
 * These handlers mock the API responses for tasks, projects, and reminders.
 */

import { http, HttpResponse } from 'msw';
import type { TaskResponse, ProjectResponse, ReminderResponse } from '../../types/index.js';

// In-memory mock data store
let mockTasks: TaskResponse[] = [
  {
    id: 1,
    title: 'Test Task 1',
    description: 'First test task',
    status: 'pending',
    priority: 2,
    projectId: 1,
    dueDate: new Date().toISOString(),
    snoozedUntil: null,
    tags: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    notifyAt: null,
    notificationSent: false,
    notificationChannel: null,
    notificationSnoozedUntil: null,
  },
  {
    id: 2,
    title: 'Test Task 2',
    description: 'Second test task',
    status: 'pending',
    priority: 4,
    projectId: null,
    dueDate: null,
    snoozedUntil: null,
    tags: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    notifyAt: null,
    notificationSent: false,
    notificationChannel: null,
    notificationSnoozedUntil: null,
  },
  {
    id: 3,
    title: 'Completed Task',
    description: 'A completed task',
    status: 'completed',
    priority: 1,
    projectId: null,
    dueDate: null,
    snoozedUntil: null,
    tags: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    notifyAt: null,
    notificationSent: false,
    notificationChannel: null,
    notificationSnoozedUntil: null,
  },
];

let mockProjects: ProjectResponse[] = [
  {
    id: 1,
    name: 'Test Project',
    description: 'A test project',
    githubRepo: null,
    color: '#6366f1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Work Project',
    description: 'Work related tasks',
    githubRepo: 'org/repo',
    color: '#ef4444',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let mockReminders: ReminderResponse[] = [
  {
    id: 1,
    taskId: 1,
    message: 'Remember to check this',
    remindAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    status: 'pending',
    slackChannel: null,
    snoozedUntil: null,
    sentAt: null,
    createdAt: new Date().toISOString(),
    slackMessageTs: null,
    interacted: false,
    lastRemindedAt: null,
  },
];

let nextTaskId = 4;
let nextProjectId = 3;
let nextReminderId = 2;

// Reset function for tests
export function resetMockData() {
  mockTasks = [
    {
      id: 1,
      title: 'Test Task 1',
      description: 'First test task',
      status: 'pending',
      priority: 2,
      projectId: 1,
      dueDate: new Date().toISOString(),
      snoozedUntil: null,
      tags: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      notifyAt: null,
      notificationSent: false,
      notificationChannel: null,
      notificationSnoozedUntil: null,
    },
    {
      id: 2,
      title: 'Test Task 2',
      description: 'Second test task',
      status: 'pending',
      priority: 4,
      projectId: null,
      dueDate: null,
      snoozedUntil: null,
      tags: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      notifyAt: null,
      notificationSent: false,
      notificationChannel: null,
      notificationSnoozedUntil: null,
    },
    {
      id: 3,
      title: 'Completed Task',
      description: 'A completed task',
      status: 'completed',
      priority: 1,
      projectId: null,
      dueDate: null,
      snoozedUntil: null,
      tags: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      notifyAt: null,
      notificationSent: false,
      notificationChannel: null,
      notificationSnoozedUntil: null,
    },
  ];
  mockProjects = [
    {
      id: 1,
      name: 'Test Project',
      description: 'A test project',
      githubRepo: null,
      color: '#6366f1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Work Project',
      description: 'Work related tasks',
      githubRepo: 'org/repo',
      color: '#ef4444',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  mockReminders = [
    {
      id: 1,
      taskId: 1,
      message: 'Remember to check this',
      remindAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
      slackChannel: null,
      snoozedUntil: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
      slackMessageTs: null,
      interacted: false,
      lastRemindedAt: null,
    },
  ];
  nextTaskId = 4;
  nextProjectId = 3;
  nextReminderId = 2;
}

// Export mock data getters for tests
export function getMockTasks() {
  return mockTasks;
}

export function getMockProjects() {
  return mockProjects;
}

export function getMockReminders() {
  return mockReminders;
}

export const handlers = [
  // ============ TASKS ============

  // GET /api/tasks - List tasks
  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const project = url.searchParams.get('project');

    let filtered = [...mockTasks];

    if (status && status !== 'all') {
      filtered = filtered.filter((t) => t.status === status);
    }

    if (project) {
      const projectId = parseInt(project, 10);
      filtered = filtered.filter((t) => t.projectId === projectId);
    }

    return HttpResponse.json(filtered);
  }),

  // POST /api/tasks - Create task
  http.post('/api/tasks', async ({ request }) => {
    const body = (await request.json()) as Partial<TaskResponse>;
    const newTask: TaskResponse = {
      id: nextTaskId++,
      title: body.title || 'Untitled',
      description: body.description || null,
      status: 'pending',
      priority: body.priority || 2,
      projectId: body.projectId || null,
      dueDate: body.dueDate || null,
      snoozedUntil: null,
      tags: body.tags || null,
      metadata: body.metadata || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      notifyAt: body.notifyAt || null,
      notificationSent: false,
      notificationChannel: body.notificationChannel || null,
      notificationSnoozedUntil: null,
    };
    mockTasks.push(newTask);
    return HttpResponse.json(newTask, { status: 201 });
  }),

  // GET /api/tasks/:id - Get single task
  http.get('/api/tasks/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const task = mockTasks.find((t) => t.id === id);
    if (!task) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  // PATCH /api/tasks/:id - Update task
  http.patch('/api/tasks/:id', async ({ params, request }) => {
    const id = parseInt(params.id as string, 10);
    const updates = (await request.json()) as Partial<TaskResponse>;
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    mockTasks[index] = {
      ...mockTasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // DELETE /api/tasks/:id - Delete task
  http.delete('/api/tasks/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    mockTasks.splice(index, 1);
    return HttpResponse.json({ success: true });
  }),

  // POST /api/tasks/:id/complete - Complete task
  http.post('/api/tasks/:id/complete', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    mockTasks[index] = {
      ...mockTasks[index],
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // POST /api/tasks/:id/snooze - Snooze task
  http.post('/api/tasks/:id/snooze', async ({ params, request }) => {
    const id = parseInt(params.id as string, 10);
    const { duration } = (await request.json()) as { duration: string };
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Calculate snooze time based on duration
    const now = new Date();
    const match = duration.match(/^(\d+)([mhdw])$/);
    if (match) {
      const [, amount, unit] = match;
      const ms = parseInt(amount, 10);
      switch (unit) {
        case 'm':
          now.setMinutes(now.getMinutes() + ms);
          break;
        case 'h':
          now.setHours(now.getHours() + ms);
          break;
        case 'd':
          now.setDate(now.getDate() + ms);
          break;
        case 'w':
          now.setDate(now.getDate() + ms * 7);
          break;
      }
    }

    mockTasks[index] = {
      ...mockTasks[index],
      status: 'snoozed',
      snoozedUntil: now.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // POST /api/tasks/:id/notification - Set notification
  http.post('/api/tasks/:id/notification', async ({ params, request }) => {
    const id = parseInt(params.id as string, 10);
    const { notifyAt, channel } = (await request.json()) as { notifyAt: string; channel?: string };
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    mockTasks[index] = {
      ...mockTasks[index],
      notifyAt,
      notificationChannel: channel || null,
      notificationSent: false,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // POST /api/tasks/:id/notification/snooze - Snooze notification
  http.post('/api/tasks/:id/notification/snooze', async ({ params, request }) => {
    const id = parseInt(params.id as string, 10);
    const { duration } = (await request.json()) as { duration: string };
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const now = new Date();
    const match = duration.match(/^(\d+)([mh])$/);
    if (match) {
      const [, amount, unit] = match;
      const ms = parseInt(amount, 10);
      if (unit === 'm') now.setMinutes(now.getMinutes() + ms);
      if (unit === 'h') now.setHours(now.getHours() + ms);
    }

    mockTasks[index] = {
      ...mockTasks[index],
      notificationSnoozedUntil: now.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // DELETE /api/tasks/:id/notification - Clear notification
  http.delete('/api/tasks/:id/notification', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const index = mockTasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    mockTasks[index] = {
      ...mockTasks[index],
      notifyAt: null,
      notificationSent: false,
      notificationChannel: null,
      notificationSnoozedUntil: null,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockTasks[index]);
  }),

  // ============ PROJECTS ============

  // GET /api/projects - List projects
  http.get('/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  // POST /api/projects - Create project
  http.post('/api/projects', async ({ request }) => {
    const body = (await request.json()) as Partial<ProjectResponse>;
    const newProject: ProjectResponse = {
      id: nextProjectId++,
      name: body.name || 'Untitled Project',
      description: body.description || null,
      githubRepo: body.githubRepo || null,
      color: body.color || '#6366f1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockProjects.push(newProject);
    return HttpResponse.json(newProject, { status: 201 });
  }),

  // GET /api/projects/:id - Get single project
  http.get('/api/projects/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const project = mockProjects.find((p) => p.id === id);
    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return HttpResponse.json(project);
  }),

  // DELETE /api/projects/:id - Delete project
  http.delete('/api/projects/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const index = mockProjects.findIndex((p) => p.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    mockProjects.splice(index, 1);
    return HttpResponse.json({ success: true });
  }),

  // ============ REMINDERS ============

  // GET /api/reminders - List reminders
  http.get('/api/reminders', () => {
    return HttpResponse.json(mockReminders);
  }),

  // POST /api/reminders - Create reminder
  http.post('/api/reminders', async ({ request }) => {
    const body = (await request.json()) as Partial<ReminderResponse>;
    const newReminder: ReminderResponse = {
      id: nextReminderId++,
      taskId: body.taskId || null,
      message: body.message || '',
      remindAt: body.remindAt || new Date().toISOString(),
      status: 'pending',
      slackChannel: body.slackChannel || null,
      snoozedUntil: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
      slackMessageTs: null,
      interacted: false,
      lastRemindedAt: null,
    };
    mockReminders.push(newReminder);
    return HttpResponse.json(newReminder, { status: 201 });
  }),

  // DELETE /api/reminders/:id - Cancel reminder
  http.delete('/api/reminders/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const index = mockReminders.findIndex((r) => r.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    mockReminders.splice(index, 1);
    return HttpResponse.json({ success: true });
  }),
];
