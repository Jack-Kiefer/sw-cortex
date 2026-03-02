# Jack / Madison - Claude Code Setup

Date: 2026-02-25

Attendees: Jack Kiefer, Madison Meilinger

## Summary

Jack walked Madison through the full Mac development environment setup for Claude Code and the WishDesk (SWAC) codebase. Setup completed successfully — WishDesk running locally at `localhost:50003` connected to a local MySQL database. Also discussed planned WishDesk enhancements: priority classification improvements, per-priority SLA targets, and a breached event log audit feature.

## Details

### Madison's Goals

- Encouraged by Matt to use Claude Code
- Primary goal: reduce reliance on Jack for minor WishDesk changes
- Secondary goal: spec out future WishDesk changes independently
- Jack: front-end changes are generally easier; this setup makes it much more accessible

### Mac Setup Steps (Completed)

1. **GitHub account** — Madison created and shared username in Slack; Jack added to WishDesk and Squirrel codebases
2. **VS Code** — downloaded and installed
3. **Homebrew** — installed via terminal (required computer password)
4. **Node** — `brew install node`
5. **Git** — `brew install git`
6. **Claude Code** — installed via `.pkg` file; ran `sudo npm install` (initial `npm install` failed, `sudo` worked)
7. **DB Engine** — set up local MySQL instance (renamed, started)
8. **SQL Ace** — installed for viewing SQL databases
   - Connection: host `127.0.0.1`, user `root`, no password, port `3306`
9. **Clone SWAC repo** — cloned from GitHub in VS Code
10. **`.env` file** — copied from Dev Group WishDesk Slack channel ENV file, pasted into project root
11. **`npm install`** — ran via Claude interface after encountering errors (Claude fixed dependency issues)
12. **Migration seed** — ran via Claude to copy production DB to local environment; verified in SQL Ace (tables appeared)
13. **`npm run dev`** — started local WishDesk at `localhost:50003`

### Key Notes

- Setup is one-time — Madison won't need to repeat this process
- Local server uses local DB — safe for testing without affecting production
- Stop server: `Ctrl+C` or close the terminal (frees up computer resources)
- Claude Code in VS Code can run commands on the computer (unlike standard Claude.ai)
- When errors occur: paste into Claude, it handles confusing dependency problems well

### WishDesk Enhancements Discussed

**Priority Classification:**

- Current system: programmatic (e.g., corporate users → priority 2, no user → priority 6)
- Not currently AI-based
- Madison's goal: ensure time-sensitive requests (e.g., cancellations) get higher priority than pure user-type logic
- Jack to explore: AI-based classification or keyword system to promote priority-6 tickets that match specific categories

**Per-Priority SLA Targets:**

- Current: single SLA target for all priorities
- Proposed: separate SLA targets for each of the 4 priority levels

**Breached Event Log Auditing:**

- Low-priority feature request
- Add a button/checkbox to mark a breached event log as "reviewed"
- Prevents repeatedly reviewing the same breach
- Jack: can implement "mark as read" button while still showing all breaches in a view

## Action Items

- **Jack**: Explore AI classification or keyword system to promote time-sensitive priority-6 tickets
- **Jack**: Implement separate SLA targets per priority level in WishDesk
- **Jack**: Implement "mark as reviewed" button for breached event logs
- **Jack**: Schedule follow-up to show Madison how to make code changes and navigate the setup
