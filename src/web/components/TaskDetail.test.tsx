import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import TaskDetail from './TaskDetail';
import { createMockTask, createMockProject } from '../../test/utils';

describe('TaskDetail', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnSnooze = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSnoozeNotification = vi.fn();
  const mockOnClearNotification = vi.fn();

  const defaultProps = {
    onClose: mockOnClose,
    onComplete: mockOnComplete,
    onSnooze: mockOnSnooze,
    onDelete: mockOnDelete,
    onSnoozeNotification: mockOnSnoozeNotification,
    onClearNotification: mockOnClearNotification,
  };

  const mockProject = createMockProject({ id: 1, name: 'Test Project', color: '#6366f1' });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  describe('rendering', () => {
    it('should render task title', () => {
      const task = createMockTask({ title: 'My Task Title' });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('My Task Title')).toBeInTheDocument();
    });

    it('should render task description when provided', () => {
      const task = createMockTask({ description: 'This is the description' });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('This is the description')).toBeInTheDocument();
    });

    it('should render Task Details header', () => {
      const task = createMockTask();
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Task Details')).toBeInTheDocument();
    });

    it('should render close button', () => {
      const task = createMockTask();
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      const closeButton = document.querySelector('svg.lucide-x')?.parentElement;
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('should render pending status badge', () => {
      const task = createMockTask({ status: 'pending' });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render completed status badge', () => {
      const task = createMockTask({
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // Status badge should show "Completed"
      const completedElements = screen.getAllByText('Completed');
      expect(completedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render snoozed status badge', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        status: 'snoozed',
        snoozedUntil: futureDate.toISOString(),
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Snoozed')).toBeInTheDocument();
    });
  });

  describe('priority display', () => {
    it('should render low priority badge', () => {
      const task = createMockTask({ priority: 1 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should render medium priority badge', () => {
      const task = createMockTask({ priority: 2 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('should render high priority badge', () => {
      const task = createMockTask({ priority: 3 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should render urgent priority badge', () => {
      const task = createMockTask({ priority: 4 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });
  });

  describe('project display', () => {
    it('should render project name when provided', () => {
      const task = createMockTask({ projectId: 1 });
      render(<TaskDetail task={task} project={mockProject} {...defaultProps} />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });

    it('should not render project section when no project', () => {
      const task = createMockTask({ projectId: null });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByText('Project')).not.toBeInTheDocument();
    });
  });

  describe('due date display', () => {
    it('should render due date when provided', () => {
      const dueDate = new Date('2024-12-25T10:00:00');
      const task = createMockTask({ dueDate: dueDate.toISOString() });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Due Date')).toBeInTheDocument();
    });

    it('should not render due date section when not provided', () => {
      const task = createMockTask({ dueDate: null });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByText('Due Date')).not.toBeInTheDocument();
    });
  });

  describe('notification display', () => {
    it('should render notification section when notification is scheduled', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        notifyAt: futureDate.toISOString(),
        notificationSent: false,
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Notification Scheduled')).toBeInTheDocument();
    });

    it('should not render notification section when no notification', () => {
      const task = createMockTask({ notifyAt: null });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByText('Notification Scheduled')).not.toBeInTheDocument();
    });

    it('should not render notification section when notification already sent', () => {
      const task = createMockTask({
        notifyAt: new Date().toISOString(),
        notificationSent: true,
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByText('Notification Scheduled')).not.toBeInTheDocument();
    });

    it('should show snoozed indicator when notification is snoozed', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        notifyAt: new Date().toISOString(),
        notificationSent: false,
        notificationSnoozedUntil: futureDate.toISOString(),
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Snoozed from original time')).toBeInTheDocument();
    });
  });

  describe('tags display', () => {
    it('should render tags when provided', () => {
      const task = createMockTask({ tags: JSON.stringify(['tag1', 'tag2', 'tag3']) });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should not render tags section when no tags', () => {
      const task = createMockTask({ tags: null });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      const closeButton = document.querySelector('svg.lucide-x')?.parentElement;
      if (closeButton) await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onComplete when Complete button is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 42, status: 'pending' });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /complete/i }));

      expect(mockOnComplete).toHaveBeenCalledWith(42);
    });

    it('should not show Complete button for completed tasks', () => {
      const task = createMockTask({ status: 'completed' });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
    });

    it('should show snooze menu when Snooze button is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // Find the snooze button (not in notification section)
      const snoozeButtons = screen.getAllByRole('button', { name: /snooze/i });
      await user.click(snoozeButtons[0]);

      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('1d')).toBeInTheDocument();
      expect(screen.getByText('1w')).toBeInTheDocument();
    });

    it('should call onSnooze when snooze option is selected', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 42 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // Open snooze menu
      const snoozeButtons = screen.getAllByRole('button', { name: /snooze/i });
      await user.click(snoozeButtons[0]);

      // Click snooze option
      await user.click(screen.getByText('1h'));

      expect(mockOnSnooze).toHaveBeenCalledWith(42, '1h');
    });

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 42 });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      const deleteButton = document.querySelector('svg.lucide-trash-2')?.parentElement;
      if (deleteButton) await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(42);
    });
  });

  describe('notification actions', () => {
    it('should call onClearNotification when Clear button is clicked', async () => {
      const user = userEvent.setup();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        id: 42,
        notifyAt: futureDate.toISOString(),
        notificationSent: false,
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /clear/i }));

      expect(mockOnClearNotification).toHaveBeenCalledWith(42);
    });

    it('should show notification snooze menu when clicked', async () => {
      const user = userEvent.setup();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        notifyAt: futureDate.toISOString(),
        notificationSent: false,
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // Find all snooze buttons - the notification snooze button comes first (in the notification section)
      const snoozeButtons = screen.getAllByRole('button', { name: /snooze/i });
      // The notification snooze button is the first one (in notification section)
      await user.click(snoozeButtons[0]);

      expect(screen.getByText('15m')).toBeInTheDocument();
      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('should call onSnoozeNotification when option is selected', async () => {
      const user = userEvent.setup();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      const task = createMockTask({
        id: 42,
        notifyAt: futureDate.toISOString(),
        notificationSent: false,
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // Open notification snooze menu - it's the first snooze button
      const snoozeButtons = screen.getAllByRole('button', { name: /snooze/i });
      await user.click(snoozeButtons[0]);

      // Click snooze option
      await user.click(screen.getByText('15m'));

      expect(mockOnSnoozeNotification).toHaveBeenCalledWith(42, '15m');
    });
  });

  describe('created date', () => {
    it('should always show created date', () => {
      const task = createMockTask();
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  describe('completed date', () => {
    it('should show completed date when task is completed', () => {
      const task = createMockTask({
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      render(<TaskDetail task={task} project={null} {...defaultProps} />);

      // The "Completed" text appears both as status badge and as date label
      const completedElements = screen.getAllByText('Completed');
      expect(completedElements.length).toBeGreaterThan(0);
    });
  });
});
