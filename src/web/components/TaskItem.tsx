import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

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

interface TaskItemProps {
  task: Task;
  onComplete: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
  onDelete: (id: number) => void;
}

export default function TaskItem({ task, onComplete, onSnooze, onDelete }: TaskItemProps) {
  const [showSnooze, setShowSnooze] = useState(false);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition"
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-400 mt-1"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-base ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}
            >
              {task.title}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
            {task.priority > 2 && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {priorityLabels[task.priority]}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-slate-400 truncate">{task.description}</p>
          )}
          {task.dueDate && (
            <p className="text-xs text-slate-500 mt-1">
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSnooze(!showSnooze)}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Snooze"
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
              <div className="absolute right-0 top-8 bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px]">
                {['30m', '1h', '2h', '1d', '1w'].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      onSnooze(task.id, d);
                      setShowSnooze(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
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
