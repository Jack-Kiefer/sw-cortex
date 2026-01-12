# sw-cortex

Personal work intelligence platform. Manage tasks, query databases, search Slack history, generate n8n workflows, and integrate with Claude Code.

## Features

- **Task Management**: TickTick-style tasks with projects, priorities, Eisenhower matrix
- **Database Access**: Read-only queries against MySQL/PostgreSQL databases
- **Slack Search**: Semantic search over your Slack message history
- **GitHub Access**: Browse and search configured repositories
- **Discoveries**: Knowledge base for database insights and learnings
- **n8n Workflows**: Generate workflow JSON for import into n8n
- **Claude Code Integration**: MCP servers for AI-assisted development

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/youruser/sw-cortex.git
cd sw-cortex
npm install
```

### 2. Run Setup

```bash
npm run setup
```

This interactive script will:

- Create `.env` from template
- Generate `~/.mcp.json` with correct paths
- Generate `~/CLAUDE.md` for global Claude config
- Set up required directories

### 3. Configure Credentials

Edit `.env` with your credentials:

```bash
# Required for database access
WISHDESK_DB_HOST=...
SUGARWISH_DB_HOST=...
# etc.

# Required for Slack integration
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# Required for GitHub access
GITHUB_TOKEN=ghp_...

# Required for vector search
QDRANT_URL=https://...
QDRANT_API_KEY=...
```

### 4. Configure GitHub Repos (Optional)

Add your repositories to `.env`:

```bash
GITHUB_REPOS=[{"owner":"myorg","repo":"myapp","description":"My Application"}]
```

### 5. Initialize Database

```bash
npm run db:migrate
```

### 6. Restart Claude Code

Restart Claude Code to pick up the new MCP configuration.

### 7. Start Development

```bash
npm run dev
```

## MCP Servers

Five MCP servers provide tools to Claude Code:

| Server           | Purpose                             |
| ---------------- | ----------------------------------- |
| **discoveries**  | Knowledge base for insights         |
| **slack-search** | Semantic search over Slack messages |
| **logs**         | System log search and analysis      |
| **db**           | Database queries (read-only)        |
| **github**       | GitHub repo access (read-only)      |

Regenerate MCP config: `npm run generate:mcp`

## Configuration

### Environment Variables

See `.env.example` for all available options. Key sections:

- **Application**: `SW_CORTEX_USER`, `SW_CORTEX_ROOT`
- **Databases**: MySQL and PostgreSQL connection details
- **Slack**: Bot token, app token, user ID
- **Qdrant**: Vector database for semantic search
- **GitHub**: Personal access token
- **n8n**: Automation platform credentials

### Background Services

#### PM2 (Recommended)

```bash
pm2 start ecosystem.config.cjs
pm2 logs          # View logs
pm2 restart api   # Restart API
```

#### Systemd

```bash
bash scripts/install-systemd.sh
```

This generates service files from templates with your paths.

## Development

```bash
npm run dev          # Start Vite dev server
npm run dev:api      # Start API server
npm run typecheck    # TypeScript checks
npm run test         # Run tests
npm run lint         # ESLint check
```

### Database Migrations

```bash
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Drizzle Studio GUI
```

### Qdrant Vector Database

```bash
npm run qdrant:init   # Initialize collections
npm run qdrant:status # Check collection status
```

## Project Structure

```
sw-cortex/
├── src/
│   ├── mcp-servers/       # MCP server implementations
│   │   ├── discoveries/   # Knowledge base
│   │   ├── slack-search/  # Slack message search
│   │   ├── logs/          # Log analysis
│   │   ├── db/            # Database access
│   │   └── github/        # GitHub access
│   ├── services/          # Shared backend services
│   ├── qdrant/            # Vector DB module
│   ├── db/                # Drizzle schema
│   ├── config/            # Configuration modules
│   └── web/               # React frontend
├── scripts/               # Utility scripts
│   ├── setup.ts           # Interactive setup
│   ├── generate-mcp-config.ts
│   └── systemd/           # Service templates
├── global-config/         # Global Claude config templates
├── workflows/             # n8n workflow exports
└── tasks/                 # SQLite database
```

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js + TypeScript, Drizzle ORM
- **Databases**: MySQL, PostgreSQL, SQLite (local)
- **Vector DB**: Qdrant
- **Process Management**: PM2
- **Automation**: n8n

## Documentation

- `CLAUDE.md` - Project instructions for Claude Code
- `global-config/CLAUDE.md.template` - Global config template
- `.claude/rules/` - Modular Claude rules

## License

MIT
