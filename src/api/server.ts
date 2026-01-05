import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db/index.js';
import * as taskService from '../services/tasks.js';
import * as reminderService from '../services/reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.API_PORT || 4000;

// Initialize database
initDb();

app.use(cors());
app.use(express.json());

// Serve static files from dist in production
app.use(express.static(path.join(__dirname, '../../dist')));

// Tasks API
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

// Projects API
app.get('/api/projects', (_req, res) => {
  const projects = taskService.listProjects();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const project = taskService.createProject(req.body);
  res.json(project);
});

// Reminders API
app.get('/api/reminders', (req, res) => {
  const { status } = req.query;
  const reminders = reminderService.listReminders({
    status: status as string,
  });
  res.json(reminders);
});

app.post('/api/reminders', (req, res) => {
  const reminder = reminderService.addReminder(req.body);
  res.json(reminder);
});

app.post('/api/reminders/:id/cancel', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const reminder = reminderService.cancelReminder(id);
  res.json(reminder);
});

app.post('/api/reminders/:id/snooze', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { duration } = req.body;
  const reminder = reminderService.snoozeReminder(id, duration);
  res.json(reminder);
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`sw-cortex running on http://localhost:${PORT}`);
});
