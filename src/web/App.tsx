import { useState, useEffect } from 'react';
import TaskList from './components/TaskList';
import ReminderList from './components/ReminderList';
import AddTask from './components/AddTask';
import AddReminder from './components/AddReminder';

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  projectId: number | null;
  dueDate: string | null;
  tags: string | null;
  createdAt: string;
  completedAt: string | null;
  snoozedUntil: string | null;
}

interface Reminder {
  id: number;
  message: string;
  remindAt: string;
  status: string;
  taskId: number | null;
  snoozedUntil: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders'>('tasks');

  const fetchTasks = async () => {
    const res = await fetch(`/api/tasks?status=${filter === 'all' ? '' : filter}`);
    const data = await res.json();
    setTasks(data);
  };

  const fetchReminders = async () => {
    const res = await fetch('/api/reminders?status=pending');
    const data = await res.json();
    setReminders(data);
  };

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
  };

  useEffect(() => {
    fetchTasks();
    fetchReminders();
    fetchProjects();
  }, [filter]);

  const handleReorder = async (taskIds: number[]) => {
    await fetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds }),
    });
    fetchTasks();
  };

  const handleComplete = async (id: number) => {
    await fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
    fetchTasks();
  };

  const handleSnooze = async (id: number, duration: string) => {
    await fetch(`/api/tasks/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    });
    fetchTasks();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const handleAddTask = async (title: string, project?: string) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, project }),
    });
    fetchTasks();
  };

  const handleAddReminder = async (message: string, remindAt: string) => {
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, remindAt }),
    });
    fetchReminders();
  };

  const handleCancelReminder = async (id: number) => {
    await fetch(`/api/reminders/${id}/cancel`, { method: 'POST' });
    fetchReminders();
  };

  const handleSnoozeReminder = async (id: number, duration: string) => {
    await fetch(`/api/reminders/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    });
    fetchReminders();
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">sw-cortex</h1>
          <p className="text-slate-400">Task & Reminder Management</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'tasks'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'reminders'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Reminders ({reminders.length})
          </button>
        </div>

        {activeTab === 'tasks' && (
          <>
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {['pending', 'in_progress', 'completed', 'all'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    filter === f
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>

            <AddTask onAdd={handleAddTask} projects={projects} />

            <TaskList
              tasks={tasks}
              onReorder={handleReorder}
              onComplete={handleComplete}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
            />
          </>
        )}

        {activeTab === 'reminders' && (
          <>
            <AddReminder onAdd={handleAddReminder} />

            <ReminderList
              reminders={reminders}
              onCancel={handleCancelReminder}
              onSnooze={handleSnoozeReminder}
            />
          </>
        )}
      </div>
    </div>
  );
}
