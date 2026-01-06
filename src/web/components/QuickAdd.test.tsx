import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createMockProject } from '../../test/utils';
import QuickAdd from './QuickAdd';

describe('QuickAdd', () => {
  const mockOnAdd = vi.fn();
  const mockProjects = [
    createMockProject({ id: 1, name: 'Project A', color: '#ff0000' }),
    createMockProject({ id: 2, name: 'Project B', color: '#00ff00' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render collapsed state initially', () => {
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="today" />);

    expect(screen.getByText('Add task...')).toBeInTheDocument();
  });

  it('should expand when clicked', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="today" />);

    await user.click(screen.getByText('Add task...'));

    expect(screen.getByPlaceholderText('Task name')).toBeInTheDocument();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('should call onAdd with task data when form is submitted', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="all" />);

    // Expand the form
    await user.click(screen.getByText('Add task...'));

    // Fill in task name
    const input = screen.getByPlaceholderText('Task name');
    await user.type(input, 'New Task');

    // Submit the form
    await user.click(screen.getByText('Add Task'));

    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Task',
        priority: 2, // Default priority
      })
    );
  });

  it('should not submit with empty title', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="all" />);

    // Expand the form
    await user.click(screen.getByText('Add task...'));

    // Try to submit without entering a title
    const submitButton = screen.getByText('Add Task');
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('should collapse when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="today" />);

    // Expand the form
    await user.click(screen.getByText('Add task...'));
    expect(screen.getByPlaceholderText('Task name')).toBeInTheDocument();

    // Click cancel (X button)
    const cancelButtons = screen.getAllByRole('button');
    const cancelButton = cancelButtons.find((btn) => btn.querySelector('svg.lucide-x') !== null);
    if (cancelButton) {
      await user.click(cancelButton);
    }

    // Should show collapsed state again
    expect(screen.getByText('Add task...')).toBeInTheDocument();
  });

  it('should show date picker options', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="all" />);

    await user.click(screen.getByText('Add task...'));

    // Click date button
    await user.click(screen.getByText('Date'));

    // Should show date options
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Next week')).toBeInTheDocument();
  });

  it('should show priority picker options', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="all" />);

    await user.click(screen.getByText('Add task...'));

    // Click priority button (shows "Medium" by default)
    await user.click(screen.getByText('Medium'));

    // Should show priority options
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('should show project picker when projects exist', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="all" />);

    await user.click(screen.getByText('Add task...'));

    // Click project button
    await user.click(screen.getByText('Project'));

    // Should show project options
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
    expect(screen.getByText('No project')).toBeInTheDocument();
  });

  it('should auto-set due date when in today view', async () => {
    const user = userEvent.setup();
    render(<QuickAdd onAdd={mockOnAdd} projects={mockProjects} currentView="today" />);

    await user.click(screen.getByText('Add task...'));

    // When in today view, a due date should be auto-set
    // The button will have blue styling indicating a date is selected
    const dateButton = document.querySelector('button.bg-blue-50, button[class*="bg-blue-50"]');
    expect(dateButton).toBeInTheDocument();
    // Should NOT show just "Date" (which indicates no date selected)
    expect(screen.queryByText('Date')).not.toBeInTheDocument();
  });
});
