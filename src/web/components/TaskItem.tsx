import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { GripVertical, Flag, Clock, Calendar, Bell, MoreHorizontal, Trash2 } from 'lucide-react';
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

const PRIORITY_COLORS: Record<number, string> = {
  4: 'text-red-500', // Urgent
  3: 'text-amber-500', // High
  2: 'text-blue-500', // Medium
  1: 'text-slate-300 dark:text-slate-600', // Low
};

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
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Format due date
  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    const isOverdue = date < today;
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { text: formatted, isOverdue };
  };

  // Format notification time
  const formatNotificationTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return '< 1m';
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  };

  const hasNotification = task.notifyAt && !task.notificationSent;
  const notificationTime = task.notificationSnoozedUntil || task.notifyAt;
  const priorityColor = PRIORITY_COLORS[task.priority ?? 2];

  const dueDateInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  const dueDateText = typeof dueDateInfo === 'string' ? dueDateInfo : dueDateInfo?.text;
  const isOverdue = typeof dueDateInfo === 'object' && dueDateInfo?.isOverdue;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      className={`group bg-white dark:bg-slate-800 rounded-lg px-3 py-2.5 border transition-all shadow-task hover:shadow-task-hover ${
        isDragging
          ? 'border-blue-400 dark:border-blue-500'
          : hasNotification
            ? 'border-amber-300 dark:border-amber-600'
            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle - only visible on hover */}
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Priority flag */}
        <Flag className={`w-4 h-4 flex-shrink-0 ${priorityColor}`} />

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === 'completed'}
          onChange={() => onComplete(task.id)}
          className="task-checkbox"
        />

        {/* Content - clickable area */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(task)}>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                task.status === 'completed'
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {task.title}
            </span>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1 text-xs">
            {/* Project */}
            {project && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${project.color ?? '#6366f1'}15`,
                  color: project.color ?? '#6366f1',
                }}
              >
                {project.name}
              </span>
            )}

            {/* Due date */}
            {dueDateText && (
              <span
                className={`flex items-center gap-1 ${
                  isOverdue
                    ? 'text-red-500'
                    : dueDateText === 'Today'
                      ? 'text-blue-500'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {dueDateText}
              </span>
            )}

            {/* Notification */}
            {hasNotification && notificationTime && (
              <span className="flex items-center gap-1 text-amber-500">
                <Bell className="w-3 h-3" />
                {formatNotificationTime(notificationTime)}
              </span>
            )}

            {/* Snoozed indicator */}
            {task.status === 'snoozed' && task.snoozedUntil && (
              <span className="flex items-center gap-1 text-purple-500">
                <Clock className="w-3 h-3" />
                Snoozed
              </span>
            )}
          </div>
        </div>

        {/* Actions - visible on hover */}
        <div
          className={`flex items-center gap-1 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* More menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-panel z-20 py-1 min-w-[140px] border border-slate-200 dark:border-slate-700">
                {/* Snooze task section */}
                <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Snooze task
                </div>
                {['30m', '1h', '2h', '1d', '1w'].map((d) => (
                  <button
                    key={d}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSnooze(task.id, d);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {d}
                  </button>
                ))}

                {/* Notification controls */}
                {hasNotification && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                    <div className="px-3 py-1.5 text-xs text-amber-500 font-medium">
                      Notification
                    </div>
                    {['15m', '30m', '1h'].map((d) => (
                      <button
                        key={d}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSnoozeNotification(task.id, d);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        Snooze {d}
                      </button>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearNotification(task.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Bell className="w-3.5 h-3.5 text-slate-400" />
                      Clear notification
                    </button>
                  </>
                )}

                {/* Delete */}
                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
