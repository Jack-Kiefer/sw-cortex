# sw-cortex

Personal work intelligence platform for Jack. Answers questions, accesses databases, monitors Slack, searches knowledge base, and automates daily workflows.

## Tech Stack

- **Language**: TypeScript
- **Databases**: MySQL (WishDesk, Live SugarWish), PostgreSQL (Odoo, Retool), SQLite (local discoveries)
- **Vector DB**: Qdrant (Slack message search, discoveries)
- **Embeddings**: OpenAI
- **Process Mgmt**: PM2
- **Automation**: n8n (self-hosted)

## MCP Servers

This workspace has 5 MCP servers that provide tools for Claude to use:

| Server           | Purpose                             | Tools   |
| ---------------- | ----------------------------------- | ------- |
| **discoveries**  | Knowledge base for insights         | 8 tools |
| **slack-search** | Semantic search over Slack messages | 4 tools |
| **logs**         | System log search and analysis      | 4 tools |
| **db**           | Database queries (read-only)        | 4 tools |
| **github**       | GitHub repo access (read-only)      | 9 tools |

See `~/CLAUDE.md` for full MCP tool documentation (synced globally).

## Project Structure

```
sw-cortex/
├── CLAUDE.md              # You are here
├── .claude/               # Claude Code configuration
│   ├── commands/          # Slash commands (/analyze, etc.)
│   ├── rules/             # Modular rules (auto-loaded)
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
│   ├── db/                # Local SQLite schema (Drizzle)
│   └── types/             # TypeScript types
├── global-config/         # Global Claude config (syncs to ~/.claude)
├── workflows/             # Automation configs (n8n, retool)
├── knowledge/             # Local data (slack index, meetings)
└── scripts/               # Utility scripts
```

## DX Commands

```bash
# Data Sync
npm run slack:sync       # Sync Slack messages to Qdrant
npm run meetings:sync    # Sync meeting notes to Qdrant
npm run sync:all         # Sync meetings + Slack

# Qdrant Vector Database
npm run qdrant:init      # Initialize all registered collections
npm run qdrant:status    # Show collection status

# Code Quality
npm run typecheck        # Run TypeScript checks
npm run format           # Prettier format all
npm run lint             # ESLint check

# Global Config
bash scripts/sync-global-config.sh push   # Export to ~/.claude
bash scripts/sync-global-config.sh pull   # Import from ~/.claude
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

| Collection                 | Alias                              | Vector Size | Purpose                          |
| -------------------------- | ---------------------------------- | ----------- | -------------------------------- |
| `slack_messages_encrypted` | `slack_messages_encrypted_current` | 1536        | Slack message search (encrypted) |
| `discoveries_encrypted`    | `discoveries_enc_current`          | 1536        | Knowledge base (encrypted)       |

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

### n8n

- Self-hosted instance
- Workflow exports stored in `workflows/n8n/`
- Daily digest workflow runs at 8:00 AM

### Retool

- Configs stored in `workflows/retool/`
- PostgreSQL database queries documented

## Code Style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Prefer functional patterns
- Use Drizzle ORM for local database operations
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

Required in `.env` (not committed). See `.env.example` for all options.

Core variables for Slack search:

```
SLACK_USER_TOKEN=     # Slack user token (xoxp-*)
ENCRYPTION_KEY=       # AES-256-GCM key for Qdrant data (openssl rand -hex 32)
OPENAI_API_KEY=       # For generating embeddings
QDRANT_URL=           # Qdrant Cloud URL
QDRANT_API_KEY=       # Qdrant API key
```

Optional for other MCP servers:

```
GITHUB_TOKEN=         # GitHub personal access token
WISHDESK_DB_HOST=     # Database connections (see .env.example)
ODOO_DB_HOST=         # etc.
```

---

_Add to this file whenever Claude makes a mistake, so it learns._
