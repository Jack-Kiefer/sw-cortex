import { useState, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, FolderKanban, X } from 'lucide-react';
import type { ProjectResponse } from '../../types/index.js';

interface QuickAddProps {
  onAdd: (data: { title: string; project?: string; dueDate?: string; priority?: number }) => void;
  projects: ProjectResponse[];
  currentView: string;
}

const PRIORITY_COLORS = {
  4: 'text-red-500', // Urgent
  3: 'text-amber-500', // High
  2: 'text-blue-500', // Medium
  1: 'text-slate-400', // Low
};

const PRIORITY_LABELS = {
  4: 'Urgent',
  3: 'High',
  2: 'Medium',
  1: 'Low',
};

export default function QuickAdd({ onAdd, projects, currentView }: QuickAddProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<number>(2);
  const [project, setProject] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-set due date based on current view
  useEffect(() => {
    if (currentView === 'today') {
      setDueDate(new Date().toISOString().split('T')[0]);
    } else if (currentView === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
    } else {
      setDueDate('');
    }
  }, [currentView, isExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      project: project || undefined,
      dueDate: dueDate || undefined,
      priority,
    });

    setTitle('');
    setDueDate('');
    setPriority(2);
    setProject('');
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setTitle('');
    setDueDate('');
    setPriority(2);
    setProject('');
    setIsExpanded(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => {
          setIsExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-full flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>Add task...</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-task"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name"
        className="w-full px-0 py-2 bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-lg font-medium quick-add-input"
        autoFocus
      />

      {/* Quick options row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Date picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDatePicker(!showDatePicker);
              setShowPriorityPicker(false);
              setShowProjectPicker(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              dueDate
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{dueDate ? formatDate(dueDate) : 'Date'}</span>
          </button>
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-panel z-10">
              <div className="flex flex-col gap-1 min-w-[140px]">
                <button
                  type="button"
                  onClick={() => {
                    setDueDate(new Date().toISOString().split('T')[0]);
                    setShowDatePicker(false);
                  }}
                  className="text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setDueDate(d.toISOString().split('T')[0]);
                    setShowDatePicker(false);
                  }}
                  className="text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setDueDate(d.toISOString().split('T')[0]);
                    setShowDatePicker(false);
                  }}
                  className="text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                >
                  Next week
                </button>
                <hr className="border-slate-200 dark:border-slate-700 my-1" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-1.5 rounded text-sm bg-slate-50 dark:bg-slate-700 border-0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Priority picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowPriorityPicker(!showPriorityPicker);
              setShowDatePicker(false);
              setShowProjectPicker(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS]} bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600`}
          >
            <Flag className="w-4 h-4" />
            <span>{PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS]}</span>
          </button>
          {showPriorityPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-panel z-10">
              <div className="flex flex-col gap-1 min-w-[120px]">
                {[4, 3, 2, 1].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      setShowPriorityPicker(false);
                    }}
                    className={`flex items-center gap-2 text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm ${PRIORITY_COLORS[p as keyof typeof PRIORITY_COLORS]}`}
                  >
                    <Flag className="w-4 h-4" />
                    {PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Project picker */}
        {projects.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowProjectPicker(!showProjectPicker);
                setShowDatePicker(false);
                setShowPriorityPicker(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                project
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>{project || 'Project'}</span>
            </button>
            {showProjectPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-panel z-10">
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <button
                    type="button"
                    onClick={() => {
                      setProject('');
                      setShowProjectPicker(false);
                    }}
                    className="text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-500"
                  >
                    No project
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProject(p.name);
                        setShowProjectPicker(false);
                      }}
                      className="text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <button
          type="button"
          onClick={handleCancel}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Task
        </button>
      </div>
    </form>
  );
}
