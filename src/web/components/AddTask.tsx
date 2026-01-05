import { useState } from 'react';
import type { ProjectResponse } from '../../types/index.js';

interface AddTaskProps {
  onAdd: (data: { title: string; project?: string; notifyAt?: string }) => void;
  projects: ProjectResponse[];
}

export default function AddTask({ onAdd, projects }: AddTaskProps) {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [notifyIn, setNotifyIn] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title,
      project: project || undefined,
      notifyAt: notifyIn || undefined,
    });
    setTitle('');
    setProject('');
    setNotifyIn('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 min-w-[200px] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={notifyIn}
          onChange={(e) => setNotifyIn(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
          title="Set notification time"
        >
          <option value="">No notification</option>
          <option value="15m">Notify in 15m</option>
          <option value="30m">Notify in 30m</option>
          <option value="1h">Notify in 1h</option>
          <option value="2h">Notify in 2h</option>
          <option value="1d">Notify in 1d</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Add
        </button>
      </div>
    </form>
  );
}
