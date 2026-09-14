# Jack's Global Codex Guidance

Before substantial work, read `~/CLAUDE.md` as the live shared source for Jack's working
preferences, repository map, operational knowledge, and workflow intent. Re-read relevant
sections when that file changes. Apply its behavioral and domain guidance, but translate
Claude-specific tool names, hooks, permission modes, slash commands, and agent APIs to the
Codex capability that is actually available. This file and the active repository's
`AGENTS.md` win when a Claude-only instruction cannot operate in Codex.

## Working style

- Make minimal, additive changes and do exactly what Jack asks. Do not add adjacent
  refactors or speculative improvements.
- Advice and questions are read-only by default. Apply changes only when Jack asks to
  build, fix, update, or implement them.
- A repeated request is a directive to act. Do not repeat an earlier explanation Jack
  rejected.
- Stop immediately when Jack says he is taking over, says never mind, or rejects a tool.
- Fix root causes. If the correct fix is outside scope, report it instead of adding a
  workaround.
- Verify actual behavior before claiming completion. State commands, exit statuses, and
  any checks that could not run.
- Treat plans as target state, not evidence of current state. Verify live state before
  describing migrations, deployments, databases, or integrations in the present tense.
- Establish intended target before calling an observed difference a failure.

## Repository and Git safety

- Never use `git stash`, `git add .`, `git add -A`, destructive resets, or branch switches
  in a long-lived main checkout.
- Use absolute paths and `git -C <repo-root>` for cross-repository Git operations.
- SERP, SWAC, and sw-cortex changes use dedicated worktrees. Preserve dirty main clones.
- SERP PRs target `dev`; sw-cortex PRs target `main`; follow SWAC's committed guidance.
- Do not commit, push, open, merge, or deploy unless Jack explicitly asks for that action.
- Writable roots: SERP `/Users/jackkief/Desktop/Projects/SERP`, SWAC
  `/Users/jackkief/Desktop/Projects/SWAC`, and sw-cortex
  `/Users/jackkief/Desktop/Projects/sw-cortex`. Treat other Sugarwish repositories as
  read-only unless current sandbox policy explicitly grants writes.

## Data and knowledge

- Production databases are read-only. Never guess a table or column. List/describe the
  table before its first query and sample narrowly before reasoning from its contents.
- Preserve known schema traps: `oddo_synchronized`; SERP/Odoo joins use `odoo_id`; active
  `stock_move.state` uses the positive list `draft`, `confirmed`, `waiting`,
  `partially_available`, `assigned`.
- Search the knowledge MCP before reasoning about company-specific systems, decisions,
  schemas, or operational history. Search Slack when a later decision may supersede a
  ticket or plan.
- Never write production data or expose customer PII unless Jack explicitly requests the
  specific data, and never commit PII.

## Sessions and `/go`

- `/go`, "open a new go", and equivalent requests use the installed `go` skill and launch
  a fresh Codex session in the owning repository.
- At the start of substantial work, use the sessions MCP overlap check when available.
  Keep the thread name/task state meaningful so peer sessions can identify overlap.
- Use Codex's native status line, task progress, and terminal title; do not invoke
  Claude-only tab-title hooks from Codex.

## Verification

- Follow the closest repository `AGENTS.md`; nested instructions override this file.
- Read the repository's `CLAUDE.md` for its live architecture, commands, integrations, and
  domain rules. Treat `AGENTS.md` as authoritative when the two files disagree about Codex
  execution or safety.
- sw-cortex: `npm run typecheck && npm run lint`, plus relevant tests.
- SERP: use the commands and test-first requirements in its repository guidance.
- Do not start or stop development servers unless the task requires it or Jack asks.
