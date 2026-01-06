import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

// Add providers here as needed (e.g., context providers)
function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Override render with custom render
export { customRender as render };

// Mock data factories
export function createMockTask(overrides = {}) {
  return {
    id: 1,
    title: 'Test Task',
    description: null,
    status: 'pending',
    priority: 2,
    importance: 2,
    projectId: null,
    startDate: null,
    dueDate: null,
    snoozedUntil: null,
    estimatedMinutes: null,
    actualMinutes: null,
    parentId: null,
    sortOrder: 0,
    recurrenceType: 'none',
    recurrenceRule: null,
    recurrenceEndDate: null,
    lastRecurrence: null,
    tags: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    notifyAt: null,
    notificationSent: false,
    notificationChannel: null,
    notificationSnoozedUntil: null,
    ...overrides,
  };
}

export function createMockProject(overrides = {}) {
  return {
    id: 1,
    name: 'Test Project',
    description: null,
    githubRepo: null,
    color: '#6366f1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockHabit(overrides = {}) {
  return {
    id: 1,
    name: 'Test Habit',
    description: null,
    frequency: 'daily',
    frequencyDays: null,
    targetCount: 1,
    color: '#6366f1',
    reminderTime: null,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
