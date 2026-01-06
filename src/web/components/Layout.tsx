import { useState, useEffect, type ReactNode } from 'react';
import { Sun, Moon, PanelLeftClose, PanelLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import type { ProjectResponse } from '../../types/index.js';

interface LayoutProps {
  children: ReactNode;
  detailPanel?: ReactNode;
  onNavigate: (view: string) => void;
  currentView: string;
  taskCounts: {
    today: number;
    tomorrow: number;
    week: number;
    overdue: number;
    inbox: number;
    all: number;
  };
  projects?: ProjectResponse[];
}

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

export default function Layout({
  children,
  detailPanel,
  onNavigate,
  currentView,
  taskCounts,
  projects = [],
}: LayoutProps) {
  const [isDark, toggleDarkMode] = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'
        } flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-600">sw</span>
              <span className="text-slate-400">-cortex</span>
            </h1>
          </div>

          {/* Navigation */}
          <Sidebar
            currentView={currentView}
            onNavigate={onNavigate}
            taskCounts={taskCounts}
            projects={projects}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
            <span className="text-lg font-semibold text-slate-900 dark:text-white capitalize">
              {currentView === 'week' ? 'Next 7 Days' : currentView}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Detail Panel */}
          {detailPanel && (
            <aside className="w-96 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
              {detailPanel}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
