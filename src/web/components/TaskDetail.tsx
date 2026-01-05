import { useState } from 'react';
import type { TaskResponse, ProjectResponse } from '../../types/index.js';

interface TaskDetailProps {
  task: TaskResponse;
  project: ProjectResponse | null;
  onClose: () => void;
  onComplete: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
  onDelete: (id: number) => void;
  onSnoozeNotification: (id: number, duration: string) => void;
  onClearNotification: (id: number) => void;
}

export default function TaskDetail({
  task,
  project,
  onClose,
  onComplete,
  onSnooze,
  onDelete,
  onSnoozeNotification,
  onClearNotification,
}: TaskDetailProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showNotificationSnoozeMenu, setShowNotificationSnoozeMenu] = useState(false);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/50',
    snoozed: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  };

  const priorityLabels: Record<number, { label: string; color: string }> = {
    1: { label: 'Low', color: 'text-slate-400' },
    2: { label: 'Medium', color: 'text-slate-300' },
    3: { label: 'High', color: 'text-orange-400' },
    4: { label: 'Urgent', color: 'text-red-400' },
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Less than a minute';
    if (diff < 3600000) return `${Math.round(diff / 60000)} minutes`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)} hours`;
    return `${Math.round(diff / 86400000)} days`;
  };

  const hasNotification = task.notifyAt && !task.notificationSent;
  const notificationTime = task.notificationSnoozedUntil || task.notifyAt;

  // Parse metadata if exists
  let metadata: Record<string, unknown> | null = null;
  if (task.metadata) {
    try {
      metadata = JSON.parse(task.metadata);
    } catch {
      // ignore parse errors
    }
  }

  // Parse tags if exists
  let tags: string[] = [];
  if (task.tags) {
    try {
      tags = JSON.parse(task.tags);
    } catch {
      // ignore parse errors
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {project && project.color && (
                <span
                  className="text-xs px-2 py-1 rounded border"
                  style={{
                    backgroundColor: `${project.color}20`,
                    borderColor: `${project.color}50`,
                    color: project.color,
                  }}
                >
                  {project.name}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded border ${statusColors[task.status]}`}>
                {task.status.replace('_', ' ')}
              </span>
              {task.priority && (
                <span className={`text-xs ${priorityLabels[task.priority]?.color}`}>
                  {priorityLabels[task.priority]?.label} priority
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Description */}
          {task.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                Description
              </h3>
              <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 text-sm">
                {task.description}
              </div>
            </div>
          )}

          {/* Notification */}
          {hasNotification && notificationTime && (
            <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <h3 className="text-sm font-medium text-yellow-400">Notification Scheduled</h3>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {formatRelativeTime(notificationTime)} ({formatDate(notificationTime)})
              </p>
              {task.notificationSnoozedUntil && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Snoozed from original time
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationSnoozeMenu(!showNotificationSnoozeMenu)}
                    className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition"
                  >
                    Snooze
                  </button>
                  {showNotificationSnoozeMenu && (
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px] border border-slate-200 dark:border-slate-600">
                      {['15m', '30m', '1h', '2h', '1d'].map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            onSnoozeNotification(task.id, d);
                            setShowNotificationSnoozeMenu(false);
                          }}
                          className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onClearNotification(task.id)}
                  className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {task.dueDate && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase mb-1">
                  Due Date
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {formatDate(task.dueDate)}
                </p>
              </div>
            )}
            <div>
              <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase mb-1">
                Created
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {formatDate(task.createdAt)}
              </p>
            </div>
            {task.completedAt && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase mb-1">
                  Completed
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {formatDate(task.completedAt)}
                </p>
              </div>
            )}
            {task.snoozedUntil && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase mb-1">
                  Snoozed Until
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {formatDate(task.snoozedUntil)}
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase mb-2">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {metadata && typeof metadata.migratedFrom === 'string' && (
            <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800/30 rounded p-3">
              <p>Migrated from {metadata.migratedFrom}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-2">
            {task.status !== 'completed' && (
              <button
                onClick={() => {
                  onComplete(task.id);
                  onClose();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
              >
                Complete
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition text-sm"
              >
                Snooze Task
              </button>
              {showSnoozeMenu && (
                <div className="absolute left-0 bottom-full mb-1 bg-white dark:bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px] border border-slate-200 dark:border-slate-600">
                  {['30m', '1h', '2h', '1d', '1w'].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        onSnooze(task.id, d);
                        setShowSnoozeMenu(false);
                        onClose();
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Delete this task?')) {
                onDelete(task.id);
                onClose();
              }
            }}
            className="px-4 py-2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 rounded-lg transition text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
