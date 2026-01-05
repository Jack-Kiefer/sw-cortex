import { useState, useEffect } from 'react';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import AddTask from './components/AddTask';
import type { TaskResponse, ProjectResponse } from '../types/index.js';

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed' | 'with_notifications';

function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDark));
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);
  return [isDark, toggle];
}

export default function App() {
  const [isDark, toggleDarkMode] = useDarkMode();
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);

  const fetchTasks = async () => {
    const status = filter === 'with_notifications' ? 'all' : filter;
    const res = await fetch(`/api/tasks?status=${status === 'all' ? '' : status}`);
    let data: TaskResponse[] = await res.json();

    // Client-side filter for notifications
    if (filter === 'with_notifications') {
      data = data.filter((t) => t.notifyAt && !t.notificationSent);
    }

    // Project filter
    if (projectFilter !== 'all') {
      const project = projects.find((p) => p.name === projectFilter);
      if (project) {
        data = data.filter((t) => t.projectId === project.id);
      }
    }

    setTasks(data);
  };

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filter, projectFilter, projects]);

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

  const handleAddTask = async (data: { title: string; project?: string; notifyAt?: string }) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    fetchTasks();
  };

  const handleSnoozeNotification = async (id: number, duration: string) => {
    await fetch(`/api/tasks/${id}/notification/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    });
    fetchTasks();
  };

  const handleClearNotification = async (id: number) => {
    await fetch(`/api/tasks/${id}/notification`, { method: 'DELETE' });
    fetchTasks();
  };

  // Count tasks with pending notifications
  const notificationCount = tasks.filter((t) => t.notifyAt && !t.notificationSent).length;

  return (
    <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">sw-cortex</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Unified Task & Notification Management
            </p>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Status filters */}
          <div className="flex gap-2">
            {(
              [
                { key: 'pending', label: 'Pending' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'with_notifications', label: `🔔 Notifications` },
                { key: 'completed', label: 'Completed' },
                { key: 'all', label: 'All' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded text-sm transition ${
                  filter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
                {f.key === 'with_notifications' && notificationCount > 0 && (
                  <span className="ml-1 bg-yellow-500 text-black px-1.5 rounded-full text-xs">
                    {notificationCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Project filter */}
          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1 rounded text-sm bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <AddTask onAdd={handleAddTask} projects={projects} />

        <TaskList
          tasks={tasks}
          projects={projects}
          onReorder={handleReorder}
          onSelectTask={setSelectedTask}
          onComplete={handleComplete}
          onSnooze={handleSnooze}
          onDelete={handleDelete}
          onSnoozeNotification={handleSnoozeNotification}
          onClearNotification={handleClearNotification}
        />

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            project={projects.find((p) => p.id === selectedTask.projectId) ?? null}
            onClose={() => setSelectedTask(null)}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onDelete={handleDelete}
            onSnoozeNotification={handleSnoozeNotification}
            onClearNotification={handleClearNotification}
          />
        )}
      </div>
    </div>
  );
}
