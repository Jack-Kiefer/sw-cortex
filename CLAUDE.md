# sw-cortex

Personal work intelligence platform for Jack. Answers questions, manages tasks, accesses databases, monitors Slack, and automates daily workflows.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js + TypeScript, Drizzle ORM
- **Databases**: MySQL (WishDesk, Live SugarWish), PostgreSQL (Odoo, Retool)
- **Vector DB**: Qdrant (Slack message search)
- **Process Mgmt**: PM2
- **Automation**: n8n (self-hosted)
- **Notifications**: Slack

## MCP Servers

This workspace has 3 MCP servers that provide tools for Claude to use:

| Server           | Purpose                        | Tools    |
| ---------------- | ------------------------------ | -------- |
| **task-manager** | Tasks, reminders, projects     | 13 tools |
| **db**           | Database queries (read-only)   | 4 tools  |
| **github**       | GitHub repo access (read-only) | 9 tools  |

**IMPORTANT**: When working on multi-step problems, use the task-manager tools to track progress:

1. Create tasks for each step with `mcp__task-manager__add_task`
2. Update status as you work with `mcp__task-manager__update_task`
3. Mark complete when done with `mcp__task-manager__complete_task`

## Project Structure

```
sw-cortex/
├── CLAUDE.md              # You are here
├── .claude/               # Claude Code configuration
│   ├── commands/          # Slash commands (/task, /remind, etc.)
│   ├── rules/             # Modular memory (auto-loaded)
│   └── agents/            # Subagents (code-simplifier, verify-app)
├── .mcp.json              # MCP server config (github, task-manager, db)
├── src/                   # Application source code
│   ├── mcp-servers/       # Custom MCP servers
│   │   ├── task-manager/  # Task/reminder management
│   │   ├── db/            # Database access
│   │   └── github/        # GitHub access
│   ├── services/          # Shared backend services
│   ├── qdrant/            # Qdrant vector DB module
│   ├── db/                # Local database schema (Drizzle)
│   └── types/             # TypeScript types
├── tasks/                 # Task data (SQLite)
├── workflows/             # Automation configs
│   ├── n8n/               # n8n workflow exports
│   └── retool/            # Retool configurations
├── knowledge/             # Vector DB data
│   └── slack/             # Slack message index
└── scripts/               # Utility scripts
```

## Global Config Management

The `global-config/` directory contains commands, skills, and settings that sync to `~/.claude` for use across all projects.

**IMPORTANT: Always sync before and after editing global config files.**

### Editing Global Config

1. **Pull first** to get any external changes:

   ```bash
   bash scripts/sync-global-config.sh pull
   ```

2. **Make your edits** to files in `global-config/`

3. **Push after** to deploy changes:
   ```bash
   bash scripts/sync-global-config.sh push
   ```

Or use the slash command: `/add-global sync push`

### Files Synced

| Source                    | Destination           |
| ------------------------- | --------------------- |
| `global-config/commands/` | `~/.claude/commands/` |
| `global-config/skills/`   | `~/.claude/skills/`   |
| `global-config/CLAUDE.md` | `~/CLAUDE.md`         |
| `global-config/mcp.json`  | `~/.mcp.json`         |

**Restart Claude Code after pushing to pick up changes.**

## DX Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run typecheck        # Run TypeScript checks

# Task Management
npm run task:serve       # Start task MCP server (auto-creates DB)

# Database Migrations (SQLite)
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply pending migrations
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Drizzle Studio GUI

# Qdrant Vector Database
npm run qdrant:init      # Initialize all registered collections
npm run qdrant:status    # Show collection status

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode

