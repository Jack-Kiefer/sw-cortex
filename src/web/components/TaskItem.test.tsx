import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createMockTask, createMockProject } from '../../test/utils';
import TaskItem from './TaskItem';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

// Wrapper component for DnD context
function renderWithDnd(ui: React.ReactElement) {
  return render(
    <DndContext>
      <SortableContext items={[1]}>{ui}</SortableContext>
    </DndContext>
  );
}

describe('TaskItem', () => {
  const mockOnSelect = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnSnooze = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSnoozeNotification = vi.fn();
  const mockOnClearNotification = vi.fn();

  const defaultProps = {
    onSelect: mockOnSelect,
    onComplete: mockOnComplete,
    onSnooze: mockOnSnooze,
    onDelete: mockOnDelete,
    onSnoozeNotification: mockOnSnoozeNotification,
    onClearNotification: mockOnClearNotification,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render task title', () => {
    const task = createMockTask({ title: 'Test Task Title' });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    expect(screen.getByText('Test Task Title')).toBeInTheDocument();
  });

  it('should render project badge when project is provided', () => {
    const task = createMockTask({ projectId: 1 });
    const project = createMockProject({ id: 1, name: 'My Project', color: '#ff0000' });
    renderWithDnd(<TaskItem task={task} project={project} {...defaultProps} />);

    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('should render due date when provided', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const task = createMockTask({ dueDate: tomorrow.toISOString() });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('should render "Today" for tasks due today', () => {
    const today = new Date();
    const task = createMockTask({ dueDate: today.toISOString() });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should call onComplete when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const task = createMockTask({ id: 42 });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockOnComplete).toHaveBeenCalledWith(42);
  });

  it('should call onSelect when task content is clicked', async () => {
    const user = userEvent.setup();
    const task = createMockTask({ id: 42, title: 'Clickable Task' });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    await user.click(screen.getByText('Clickable Task'));

    expect(mockOnSelect).toHaveBeenCalledWith(task);
  });

  it('should show strikethrough for completed tasks', () => {
    const task = createMockTask({ status: 'completed', title: 'Done Task' });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    const titleElement = screen.getByText('Done Task');
    expect(titleElement).toHaveClass('line-through');
  });

  it('should render checkbox as checked for completed tasks', () => {
    const task = createMockTask({ status: 'completed' });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should render notification indicator when notifyAt is set', () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    const task = createMockTask({
      notifyAt: futureDate.toISOString(),
      notificationSent: false,
    });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    // Should show notification time indicator (e.g., "2h")
    expect(screen.getByText(/\d+h/)).toBeInTheDocument();
  });

  it('should not render notification indicator when notification is sent', () => {
    const task = createMockTask({
      notifyAt: new Date().toISOString(),
      notificationSent: true,
    });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    // Should not show notification indicator
    const notificationBadge = screen.queryByText(/\d+h/);
    expect(notificationBadge).not.toBeInTheDocument();
  });

  it('should render snoozed indicator for snoozed tasks', () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    const task = createMockTask({
      status: 'snoozed',
      snoozedUntil: futureDate.toISOString(),
    });
    renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

    expect(screen.getByText('Snoozed')).toBeInTheDocument();
  });

  describe('priority colors', () => {
    it('should render red flag for urgent priority', () => {
      const task = createMockTask({ priority: 4 });
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      const flagIcon = document.querySelector('svg.lucide-flag');
      expect(flagIcon).toHaveClass('text-red-500');
    });

    it('should render amber flag for high priority', () => {
      const task = createMockTask({ priority: 3 });
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      const flagIcon = document.querySelector('svg.lucide-flag');
      expect(flagIcon).toHaveClass('text-amber-500');
    });

    it('should render blue flag for medium priority', () => {
      const task = createMockTask({ priority: 2 });
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      const flagIcon = document.querySelector('svg.lucide-flag');
      expect(flagIcon).toHaveClass('text-blue-500');
    });
  });

  describe('hover menu', () => {
    it('should show menu when more button is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      // Find and click the more button directly (jsdom doesn't handle CSS hover states)
      // The button exists in the DOM even though it has opacity-0 when not hovered
      const moreButton = document.querySelector('svg.lucide-ellipsis')?.parentElement;
      expect(moreButton).not.toBeNull();
      await user.click(moreButton!);

      // Should show snooze options
      expect(screen.getByText('Snooze task')).toBeInTheDocument();
      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should render all snooze duration options', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 99 });
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      const moreButton = document.querySelector('svg.lucide-ellipsis')?.parentElement;
      await user.click(moreButton!);

      // Verify all snooze durations are available
      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('1d')).toBeInTheDocument();
      expect(screen.getByText('1w')).toBeInTheDocument();
    });

    it('should render delete option with correct styling', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 99 });
      renderWithDnd(<TaskItem task={task} project={null} {...defaultProps} />);

      const moreButton = document.querySelector('svg.lucide-ellipsis')?.parentElement;
      await user.click(moreButton!);

      // Delete button should have red text styling
      const deleteButton = screen.getByText('Delete').closest('button');
      expect(deleteButton).toHaveClass('text-red-500');
    });
  });
});
