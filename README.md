# sw-cortex

Personal work intelligence platform built around [Claude Code](https://claude.ai/claude-code). Exports your Slack history into a [Qdrant](https://qdrant.tech/) vector database and provides MCP tools so Claude can semantically search it from any project.

Better than searching Slack directly — it's fast and uses semantic search so you can find things by meaning, not just keywords.

## What It Does

1. **Syncs your Slack messages** into a Qdrant vector database with embeddings
2. **Provides MCP servers** that Claude Code can use as tools (Slack search, database access, knowledge base, etc.)
3. **Exports MCP tools to your global config** so they're available in every repo, not just this one

## Quick Start

### Prerequisites

- Node.js 18+
- A [Qdrant Cloud](https://cloud.qdrant.io/) instance (free tier works)
- A Slack User Token (not a bot token — needs your message history)
- An OpenAI API key (for generating embeddings)

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

Initialize the Qdrant collections:

```bash
npm run qdrant:init
```

### Sync Your Slack Messages

```bash
npm run slack:sync
```

This pulls your Slack messages, generates embeddings via OpenAI, and stores them in Qdrant. Run it periodically to keep things up to date, or set it up on a cron/PM2 schedule.

### Export MCP Tools to Global Config

The MCP servers in this repo (Slack search, discoveries, etc.) can be exported to your global Claude Code config so they're available in every project:

```bash
bash scripts/sync-global-config.sh push
```

This syncs the contents of `global-config/` to `~/.claude/`, including MCP server definitions, slash commands, and skills. Restart Claude Code after pushing to pick up changes.

To pull external changes back into the repo:

```bash
bash scripts/sync-global-config.sh pull
```

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
