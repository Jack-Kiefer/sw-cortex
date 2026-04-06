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

| Command                               | Description                          |
| ------------------------------------- | ------------------------------------ |
| `/slack-search [query]`               | Search Slack messages                |
| `/db query [database] [sql]`          | Query databases                      |
| `/global-analyze [description]`       | Deep pre-implementation analysis     |
| `/global-quick-analyze [description]` | Quick codebase assessment            |
| `/meeting [title]`                    | Save meeting notes + index to Qdrant |

## Global Skills

| Skill          | Trigger                                        |
| -------------- | ---------------------------------------------- |
| `n8n-workflow` | When asked to create n8n workflows/automations |

## Global MCP Tools (via `~/.mcp.json`)

### Database Access (`mcp__db__*`)

Read-only access to production databases. **Never run write queries.**

#### Available Databases

| Database        | Type       | MCP Name          | Purpose              |
| --------------- | ---------- | ----------------- | -------------------- |
| WishDesk        | MySQL      | `wishdesk`        | WishDesk ticketing   |
| SugarWish       | MySQL      | `sugarwish`       | Production orders    |
| Odoo            | PostgreSQL | `odoo`            | ERP data (prod)      |
| Odoo Staging    | PostgreSQL | `odoo_staging`    | ERP data (staging)   |
| Retool          | PostgreSQL | `retool`          | Analytics/dashboards |
| Laravel         | MySQL      | `laravel`         | Production (SERP)    |
| Laravel Local   | MySQL      | `laravel_local`   | Local Laravel dev    |
| Laravel Staging | MySQL      | `laravel_staging` | Laravel staging      |

#### Tools

| Need to...     | Do this                                               |
| -------------- | ----------------------------------------------------- |
| List databases | `mcp__db__list_databases`                             |
| List tables    | `mcp__db__list_tables { database }`                   |
| Describe table | `mcp__db__describe_table { database, table }`         |
| Query database | `mcp__db__query_database { database, query, limit? }` |

**Always include LIMIT.** Use specific columns when possible.

#### Example Queries

```
mcp__db__list_tables { database: "wishdesk" }

mcp__db__query_database {
  database: "odoo",
  query: "SELECT * FROM sale_order LIMIT 10"
}

mcp__db__describe_table { database: "sugarwish", table: "orders" }
```

### Slack Search (`mcp__slack-search__*`)

Semantic search across Jack's Slack history. **Use this when:**

- Looking for past discussions about a topic
- Finding who said something or when
- Searching for decisions, context, or background info
- User asks "what did we discuss about X" or "find that Slack message about Y"

#### Tools

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

Slack syncs hourly via PM2. Manual sync: `npm run slack:sync` in sw-cortex.

### GitHub Access (`mcp__github__*`)

Read-only access to configured repos.

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

#### Tools

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

Use `ref` parameter to specify branch/tag/commit:

```
mcp__github__get_file { repo: "sugarwish-odoo", path: "file.py", ref: "development" }
mcp__github__list_files { repo: "sugarwish-odoo", path: "models", ref: "staging" }
mcp__github__list_commits { repo: "SERP", branch: "dev" }
```

Without `ref`, tools default to the repo's default branch (usually `main`).

### Discoveries (`mcp__discoveries__*`)

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

### Logs (`mcp__logs__*`)

Search and analyze sw-cortex service logs.

| Need to...     | Do this                                                        |
| -------------- | -------------------------------------------------------------- |
| Search logs    | `mcp__logs__search_logs { service?, level?, search?, since? }` |
| Recent logs    | `mcp__logs__get_recent_logs { limit? }`                        |
| Recent errors  | `mcp__logs__get_recent_errors { limit? }`                      |
| Log statistics | `mcp__logs__get_log_stats`                                     |

## Global Config Management

The `global-config/` directory in `sw-cortex` contains commands, skills, and settings that sync to `~/.claude` for use across all projects.

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

## PM2 Services

Running on this machine:

- `api` - sw-cortex API on port 4000 (watches src/ for changes)
- `slack-sync` - Hourly Slack message sync

```bash
pm2 list              # Status
pm2 logs              # View logs
pm2 restart api       # Restart API
```
