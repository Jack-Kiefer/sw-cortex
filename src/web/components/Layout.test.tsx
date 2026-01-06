import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import Layout from './Layout';
import { createMockProject } from '../../test/utils';

describe('Layout', () => {
  const mockOnNavigate = vi.fn();

  const defaultTaskCounts = {
    today: 5,
    tomorrow: 3,
    week: 12,
    overdue: 0,
    inbox: 8,
    all: 25,
  };

  const defaultProps = {
    onNavigate: mockOnNavigate,
    currentView: 'today',
    taskCounts: defaultTaskCounts,
    projects: [],
    children: <div data-testid="main-content">Main Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset dark mode
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  describe('structure rendering', () => {
    it('should render main content area', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('should render sidebar with sw-cortex branding', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByText('sw')).toBeInTheDocument();
      expect(screen.getByText('-cortex')).toBeInTheDocument();
    });

    it('should render header with current view name', () => {
      render(<Layout {...defaultProps} currentView="today" />);
      expect(screen.getByText('today')).toBeInTheDocument();
    });

    it('should display "Next 7 Days" when currentView is "week"', () => {
      render(<Layout {...defaultProps} currentView="week" />);
      // The header should show "Next 7 Days" as the title
      const header = document.querySelector('header');
      expect(header?.textContent).toContain('Next 7 Days');
    });

    it('should render detail panel when provided', () => {
      render(
        <Layout {...defaultProps} detailPanel={<div data-testid="detail-panel">Details</div>} />
      );
      expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    });

    it('should not render detail panel when not provided', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
    });
  });

  describe('sidebar toggle', () => {
    it('should render toggle sidebar button', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
    });

    it('should collapse sidebar when toggle button is clicked', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      // Click toggle button
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Sidebar should be collapsed (w-0)
      const sidebar = document.querySelector('aside');
      expect(sidebar).toHaveClass('w-0');
    });

    it('should expand sidebar when toggle button is clicked again', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      // Collapse
      await user.click(screen.getByLabelText('Toggle sidebar'));
      // Expand
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Sidebar should be expanded (w-64)
      const sidebar = document.querySelector('aside');
      expect(sidebar).toHaveClass('w-64');
    });

    it('should show PanelLeftClose icon when sidebar is expanded', () => {
      render(<Layout {...defaultProps} />);
      const panelLeftClose = document.querySelector('svg.lucide-panel-left-close');
      expect(panelLeftClose).toBeInTheDocument();
    });

    it('should show PanelLeft icon when sidebar is collapsed', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      await user.click(screen.getByLabelText('Toggle sidebar'));

      const panelLeft = document.querySelector('svg.lucide-panel-left');
      expect(panelLeft).toBeInTheDocument();
    });
  });

  describe('dark mode toggle', () => {
    it('should render dark mode toggle button', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    });

    it('should toggle between sun and moon icons when clicked', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      // Get the initial icon state
      const initialSunIcon = document.querySelector('svg.lucide-sun');
      const initialMoonIcon = document.querySelector('svg.lucide-moon');

      // Click to toggle
      await user.click(screen.getByLabelText('Toggle dark mode'));

      // Icon should have changed
      const afterSunIcon = document.querySelector('svg.lucide-sun');
      const afterMoonIcon = document.querySelector('svg.lucide-moon');

      // One should be present, and it should be the opposite of what we started with
      if (initialSunIcon) {
        expect(afterMoonIcon).toBeInTheDocument();
      } else if (initialMoonIcon) {
        expect(afterSunIcon).toBeInTheDocument();
      }
    });

    it('should add or remove dark class on document when toggled', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      const hadDarkClass = document.documentElement.classList.contains('dark');

      await user.click(screen.getByLabelText('Toggle dark mode'));

      // Should have toggled
      expect(document.documentElement.classList.contains('dark')).toBe(!hadDarkClass);
    });
  });

  describe('sidebar navigation', () => {
    it('should render sidebar component', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Inbox')).toBeInTheDocument();
    });

    it('should pass onNavigate to sidebar', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      await user.click(screen.getByText('Inbox'));

      expect(mockOnNavigate).toHaveBeenCalledWith('inbox');
    });

    it('should pass task counts to sidebar', () => {
      render(<Layout {...defaultProps} />);
      // Today count
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should pass projects to sidebar', () => {
      const projects = [createMockProject({ id: 1, name: 'Test Project' })];
      render(<Layout {...defaultProps} projects={projects} />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('responsive behavior', () => {
    it('should hide sidebar content when collapsed', async () => {
      const user = userEvent.setup();
      render(<Layout {...defaultProps} />);

      // Sidebar content should be visible initially
      expect(screen.getByText('Today')).toBeVisible();

      // Collapse sidebar
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Sidebar should have overflow-hidden
      const sidebar = document.querySelector('aside');
      expect(sidebar).toHaveClass('overflow-hidden');
    });
  });

  describe('accessibility', () => {
    it('should have main element for content', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should have header element', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should have accessible toggle buttons', () => {
      render(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    });
  });

  describe('view title formatting', () => {
    it('should capitalize view name', () => {
      render(<Layout {...defaultProps} currentView="inbox" />);
      expect(screen.getByText('inbox')).toBeInTheDocument();
      const headerTitle = screen.getByText('inbox');
      expect(headerTitle).toHaveClass('capitalize');
    });

    it('should display special formatting for week view', () => {
      render(<Layout {...defaultProps} currentView="week" />);
      // The header should show "Next 7 Days" as the title
      const header = document.querySelector('header');
      expect(header?.textContent).toContain('Next 7 Days');
    });

    it('should display matrix as "matrix"', () => {
      render(<Layout {...defaultProps} currentView="matrix" />);
      expect(screen.getByText('matrix')).toBeInTheDocument();
    });

    it('should display habits as "habits"', () => {
      render(<Layout {...defaultProps} currentView="habits" />);
      expect(screen.getByText('habits')).toBeInTheDocument();
    });
  });
});
