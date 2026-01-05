import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db/index.js';
import * as taskService from '../services/tasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.API_PORT || 3001;

// Initialize database
initDb();

app.use(cors());
app.use(express.json());

// Serve static files from dist in production
app.use(express.static(path.join(__dirname, '../../dist')));

// ==================
// Tasks API
// ==================
app.get('/api/tasks', (req, res) => {
  const { status, project } = req.query;
  const tasks = taskService.listTasks({
    status: status as string,
    project: project as string,
  });
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const task = taskService.addTask(req.body);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = taskService.updateTask(id, req.body);
  res.json(task);
});

app.post('/api/tasks/:id/complete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = taskService.completeTask(id);
  res.json(task);
});

app.post('/api/tasks/:id/snooze', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { duration } = req.body;
  const task = taskService.snoozeTask(id, duration);
  res.json(task);
});

app.post('/api/tasks/:id/move', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { project } = req.body;
  const task = taskService.moveTask(id, project);
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const success = taskService.deleteTask(id);
  res.json({ success });
});

app.post('/api/tasks/reorder', (req, res) => {
  const { taskIds } = req.body;
  // Update sort order based on array position
  taskIds.forEach((id: number, index: number) => {
    taskService.updateTask(id, { priority: index + 1 });
  });
  res.json({ success: true });
});

// ==================
// Task Notification API (Unified Reminders)
// ==================
app.post('/api/tasks/:id/notification', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { notifyAt, channel } = req.body;
  const task = taskService.setTaskNotification(id, notifyAt, channel);
  res.json(task);
});

app.post('/api/tasks/:id/notification/snooze', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { duration } = req.body;
  const task = taskService.snoozeTaskNotification(id, duration);
  res.json(task);
});

app.delete('/api/tasks/:id/notification', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = taskService.clearTaskNotification(id);
  res.json(task);
});

app.get('/api/tasks/notifications/due', (_req, res) => {
  const tasks = taskService.getTasksDueForNotification();
  res.json(tasks);
});

app.get('/api/tasks/notifications/pending', (_req, res) => {
  const tasks = taskService.listTasksWithNotifications();
  res.json(tasks);
});

// ==================
// Projects API
// ==================
app.get('/api/projects', (_req, res) => {
  const projects = taskService.listProjects();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const project = taskService.createProject(req.body);
  res.json(project);
});

// ==================
// Legacy Reminders API (Deprecated - Creates tasks internally)
// ==================
app.get('/api/reminders', (req, res) => {
  // Return tasks with notifications as "reminders" for backwards compatibility
  const tasks = taskService.listTasksWithNotifications();
  // Map to reminder-like format
  const reminders = tasks.map((task) => ({
    id: task.id,
    message: task.title,
    remindAt: task.notifyAt,
    status: task.notificationSent ? 'sent' : 'pending',
    taskId: task.id,
    snoozedUntil: task.notificationSnoozedUntil,
    sentAt: null,
    createdAt: task.createdAt,
  }));
  res.json(reminders);
});

app.post('/api/reminders', (req, res) => {
  // Create a task with notification instead
  const { message, remindAt, project } = req.body;
  const task = taskService.addTask({
    title: message,
    project: project || 'Personal',
    notifyAt: remindAt,
  });
  res.json({
    id: task.id,
    message: task.title,
    remindAt: task.notifyAt,
    status: 'pending',
    taskId: task.id,
  });
});

app.post('/api/reminders/:id/cancel', (req, res) => {
  // Clear the notification from the task
  const id = parseInt(req.params.id, 10);
  taskService.clearTaskNotification(id);
  res.json({ id, status: 'cancelled' });
});

app.post('/api/reminders/:id/snooze', (req, res) => {
  // Snooze the task's notification
  const id = parseInt(req.params.id, 10);
  const { duration } = req.body;
  const task = taskService.snoozeTaskNotification(id, duration);
  res.json({
    id: task.id,
    snoozedUntil: task.notificationSnoozedUntil,
    status: 'snoozed',
  });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const server = app.listen(PORT, () => {
  console.log(`sw-cortex API running on http://localhost:${PORT}`);
  console.log('Using unified task/notification model v2.0');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