# Formatting & Linting
npm run format           # Prettier format all
npm run lint             # ESLint check
```

## SQLite Database Migrations

The local task database uses Drizzle ORM with migrations stored in `drizzle/`.

### Schema Location

- Schema: `src/db/schema.ts`
- Migrations: `drizzle/*.sql`
- Config: `drizzle.config.ts`

### Making Schema Changes

1. Edit `src/db/schema.ts` to add/modify tables or columns
2. Generate migration: `npm run db:generate`
3. Apply migration: `npm run db:migrate`

### Example: Adding a Column

```typescript
// In src/db/schema.ts
export const reminders = sqliteTable('reminders', {
  // ... existing columns
  newColumn: text('new_column'), // Add new column
});
```

Then run:

```bash
npm run db:generate  # Creates drizzle/0001_xxx.sql
npm run db:migrate   # Applies the migration
```

### Quick Development (No Migration)

For rapid iteration, use `db:push` to sync schema directly:

```bash
npm run db:push  # Directly syncs schema (may lose data)
```

**Note:** Use migrations in production, `db:push` only for local dev.

## Testing

The project uses Vitest with React Testing Library for comprehensive testing.

### Test Infrastructure

- **Framework**: Vitest (fast, Vite-native)
- **Component Testing**: @testing-library/react + @testing-library/user-event
- **Environment**: jsdom for DOM simulation
- **Config**: `vitest.config.ts`

### Test Files

| File                                      | Tests | Coverage                                              |
| ----------------------------------------- | ----- | ----------------------------------------------------- |
| `src/services/date-parser.test.ts`        | 34    | Natural language date parsing, formatting, recurrence |
| `src/web/components/TaskItem.test.tsx`    | 17    | Task rendering, priority colors, checkbox, hover menu |
| `src/web/components/QuickAdd.test.tsx`    | 9     | Quick add form, date/priority/project pickers         |
| `src/web/components/ProjectForm.test.tsx` | 10    | Project creation form, validation, color picker       |

### Running Tests

```bash
npm run test           # Watch mode (re-runs on file changes)
npm run test -- --run  # Single run (CI mode)
```

### Test Utilities

Mock factories are available in `src/test/utils.tsx`:

```typescript
import { render, screen, userEvent, createMockTask, createMockProject } from '../../test/utils';

// Create mock data
const task = createMockTask({ title: 'Test', priority: 4 });
const project = createMockProject({ name: 'My Project', color: '#ff0000' });

// Render with providers
render(<MyComponent task={task} />);

// User interactions
const user = userEvent.setup();
await user.click(screen.getByText('Submit'));
```

### Writing New Tests

1. Create test file next to component: `ComponentName.test.tsx`
2. Import test utilities from `src/test/utils`
3. Use `describe`/`it` blocks for organization
4. Mock external dependencies in `src/test/setup.ts`

## Slash Commands

- `/task add [title]` - Add a new task
- `/task list` - List pending tasks
- `/task done [id]` - Mark task complete
- `/remind [message] in [duration]` - Set a reminder
- `/commit-push-pr` - Commit, push, and create PR
- `/analyze [description]` - Deep pre-implementation analysis
- `/quick-analyze [description]` - Quick codebase assessment

## Workflow

### Starting a Session

1. **Plan Mode First** (shift+tab twice) - Get alignment before coding
2. Review the plan with Claude until satisfied
3. Switch to auto-accept mode for implementation
4. Use `/commit-push-pr` when done

### Task Management

1. Use `/task add` for new work items
2. Link tasks to projects when relevant
3. Use `/remind` for time-sensitive items
4. Reminders delivered via Slack DM

### Verification

Every significant change should have verification. **Always spawn the `verify-app` subagent** before committing - no exceptions.

### Use Subagents Liberally

- **Exploring code?** → Spawn `Explore` agent
- **Finished a feature?** → Spawn `code-simplifier`
- **About to commit?** → Spawn `verify-app`
- **Complex investigation?** → Spawn `general-purpose` agent

Subagents keep the main conversation focused and produce better results.

## Database Access (mcp**db**\*)

### Read-Only Policy

All production database access is READ-ONLY. Never run write queries against production.

### Available Databases

- `wishdesk` - WishDesk MySQL
- `sugarwish` - Live SugarWish MySQL
- `odoo` - Odoo PostgreSQL
- `retool` - Retool PostgreSQL

### MCP Tools

```
mcp__db__list_databases      # List available databases
mcp__db__list_tables         # List tables in a database
mcp__db__describe_table      # Get table schema
mcp__db__query_database      # Execute SELECT query
```

### Example Queries

```
# List tables in WishDesk
mcp__db__list_tables { database: "wishdesk" }

# Query Odoo
mcp__db__query_database {
  database: "odoo",
  query: "SELECT * FROM sale_order LIMIT 10"
}

# Describe a table
mcp__db__describe_table { database: "sugarwish", table: "orders" }
```

## Qdrant Vector Database

Qdrant is used for semantic search over Slack messages and other text content.

### Configuration

Environment variables:

```
QDRANT_URL=https://your-instance.cloud.qdrant.io
QDRANT_API_KEY=your-api-key
```

### Collections

Collections are defined in `src/qdrant/schemas/` with TypeScript types and Zod validation.

| Collection       | Alias                    | Vector Size | Purpose              |
| ---------------- | ------------------------ | ----------- | -------------------- |
| `slack_messages` | `slack_messages_current` | 1536        | Slack message search |

### Usage

```typescript
import { getQdrantClient, SlackMessagePayloadSchema } from './qdrant';

// Get client
const client = getQdrantClient();

// Search (always use alias for production)
const results = await client.search('slack_messages_current', {
  vector: queryEmbedding,
  limit: 10,
});

// Validate payload before insertion
const payload = SlackMessagePayloadSchema.parse({
  messageId: '1234567890.123456',
  channelId: 'C123ABC',
  userId: 'U456DEF',
  text: 'Hello world',
  timestamp: Date.now(),
  version: 1,
});
```

### Adding New Collections

1. Create schema in `src/qdrant/schemas/my-collection.ts`
2. Export from `src/qdrant/schemas/index.ts`
3. Register in `src/qdrant/collections.ts`
4. Run `npm run qdrant:init`

See `src/qdrant/README.md` for detailed documentation.

### Migration Strategy

Qdrant has no built-in migrations. Use **collection aliases** for zero-downtime changes:

1. Create new collection with updated schema
2. Migrate data in background
3. Swap alias atomically
4. Delete old collection

## Integrations

### Slack

- Bot token configured for messaging
- Vector search via Qdrant for message history
- Reminders delivered as DMs

### GitHub (Read-Only)

#### Repositories & Branches

| Repo                  | Production | Development      | Staging       | Workflow                           |
| --------------------- | ---------- | ---------------- | ------------- | ---------------------------------- |
| **SERP**              | `main`     | `dev`            | -             | dev → main → auto-deploy (Jenkins) |
| **SWAC**              | `live`     | `development`    | `staging`     | dev → staging → live               |
| **sugarwish-odoo**    | `main`     | -                | `staging_new` | staging_new → main                 |
| **sugarwish-laravel** | `blue`     | feature branches | -             | SUG-\* branches → blue             |

**Environments**:

- SWAC: `desk.sugarwish.com` (live), `desk2.sugarwish.com` (dev), `desk3.sugarwish.com` (staging)
- SERP: Auto-deploys from `main` via Jenkins CI/CD

**IMPORTANT - Always specify the correct branch**:

- When exploring current/active work, use the **Development** or **Staging** branch
- When checking production code, use the **Production** branch
- If unsure which branch, **ask the user** or use `list_branches` to see options
- **Never assume `main` is correct** - check the table above

Use `ref` parameter to specify branch/tag/commit:

```
# Get file from specific branch
mcp__github__get_file { repo: "sugarwish-odoo", path: "file.py", ref: "development" }

# List files from staging
mcp__github__list_files { repo: "sugarwish-odoo", path: "models", ref: "staging" }

# Get commits from dev branch
mcp__github__list_commits { repo: "SERP", branch: "dev" }
```

Without `ref`, tools default to the repo's default branch (usually `main`).

#### MCP Tools

- `mcp__github__list_repos` - List configured repos
- `mcp__github__search_code` - Search code across repos
- `mcp__github__get_file` - Get file contents (supports `ref`)
- `mcp__github__list_files` - List directory contents (supports `ref`)
- `mcp__github__list_branches` - List all branches in a repo
- `mcp__github__list_commits` - List recent commits (supports `branch`)
- `mcp__github__list_pull_requests` - List PRs
- `mcp__github__get_pull_request` - Get PR details

### n8n

- Self-hosted instance
- Workflow exports stored in `workflows/n8n/`
- Daily digest workflow runs at 8:00 AM

### Retool

- Configs stored in `workflows/retool/`
- PostgreSQL database queries documented

## Code Style

- TypeScript strict mode
- Prettier for formatting (runs on save via hook)
- ESLint for linting
- Prefer functional patterns
- Use Drizzle ORM for all database operations
- Environment variables for all secrets

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Use `/commit-push-pr` for standard workflow
- Plan mode before significant changes
- Squash commits for clean history

## Common Mistakes to Avoid

- Don't hardcode credentials (use .env)
- Don't run write queries on production DBs
- Don't skip Plan mode for complex changes
- Don't forget to verify changes work
- Don't commit without running tests

## Subagents (Use Frequently!)

**IMPORTANT**: Spawn subagents liberally. They run in parallel, reduce context bloat, and produce better results than doing everything inline. When in doubt, spawn an agent.

### When to Spawn Subagents

| Situation             | Agent                        | Why                        |
| --------------------- | ---------------------------- | -------------------------- |
| After writing code    | `code-simplifier`            | Clean up before committing |
| Before committing     | `verify-app`                 | Catch issues early         |
| Exploring codebase    | `Explore` (built-in)         | Preserves main context     |
| Multi-file search     | `Explore` (built-in)         | More thorough than inline  |
| Complex investigation | `general-purpose` (built-in) | Deep dive without bloat    |

### Available Subagents

#### code-simplifier

**Run after completing any feature.** Simplifies code, removes dead code, improves naming, extracts patterns. Always run this before committing new features.

```
Spawn: Task tool with subagent_type="code-simplifier"
```

#### verify-app

**Run before every commit.** Runs typecheck, lint, tests, and checks for debug statements. This is your quality gate.

```
Spawn: Task tool with subagent_type="verify-app"
```

### Subagent Best Practices

1. **Spawn early, spawn often** - Don't try to do everything in the main conversation
2. **Run agents in parallel** - Multiple Task calls in one message
3. **Use for exploration** - Keep main context clean for implementation
4. **Always verify-app before commits** - No exceptions
5. **Always code-simplifier after features** - Catch complexity before it spreads

### Example: Feature Implementation Flow

```
1. Plan the feature (main conversation)
2. Implement the feature (main conversation)
3. Spawn code-simplifier → cleans up the code
4. Spawn verify-app → confirms everything works
5. Commit with confidence
```

## Environment Variables

Required in `.env.local` (not committed):

```
# Databases
WISHDESK_DB_HOST=
WISHDESK_DB_USER=
WISHDESK_DB_PASSWORD=
SUGARWISH_DB_HOST=
SUGARWISH_DB_USER=
SUGARWISH_DB_PASSWORD=
ODOO_DB_HOST=
ODOO_DB_USER=
ODOO_DB_PASSWORD=
RETOOL_DB_HOST=
RETOOL_DB_USER=
RETOOL_DB_PASSWORD=

# SSH Tunnel
SSH_BASTION_HOST=
SSH_BASTION_USER=
SSH_KEY_PATH=

# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Qdrant
QDRANT_URL=
QDRANT_API_KEY=

# n8n
N8N_HOST=
N8N_API_KEY=

# GitHub
GITHUB_TOKEN=
```

## Quick Reference

### Task Management (mcp**task-manager**\*)

| Need to...      | Do this                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| Add a task      | `mcp__task-manager__add_task { title, description?, project?, priority? }` |
| List tasks      | `mcp__task-manager__list_tasks { status?, project? }`                      |
| Update a task   | `mcp__task-manager__update_task { id, status?, title?, priority? }`        |
| Complete a task | `mcp__task-manager__complete_task { id }`                                  |
| Snooze a task   | `mcp__task-manager__snooze_task { id, duration }` (e.g., "2h", "1d")       |
| Move to project | `mcp__task-manager__move_task { id, project }`                             |
| Delete a task   | `mcp__task-manager__delete_task { id }`                                    |
| Set reminder    | `mcp__task-manager__add_reminder { message, remindAt }`                    |
| List reminders  | `mcp__task-manager__list_reminders { status? }`                            |
| Cancel reminder | `mcp__task-manager__cancel_reminder { id }`                                |
| List projects   | `mcp__task-manager__list_projects`                                         |
| Create project  | `mcp__task-manager__create_project { name, description?, githubRepo? }`    |

### Database Access (mcp**db**\*)

| Need to...     | Do this                                               |
| -------------- | ----------------------------------------------------- |
| List databases | `mcp__db__list_databases`                             |
| List tables    | `mcp__db__list_tables { database }`                   |
| Describe table | `mcp__db__describe_table { database, table }`         |
| Query database | `mcp__db__query_database { database, query, limit? }` |

### GitHub Access (mcp**github**\*)

| Need to...     | Do this                                              |
| -------------- | ---------------------------------------------------- |
| List repos     | `mcp__github__list_repos`                            |
| Search code    | `mcp__github__search_code { query, repo? }`          |
| Get file       | `mcp__github__get_file { repo, path, ref? }`         |
| List files     | `mcp__github__list_files { repo, path? }`            |
| List branches  | `mcp__github__list_branches { repo }`                |
| List commits   | `mcp__github__list_commits { repo, branch?, path? }` |
| List PRs       | `mcp__github__list_pull_requests { repo, state? }`   |
| Get PR details | `mcp__github__get_pull_request { repo, pr_number }`  |

### Slack Search (mcp**task-manager**\*)

Semantic search across Jack's Slack history. **Use this when:**

- Looking for past discussions about a topic
- Finding who said something or when
- Searching for decisions, context, or background info
- User asks "what did we discuss about X" or "find that Slack message about Y"

| Tool                    | Purpose                           |
| ----------------------- | --------------------------------- |
| `search_slack_messages` | Semantic search by topic          |
| `get_slack_context`     | Get conversation around a message |

**Workflow**: Search first, then get context for interesting results:

```
# 1. Search for topic
mcp__task-manager__search_slack_messages { query: "purchase order approval" }

# 2. Get surrounding conversation (use channelId + timestamp from results)
mcp__task-manager__get_slack_context { channelId: "C123", timestamp: 1704067200, windowMinutes: 60 }
```

| Parameter       | Description                             |
| --------------- | --------------------------------------- |
| `query`         | Natural language search (required)      |
| `limit`         | Max results (default 10)                |
| `channelId`     | Filter to specific channel              |
| `minScore`      | Similarity threshold 0-1 (default 0.3)  |
| `timestamp`     | Unix timestamp to center context around |
| `windowMinutes` | Time window +/- minutes (default 30)    |

### Slash Commands

| Need to...       | Do this                           |
| ---------------- | --------------------------------- |
| Add task quickly | `/task add [title]`               |
| List tasks       | `/task list`                      |
| Set reminder     | `/remind [message] in [duration]` |
| Create PR        | `/commit-push-pr`                 |
| Deep analysis    | `/analyze [description]`          |

---

## When in Doubt, Search

**Always use WebSearch when uncertain about:**

- Current API documentation or syntax
- Library versions and compatibility
- Error messages you don't recognize
- Best practices for unfamiliar tools
- How something works in production systems

**Use Slack search for past conversations:**

- "What did we discuss about X?" → `mcp__task-manager__search_slack_messages`
- Historical context on decisions
- Finding who said something

Don't guess - search first, then act with confidence.

## Working on Problems

When solving multi-step problems or bugs:

1. **Create a task** to track the work:

   ```
   mcp__task-manager__add_task { title: "Fix login bug", project: "SERP" }
   ```

2. **Break down into subtasks** if complex:

   ```
   mcp__task-manager__add_task { title: "Investigate auth flow", project: "SERP" }
   mcp__task-manager__add_task { title: "Fix token validation", project: "SERP" }
   mcp__task-manager__add_task { title: "Add tests", project: "SERP" }
   ```

3. **Query databases** to understand data:

   ```
   mcp__db__query_database { database: "sugarwish", query: "SELECT * FROM users WHERE..." }
   ```

4. **Search GitHub** for related code:

   ```
   mcp__github__search_code { query: "validateToken", repo: "SERP" }
   ```

5. **Mark tasks complete** as you finish:

   ```
   mcp__task-manager__complete_task { id: 1 }
   ```

6. **Set reminders** for follow-ups:
   ```
   mcp__task-manager__add_reminder { message: "Check if fix deployed", remindAt: "2h" }
   ```

---

_Add to this file whenever Claude makes a mistake, so it learns._
