/**
 * MSW API Handlers for testing
 *
 * Placeholder handlers - web UI is currently a placeholder.
 * MCP servers are tested via their service modules.
 */

import { http, HttpResponse } from 'msw';

// Reset function for tests (no-op since no mock data)
export function resetMockData() {
  // No mock data to reset
}

export const handlers = [
  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),
];
