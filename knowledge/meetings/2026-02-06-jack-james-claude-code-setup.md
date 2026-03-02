# Jack / James - Claude Code Setup

Date: 2026-02-06

Attendees: Jack Kiefer, James Emeric

## Summary

Jack guided James through the initial SERP development environment setup on Windows: VS Code, Git, Node, Claude Code, and the local SERP instance. Covered GitHub branch workflow, .env file for sensitive credentials, SSH key for live database access, and MCP tools for database querying. Local SERP successfully connected to live Laravel and Odoo databases (read-only). Concluded with version control basics in VS Code and agreed to a follow-up session to build queries and dashboards.

## Details

### Initial Setup

- James had Claude Code installed but showing "preview" status — Jack noted it was unfamiliar but likely workable
- James had recently created a GitHub account and accepted the SERP repo invitation

### VS Code and GitHub

- VS Code: code editor for running terminals, viewing code, GitHub integration
- GitHub: logs every code change — like Google Drive for technical documents
- Cloned the SERP repo to local machine
- Branch structure:
  - `main` → production
  - `dev` → development (James switched to `origin/dev`)
  - feature branches → personal work, safe from affecting others
- Pull request process for merging changes
- Pulling frequency: once a month is fine since James is the only other person working on this codebase — pull before pushing to avoid merge conflicts

### Codebase Overview

- SERP codebase contains both front end and back end
- Has established DB connections used by both the app and MCP tools
- MCP (Model Context Protocol) = the set of tools/actions AI can perform (e.g., query a database)

### Installation Steps (Windows)

1. Install Git for Windows (via VS Code terminal)
2. Install Node/npm (package manager for project dependencies)
3. Create `.env` file — stores API keys, DB connection URLs (copied from Slack)
4. Copy `replet_key.pm` into codebase — SSH key for accessing live database
5. Launch Claude Code in terminal, authorize access, accept recommended settings
6. Run `/setup Windows` slash command — installs additional components (Python, etc.)

### Data Concepts Explained

- JSON: structured data with relationships (vs CSV which is flat/table-based)
- SQL: language for querying table-based databases
- MCP tools translate plain-text questions into SQL — no need to master SQL

### Database Access

- Development server launches SSH tunnel → enables access to live Laravel and Odoo databases
- **Laravel and Odoo: read-only via MCP tools**
- Retool database may allow write access — use caution
- Claude is better at querying Odoo (standard layout) than Laravel ("messy" tables)
- Finding: Odoo SKUs don't track supplier information — flagged as potential improvement

### Running SERP Locally

- Start: `npm run dev` in VS Code terminal
- Front end: `localhost:3002`
- Back end: `localhost:8000`
- Split terminals to run front end and back end simultaneously
- Stop server: `Ctrl+C` (press twice) to free up resources
- Claude Code can diagnose back-end errors — paste logs into chat for fix suggestions

### Claude Code Tips

- VS Code Claude Code can run commands on the computer (unlike standard Claude.ai)
- Press "yes" to Claude's prompts unless you know you want something different
- `CLAUDE.md` file = always-loaded context for the project
- Drag files into Claude chat to add file context
- `/compact` command: summarizes context when it fills up (also auto-compacts sometimes)
- Claude chat logs don't save reliably — focus on organizing files/code folder instead

### Version Control in VS Code

- Changes save locally automatically but don't affect deployment
- To discard local changes: version control sidebar → right-click file → "Discard Changes"
- "Commit" = sends changes to your branch
- James created their own branch — commits stay contained, won't affect Jack's work
- Safe rule: as long as you don't commit, nothing in production is affected

### Recommended Tools to Build in SERP

- Invoice reconciliation tool
- Reporting/dashboard tools
- Slack MCP tool (Jack to teach James how to set up)

## Action Items

- **Jack**: Guide James on .env file once James has the codebase fully set up
- **Jack**: Teach James how to make an MCP tool that accesses his Slack messages
- **James**: Schedule follow-up meeting (Mon or Wed next week, not Tuesday)
- **Jack + James**: Meet next week to set up starting queries and build dashboards
- **James**: Reach out to Jack with questions anytime

## Key Commands Reference

```bash
npm run dev      # Start local SERP instance
Ctrl+C           # Stop the server (press twice)
/compact         # Compact Claude's context window
/setup windows   # Run Windows setup (first-time only)
```
