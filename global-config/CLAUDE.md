# Jack's Global Claude Config

These tools and commands are available in every project.

## Working Style

How Jack wants Claude to work. These override the urge to be "helpful" by doing extra.

- **Minimal, additive change.** When asked to "also add / instead add" a column, dropdown, option, or branch, **extend** the existing structure. Do not delete, replace, or rebuild adjacent behavior, do not add new pages/files/nodes, and do not touch out-of-scope code or data unless explicitly told to. Prefer reusing/extending an existing thing over creating a new one. (e.g. "just use add and remove, not replace"; "you dont need new nodes, just make the existing thing also include X".)
- **Do exactly what's asked — nothing more.** No bonus "improvements," adjacent refactors, or speculative scaffolding. If you think scope should grow, ask first.
- **Stop the moment Jack takes over.** If Jack says he'll modify the code himself, "nevermind," or "it's not your job to do that," stop editing immediately and don't step on his changes. **A rejected tool call counts as taking over.** If Jack rejects/cancels a tool use ("user rejected the tool use"), even with no message, treat it as an intentional STOP — do **not** re-fire the same call, do **not** route around it with a different tool to do the same thing, and do **not** proceed as if it succeeded. Stop and ask what he wants instead.
- **Advisory by default.** "What do I need to change?" / "tell me what to do" / "how would I…" means **surface the diff or SQL as text** — do not apply it until told to.
- **A repeated request is a directive to act, not to re-explain.** If Jack restates a request after you answered with "it's already fine / here's why you don't need to" — especially if he leads with "no" — he is rejecting the non-answer, not asking for it again. Make the change he asked for (or, if it genuinely can't be done, say _that_ and propose the closest action that achieves his goal). Do not repeat the status report, and do not hand him a manual step to do himself (e.g. "press shift+tab") when he asked _you_ to change the setup. (e.g. "no, update claude setup to always allow edits" after being told `acceptEdits` was already set = **set `bypassPermissions` for him**, don't re-explain that the file looks fine.)
- **Verify before claiming done.** Editing a file is not the same as changing the behavior. Before reporting a UI or data fix complete, observe the changed result yourself — reload the page, re-run the query, diff the output. Watch for caches, paginated slices, and stale builds that mask "no change." If you can't verify, say so instead of asserting it works.
- **Read before Edit/Write; re-Read after anything touches the file.** "File has not been read yet" and "File has been modified since read" are the harness guard working — never defeat them. Has-not-been-read → you skipped the Read this turn (a subagent's or prior-turn Read doesn't count); Read it, then Edit. Modified-since-read → a formatter / `lint:fix` / verify-app / `git checkout·pull` rewrote it; re-Read and re-apply against the new contents (your old `old_string` may no longer match). Never retry the identical Edit, blind-`Write` to overwrite, or `git stash` to "reset." Inverse also holds: don't re-Read a file you just successfully Edited "to verify" — Edit would have errored if it failed.
- **Task/agent handles are session-scoped — re-resolve, never reuse from memory.** Built-in Task numeric IDs (`1`, `2`…) and research-team teammate names (`foo@session-…`) are live, per-session references that get reaped; one valid earlier (or in a prior session) is dead now. Before any `TaskGet`/`TaskStop`/`SendMessage`, re-discover the live handle with `TaskList` and act on what it returns. If `TaskList` is empty, the task/team is gone — don't retry the stale handle. To resume a completed background agent, use the `agentId` (`a…`) from its own spawn result.
- **Pulling the SERP main clone (sync / post-merge) — handle the dirty tree FIRST, never let `git pull` error on it.** The SERP main clone (`…/Projects/SERP`, parked on `dev`) is routinely dirtied by the dev-server watcher (`package-lock.json` churn) and stray in-place edits, so a bare `git pull`/`pull --ff-only origin dev` fails with `cannot pull with rebase: You have unstaged changes`. Before any pull of the SERP main clone: run `git -C <SERP-root> status --porcelain`. If the ONLY dirty paths are known watcher churn (`package-lock.json`), discard just those (`git -C <SERP-root> checkout -- package-lock.json`) then pull. If anything ELSE is dirty, STOP and report the dirty paths to Jack — do NOT `git stash` (forbidden), do NOT `git checkout --` real edits, do NOT force-pull. (Editing the main clone in place is already NEVER for SERP — all work goes in a worktree; see [[check-branch-before-editing-main-clone]]. This rule is specifically about the read-only sync/post-merge pull leaving the clone un-updatable.)
- **Waiting on a background command = end the turn with plain text, ZERO tool calls.** When a `run_in_background` command (test suite, build, seed) is still running, do NOT poll: never run a no-op Bash (`:`, `true`, `echo`) as a pseudo-wait, and don't re-Read the output file on every intermediate task-notification wake-up. The harness re-invokes you when the command exits; an intermediate wake just means "new output" — say one short line (or advance other work) and stop. "Waiting for the completion notification" is a legitimate final paragraph when the next step depends on that result — you are blocked on the tool, not leaving a promise unfulfilled. (One SERP session burned 161 `Bash(:)` no-ops and ~12k tokens spinning in wait loops, 2026-07-02.)
- **No scratch files, minimal comments.** Don't create summary/scratch `.md` files or add explanatory comments unless asked. Keep output minimal and inline.
- **A correction from Jack is a directive to fix the setup so it can't recur — not just to fix this instance.** When Jack tells you that you did something wrong ("no…", "stop…", "don't…", "why did you…", "from now on…", "use my messages as clear directive"), treat it as the strongest possible signal: identify what you did wrong, fix it _here_, AND land a durable change so the next agent doesn't repeat it — a session memory, a `~/CLAUDE.md`/rules line, a settings/config change, or a fix in the relevant repo. Don't re-explain or apologize; make the behaviour impossible (or at least documented) going forward. (`/start-day` Step 5 does this automatically each run by mining both tool-errors and Jack's corrections and auto-applying the fixes.)

