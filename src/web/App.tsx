import { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import QuickAdd from './components/QuickAdd';
import ProjectForm from './components/ProjectForm';
import type { TaskResponse, ProjectResponse } from '../types/index.js';

// Smart list view types
type ViewType =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'inbox'
  | 'all'
  | 'overdue'
  | 'completed'
  | 'matrix'
  | 'habits'
  | string; // For project views like 'project-1'

interface TaskCounts {
  today: number;
  tomorrow: number;
  week: number;
  overdue: number;
  inbox: number;
  all: number;
}

// Helper to check if a date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Helper to check if a date is tomorrow
function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  );
}

// Helper to check if a date is within the next 7 days
function isThisWeek(date: Date): boolean {
  const today = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(today.getDate() + 7);
  return date >= today && date <= weekFromNow;
}

// Helper to check if a date is overdue
function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export default function App() {
  const [allTasks, setAllTasks] = useState<TaskResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('today');
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);

  // Fetch all tasks (we filter client-side for smart lists)
  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks?status=');
    const data: TaskResponse[] = await res.json();
    setAllTasks(data);
  }, []);

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
  };

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, [fetchTasks]);

  // Calculate task counts for sidebar
  const taskCounts: TaskCounts = {
    today: allTasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && isToday(new Date(t.dueDate))
    ).length,
    tomorrow: allTasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && isTomorrow(new Date(t.dueDate))
    ).length,
    week: allTasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && isThisWeek(new Date(t.dueDate))
    ).length,
    overdue: allTasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && isOverdue(new Date(t.dueDate))
    ).length,
    inbox: allTasks.filter((t) => t.status !== 'completed' && !t.projectId && !t.dueDate).length,
    all: allTasks.filter((t) => t.status !== 'completed').length,
  };

  // Filter tasks based on current view
  const getFilteredTasks = (): TaskResponse[] => {
    switch (currentView) {
      case 'today':
        return allTasks.filter(
          (t) => t.status !== 'completed' && t.dueDate && isToday(new Date(t.dueDate))
        );
      case 'tomorrow':
        return allTasks.filter(
          (t) => t.status !== 'completed' && t.dueDate && isTomorrow(new Date(t.dueDate))
        );
      case 'week':
        return allTasks.filter(
          (t) => t.status !== 'completed' && t.dueDate && isThisWeek(new Date(t.dueDate))
        );
      case 'overdue':
        return allTasks.filter(
          (t) => t.status !== 'completed' && t.dueDate && isOverdue(new Date(t.dueDate))
        );
      case 'inbox':
        return allTasks.filter((t) => t.status !== 'completed' && !t.projectId && !t.dueDate);
      case 'completed':
        return allTasks.filter((t) => t.status === 'completed');
      case 'all':
        return allTasks.filter((t) => t.status !== 'completed');
      default:
        // Project view (e.g., 'project-1')
        if (currentView.startsWith('project-')) {
          const projectId = parseInt(currentView.replace('project-', ''), 10);
          return allTasks.filter((t) => t.status !== 'completed' && t.projectId === projectId);
        }
        return allTasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  // Task actions
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
    if (selectedTask?.id === id) {
      setSelectedTask(null);
    }
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
    if (selectedTask?.id === id) {
      setSelectedTask(null);
    }
  };

  const handleAddTask = async (data: {
    title: string;
    project?: string;
    dueDate?: string;
    priority?: number;
  }) => {
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

  const handleCreateProject = async (data: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetchProjects();
    setCurrentView('all');
  };

  // Detail panel content
  const detailPanel = selectedTask ? (
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
  ) : undefined;

  return (
    <Layout
      currentView={currentView}
      onNavigate={setCurrentView}
      taskCounts={taskCounts}
      detailPanel={detailPanel}
      projects={projects}
    >
      {/* New Project Form */}
      {currentView === 'new-project' ? (
        <ProjectForm onSubmit={handleCreateProject} onCancel={() => setCurrentView('all')} />
      ) : (
        <>
          {/* Quick Add */}
          <QuickAdd onAdd={handleAddTask} projects={projects} currentView={currentView} />

          {/* Task List */}
          <TaskList
            tasks={filteredTasks}
            projects={projects}
            onReorder={handleReorder}
            onSelectTask={setSelectedTask}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onDelete={handleDelete}
            onSnoozeNotification={handleSnoozeNotification}
            onClearNotification={handleClearNotification}
          />

          {/* Empty state */}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 dark:text-slate-500 text-lg mb-2">
                {currentView === 'completed' ? 'No completed tasks yet' : 'No tasks here'}
              </div>
              <p className="text-slate-400 dark:text-slate-600 text-sm">
                {currentView === 'inbox'
                  ? 'Tasks without a project or due date appear here'
                  : currentView === 'today'
                    ? "Add a task with today's due date to see it here"
                    : 'Add tasks to get started'}
              </p>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
