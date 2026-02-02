# Jack's Global Claude Config

These tools and commands are available in every project.

## IMPORTANT: Log Discoveries Frequently

Whenever you learn something useful, **save it as a discovery** so future sessions can benefit:

```
mcp__discoveries__add_discovery {
  title: "Brief description",
  source: "database_query|exploration|code_review|manual",
  description: "What you learned and why it matters",
  type: "fact|relationship|pattern|insight|anomaly",
  sourceDatabase: "...",  # if database-related
  tableName: "...",       # if table-specific
  tags: ["..."]           # optional categorization
}
```

**Save discoveries about:**

- Database schemas, relationships, business logic
- Codebase architecture, patterns, conventions
- How systems integrate (Odoo, Slack, n8n, etc.)
- Gotchas, edge cases, things that surprised you
- Solutions that worked for tricky problems
- Business rules and workflows
- API behaviors, undocumented features
- Anything Jack might need to know again

**Search before asking:**

```
mcp__discoveries__search_discoveries { query: "topic" }
```

This builds institutional knowledge across all sessions.

## Global Slash Commands

| Command                               | Description                      |
| ------------------------------------- | -------------------------------- |
| `/slack-search [query]`               | Search Slack messages            |
| `/db query [database] [sql]`          | Query databases                  |
| `/global-analyze [description]`       | Deep pre-implementation analysis |
| `/global-quick-analyze [description]` | Quick codebase assessment        |

## Global Skills

| Skill          | Trigger                                        |
| -------------- | ---------------------------------------------- |
| `n8n-workflow` | When asked to create n8n workflows/automations |

## Global MCP Tools (via `~/.mcp.json`)

### Slack Search (`mcp__slack-search__*`)

Search Jack's Slack message history semantically.

```
# Search messages (with optional date filter)
mcp__slack-search__search_slack_messages {
  query: "deployment issues",
  afterDate: "2025-12-18",    # ISO date (optional)
  beforeDate: "2026-01-08",   # ISO date (optional)
  limit: 20
}

# Get conversation context around a message
mcp__slack-search__get_slack_context {
  channelId: "C123ABC",       # From search results
  timestamp: 1704067200,      # Unix timestamp from search
  windowMinutes: 30
}

# Check sync status
mcp__slack-search__get_slack_sync_status
```

Slack syncs hourly via PM2. Manual sync: `npm run slack:sync` in sw-cortex.

### Database Access (`mcp__db__*`)

Read-only access to production databases.

```
mcp__db__list_databases
mcp__db__list_tables { database: "wishdesk|sugarwish|odoo|odoo_staging|retool" }
mcp__db__describe_table { database, table }
mcp__db__query_database { database, query, limit? }
```

**Always include LIMIT.** Never run write queries.

### GitHub Access (`mcp__github__*`)

Read-only access to configured repos: SERP, SWAC, sugarwish-odoo, sugarwish-laravel.

```
mcp__github__list_repos
mcp__github__search_code { query, repo? }
mcp__github__get_file { repo, path, ref? }
mcp__github__list_files { repo, path? }
mcp__github__list_branches { repo }
mcp__github__list_commits { repo, branch? }
mcp__github__list_pull_requests { repo, state? }
```

**Branch conventions:**

- SERP: `main` (prod), `dev` (development)
- SWAC: `live` (prod), `development`, `staging`
- sugarwish-odoo: `main` (prod), `staging_new`

### Discoveries (`mcp__discoveries__*`)

Save and search database/codebase insights.

```
# Save a discovery
mcp__discoveries__add_discovery {
  title: "Table purpose",
  source: "database_query",
  sourceDatabase: "sugarwish",
  tableName: "ec_order",
  description: "What I learned...",
  type: "fact|relationship|pattern|insight"
}

# Search discoveries
mcp__discoveries__search_discoveries { query: "order fulfillment" }
mcp__discoveries__get_table_notes { database, table }
```

### Logs (`mcp__logs__*`)

Search and analyze sw-cortex service logs.

```
mcp__logs__search_logs { service?, level?, search?, since? }
mcp__logs__get_recent_logs { limit? }
mcp__logs__get_recent_errors { limit? }
mcp__logs__get_log_stats
```

## PM2 Services

Running on this machine:

- `api` - sw-cortex API on port 4000 (watches src/ for changes)
- `slack-sync` - Hourly Slack message sync

```bash
pm2 list              # Status
pm2 logs              # View logs
pm2 restart api       # Restart API
```
