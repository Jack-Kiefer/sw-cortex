import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Inbox,
  ListTodo,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Plus,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  Repeat,
} from 'lucide-react';
import { useState } from 'react';
import type { ProjectResponse } from '../../types/index.js';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
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

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

function NavItem({ icon, label, count, isActive, onClick, variant = 'default' }: NavItemProps) {
  const baseClasses =
    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
  const activeClasses = isActive
    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
  const dangerClasses = variant === 'danger' && !isActive ? 'text-red-600 dark:text-red-400' : '';

  return (
    <button className={`${baseClasses} ${activeClasses} ${dangerClasses}`} onClick={onClick}>
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            variant === 'danger'
              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
              : isActive
                ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onAdd?: () => void;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  onAdd,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-3 py-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200"
        >
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {title}
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isOpen && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}

export default function Sidebar({
  currentView,
  onNavigate,
  taskCounts,
  projects = [],
}: SidebarProps) {
  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {/* Smart Lists */}
      <div className="px-2 space-y-0.5">
        {taskCounts.overdue > 0 && (
          <NavItem
            icon={<AlertCircle className="w-5 h-5" />}
            label="Overdue"
            count={taskCounts.overdue}
            isActive={currentView === 'overdue'}
            onClick={() => onNavigate('overdue')}
            variant="danger"
          />
        )}
        <NavItem
          icon={<Calendar className="w-5 h-5" />}
          label="Today"
          count={taskCounts.today}
          isActive={currentView === 'today'}
          onClick={() => onNavigate('today')}
        />
        <NavItem
          icon={<CalendarDays className="w-5 h-5" />}
          label="Tomorrow"
          count={taskCounts.tomorrow}
          isActive={currentView === 'tomorrow'}
          onClick={() => onNavigate('tomorrow')}
        />
        <NavItem
          icon={<CalendarRange className="w-5 h-5" />}
          label="Next 7 Days"
          count={taskCounts.week}
          isActive={currentView === 'week'}
          onClick={() => onNavigate('week')}
        />
        <NavItem
          icon={<Inbox className="w-5 h-5" />}
          label="Inbox"
          count={taskCounts.inbox}
          isActive={currentView === 'inbox'}
          onClick={() => onNavigate('inbox')}
        />
        <NavItem
          icon={<ListTodo className="w-5 h-5" />}
          label="All Tasks"
          count={taskCounts.all}
          isActive={currentView === 'all'}
          onClick={() => onNavigate('all')}
        />
      </div>

      {/* Divider */}
      <div className="my-4 mx-3 border-t border-slate-200 dark:border-slate-700" />

      {/* Special Views */}
      <div className="px-2 space-y-0.5">
        <NavItem
          icon={<Grid3X3 className="w-5 h-5" />}
          label="Eisenhower Matrix"
          isActive={currentView === 'matrix'}
          onClick={() => onNavigate('matrix')}
        />
        <NavItem
          icon={<Repeat className="w-5 h-5" />}
          label="Habits"
          isActive={currentView === 'habits'}
          onClick={() => onNavigate('habits')}
        />
        <NavItem
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Completed"
          isActive={currentView === 'completed'}
          onClick={() => onNavigate('completed')}
        />
      </div>

      {/* Projects Section */}
      <CollapsibleSection title="Projects" onAdd={() => onNavigate('new-project')}>
        <div className="px-2 space-y-0.5">
          {projects.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-3 py-2">No projects yet</p>
          ) : (
            projects.map((project) => (
              <NavItem
                key={project.id}
                icon={
                  <FolderKanban className="w-5 h-5" style={{ color: project.color ?? '#6366f1' }} />
                }
                label={project.name}
                isActive={currentView === `project-${project.id}`}
                onClick={() => onNavigate(`project-${project.id}`)}
              />
            ))
          )}
        </div>
      </CollapsibleSection>
    </nav>
  );
}
