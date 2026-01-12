# sw-cortex

Personal work intelligence platform for Jack. Answers questions, accesses databases, monitors Slack, searches knowledge base, and automates daily workflows.

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js + TypeScript, Drizzle ORM
- **Databases**: MySQL (WishDesk, Live SugarWish), PostgreSQL (Odoo, Retool)
- **Vector DB**: Qdrant (Slack message search, discoveries)
- **Process Mgmt**: PM2
- **Automation**: n8n (self-hosted)
- **Notifications**: Slack

## MCP Servers

This workspace has 5 MCP servers that provide tools for Claude to use:

| Server           | Purpose                             | Tools   |
| ---------------- | ----------------------------------- | ------- |
| **discoveries**  | Knowledge base for insights         | 8 tools |
| **slack-search** | Semantic search over Slack messages | 4 tools |
| **logs**         | System log search and analysis      | 4 tools |
| **db**           | Database queries (read-only)        | 4 tools |
| **github**       | GitHub repo access (read-only)      | 9 tools |

## Project Structure

```
sw-cortex/
├── CLAUDE.md              # You are here
├── .claude/               # Claude Code configuration
│   ├── commands/          # Slash commands (/analyze, etc.)
│   ├── rules/             # Modular memory (auto-loaded)
│   └── agents/            # Subagents (code-simplifier, verify-app)
├── .mcp.json              # MCP server config
├── src/                   # Application source code
│   ├── mcp-servers/       # Custom MCP servers
│   │   ├── discoveries/   # Knowledge base management
│   │   ├── slack-search/  # Slack message search
│   │   ├── logs/          # Log analysis
│   │   ├── db/            # Database access
│   │   └── github/        # GitHub access
│   ├── services/          # Shared backend services
│   ├── qdrant/            # Qdrant vector DB module
│   ├── db/                # Local database schema (Drizzle)
│   └── types/             # TypeScript types
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

## Slash Commands

- `/commit-push-pr` - Commit, push, and create PR
- `/analyze [description]` - Deep pre-implementation analysis
- `/quick-analyze [description]` - Quick codebase assessment
- `/slack-search [query]` - Search Slack messages

## Workflow

### Starting a Session

1. **Plan Mode First** (shift+tab twice) - Get alignment before coding
2. Review the plan with Claude until satisfied
3. Switch to auto-accept mode for implementation
4. Use `/commit-push-pr` when done

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

Qdrant is used for semantic search over Slack messages and discoveries.

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
| `discoveries`    | `discoveries_current`    | 1536        | Knowledge base       |

### Adding New Collections

1. Create schema in `src/qdrant/schemas/my-collection.ts`
2. Export from `src/qdrant/schemas/index.ts`
3. Register in `src/qdrant/collections.ts`
4. Run `npm run qdrant:init`

See `src/qdrant/README.md` for detailed documentation.

## Integrations

### Slack

- Bot token configured for messaging
- Vector search via Qdrant for message history

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

### Discoveries (mcp**discoveries**\*)

Save and search database/codebase insights.

| Need to...         | Do this                                                  |
| ------------------ | -------------------------------------------------------- |
| Save a discovery   | `mcp__discoveries__add_discovery { title, source, ... }` |
| Search discoveries | `mcp__discoveries__search_discoveries { query }`         |
| List discoveries   | `mcp__discoveries__list_discoveries { source?, type? }`  |
| Get discovery      | `mcp__discoveries__get_discovery { id }`                 |
| Update discovery   | `mcp__discoveries__update_discovery { id, ... }`         |
| Delete discovery   | `mcp__discoveries__delete_discovery { id }`              |
| Export discoveries | `mcp__discoveries__export_discoveries { format? }`       |
| Get table notes    | `mcp__discoveries__get_table_notes { database, table }`  |

### Slack Search (mcp**slack-search**\*)

Semantic search across Jack's Slack history. **Use this when:**

- Looking for past discussions about a topic
- Finding who said something or when
- Searching for decisions, context, or background info
- User asks "what did we discuss about X" or "find that Slack message about Y"

| Need to...        | Do this                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| Search messages   | `mcp__slack-search__search_slack_messages { query, afterDate?, limit? }` |
| Get context       | `mcp__slack-search__get_slack_context { channelId, timestamp }`          |
| Get thread        | `mcp__slack-search__get_slack_thread { channelId, threadTs }`            |
| Check sync status | `mcp__slack-search__get_slack_sync_status`                               |

**Workflow**: Search first, then get context for interesting results:

```
# 1. Search for topic
mcp__slack-search__search_slack_messages { query: "purchase order approval" }

# 2. Get surrounding conversation (use channelId + timestamp from results)
mcp__slack-search__get_slack_context { channelId: "C123", timestamp: 1704067200 }
```

### Logs (mcp**logs**\*)

Search and analyze sw-cortex service logs.

| Need to...     | Do this                                                        |
| -------------- | -------------------------------------------------------------- |
| Search logs    | `mcp__logs__search_logs { service?, level?, search?, since? }` |
| Recent logs    | `mcp__logs__get_recent_logs { limit? }`                        |
| Recent errors  | `mcp__logs__get_recent_errors { limit? }`                      |
| Log statistics | `mcp__logs__get_log_stats`                                     |

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

---

## When in Doubt, Search

**Always use WebSearch when uncertain about:**

- Current API documentation or syntax
- Library versions and compatibility
- Error messages you don't recognize
- Best practices for unfamiliar tools
- How something works in production systems

**Use Slack search for past conversations:**

- "What did we discuss about X?" → `mcp__slack-search__search_slack_messages`
- Historical context on decisions
- Finding who said something

Don't guess - search first, then act with confidence.

---

_Add to this file whenever Claude makes a mistake, so it learns._
