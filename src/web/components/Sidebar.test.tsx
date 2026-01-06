import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import Sidebar from './Sidebar';
import { createMockProject } from '../../test/utils';

describe('Sidebar', () => {
  const mockOnNavigate = vi.fn();

  const defaultTaskCounts = {
    today: 5,
    tomorrow: 3,
    week: 12,
    overdue: 2,
    inbox: 8,
    all: 25,
  };

  const defaultProps = {
    currentView: 'today',
    onNavigate: mockOnNavigate,
    taskCounts: defaultTaskCounts,
    projects: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('smart lists rendering', () => {
    it('should render Today navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should render Tomorrow navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    });

    it('should render Next 7 Days navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Next 7 Days')).toBeInTheDocument();
    });

    it('should render Inbox navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Inbox')).toBeInTheDocument();
    });

    it('should render All Tasks navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('All Tasks')).toBeInTheDocument();
    });

    it('should render Overdue when count is greater than 0', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('should not render Overdue when count is 0', () => {
      const props = {
        ...defaultProps,
        taskCounts: { ...defaultTaskCounts, overdue: 0 },
      };
      render(<Sidebar {...props} />);
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });
  });

  describe('special views rendering', () => {
    it('should render Eisenhower Matrix navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Eisenhower Matrix')).toBeInTheDocument();
    });

    it('should render Habits navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Habits')).toBeInTheDocument();
    });

    it('should render Completed navigation item', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('task counts display', () => {
    it('should display today task count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display tomorrow task count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display week task count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should display overdue task count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display inbox task count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should display all tasks count', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should not display count badge when count is 0', () => {
      const props = {
        ...defaultProps,
        taskCounts: { ...defaultTaskCounts, today: 0 },
      };
      render(<Sidebar {...props} />);
      // Today should still appear but without a count badge
      expect(screen.getByText('Today')).toBeInTheDocument();
      // 5 should not appear since today is now 0
      expect(screen.queryByText(/^5$/)).not.toBeInTheDocument();
    });
  });

  describe('navigation interactions', () => {
    it('should call onNavigate with "today" when Today is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} currentView="inbox" />);

      await user.click(screen.getByText('Today'));
      expect(mockOnNavigate).toHaveBeenCalledWith('today');
    });

    it('should call onNavigate with "tomorrow" when Tomorrow is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Tomorrow'));
      expect(mockOnNavigate).toHaveBeenCalledWith('tomorrow');
    });

    it('should call onNavigate with "week" when Next 7 Days is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Next 7 Days'));
      expect(mockOnNavigate).toHaveBeenCalledWith('week');
    });

    it('should call onNavigate with "inbox" when Inbox is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Inbox'));
      expect(mockOnNavigate).toHaveBeenCalledWith('inbox');
    });

    it('should call onNavigate with "all" when All Tasks is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('All Tasks'));
      expect(mockOnNavigate).toHaveBeenCalledWith('all');
    });

    it('should call onNavigate with "overdue" when Overdue is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Overdue'));
      expect(mockOnNavigate).toHaveBeenCalledWith('overdue');
    });

    it('should call onNavigate with "matrix" when Eisenhower Matrix is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Eisenhower Matrix'));
      expect(mockOnNavigate).toHaveBeenCalledWith('matrix');
    });

    it('should call onNavigate with "habits" when Habits is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Habits'));
      expect(mockOnNavigate).toHaveBeenCalledWith('habits');
    });

    it('should call onNavigate with "completed" when Completed is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Completed'));
      expect(mockOnNavigate).toHaveBeenCalledWith('completed');
    });
  });

  describe('active state', () => {
    it('should highlight Today when currentView is "today"', () => {
      render(<Sidebar {...defaultProps} currentView="today" />);
      const todayButton = screen.getByText('Today').closest('button');
      expect(todayButton).toHaveClass('bg-blue-50');
    });

    it('should highlight Inbox when currentView is "inbox"', () => {
      render(<Sidebar {...defaultProps} currentView="inbox" />);
      const inboxButton = screen.getByText('Inbox').closest('button');
      expect(inboxButton).toHaveClass('bg-blue-50');
    });

    it('should highlight Matrix when currentView is "matrix"', () => {
      render(<Sidebar {...defaultProps} currentView="matrix" />);
      const matrixButton = screen.getByText('Eisenhower Matrix').closest('button');
      expect(matrixButton).toHaveClass('bg-blue-50');
    });

    it('should highlight Habits when currentView is "habits"', () => {
      render(<Sidebar {...defaultProps} currentView="habits" />);
      const habitsButton = screen.getByText('Habits').closest('button');
      expect(habitsButton).toHaveClass('bg-blue-50');
    });
  });

  describe('projects section', () => {
    it('should render Projects section header', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should show "No projects yet" when projects array is empty', () => {
      render(<Sidebar {...defaultProps} projects={[]} />);
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('should render project names when projects exist', () => {
      const projects = [
        createMockProject({ id: 1, name: 'Project Alpha' }),
        createMockProject({ id: 2, name: 'Project Beta' }),
      ];
      render(<Sidebar {...defaultProps} projects={projects} />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('should call onNavigate with project view when project is clicked', async () => {
      const user = userEvent.setup();
      const projects = [createMockProject({ id: 42, name: 'My Project' })];
      render(<Sidebar {...defaultProps} projects={projects} />);

      await user.click(screen.getByText('My Project'));
      expect(mockOnNavigate).toHaveBeenCalledWith('project-42');
    });

    it('should highlight active project', () => {
      const projects = [createMockProject({ id: 42, name: 'Active Project' })];
      render(<Sidebar {...defaultProps} currentView="project-42" projects={projects} />);

      const projectButton = screen.getByText('Active Project').closest('button');
      expect(projectButton).toHaveClass('bg-blue-50');
    });

    it('should call onNavigate with "new-project" when add button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      // Find the plus icon in the Projects section
      const addButtons = document.querySelectorAll('svg.lucide-plus');
      expect(addButtons.length).toBeGreaterThan(0);

      const addButton = addButtons[0].closest('button');
      if (addButton) await user.click(addButton);

      expect(mockOnNavigate).toHaveBeenCalledWith('new-project');
    });
  });

  describe('collapsible sections', () => {
    it('should toggle projects section when header is clicked', async () => {
      const user = userEvent.setup();
      const projects = [createMockProject({ id: 1, name: 'Test Project' })];
      render(<Sidebar {...defaultProps} projects={projects} />);

      // Initially projects should be visible
      expect(screen.getByText('Test Project')).toBeInTheDocument();

      // Click the Projects header to collapse
      await user.click(screen.getByText('Projects'));

      // Project should now be hidden
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
    });

    it('should show projects again when header is clicked twice', async () => {
      const user = userEvent.setup();
      const projects = [createMockProject({ id: 1, name: 'Toggle Project' })];
      render(<Sidebar {...defaultProps} projects={projects} />);

      // Collapse
      await user.click(screen.getByText('Projects'));
      expect(screen.queryByText('Toggle Project')).not.toBeInTheDocument();

      // Expand
      await user.click(screen.getByText('Projects'));
      expect(screen.getByText('Toggle Project')).toBeInTheDocument();
    });

    it('should show chevron down icon when projects section is expanded', () => {
      render(<Sidebar {...defaultProps} />);
      const chevronDown = document.querySelector('svg.lucide-chevron-down');
      expect(chevronDown).toBeInTheDocument();
    });

    it('should show chevron right icon when projects section is collapsed', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Projects'));

      const chevronRight = document.querySelector('svg.lucide-chevron-right');
      expect(chevronRight).toBeInTheDocument();
    });
  });

  describe('overdue styling', () => {
    it('should apply danger variant to overdue item', () => {
      render(<Sidebar {...defaultProps} />);
      const overdueButton = screen.getByText('Overdue').closest('button');
      // The danger variant applies text-red-600 when not active
      expect(overdueButton).toHaveClass('text-red-600');
    });

    it('should show overdue count badge with danger styling', () => {
      render(<Sidebar {...defaultProps} />);
      const overdueBadge = screen.getByText('2');
      expect(overdueBadge).toHaveClass('bg-red-100');
    });
  });

  describe('accessibility', () => {
    it('should have nav element as root', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have clickable buttons for all nav items', () => {
      render(<Sidebar {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      // Should have navigation items plus projects header plus add button
      expect(buttons.length).toBeGreaterThan(8);
    });
  });
});
