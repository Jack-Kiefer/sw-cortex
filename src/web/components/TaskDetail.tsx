import { useState } from 'react';
import {
  X,
  Check,
  Clock,
  Trash2,
  Bell,
  BellOff,
  Calendar,
  Flag,
  FolderKanban,
  Tag,
} from 'lucide-react';
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

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Low', color: 'text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700' },
  2: { label: 'Medium', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
  3: { label: 'High', color: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
  4: { label: 'Urgent', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  snoozed: {
    label: 'Snoozed',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
};

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Less than a minute';
    if (diff < 3600000) return `${Math.round(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  };

  const hasNotification = task.notifyAt && !task.notificationSent;
  const notificationTime = task.notificationSnoozedUntil || task.notifyAt;

  // Parse tags
  let tags: string[] = [];
  if (task.tags) {
    try {
      tags = JSON.parse(task.tags);
    } catch {
      // ignore parse errors
    }
  }

  const priorityConfig = PRIORITY_CONFIG[task.priority ?? 2];
  const statusConfig = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="h-full flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Task Details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Title */}
        <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-4">{task.title}</h3>

        {/* Status and Priority badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {task.priority && (
            <span
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${priorityConfig.color} ${priorityConfig.bgColor}`}
            >
              <Flag className="w-3 h-3" />
              {priorityConfig.label}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="mb-6">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Description
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              {task.description}
            </p>
          </div>
        )}

        {/* Details */}
        <div className="space-y-4 mb-6">
          {/* Project */}
          {project && (
            <div className="flex items-center gap-3">
              <FolderKanban className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Project</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {project.name}
                </p>
              </div>
            </div>
          )}

          {/* Due Date */}
          {task.dueDate && (
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Due Date</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {formatDate(task.dueDate)}
                </p>
              </div>
            </div>
          )}

          {/* Snoozed Until */}
          {task.snoozedUntil && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Snoozed Until</p>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {formatDate(task.snoozedUntil)}
                </p>
              </div>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Created</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {formatDate(task.createdAt)}
              </p>
            </div>
          </div>

          {/* Completed */}
          {task.completedAt && (
            <div className="flex items-center gap-3">
              <Check className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {formatDate(task.completedAt)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tags
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notification Section */}
        {hasNotification && notificationTime && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Notification Scheduled
              </h4>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-1">
              In {formatRelativeTime(notificationTime)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {formatDate(notificationTime)}
            </p>
            {task.notificationSnoozedUntil && (
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-1 italic">
                Snoozed from original time
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <div className="relative">
                <button
                  onClick={() => setShowNotificationSnoozeMenu(!showNotificationSnoozeMenu)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  Snooze
                </button>
                {showNotificationSnoozeMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-panel z-10 py-1 min-w-[100px] border border-slate-200 dark:border-slate-700">
                    {['15m', '30m', '1h', '2h', '1d'].map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          onSnoozeNotification(task.id, d);
                          setShowNotificationSnoozeMenu(false);
                        }}
                        className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => onClearNotification(task.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <BellOff className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          {task.status !== 'completed' && (
            <button
              onClick={() => onComplete(task.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Complete
            </button>
          )}

          {/* Snooze dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
            >
              <Clock className="w-4 h-4" />
              Snooze
            </button>
            {showSnoozeMenu && (
              <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-panel z-10 py-1 min-w-[100px] border border-slate-200 dark:border-slate-700">
                {['30m', '1h', '2h', '1d', '1w'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      onSnooze(task.id, d);
                      setShowSnoozeMenu(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm('Delete this task?')) {
                onDelete(task.id);
              }
            }}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
