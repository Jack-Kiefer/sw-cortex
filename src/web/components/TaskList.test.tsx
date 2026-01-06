import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import TaskList from './TaskList';
import { createMockTask, createMockProject } from '../../test/utils';

describe('TaskList', () => {
  const mockOnReorder = vi.fn();
  const mockOnSelectTask = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnSnooze = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSnoozeNotification = vi.fn();
  const mockOnClearNotification = vi.fn();

  const defaultProps = {
    onReorder: mockOnReorder,
    onSelectTask: mockOnSelectTask,
    onComplete: mockOnComplete,
    onSnooze: mockOnSnooze,
    onDelete: mockOnDelete,
    onSnoozeNotification: mockOnSnoozeNotification,
    onClearNotification: mockOnClearNotification,
  };

  const mockProjects = [
    createMockProject({ id: 1, name: 'Project A', color: '#ff0000' }),
    createMockProject({ id: 2, name: 'Project B', color: '#00ff00' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render empty state when no tasks', () => {
      render(<TaskList tasks={[]} projects={[]} {...defaultProps} />);

      expect(screen.getByText('No tasks found. Add one above!')).toBeInTheDocument();
    });

    it('should render task list when tasks exist', () => {
      const tasks = [
        createMockTask({ id: 1, title: 'First Task' }),
        createMockTask({ id: 2, title: 'Second Task' }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      expect(screen.getByText('First Task')).toBeInTheDocument();
      expect(screen.getByText('Second Task')).toBeInTheDocument();
    });

    it('should render tasks with project badges', () => {
      const tasks = [createMockTask({ id: 1, title: 'Task with Project', projectId: 1 })];

      render(<TaskList tasks={tasks} projects={mockProjects} {...defaultProps} />);

      expect(screen.getByText('Task with Project')).toBeInTheDocument();
      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    it('should render multiple tasks in order', () => {
      const tasks = [
        createMockTask({ id: 1, title: 'Task A' }),
        createMockTask({ id: 2, title: 'Task B' }),
        createMockTask({ id: 3, title: 'Task C' }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      const taskElements = screen.getAllByRole('checkbox');
      expect(taskElements).toHaveLength(3);
    });
  });

  describe('interactions', () => {
    it('should call onComplete when task checkbox is clicked', async () => {
      const user = userEvent.setup();
      const tasks = [createMockTask({ id: 42, title: 'Complete Me' })];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(mockOnComplete).toHaveBeenCalledWith(42);
    });

    it('should call onSelectTask when task content is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 42, title: 'Select Me' });

      render(<TaskList tasks={[task]} projects={[]} {...defaultProps} />);

      await user.click(screen.getByText('Select Me'));

      expect(mockOnSelectTask).toHaveBeenCalledWith(task);
    });
  });

  describe('task filtering', () => {
    it('should display pending tasks', () => {
      const tasks = [
        createMockTask({ id: 1, title: 'Pending Task', status: 'pending' }),
        createMockTask({ id: 2, title: 'Another Pending', status: 'pending' }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      expect(screen.getByText('Pending Task')).toBeInTheDocument();
      expect(screen.getByText('Another Pending')).toBeInTheDocument();
    });

    it('should display completed tasks with strikethrough', () => {
      const tasks = [createMockTask({ id: 1, title: 'Done Task', status: 'completed' })];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      const taskTitle = screen.getByText('Done Task');
      expect(taskTitle).toHaveClass('line-through');
    });

    it('should display snoozed tasks', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const tasks = [
        createMockTask({
          id: 1,
          title: 'Snoozed Task',
          status: 'snoozed',
          snoozedUntil: futureDate.toISOString(),
        }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      expect(screen.getByText('Snoozed Task')).toBeInTheDocument();
      expect(screen.getByText('Snoozed')).toBeInTheDocument();
    });
  });

  describe('priority rendering', () => {
    it('should render high priority task with correct flag color', () => {
      const tasks = [createMockTask({ id: 1, title: 'Urgent Task', priority: 4 })];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      const flagIcon = document.querySelector('svg.lucide-flag');
      expect(flagIcon).toHaveClass('text-red-500');
    });

    it('should render low priority task with muted flag color', () => {
      const tasks = [createMockTask({ id: 1, title: 'Low Priority Task', priority: 1 })];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      const flagIcon = document.querySelector('svg.lucide-flag');
      expect(flagIcon).toHaveClass('text-slate-300');
    });
  });

  describe('project assignment', () => {
    it('should show project badge for assigned task', () => {
      const tasks = [createMockTask({ id: 1, title: 'Project Task', projectId: 1 })];

      render(<TaskList tasks={tasks} projects={mockProjects} {...defaultProps} />);

      expect(screen.getByText('Project A')).toBeInTheDocument();
    });

    it('should not show project badge for unassigned task', () => {
      const tasks = [createMockTask({ id: 1, title: 'No Project Task', projectId: null })];

      render(<TaskList tasks={tasks} projects={mockProjects} {...defaultProps} />);

      expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      expect(screen.queryByText('Project B')).not.toBeInTheDocument();
    });

    it('should handle task with invalid project id gracefully', () => {
      const tasks = [createMockTask({ id: 1, title: 'Invalid Project Task', projectId: 999 })];

      render(<TaskList tasks={tasks} projects={mockProjects} {...defaultProps} />);

      // Should render task without project badge
      expect(screen.getByText('Invalid Project Task')).toBeInTheDocument();
      expect(screen.queryByText('Project A')).not.toBeInTheDocument();
    });
  });

  describe('due dates', () => {
    it('should show "Today" for tasks due today', () => {
      const today = new Date();
      const tasks = [createMockTask({ id: 1, title: 'Today Task', dueDate: today.toISOString() })];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should show "Tomorrow" for tasks due tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tasks = [
        createMockTask({ id: 1, title: 'Tomorrow Task', dueDate: tomorrow.toISOString() }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    });
  });

  describe('notifications', () => {
    it('should show notification indicator for task with notification', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const tasks = [
        createMockTask({
          id: 1,
          title: 'Notified Task',
          notifyAt: futureDate.toISOString(),
          notificationSent: false,
        }),
      ];

      render(<TaskList tasks={tasks} projects={[]} {...defaultProps} />);

      // Should show notification time (e.g., "2h")
      expect(screen.getByText(/\d+h/)).toBeInTheDocument();
    });
  });
});
