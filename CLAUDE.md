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

| Server | Purpose | Tools |
|--------|---------|-------|
| **task-manager** | Tasks, reminders, projects | 13 tools |
| **db** | Database queries (read-only) | 4 tools |
| **github** | GitHub repo access (read-only) | 9 tools |

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

## DX Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run typecheck        # Run TypeScript checks

# Task Management
npm run task:serve       # Start task MCP server (auto-creates DB)

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode

# Formatting & Linting
npm run format           # Prettier format all
npm run lint             # ESLint check
```

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
Every significant change should have verification. Use the `verify-app` subagent or write explicit test commands.

## Database Access (mcp__db__*)

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

## Integrations

### Slack
- Bot token configured for messaging
- Vector search via Qdrant for message history
- Reminders delivered as DMs

### GitHub (Read-Only)
- Repos: SERP, SWAC, sugarwish-odoo, sugarwish-laravel
- MCP Tools:
  - `mcp__github__list_repos` - List configured repos
  - `mcp__github__search_code` - Search code across repos
  - `mcp__github__get_file` - Get file contents
  - `mcp__github__list_files` - List directory contents
  - `mcp__github__list_commits` - List recent commits
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

## Subagents

### code-simplifier
Runs after completing a feature to simplify and clean up code. Reduces complexity without changing functionality.

### verify-app
Tests the application end-to-end after changes. Documents results and catches regressions.

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
QDRANT_HOST=
QDRANT_API_KEY=

# n8n
N8N_HOST=
N8N_API_KEY=

# GitHub
GITHUB_TOKEN=
```

## Quick Reference

### Task Management (mcp__task-manager__*)
| Need to... | Do this |
|------------|---------|
| Add a task | `mcp__task-manager__add_task { title, description?, project?, priority? }` |
| List tasks | `mcp__task-manager__list_tasks { status?, project? }` |
| Update a task | `mcp__task-manager__update_task { id, status?, title?, priority? }` |
| Complete a task | `mcp__task-manager__complete_task { id }` |
| Snooze a task | `mcp__task-manager__snooze_task { id, duration }` (e.g., "2h", "1d") |
| Move to project | `mcp__task-manager__move_task { id, project }` |
| Delete a task | `mcp__task-manager__delete_task { id }` |
| Set reminder | `mcp__task-manager__add_reminder { message, remindAt }` |
| List reminders | `mcp__task-manager__list_reminders { status? }` |
| Cancel reminder | `mcp__task-manager__cancel_reminder { id }` |
| List projects | `mcp__task-manager__list_projects` |
| Create project | `mcp__task-manager__create_project { name, description?, githubRepo? }` |

### Database Access (mcp__db__*)
| Need to... | Do this |
|------------|---------|
| List databases | `mcp__db__list_databases` |
| List tables | `mcp__db__list_tables { database }` |
| Describe table | `mcp__db__describe_table { database, table }` |
| Query database | `mcp__db__query_database { database, query, limit? }` |

### GitHub Access (mcp__github__*)
| Need to... | Do this |
|------------|---------|
| List repos | `mcp__github__list_repos` |
| Search code | `mcp__github__search_code { query, repo? }` |
| Get file | `mcp__github__get_file { repo, path, ref? }` |
| List files | `mcp__github__list_files { repo, path? }` |
| List branches | `mcp__github__list_branches { repo }` |
| List commits | `mcp__github__list_commits { repo, branch?, path? }` |
| List PRs | `mcp__github__list_pull_requests { repo, state? }` |
| Get PR details | `mcp__github__get_pull_request { repo, pr_number }` |

### Slash Commands
| Need to... | Do this |
|------------|---------|
| Add task quickly | `/task add [title]` |
| List tasks | `/task list` |
| Set reminder | `/remind [message] in [duration]` |
| Create PR | `/commit-push-pr` |
| Deep analysis | `/analyze [description]` |

---

## When in Doubt, Search

**Always use WebSearch when uncertain about:**
- Current API documentation or syntax
- Library versions and compatibility
- Error messages you don't recognize
- Best practices for unfamiliar tools
- How something works in production systems

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

*Add to this file whenever Claude makes a mistake, so it learns.*
