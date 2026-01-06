/**
 * MSW Server Setup for Node.js tests
 *
 * This sets up the MSW server for intercepting API requests during tests.
 */

import { setupServer } from 'msw/node';
import { handlers, resetMockData } from './handlers.js';

// Create the MSW server instance with handlers
export const server = setupServer(...handlers);

// Re-export utilities for tests
export { resetMockData };