## Orchestrator / Repo Routing (hub model)

sw-cortex is the **single Claude Code hub** Jack launches (open only sw-cortex in VS Code; `.vscode/settings.json` pins new terminals to its root; run `claude` once, cwd never changes). `/go <task>` is the **one entry point** — it auto-detects the involved repo(s) and opens a real session in the right writable repo, which then runs a slash command chosen by intent: **`/serp-analyze`** for an actionable task (research → build → PR) or **`/research`** for a pure question (investigate → answer → stop). There is no `/work` command and no repo-pick prompt. (`/serp-analyze` and `/deploy` are **repo-local** commands — they live in each repo's `.claude/commands/` and run from inside that repo's session, not from the hub; `/research` is a global command available in every session.)

- **Writable from the hub: SERP, SWAC, sw-cortex only.** All other repos (`sugarwish-laravel`, `livery`, `sw-design`, `swirl`, `sugarwish-infrastructure`) are **read-only** — read/search them freely to diagnose, but never edit. When a fix belongs in one of them, print a **hand-off note** (what's wrong + file/line + the owner to ask, from the ownership table above) instead of editing.
- **This is mechanically enforced.** A PreToolUse hook (`~/.claude/scripts/repo-write-guard.sh`) hard-DENIES any Edit/Write or `git`/`gh` commit·push·merge·worktree·PR whose resolved repo root (via `git rev-parse --git-common-dir`, so worktrees map to their owner) is not SERP/SWAC/sw-cortex. Reads are never blocked.
- **Repo roots:** SERP `/Users/jackkief/Desktop/Projects/SERP` · SWAC `…/SWAC` · sw-cortex `…/sw-cortex` · laravel `…/sugarwish-laravel` · livery `…/livery` · sw-design `…/sw-design` · swirl `…/swirl` · infra `…/sugarwish-infrastructure`.
- **Per-repo VCS:** always `git -C <root> …`; never run git from the hub cwd against another repo. Only SERP and sw-cortex have a `.claude/rules/` dir — for the others state "CLAUDE.md only", don't imply rules loaded. Each repo's conventions (SWAC `<username>/<desc>` branches + dev→staging→live; SERP Odoo-parity; sw-cortex plan-mode/verify-app) apply ONLY to that repo.
- **sw-cortex changes ship by PR to `main` — built in a throwaway worktree, NEVER by checking out a branch in the hub.** Any edit to sw-cortex (its code, `global-config/`, slash commands, scripts, MCP servers, the DICTIONARY/KB, hooks, the go-launcher extension) must land via a **PR to `main`**, the same as a SERP change produces a PR — and like SERP's `/deploy`, the branch is made in a **separate git worktree under `/tmp`, so the hub's own checkout never leaves `main` and no branch is ever checked out in the hub working copy.** **NEVER `git checkout`/`switch` a branch in the hub working copy** (`…/sw-cortex`) — it's a long-lived pinned session; moving its branch would disrupt it. The flow: `git -C <sw-cortex-root> worktree add /tmp/cortex-pr-<desc> -b <desc>` → make the edits **and commit inside that worktree** (`git -C /tmp/cortex-pr-<desc> …`, never the hub dir) → `git -C /tmp/cortex-pr-<desc> push -u origin <desc>` → `gh pr create --base main --head <desc> …` → **after it's merged, IMMEDIATELY fast-forward the hub's `main` to pick up the merge: `git -C <sw-cortex-root> pull --ff-only origin main`** (the hub stays on `main`, so this just advances it — never leave the hub behind the merged PR), then `git -C <sw-cortex-root> worktree remove /tmp/cortex-pr-<desc>` (`&& git -C <sw-cortex-root> worktree prune`). If `global-config/` changed, run `sync-global-config.sh push` after the pull (see Global Config Management). **Then close this terminal as the final teardown step** — run `~/.claude/scripts/close-own-tab.sh` so the tab disappears once the PR is merged, pulled, and cleaned up. ⚠️ **ONLY when the cortex work ran in a launched/`/launch` go-tab — NEVER close the hub's own terminal** (the long-lived session Jack launches and keeps open). If you're unsure whether this is the hub or a launched tab, do **not** close it. Pause for Jack's review/merge unless he says to merge. Cortex tasks are still **handled inline in the hub** (no new terminal — see `/go` Step 1.5); "inline" governs where the _session_ runs, this rule governs how the _commit_ ships. (Note: editing a synced `global-config/` file via the symlinked `~/CLAUDE.md` writes to the hub checkout on `main` — keep such edits uncommitted there and re-make them in the worktree, or edit the file under the worktree path directly, so nothing lands on the hub's `main` branch.)
- **Worktrees:** address by absolute path; never `cd` a long-lived terminal into one. NEVER prune/remove/rm/reset the locked SERP worktrees (`SERP/.claude/worktrees/wf_817b7ab1-a1b-*`, agent worktree) or the sibling `serp-hotfix-mo-grounding` — they back active jobs.
- **SERP app run/test fallback:** SERP's live tooling (`mcp__serp-prod`, `mcp__serp-orm`, `mcp__python`, playwright) is unreachable from the hub. For run/test/verify, open a dedicated SERP session: `cd /Users/jackkief/Desktop/Projects/SERP && claude`. The hub does edits/git/DB/orchestration; SERP work needing live tooling goes in a SERP-cwd session.
- **Deploy:** SERP deploys via its repo-local `/deploy` (run from a SERP session) — ships `origin/dev`→`main` to Hetzner K3s (from a `/tmp` worktree). Not a hub command.
- **`/go <task>` (or asking in plain English) opens a REAL session in the right repo.** `/go` — and conversational equivalents like "fix X in a new go" / "spin up a session for X" — auto-detect the writable repo (SERP/SWAC/sw-cortex; read-only-repo tasks route to the writable repo that owns the change) and run `~/.claude/scripts/launch-repo-session.sh <root> "<task>"` (just the repo root + the task prompt — no `--label`, no inline `set-tab-title.sh`/`claude`; the extension derives the descriptive tab name from the task), which opens a new VS Code terminal tab — titled with a short **description of the task** (not the repo), e.g. `🔨 make SERPY require an MO date`, which the running session updates as it works (`🔍 researching` → `🙋 approve?` → `✅ done`, after which the tab auto-closes ~5s later) — running a real `claude` session there with that repo's native commands + project MCP tools. **When launching, pass a clear, specific task string** so the derived tab name is descriptive. No confirmation — detect and launch. Use this whenever a task needs a repo's full toolset; the hub itself can only read/diagnose + run hub-compatible commands. **Fire-and-forget:** "launch that idea in a go and keep going" = launch the session for that idea AND immediately resume the current task — don't block on or babysit the new session; it works in parallel while the hub stays on its thread.

## Logging into WishDesk locally (SWAC dev)

Running the SWAC app on your machine and signing in (`SWAC` = `WishDesk`; root `…/SWAC`). Local WishDesk uses **cookie-based sessions, NOT JWT** (Bearer is only for curl/API).

- **Start it:** from the SWAC root, `npm run dev` (the `dev` script hardcodes `APP_ENV=local`; `predev` frees the ports). App serves at **`http://localhost:5003`** (the `PORT` value in SWAC's `.env`). Helper scripts: `./start-local.sh` (clears conflicting DB env vars first) or `./restart-dev.sh` (kills the port, then `npm run dev`).
- **Two ways to "log in":**
  1. **Real login (dev fixture):** sign in with **`admin` / `swdev123`** — a non-secret dev fixture user, via `/auth`. This exercises the actual cookie-session flow.
  2. **Auth bypass (skip login entirely):** set `APP_ENV=local` **and** `ENABLE_LOCAL_AUTH_BYPASS=true` in `.env`. The server (`server/auth-middleware.ts`) then skips JWT/session and hydrates a stub **admin** dev user — useful for testing without signing in. **Off by default** so JWT auth can be tested; it only engages when both vars are set.
- **DB it points at:** governed by `.env` (`LOCAL_DB_*`, e.g. `LOCAL_DB_NAME=sugarwish_wishdesk_new` on `127.0.0.1`). Local timestamps, like all WishDesk, are **Mountain Time, not UTC**.
- **Verify headless (no GUI browser):** confirm login works against the running server by hitting the cookie-session login endpoint with curl — `curl -i -c cookies.txt -X POST http://localhost:5003/api/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"swdev123"}'` → expect `200` + the user JSON (the `connect.sid` session cookie lands in `cookies.txt`); then reuse it for authed routes via `-b cookies.txt`. For automated checks, SWAC's test suite is **Jest (already headless, no browser)** — `npm run test:e2e` / `npm run test:fast`; a Playwright CLI is also available (`.playwright-cli/`) if a real browser flow is needed.

## Terminal Tab Status (every session, every project)

Keep this session's terminal tab title showing what you're doing. Set it as soon as the first real task starts, and update it at every status change:

```bash
~/.claude/scripts/set-tab-title.sh "<emoji> <status> · <label>"
```

| Emoji | When                                                  |
| ----- | ----------------------------------------------------- |
| 🔍    | researching / investigating / debugging               |
| 📋    | planning — designing the fix, before approval         |
| 🙋    | about to stop and ask Jack for approval or a decision |
| 🔨    | applying the fix / implementing / editing files       |
| 🧪    | running tests / verifying                             |
| 📝    | committing                                            |
| ⬆️    | pushing                                               |
| ❓    | blocked — error or missing info Jack must resolve     |
| 📦    | PR opened, awaiting merge decision                    |
| 🚀    | merged                                                |
| ✅    | task finished                                         |

These are the steps a full `/implement` session moves through, in order: `🔍 researching → 📋 planning → 🙋 approve? → 🔨 applying fix → 🧪 verifying → 📝 committing → ⬆️ pushing → 📦 PR open → 🚀 merged → ✅ done`. Not every task hits every step (a pure research `/go` stops at `🙋`/`✅`); emit the ones that apply, in this order. Set 🙋/❓/📦/✅ — the **idle** states — **before ending the turn**, since that's what Jack sees while the tab sits.

`<label>` = 1–3-word task label (kebab-case fine). The global hooks (Stop/Notification/SubagentStop → `tab-title-hook.sh`) re-stamp the latest value automatically, so only update it at transitions, never repeatedly. **Auto-flip on reply:** when Jack replies to a tab sitting in a waiting state (🙋 or ❓), the `UserPromptSubmit` hook automatically demotes the leading emoji to 🔨 (keeping the label) — so a tab only says "approve?"/"blocked" while it's _actually_ waiting on him. You don't need to clear 🙋/❓ yourself on the next turn; just set the next real status (🔨/🧪/📝/…) when you reach it. If Jack set a name via `/tab-title`, keep his label text and only update the emoji/status portion. `/tab-title --clear` returns the tab to automatic titles. Mechanism docs: `~/.claude/scripts/TAB_TITLES.md`.

## IMPORTANT: Search the Knowledge Base First

The SugarWish institutional knowledge base — systems, database schemas, table-by-table notes, people/ownership, business rules, gotchas — is semantically searchable via the `knowledge` MCP server:

```
mcp__knowledge__search_knowledge { query: "how do SERP and Odoo ids join", limit?: 5 }
mcp__knowledge__get_knowledge_section { section: "Serpy" }   # full text when a result is truncated
```

**Search BEFORE:**

- Reasoning about any SugarWish system, database table, or cross-system flow
- Writing queries against `odoo` / `laravel_live` / `retool` / `wishdesk` / `serp_*` tables
- Assuming who owns a system, what a column means, or which DB is the source of truth
- Starting any analyze/planning task (SWAC's `/swac-analyze`, SERP's `/serp-analyze` + `/quick-analyze`)

The obvious-looking inference is often documented as **wrong** — that's what the KB exists to catch. Search it the way you'd search the web: cheap, early, often.

**Updating the KB:** it indexes `sw-cortex/DICTIONARY.md` directly — edit that file and the index refreshes itself on the next search (no ingest step). `/refresh-knowledge` distills new session learnings into the doc.

## Looking Up a WishWorks Ticket (WW-###)

WW-### tickets are dev-request **`.md` files in the `jasonbkiefer/SWIRL` repo** (fetch with the `github` MCP — `mcp__github__get_file { repo: "SWIRL", path, ref? }`). They are filed by **status**, so a ticket is in exactly ONE of two places — **check both, in this order:**

1. **Active (open):** `wishworks/dev-requests/active/WW-###.md`
2. **Archived (released/closed):** `wishworks/dev-requests/archive/{year}-q{quarter}/WW-###.md` — the archive is **partitioned by quarter** (`2026-q1`, `2026-q2`, …). A released ticket is NOT in `active/` and NOT at `archive/WW-###.md` — it's under the quarter subfolder.

**So the correct lookup is:** try `active/WW-###.md` first; on a 404, walk the `archive/` quarter subfolders (list `wishworks/dev-requests/archive` to see which quarters exist, then fetch `archive/<quarter>/WW-###.md` — most recent quarter first). **A 404 in `active/` means "released," not "missing"** — always fall through to the archive before reporting a ticket can't be found.

**Normalize the id** to `WW-###`, preserving its own width (a bare `65` → look up `WW-065` AND `WW-65`; `/go`/`/ww` keep whatever width it's filed under). The ticket's YAML frontmatter carries the useful fields — `status` (`released`/`in_progress`/…), `track`, `assignee`, `priority`, `released_date`, and `linked_prs[]` (repo + PR number + state) — and the body has the description, root cause, and acceptance criteria. **`status: released` + `released_date`** is the cutoff to reason about for "what happened before this shipped." `/ww` is the full helper for ticket work; this note is just so any session can resolve a ticket by id without it.

## Global Slash Commands

| Command                       | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `/start-day`                  | Morning routine: sync → tickets → KB → triage        |
| `/slack-search [query]`       | Search Slack messages                                |
| `/db query [database] [sql]`  | Query databases                                      |
| `/swac-analyze [description]` | SWAC/WishDesk research → build (SWAC sessions)       |
| `/meeting [title]`            | Save meeting notes + index to Qdrant                 |
| `/sync-meetings [all\|since=]` | Pull Gemini meeting notes from Drive → index to Qdrant |
| `/refresh-knowledge`          | Update the knowledge base docs                       |
| `/draft-slack [context]`      | Draft a Slack message                                |
| `/shutdown [repo]`            | Remove all worktrees not in use (writable repos)     |
| `/ww [description]`           | WishDesk work helper                                 |
| `/tab-title [name]`           | Set/clear this terminal tab title                    |
| `/compact-global`             | Compact + resume global context                      |
| `/save-for-later [note]`      | Save a rich summary of this chat, then close the tab |
| `/resume-later [pick]`        | List saved chats and relaunch one in its repo        |
| `/close-later [pick]`         | Mark a saved chat done (active → closed)             |

## Global Skills

| Skill          | Trigger                                                          |
| -------------- | ---------------------------------------------------------------- |
| `n8n-workflow` | When asked to create n8n workflows/automations                   |
| `audit-agent`  | When Jack pastes another agent's bad output and asks to audit it |

## Global MCP Tools (via `~/.mcp.json`)

### Database Access (`mcp__db__*`)

Read-only access to production databases. **Never run write queries.**

#### Available Databases

| Database     | Type       | MCP Name       | Purpose                                            |
| ------------ | ---------- | -------------- | -------------------------------------------------- |
| WishDesk     | MySQL      | `wishdesk`     | WishDesk ticketing (via SSH tunnel)                |
| WishDesk Dev | MySQL      | `wishdesk_dev` | WishDesk dev/staging                               |
| SugarWish    | MySQL      | `laravel_live` | Production orders (live Sugarwish; SSH tunnel)     |
| Odoo         | PostgreSQL | `odoo`         | ERP data (prod)                                    |
| Odoo Staging | PostgreSQL | `odoo_staging` | ERP data (staging)                                 |
| Retool       | PostgreSQL | `retool`       | Analytics/dashboards                               |
| Laravel Live | MySQL      | `laravel_live` | Production (SERP)                                  |
| Local        | MySQL      | `local`        | Local dev DB — user picks name via `LOCAL_DB_NAME` |
| Manage       | MySQL      | `manage`       | Laravel staging                                    |

#### Tools

| Need to...           | Do this                                                        |
| -------------------- | -------------------------------------------------------------- |
| List databases       | `mcp__db__list_databases`                                      |
| List tables          | `mcp__db__list_tables { database }`                            |
| Describe table       | `mcp__db__describe_table { database, table }`                  |
| Query database       | `mcp__db__query_database { database, query, limit? }`          |
| Query from .sql file | `mcp__db__query_database_from_file { database, path, limit? }` |

**Always include LIMIT.** Use specific columns when possible.

- **HARD GATE before the FIRST query against any serp\_\*/darklaunch/Laravel/Odoo table:** your immediately-prior call must be `mcp__db__describe_table` or `mcp__knowledge__search_knowledge` for that exact table. Never type a column you have not literally seen in that output this session — `standard_price`, `cost_method`, `quantity_done`, `increment_id`, `is_prepick`, `sugarwish_id` have all been guessed-wrong; the Odoo sync flag is the misspelled `oddo_synchronized`; join Odoo on `odoo_id`, never `id=id`. (This recurring schema-guess loop is the single largest fixable friction cluster, ~74/3-day.)

`query_database_from_file` reads the SQL off disk before executing — use it
when the query is too long or awkward to inline (e.g. SERP's 20-CTE
supplier-forecast queries). The file must live under `~/Desktop/Projects`
(override via the `MCP_DB_ALLOWED_DIRS` env var). Paths can be absolute,
`~/...`, or relative to the MCP server cwd; `..` segments are collapsed
before the allowlist check.

#### Example Queries

```
mcp__db__list_tables { database: "wishdesk" }

mcp__db__query_database {
  database: "odoo",
  query: "SELECT * FROM sale_order LIMIT 10"
}

mcp__db__query_database_from_file {
  database: "retool",
  path: "~/Desktop/Projects/SERP/backend/sql/forecast/retool/sa_projections.sql"
}

mcp__db__describe_table { database: "laravel_live", table: "orders" }
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

Slack message indexing is synced via `npm run slack:sync` in sw-cortex (manual / scheduled).

### GitHub Access (`mcp__github__*`)

Read-only access to configured repos.

#### Repositories & Branches

| Repo                  | Production | Development      | Staging       | Workflow                   |
| --------------------- | ---------- | ---------------- | ------------- | -------------------------- |
| **SERP**              | `main`     | `dev`            | -             | dev → main → manual deploy |
| **SWAC**              | `live`     | `development`    | `staging`     | dev → staging → live       |
| **sugarwish-odoo**    | `main`     | -                | `staging_new` | staging_new → main         |
| **sugarwish-laravel** | `blue`     | feature branches | -             | SUG-\* branches → blue     |

**Environments**:

- SWAC: `desk.sugarwish.com` (live), `desk2.sugarwish.com` (dev), `desk3.sugarwish.com` (staging)
- SERP: deploy from `main` is a **manual** `ssh … bash deploy.sh` step — it does **NOT** auto-deploy. (CI runs on push to `main`, but deploy is manual.)

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

### Knowledge Base (`mcp__knowledge__*`)

Semantic search over `sw-cortex/DICTIONARY.md` — SugarWish systems, table-by-table notes, people/ownership, business rules, gotchas. See "Search the Knowledge Base First" above.

| Need to...               | Do this                                              |
| ------------------------ | ---------------------------------------------------- |
| Search the KB            | `mcp__knowledge__search_knowledge { query, limit? }` |
| Expand truncated section | `mcp__knowledge__get_knowledge_section { section }`  |

### Slack Posting / Reading (`mcp__jack-slack__*`)

Post and read Slack directly (distinct from `slack-search`, which is semantic search over history).

| Need to...           | Do this                                                         |
| -------------------- | --------------------------------------------------------------- |
| Post a message       | `mcp__jack-slack__slack_post_message { channel, text }`         |
| Reply in a thread    | `mcp__jack-slack__slack_reply_to_thread { channel, thread_ts }` |
| Read channel history | `mcp__jack-slack__slack_get_channel_history { channel }`        |
| Read thread replies  | `mcp__jack-slack__slack_get_thread_replies { channel, ts }`     |
| List channels        | `mcp__jack-slack__slack_list_channels`                          |
| Look up user / users | `mcp__jack-slack__slack_get_user_profile` / `slack_get_users`   |
| Add a reaction       | `mcp__jack-slack__slack_add_reaction { channel, ts, name }`     |

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

### Editing the go-launcher VS Code extension (NOT covered by sync push)

`sync-global-config.sh push` does **NOT** build or install the VS Code extension —
it only syncs scripts/skills/settings. After editing
`global-config/vscode-extensions/go-launcher/extension.js` (or `package.json`),
you MUST:

1. **Bump the version** in `go-launcher/package.json` (so VS Code treats it as an update).
2. **Build + install:** `bash global-config/vscode-extensions/go-launcher/build-and-install.sh`
3. **Reload the VS Code window** (`Cmd+Shift+P` → "Developer: Reload Window") — the
   running extension host keeps the OLD code in memory until a full reload; an
   extension-host restart alone is not enough.
4. **Verify the enabled build** is the new version (`/status`, or check
   `~/.vscode/extensions/extensions.json`) — a stale enabled build silently defeats the edit.

Skipping any of these means the running extension is still the old build, so the
change appears to "not work" even though the source is correct. (This also applies
to `terminal.integrated.tabs.title: "${sequence}"` in VS Code user settings, which
is outside this repo and only takes effect after a window reload.)

### Files Synced

| Source                            | Destination                                              |
| --------------------------------- | -------------------------------------------------------- |
| `global-config/commands/`         | `~/.claude/commands/`                                    |
| `global-config/skills/`           | `~/.claude/skills/`                                      |
| `global-config/CLAUDE.md`         | `~/CLAUDE.md` (symlink — edits are live, nothing copied) |
| `global-config/mcp.json.template` | `~/.mcp.json` (generated/expanded on push)               |

`mcp.json` has no static source — it is generated from `mcp.json.template` (repo path + env vars expanded). **Restart Claude Code after pushing mcp.json changes to pick them up.**

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

## sw-cortex Services (systemd)

The sw-cortex background services run as **systemd units** (defined in `scripts/systemd/`, installed via `scripts/install-systemd.sh`):

- `sw-cortex-web.service` — Web UI / API (`npx tsx --watch src/api/server.ts`)
- `sw-cortex-slack.service` — Slack handler, Socket Mode (`scripts/slack-handler.ts`)
- `sw-cortex-reminders.service` + `.timer` — reminder check, runs every minute

```bash
systemctl status sw-cortex-web.service     # Status
journalctl -u sw-cortex-slack.service -f   # Follow logs
systemctl restart sw-cortex-web.service    # Restart
```

> Slack message indexing is synced via `npm run slack:sync` (manual / scheduled). On this Mac, the only PM2 process is `serp-smart-search` (unrelated to sw-cortex).

---

# Supplementary Knowledge — SugarWish Ground Truth

This is the institutional memory an AI assistant **cannot** reconstruct from schemas, repo names, or org charts: how SugarWish (a corporate-gifting company) wires its systems together, who the real people are and what they own, and where the obvious-looking inference is the wrong one. Treat it as ground truth that **overrides** naming conventions, default-branch guesses, and "sensible" assumptions. Jack Kiefer (the user) is SugarWish's Solutions Engineer and sole owner-dev of **SERP** — the in-house ERP being built to replace Odoo. Most of what follows exists because it tripped up a previous assistant.

---

## TL;DR — Read This First

- `laravel_live` is **NOT** "the SERP database" — it is SugarWish's PRODUCTION Laravel e-commerce DB that co-hosts a thin, near-empty `serp_*` bridge. Live SERP data lives in the **darklaunch** DBs. When Jack says "live" he means `laravel_live`.
- SERP has **NO** dedicated production DB (as of June 2026) — it runs on the live Laravel/MySQL cluster. There is no `serp_prod` server.
- `*_replica` = clean, sparse, **pure Laravel mirror with ZERO Odoo data**; `*_darklaunch` = the full live Odoo-MERGED dataset the worker writes. **Never** interchange these names.
- `live_darklaunch_db` (MySQL `serp_test` on Hetzner `5.161.233.240:3306`) is the **REAL live production darklaunch mirror** — the name "test" is a **lie**; it is the most-current copy, not a throwaway/pytest DB. **ALWAYS use `live_darklaunch_db` (live `serp_test`) when reproducing/diagnosing what the live darklaunch worker or drift monitor actually sees — NEVER the local `serp_*_darklaunch` Docker DBs.** The app/`darklaunch_mysql_pool` defaults to local `serp_prod_darklaunch`, which is reseeded from scratch and contains ZERO worker-created rows (`id != odoo_id`) — so reproducing a drift/worker comparison there silently hides the exact rows the bug is about. Compare against live `serp_test` via the `live_darklaunch_db` MCP key.
- Join SERP/darklaunch to Odoo on **`odoo_id`**, **NEVER** `id = id`. Durable origin test: `odoo_id IS NULL` = SERP-native, `IS NOT NULL` = Odoo-sourced. **NOT** any `id >= 1_000_000_000` range (that scheme was reversed the next day).
- The Odoo sync flag column is intentionally misspelled **`oddo_synchronized`** (double-d, one o) — match it exactly. Value `3` = stuck/archived-SKU, `5` = error.
- `stock_move`/`serp_stock_move` `state` enum is positive: `draft`,`confirmed`,`waiting`,`partially_available`,`assigned`,`done`,`cancel`. **`assigned` = stock RESERVED/ready-to-pick, NOT shipped.** `done` is the only state that moved inventory.
- **PERF FOOTGUN:** never filter `stock_move` state with a NEGATED predicate (`NOT IN ('done','cancel')`) on the ~15.8M-row table — forces a seq scan and times out (Odoo.sh 330s limit). Use the POSITIVE list `state IN ('draft','confirmed','waiting','partially_available','assigned')`.
- `stock_picking.state` is the Odoo picking lifecycle, **NOT** a payment/order status.
- **Jason Kiefer ≠ Jack Kiefer ≠ Anna Kifer** — three distinct people. Jason = founder/CEO (Jack's father); Jack = SERP developer (the user); Anna **Kifer** (one E) = Director of Software Dev & QA. The spelling difference is **NOT** a typo.
- SERP is a deliberate from-scratch clone of **Odoo 15's ORM** held to line-by-line parity — divergences are **bugs to fix against Odoo 15 source**, not "best-practice" refactors.
- Darklaunch is a dual-write VALIDATION/reconciliation system writing ONLY to a replica DB (never live Odoo / never main SERP), gated on **<1% drift** as the cutover-readiness signal — **not** a feature-flag library, and SERP has not yet replaced Odoo.
- Pre-cutover, **Odoo is the inventory/accounting source of truth**; SERP/Serpy READ live from Odoo, so discrepancies usually originate in Odoo's data, not SERP's.
- SERP production runs on the **Hetzner K3s cluster** (node `5.161.95.56`, namespace `serp`), **NOT** the AWS EC2. It does **NOT** auto-deploy — CI runs on push to `main` but deploy is a manual step on that node: `ssh jack@5.161.95.56` then `bash deploy-k8s.sh main`. A merge to `main` is NOT live until that runs. The old AWS EC2 `34.203.231.65` (`bash deploy.sh`, PM2+nginx) is **frozen legacy — never deploy to it.**
- `ec_order.size` is **MISNAMED** — it holds `buyer_products.id`, NOT a physical size. `sw_fulfill` = in-house vs vendor, NOT a shipment-status flag.
- **SWAC IS WishDesk** — the GitHub description "SugarWish Activity Coordinator" is misleading.
- Inventory has **no single source of truth**: sellable (SA) = Laravel `receiver_products.inventory_qty`; raw material (RM) = Odoo only; accounting/valuation = Odoo `stock_quant`/SVL.
- SERPY is an **AI inventory-ops agent** (Slack bot), NOT a typo for SERP and NOT a human.
- `git stash` is **FORBIDDEN** in all repos (it caused a silent 4-hunk drop). Never `git add -A`. To peek at committed state use `git show HEAD:path`; to see your uncommitted changes use `git diff HEAD` — never stash to "get a clean tree." When a fix belongs in a read-only repo (anything but SERP/SWAC/sw-cortex), don't try to edit it — the write-guard will deny it; print a hand-off note (what's wrong + file/line + owner) instead. Advisory by default on anything risky/data-related.
- Inventory Days formula (Jason originated): `current inventory / (last-7-day use / 7)`.

---

## The deep dictionary lives in the Knowledge Base — search it, don't preload it

Everything below the TL;DR above (the full table-by-table DB notes, the org chart & people/ownership, the per-system deep dives — Odoo / SERP / Laravel / WishDesk / Retool, the integrations & sync internals, business rules, n8n catalog, gotchas, and the glossary) **is NOT inlined here on purpose.** It is the exact content of `sw-cortex/DICTIONARY.md`, which the `knowledge` MCP indexes and serves on demand — so preloading it into every session is wasted context, and the inline copy drifts stale (it lagged `DICTIONARY.md` by a full DB-landscape revision).

**To use it, search — early, cheap, often:**

```
mcp__knowledge__search_knowledge { query: "how do SERP and Odoo ids join", limit?: 5 }
mcp__knowledge__get_knowledge_section { section: "Serpy" }   # full text when a result is truncated
```

Do this BEFORE reasoning about any SugarWish system, DB table, column meaning, cross-system flow, who-owns-what, or before any analyze/planning task. The obvious-looking inference is often documented as **wrong** — that's what the KB exists to catch. The `DICTIONARY.md` file is the single source of truth; edit it (not this file) to update the knowledge, and the index refreshes on the next search.
