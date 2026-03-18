# sw-cortex

Personal work intelligence platform built around [Claude Code](https://claude.ai/claude-code). Exports your Slack history into a [Qdrant](https://qdrant.tech/) vector database and provides MCP tools so Claude can semantically search it from any project.

Better than searching Slack directly — it's fast and uses semantic search so you can find things by meaning, not just keywords.

## What It Does

1. **Syncs your Slack messages** into a Qdrant vector database with embeddings
2. **Provides MCP servers** that Claude Code can use as tools (Slack search, database access, knowledge base, etc.)
3. **Exports MCP tools to your global config** so they're available in every repo, not just this one

## Quick Start

### Prerequisites

- [Claude Code](https://claude.ai/claude-code) installed
- Node.js 18+
- A [Qdrant Cloud](https://cloud.qdrant.io/) instance (free tier works)
- A Slack User Token (see below)
- An OpenAI API key (for generating embeddings)

### Getting a Slack User Token

You need a **User Token** (`xoxp-...`), not a Bot Token. This is what lets the sync read your personal message history.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From scratch**
2. Name it whatever you want and select your workspace
3. Go to **OAuth & Permissions**
4. Under **User Token Scopes**, add these scopes:
   - `channels:history` — Read messages in public channels
   - `channels:read` — List public channels
   - `groups:history` — Read messages in private channels you're in
   - `groups:read` — List private channels
   - `im:history` — Read DMs
   - `im:read` — List DMs
   - `mpim:history` — Read group DMs
   - `mpim:read` — List group DMs
   - `users:read` — Resolve user IDs to names
5. **Install the app** to your workspace
6. Copy the **User OAuth Token** (starts with `xoxp-`)

### Setup

```bash
git clone https://github.com/Jack-Kiefer/sw-cortex.git
cd sw-cortex
npm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

The key ones for Slack search:

```
SLACK_USER_TOKEN=xoxp-your-user-token
OPENAI_API_KEY=sk-your-openai-key
QDRANT_URL=https://your-instance.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
```

Generate an encryption key for local Slack message storage:

```bash
openssl rand -hex 32
```

Add it to your `.env`:

```
SLACK_ENCRYPTION_KEY=your-generated-key
```

### Setting Up Qdrant

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io/) (free tier gives you 1GB)
2. Create a cluster
3. Get your cluster URL and API key from the dashboard
4. Add them to your `.env`

Initialize the collections:

```bash
npm run qdrant:init
```

### Sync Your Slack Messages

```bash
npm run slack:sync
```

This pulls your Slack messages, generates embeddings via OpenAI, and stores them in Qdrant. The first sync will take a while depending on how many messages you have. Subsequent syncs are incremental and much faster.

Run it periodically to keep things up to date, or set it up on a cron/PM2 schedule.

### Make It Available in All Your Projects

The whole point is having Slack search available everywhere in Claude Code, not just in this repo. Export the MCP tools to your global config:

```bash
bash scripts/sync-global-config.sh push
```

This copies MCP server definitions, slash commands, and skills from `global-config/` to `~/.claude/`. **Restart Claude Code after running this** to pick up the new tools.

After this, Claude will have access to the `slack-search` MCP tools in any project. You can ask things like "search Slack for what we discussed about the deployment last week" from any repo.

## Key Commands

| Command                                   | What it does                             |
| ----------------------------------------- | ---------------------------------------- |
| `npm run slack:sync`                      | Sync Slack messages to Qdrant            |
| `npm run qdrant:init`                     | Initialize Qdrant collections            |
| `npm run qdrant:status`                   | Check Qdrant collection status           |
| `npm run sync:all`                        | Sync everything (meetings + Slack)       |
| `bash scripts/sync-global-config.sh push` | Export MCP tools to global Claude config |

## MCP Servers

This repo includes several MCP servers that Claude Code can use as tools:

| Server           | Purpose                                      |
| ---------------- | -------------------------------------------- |
| **slack-search** | Semantic search over Slack messages          |
| **discoveries**  | Knowledge base for saving insights           |
| **db**           | Read-only database access (MySQL/PostgreSQL) |
| **github**       | GitHub repo access                           |
| **logs**         | System log search and analysis               |

## Forking / Making It Your Own

Fork this repo and have Claude Code customize it for your setup. The main things you'll want to change:

- **`.env`** — Your own credentials
- **`global-config/`** — Your own slash commands, skills, and MCP config
- **`src/mcp-servers/`** — Add/remove MCP servers for your tools
- **`src/services/databases.ts`** — Database connections (if you use the DB server)

The Slack sync + search works standalone — you don't need the database or GitHub servers if you just want Slack search.

## Tech Stack

- TypeScript
- Qdrant (vector DB for semantic search)
- OpenAI (embeddings)
- Slack User Token API
- MCP (Model Context Protocol) servers
- PM2 (process management, optional)
