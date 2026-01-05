import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { TaskResponse, ProjectResponse } from '../../types/index.js';

interface TaskItemProps {
  task: TaskResponse;
  project: ProjectResponse | null;
  onSelect: (task: TaskResponse) => void;
  onComplete: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
  onDelete: (id: number) => void;
  onSnoozeNotification: (id: number, duration: string) => void;
  onClearNotification: (id: number) => void;
}

export default function TaskItem({
  task,
  project,
  onSelect,
  onComplete,
  onSnooze,
  onDelete,
  onSnoozeNotification,
  onClearNotification,
}: TaskItemProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [showNotificationSnooze, setShowNotificationSnooze] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    snoozed: 'bg-purple-500/20 text-purple-400',
  };

  const priorityLabels: Record<number, string> = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Urgent',
  };

  // Format notification time
  const formatNotificationTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return '< 1 min';
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  };

  const hasNotification = task.notifyAt && !task.notificationSent;
  const notificationTime = task.notificationSnoozedUntil || task.notifyAt;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-slate-800 rounded-lg p-4 border transition shadow-sm dark:shadow-none ${
        hasNotification
          ? 'border-yellow-500/50 hover:border-yellow-500'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 mt-1"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onComplete(task.id)}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 transition ${
            task.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-slate-500 hover:border-green-500'
          }`}
        >
          {task.status === 'completed' && (
            <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Content - clickable area */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(task)}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-base hover:underline ${task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}
            >
              {task.title}
            </span>

            {/* Project badge */}
            {project && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${project.color ?? '#6366f1'}20`,
                  color: project.color ?? '#6366f1',
                }}
              >
                {project.name}
              </span>
            )}

            {/* Status badge */}
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>

            {/* Priority badge */}
            {task.priority && task.priority > 2 && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {priorityLabels[task.priority]}
              </span>
            )}

            {/* Notification badge */}
            {hasNotification && notificationTime && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                {formatNotificationTime(notificationTime)}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {/* Due date */}
          {task.dueDate && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Notification controls */}
          {hasNotification && (
            <div className="relative">
              <button
                onClick={() => setShowNotificationSnooze(!showNotificationSnooze)}
                className="p-1.5 rounded text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Snooze notification"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
              </button>
              {showNotificationSnooze && (
                <div className="absolute right-0 top-8 bg-white dark:bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px] border border-slate-200 dark:border-slate-600">
                  <div className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600">
                    Snooze notification
                  </div>
                  {['15m', '30m', '1h', '2h', '1d'].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        onSnoozeNotification(task.id, d);
                        setShowNotificationSnooze(false);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      onClearNotification(task.id);
                      setShowNotificationSnooze(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-600 border-t border-slate-200 dark:border-slate-600"
                  >
                    Clear notification
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Task snooze */}
          <div className="relative">
            <button
              onClick={() => setShowSnooze(!showSnooze)}
              className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Snooze task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            {showSnooze && (
              <div className="absolute right-0 top-8 bg-white dark:bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px] border border-slate-200 dark:border-slate-600">
                <div className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600">
                  Snooze task
                </div>
                {['30m', '1h', '2h', '1d', '1w'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      onSnooze(task.id, d);
                      setShowSnooze(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
