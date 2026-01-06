import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import ProjectForm from './ProjectForm';

describe('ProjectForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with all fields', () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText('New Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onSubmit with form data when submitted', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill in the form
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'My New Project');

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.type(descriptionInput, 'Project description');

    // Submit the form
    await user.click(screen.getByText('Create Project'));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: 'My New Project',
      description: 'Project description',
      color: '#6366f1', // Default color (indigo)
    });
  });

  it('should call onSubmit without description if not provided', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill in only the name
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'Simple Project');

    // Submit the form
    await user.click(screen.getByText('Create Project'));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: 'Simple Project',
      description: undefined,
      color: '#6366f1',
    });
  });

  it('should not submit with empty name', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Try to submit without entering a name
    const submitButton = screen.getByText('Create Project');
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await user.click(screen.getByText('Cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onCancel when X button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Find and click the X button
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find((btn) => btn.querySelector('svg.lucide-x') !== null);
    if (closeButton) {
      await user.click(closeButton);
    }

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should render color picker with multiple options', () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Should have 8 color options based on the component
    const colorButtons = screen.getAllByRole('button').filter((btn) => {
      const style = btn.getAttribute('style');
      return style?.includes('background-color');
    });

    expect(colorButtons.length).toBe(8);
  });

  it('should update selected color when color button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Find and click a different color (red)
    const colorButtons = screen.getAllByRole('button').filter((btn) => {
      const style = btn.getAttribute('style');
      return style?.includes('background-color: rgb(239, 68, 68)'); // red
    });

    if (colorButtons.length > 0) {
      await user.click(colorButtons[0]);
    }

    // Fill in name and submit
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'Red Project');
    await user.click(screen.getByText('Create Project'));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Red Project',
        color: '#ef4444', // Red color
      })
    );
  });

  it('should trim whitespace from name', async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, '  Trimmed Name  ');

    await user.click(screen.getByText('Create Project'));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Trimmed Name',
      })
    );
  });

  it('should auto-focus name input', () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const nameInput = screen.getByLabelText(/name/i);
    expect(document.activeElement).toBe(nameInput);
  });
});
