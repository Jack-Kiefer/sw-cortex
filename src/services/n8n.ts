/**
 * n8n Service - Read-Only Access
 *
 * Reads workflows and executions from the live self-hosted n8n instance via
 * its public REST API (/api/v1). Configured with:
 *   - N8N_HOST     base URL of the instance (e.g. http://localhost:5678)
 *   - N8N_API_KEY  a personal API key (Settings → n8n API), sent as X-N8N-API-KEY
 *
 * NO write operations are exposed here — list/get only. This mirrors the
 * read-only posture of the github/db/logs MCP servers.
 */

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecutionSummary {
  id: string;
  workflowId?: string;
  finished?: boolean;
  status?: string;
  mode?: string;
  startedAt?: string;
  stoppedAt?: string;
}

interface N8nListResponse<T> {
  data: T[];
  nextCursor?: string | null;
}

function getConfig(): { host: string; apiKey: string } {
  const host = (process.env.N8N_HOST ?? '').replace(/\/+$/, '');
  const apiKey = process.env.N8N_API_KEY ?? '';
  if (!host) {
    throw new Error('N8N_HOST environment variable not set (e.g. http://localhost:5678).');
  }
  if (!apiKey) {
    throw new Error(
      'N8N_API_KEY environment variable not set. Create one in n8n → Settings → n8n API.'
    );
  }
  return { host, apiKey };
}

async function apiRequest<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  const { host, apiKey } = getConfig();
  const url = new URL(`${host}/api/v1${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 401 means the API key is wrong/expired, not a code problem — translate it
    // into the exact fix so the key gets refreshed instead of retried blindly.
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `n8n authentication failed (HTTP ${res.status}). The N8N_API_KEY is likely wrong, ` +
          `expired, or lacks scope. Fix: create a new key in n8n → Settings → n8n API, update ` +
          `N8N_API_KEY in sw-cortex/.env, then restart Claude Code so the n8n MCP server reloads it. ` +
          `(Base URL in use: ${host})`
      );
    }
    throw new Error(`n8n API error (HTTP ${res.status}) for ${path}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

/**
 * List workflows (summary only — no node bodies). Newest-updated first.
 */
export async function listWorkflows(opts?: {
  active?: boolean;
  limit?: number;
}): Promise<WorkflowSummary[]> {
  const query: Record<string, string | number> = { limit: opts?.limit ?? 100 };
  if (typeof opts?.active === 'boolean') query.active = String(opts.active);

  const res = await apiRequest<N8nListResponse<Record<string, unknown>>>('/workflows', query);
  return (res.data ?? []).map(summarizeWorkflow);
}

/**
 * Get one workflow's full JSON (nodes, connections, settings).
 */
export async function getWorkflow(id: string): Promise<unknown> {
  if (!id) throw new Error('getWorkflow requires a workflow id.');
  return apiRequest<unknown>(`/workflows/${encodeURIComponent(id)}`);
}

/**
 * List recent executions (run history), newest first. Optionally filter by
 * workflow id and/or status.
 */
export async function listExecutions(opts?: {
  workflowId?: string;
  status?: 'success' | 'error' | 'waiting';
  limit?: number;
}): Promise<ExecutionSummary[]> {
  const query: Record<string, string | number> = { limit: opts?.limit ?? 20 };
  if (opts?.workflowId) query.workflowId = opts.workflowId;
  if (opts?.status) query.status = opts.status;

  const res = await apiRequest<N8nListResponse<Record<string, unknown>>>('/executions', query);
  return (res.data ?? []).map(summarizeExecution);
}

/**
 * Get one execution's detail. Pass includeData to pull the full run data
 * (node inputs/outputs) — omit it for a lighter summary.
 */
export async function getExecution(id: string, includeData?: boolean): Promise<unknown> {
  if (!id) throw new Error('getExecution requires an execution id.');
  return apiRequest<unknown>(`/executions/${encodeURIComponent(id)}`, {
    includeData: includeData ? 'true' : '',
  });
}

function summarizeWorkflow(w: Record<string, unknown>): WorkflowSummary {
  const tags = Array.isArray(w.tags)
    ? (w.tags as Array<Record<string, unknown>>)
        .map((t) => String(t.name ?? t.id ?? ''))
        .filter(Boolean)
    : [];
  return {
    id: String(w.id ?? ''),
    name: String(w.name ?? ''),
    active: Boolean(w.active),
    tags,
    createdAt: w.createdAt ? String(w.createdAt) : undefined,
    updatedAt: w.updatedAt ? String(w.updatedAt) : undefined,
  };
}

function summarizeExecution(e: Record<string, unknown>): ExecutionSummary {
  return {
    id: String(e.id ?? ''),
    workflowId: e.workflowId != null ? String(e.workflowId) : undefined,
    finished: typeof e.finished === 'boolean' ? e.finished : undefined,
    status: e.status ? String(e.status) : undefined,
    mode: e.mode ? String(e.mode) : undefined,
    startedAt: e.startedAt ? String(e.startedAt) : undefined,
    stoppedAt: e.stoppedAt ? String(e.stoppedAt) : undefined,
  };
}
