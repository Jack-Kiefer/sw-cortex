# sw-cortex TODO

Remaining setup tasks for the workspace.

## Immediate (Before Using)

- [x] **Install dependencies** ✅ DONE

  ```bash
  cd /home/jackk/sw-cortex
  npm install
  ```

- [x] **Test MCP server works** ✅ DONE
  - MCP server starts and lists all 17 tools
  - Database tools: `mcp__task-manager__list_databases`, etc.

## Database Access

- [x] **Add SSH tunneling for live databases** ✅ DONE
  - Built into `src/services/databases.ts` using `ssh2` package
  - Per-database toggle: set `WISHDESK_USE_SSH=true` (etc.) in `.env`
  - Shared SSH config via `SSH_BASTION_HOST`, `SSH_BASTION_USER`, `SSH_KEY_PATH`

- [ ] **Test database connections**
  - WishDesk (MySQL)
  - SugarWish Live (MySQL)
  - Odoo (PostgreSQL)
  - Retool (PostgreSQL)

## Slack Integration

- [ ] **Set up Qdrant for Slack message search**
  - Install Qdrant (Docker or native)
  - Create collection for Slack messages
  - Build ingestion pipeline to index historical messages
  - Add vector search to MCP server

- [ ] **Real-time Slack monitoring** (optional)
  - Use Slack Events API or Socket Mode
  - Index new messages as they arrive

- [ ] **Add Slack MCP tools**
  - `search_slack` - Semantic search via Qdrant
  - `send_slack_message` - Send DM or channel message
  - `list_slack_channels` - List accessible channels

## Reminder Service

- [ ] **Add SLACK_USER_ID to .env.local**
  - Get your Slack user ID (click your profile → "..." → "Copy member ID")
  - Add to `.env.local`: `SLACK_USER_ID=U0123456789`

- [ ] **Install systemd timer**

  ```bash
  ./scripts/install-systemd.sh
  ```

  Or manually:

  ```bash
  sudo cp scripts/systemd/sw-cortex-reminders.* /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now sw-cortex-reminders.timer
  ```

- [ ] **Test reminder delivery**
  ```bash
  # Create a test reminder, then watch logs:
  journalctl -u sw-cortex-reminders.service -f
  ```

## GitHub Integration

- [x] **Add GitHub MCP tools** ✅ DONE
  - Built custom read-only MCP server using Octokit
  - Configured repos: SERP, SWAC, sugarwish-odoo, sugarwish-laravel
  - Tools available:
    - `list_repos` - List configured repositories
    - `get_repo_info` - Get repository details
    - `search_code` - Search code across repos
    - `get_file` - Get file contents
    - `list_files` - List directory contents
    - `list_branches` - List branches
    - `list_commits` - List recent commits
    - `list_pull_requests` - List PRs
    - `get_pull_request` - Get PR details
  - **Read-only access only** - no write operations

## Daily Workflow

- [ ] **Create daily digest**
  - Morning summary: tasks due, Slack highlights, calendar
  - Delivery via Slack DM
  - Snooze capability
  - Options:
    1. systemd timer + script
    2. n8n workflow

## Workflow Storage

- [ ] **Export n8n workflows**
  - Export JSON from n8n instance
  - Save to `workflows/n8n/`
  - Document each workflow's purpose

- [ ] **Export Retool configs**
  - Save queries/transformations to `workflows/retool/`
  - Document data sources

## Nice to Have

- [ ] **Project-aware task search**
  - When viewing a task linked to a project, auto-search project codebase
  - Generate solution suggestions based on code context

- [ ] **Task-to-Jira sync** (if using Jira)
  - Sync tasks between local DB and Jira
  - Two-way updates

- [ ] **Browser automation integration**
  - Already have Playwright MCP configured
  - Document common automation workflows

---

## Quick Start After Setup

Once everything is installed:

```bash
# Start a Claude Code session in sw-cortex
cd /home/jackk/sw-cortex
claude

# Test task management
/task add Test my first task
/task list

# Test database access
# (use MCP tool) mcp__task-manager__list_tables { database: "wishdesk" }

# Set a reminder
/remind Check this worked in 5m
```
