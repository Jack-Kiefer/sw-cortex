#!/usr/bin/env node

import 'dotenv/config';

/**
 * Sessions MCP Server — the "session mesh"
 *
 * Gives every Claude Code session a live view of all the OTHER sessions running
 * on this machine, so they can see what each other are doing, detect when two
 * are working the same thing, read a peer's output, and message a peer.
 *
 * Data source: the Herdr socket API (the `herdr` CLI). Every session runs in a
 * Herdr pane; `herdr agent list` reports each pane's repo, live status, and
 * current task (the tab title the session keeps updated). We fuse that into a
 * unified board — no new store, always reflecting live state.
 *
 * Tools:
 * - list_sessions:   the unified board — every running session, repo, status, task, pane_id
 * - check_overlap:   given a task, find peers already working the same thing (PR#, ticket, task text)
 * - read_session:    read a peer session's recent terminal output
 * - message_session: send a message to a peer session (lands as a prompt in its queue)
 *
 * Coordination policy (see the Session Mesh section of ~/CLAUDE.md):
 *   • On launch, a session calls check_overlap on its own task.
 *   • If it overlaps a peer, it sends ONE heads-up via message_session and tells Jack.
 *   • Otherwise, no chatter — sessions observe, they don't constantly cross-talk,
 *     and they never drive another session.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  listSessions,
  checkOverlap,
  readSession,
  messageSession,
} from '../../services/sessions.js';

// The caller's own pane, so it can exclude itself from the board / overlap scan.
const SELF_PANE = process.env.HERDR_PANE_ID || undefined;

const tools: Tool[] = [
  {
    name: 'list_sessions',
    description:
      'The unified board of every Claude Code session running on this machine right now. ' +
      'Returns each session as { name, repo, status, task, cwd, paneId, focused, isSelf } — ' +
      'name is the address to message it, task is its live tab title (what it is currently ' +
      'doing), status is working|idle|done|blocked, and paneId is the handle for read_session. ' +
      'Use this to see what everything else is working on and where to look.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_overlap',
    description:
      'Given the task THIS session is about to work on, find any other running session that ' +
      'appears to be working the same thing (a shared PR number, a shared WW ticket, the same ' +
      'worktree, or strongly similar task text). Returns { task, overlaps[], suggestedPeer }. ' +
      'A launching session should call this early. If there IS an overlap, send the suggestedPeer ' +
      'ONE heads-up with message_session and tell Jack — do not silently collide, and do not ' +
      'chatter beyond the single heads-up.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            "This session's task text — its /go description, ticket id, PR number, or tab title. " +
            'The more specific (PR #, WW-####, file/worktree name), the better the match.',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'read_session',
    description:
      "Read a peer session's recent terminal output, to see in detail what it is doing " +
      "(more than the one-line task from list_sessions). Pass the peer's paneId (from " +
      'list_sessions or check_overlap).',
    inputSchema: {
      type: 'object',
      properties: {
        paneId: {
          type: 'string',
          description: 'The peer session\'s Herdr pane id, e.g. "w8:p2C".',
        },
        lines: {
          type: 'number',
          description: 'How many trailing lines of output to return (default 60).',
        },
      },
      required: ['paneId'],
    },
  },
  {
    name: 'message_session',
    description:
      "Send a message to a peer session. It lands as a prompt in that session's queue and it " +
      'will respond on its next turn. Use for the single overlap heads-up, a coordination note, ' +
      'or a question. This is a MESSAGE, not a handoff — it does not drive or wait on the peer. ' +
      "Per Jack's policy, message a peer only when it matters (e.g. you overlap it), not as " +
      'constant back-and-forth.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'The peer to message — its paneId (e.g. "w8:p2C") from list_sessions/check_overlap.',
        },
        text: { type: 'string', description: 'The message text.' },
      },
      required: ['target', 'text'],
    },
  },
];

const server = new Server({ name: 'sessions', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'list_sessions': {
        const sessions = await listSessions(SELF_PANE);
        result = sessions.map((s) => ({ name: s.paneId, ...s }));
        break;
      }
      case 'check_overlap': {
        const task = (args as { task?: string })?.task;
        if (!task) throw new Error('check_overlap requires a "task" argument');
        result = await checkOverlap(task, SELF_PANE);
        break;
      }
      case 'read_session': {
        const { paneId, lines } = (args as { paneId?: string; lines?: number }) ?? {};
        if (!paneId) throw new Error('read_session requires a "paneId" argument');
        result = { paneId, output: await readSession(paneId, lines) };
        break;
      }
      case 'message_session': {
        const { target, text } = (args as { target?: string; text?: string }) ?? {};
        if (!target || !text)
          throw new Error('message_session requires "target" and "text" arguments');
        result = { status: await messageSession(target, text) };
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Sessions MCP Server v1.0.0 running on stdio');
}

main().catch(console.error);
