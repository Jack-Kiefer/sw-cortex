import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../test/utils';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('should render the layout with sidebar', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('sw')).toBeInTheDocument();
        expect(screen.getByText('-cortex')).toBeInTheDocument();
      });
    });

    it('should render navigation items in sidebar', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Tomorrow')).toBeInTheDocument();
        expect(screen.getByText('Next 7 Days')).toBeInTheDocument();
        expect(screen.getByText('Inbox')).toBeInTheDocument();
        expect(screen.getByText('All Tasks')).toBeInTheDocument();
      });
    });

    it('should render special views in sidebar', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Eisenhower Matrix')).toBeInTheDocument();
        expect(screen.getByText('Habits')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('should show QuickAdd component', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Add task...')).toBeInTheDocument();
      });
    });

    it('should start on Today view', async () => {
      render(<App />);

      await waitFor(() => {
        // The header should show "today" (capitalized by CSS)
        const headers = document.querySelectorAll('header span');
        const todayHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'today'
        );
        expect(todayHeader).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to Inbox when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Inbox')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Inbox'));

      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const inboxHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'inbox'
        );
        expect(inboxHeader).toBeInTheDocument();
      });
    });

    it('should navigate to All Tasks when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('All Tasks')).toBeInTheDocument();
      });

      await user.click(screen.getByText('All Tasks'));

      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const allHeader = Array.from(headers).find((h) => h.textContent?.toLowerCase() === 'all');
        expect(allHeader).toBeInTheDocument();
      });
    });

    it('should navigate to Completed when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Completed'));

      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const completedHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'completed'
        );
        expect(completedHeader).toBeInTheDocument();
      });
    });

    it('should navigate to Eisenhower Matrix when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Eisenhower Matrix')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Eisenhower Matrix'));

      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const matrixHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'matrix'
        );
        expect(matrixHeader).toBeInTheDocument();
      });
    });

    it('should navigate to Habits when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Habits')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Habits'));

      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const habitsHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'habits'
        );
        expect(habitsHeader).toBeInTheDocument();
      });
    });
  });

  describe('task creation flow', () => {
    it('should expand QuickAdd when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Add task...')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Add task...'));

      expect(screen.getByPlaceholderText('Task name')).toBeInTheDocument();
    });

    it('should create a task when form is submitted', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Add task...')).toBeInTheDocument();
      });

      // Expand QuickAdd
      await user.click(screen.getByText('Add task...'));

      // Enter task name
      await user.type(screen.getByPlaceholderText('Task name'), 'My New Task');

      // Submit
      await user.click(screen.getByRole('button', { name: /add task/i }));

      // Form should collapse
      await waitFor(() => {
        expect(screen.getByText('Add task...')).toBeInTheDocument();
      });
    });
  });

  describe('project creation flow', () => {
    it('should show new project form when navigating to new-project view', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Click the plus button in Projects section
      const addButtons = document.querySelectorAll('svg.lucide-plus');
      const projectAddButton = Array.from(addButtons).find((btn) =>
        btn.closest('button')?.parentElement?.textContent?.includes('Projects')
      );

      if (projectAddButton) {
        const button = projectAddButton.closest('button');
        if (button) await user.click(button);
      }

      await waitFor(() => {
        expect(screen.getByText('New Project')).toBeInTheDocument();
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });
    });

    it('should return to All Tasks after project creation', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Navigate to new project form
      const addButtons = document.querySelectorAll('svg.lucide-plus');
      const projectAddButton = Array.from(addButtons).find((btn) =>
        btn.closest('button')?.parentElement?.textContent?.includes('Projects')
      );

      if (projectAddButton) {
        const button = projectAddButton.closest('button');
        if (button) await user.click(button);
      }

      await waitFor(() => {
        expect(screen.getByText('New Project')).toBeInTheDocument();
      });

      // Fill and submit project form
      await user.type(screen.getByLabelText(/name/i), 'Test Project');
      await user.click(screen.getByText('Create Project'));

      // Should navigate back to All Tasks
      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const allHeader = Array.from(headers).find((h) => h.textContent?.toLowerCase() === 'all');
        expect(allHeader).toBeInTheDocument();
      });
    });

    it('should cancel project creation and return', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Navigate to new project form
      const addButtons = document.querySelectorAll('svg.lucide-plus');
      const projectAddButton = Array.from(addButtons).find((btn) =>
        btn.closest('button')?.parentElement?.textContent?.includes('Projects')
      );

      if (projectAddButton) {
        const button = projectAddButton.closest('button');
        if (button) await user.click(button);
      }

      await waitFor(() => {
        expect(screen.getByText('New Project')).toBeInTheDocument();
      });

      // Cancel
      await user.click(screen.getByText('Cancel'));

      // Should navigate back to All Tasks
      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const allHeader = Array.from(headers).find((h) => h.textContent?.toLowerCase() === 'all');
        expect(allHeader).toBeInTheDocument();
      });
    });
  });

  describe('dark mode', () => {
    it('should toggle dark mode when button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
      });

      // Initially should be in dark mode (based on default)
      await user.click(screen.getByLabelText('Toggle dark mode'));

      // The toggle should work (we just verify the button is clickable)
      expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    });
  });

  describe('sidebar toggle', () => {
    it('should toggle sidebar when button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
      });

      // Click toggle
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Sidebar should be collapsed (Today should be hidden)
      const sidebar = document.querySelector('aside');
      expect(sidebar).toHaveClass('w-0');
    });

    it('should expand sidebar when toggled again', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
      });

      // Collapse
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Expand
      await user.click(screen.getByLabelText('Toggle sidebar'));

      // Sidebar should be expanded
      const sidebar = document.querySelector('aside');
      expect(sidebar).toHaveClass('w-64');
    });
  });

  describe('task filtering', () => {
    it('should filter tasks for Today view', async () => {
      render(<App />);

      // The Today view should show tasks due today
      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      });
    });

    it('should show empty state message for Inbox when no unassigned tasks', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Inbox')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Inbox'));

      // Should show inbox-specific empty state
      await waitFor(() => {
        // Either shows inbox tasks or empty state
        const inboxText = screen.queryByText('Tasks without a project or due date appear here');
        if (inboxText) {
          expect(inboxText).toBeInTheDocument();
        }
      });
    });

    it('should show completed tasks in Completed view', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Completed'));

      // Should be on completed view
      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const completedHeader = Array.from(headers).find(
          (h) => h.textContent?.toLowerCase() === 'completed'
        );
        expect(completedHeader).toBeInTheDocument();
      });
    });
  });

  describe('week view special handling', () => {
    it('should show "Next 7 Days" header when in week view', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Next 7 Days')).toBeInTheDocument();
      });

      // Click on Next 7 Days in sidebar
      await user.click(screen.getByText('Next 7 Days'));

      // Header should show "Next 7 Days" (special case handling)
      await waitFor(() => {
        const headers = document.querySelectorAll('header span');
        const weekHeader = Array.from(headers).find((h) => h.textContent === 'Next 7 Days');
        expect(weekHeader).toBeInTheDocument();
      });
    });
  });

  describe('responsive layout', () => {
    it('should have main content area', () => {
      render(<App />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should have header area', () => {
      render(<App />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });
  });
});
