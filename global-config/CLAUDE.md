# Jack's Global Claude Config

These tools and commands are available in every project.

## Working Style

How Jack wants Claude to work. These override the urge to be "helpful" by doing extra.

- **Minimal, additive change.** When asked to "also add / instead add" a column, dropdown, option, or branch, **extend** the existing structure. Do not delete, replace, or rebuild adjacent behavior, do not add new pages/files/nodes, and do not touch out-of-scope code or data unless explicitly told to. Prefer reusing/extending an existing thing over creating a new one. (e.g. "just use add and remove, not replace"; "you dont need new nodes, just make the existing thing also include X".)
- **Do exactly what's asked — nothing more.** No bonus "improvements," adjacent refactors, or speculative scaffolding. If you think scope should grow, ask first.
- **Stop the moment Jack takes over.** If Jack says he'll modify the code himself, "nevermind," or "it's not your job to do that," stop editing immediately and don't step on his changes.
- **Advisory by default.** "What do I need to change?" / "tell me what to do" / "how would I…" means **surface the diff or SQL as text** — do not apply it until told to.
- **Verify before claiming done.** Editing a file is not the same as changing the behavior. Before reporting a UI or data fix complete, observe the changed result yourself — reload the page, re-run the query, diff the output. Watch for caches, paginated slices, and stale builds that mask "no change." If you can't verify, say so instead of asserting it works.
- **No scratch files, minimal comments.** Don't create summary/scratch `.md` files or add explanatory comments unless asked. Keep output minimal and inline.

## Orchestrator / Repo Routing (hub model)

sw-cortex is the **single Claude Code hub** Jack launches (open only sw-cortex in VS Code; `.vscode/settings.json` pins new terminals to its root; run `claude` once, cwd never changes). `/go <task>` is the **one entry point** — it auto-detects the involved repo(s) and opens a real session in the right writable repo, which then runs that repo's own `/analyze`. There is no `/work` command and no repo-pick prompt. (`/analyze` and `/deploy` are **repo-local** commands — they live in each repo's `.claude/commands/` and run from inside that repo's session, not from the hub.)

- **Writable from the hub: SERP, SWAC, sw-cortex only.** All other repos (`sugarwish-laravel`, `livery`, `sw-design`, `swirl`, `sugarwish-infrastructure`) are **read-only** — read/search them freely to diagnose, but never edit. When a fix belongs in one of them, print a **hand-off note** (what's wrong + file/line + the owner to ask, from the ownership table above) instead of editing.
- **This is mechanically enforced.** A PreToolUse hook (`~/.claude/scripts/repo-write-guard.sh`) hard-DENIES any Edit/Write or `git`/`gh` commit·push·merge·worktree·PR whose resolved repo root (via `git rev-parse --git-common-dir`, so worktrees map to their owner) is not SERP/SWAC/sw-cortex. Reads are never blocked.
- **Repo roots:** SERP `/Users/jackkief/Desktop/Projects/SERP` · SWAC `…/SWAC` · sw-cortex `…/sw-cortex` · laravel `…/sugarwish-laravel` · livery `…/livery` · sw-design `…/sw-design` · swirl `…/swirl` · infra `…/sugarwish-infrastructure`.
- **Per-repo VCS:** always `git -C <root> …`; never run git from the hub cwd against another repo. Only SERP and sw-cortex have a `.claude/rules/` dir — for the others state "CLAUDE.md only", don't imply rules loaded. Each repo's conventions (SWAC `<username>/<desc>` branches + dev→staging→live; SERP Odoo-parity; sw-cortex plan-mode/verify-app) apply ONLY to that repo.
- **Worktrees:** address by absolute path; never `cd` a long-lived terminal into one. NEVER prune/remove/rm/reset the locked SERP worktrees (`SERP/.claude/worktrees/wf_817b7ab1-a1b-*`, agent worktree) or the sibling `serp-hotfix-mo-grounding` — they back active jobs.
- **SERP app run/test fallback:** SERP's live tooling (`mcp__serp-prod`, `mcp__serp-orm`, `mcp__python`, playwright) is unreachable from the hub. For run/test/verify, open a dedicated SERP session: `cd /Users/jackkief/Desktop/Projects/SERP && claude`. The hub does edits/git/DB/orchestration; SERP work needing live tooling goes in a SERP-cwd session.
- **Deploy:** SERP deploys via its repo-local `/deploy` (run from a SERP session) — ships `origin/dev`→`main` to Hetzner K3s (from a `/tmp` worktree). Not a hub command.
- **`/go <task>` (or asking in plain English) opens a REAL session in the right repo.** `/go` — and conversational equivalents like "fix X in a new go" / "spin up a session for X" — auto-detect the writable repo (SERP/SWAC/sw-cortex; read-only-repo tasks route to the writable repo that owns the change) and run `~/.claude/scripts/launch-repo-session.sh <root> "<task>"` (just the repo root + the task prompt — no `--label`, no inline `set-tab-title.sh`/`claude`; the extension derives the descriptive tab name from the task), which opens a new VS Code terminal tab — titled with a short **description of the task** (not the repo), e.g. `🔨 make SERPY require an MO date`, which the running session updates as it works (`🔍 researching` → `🙋 approve?` → `✅ done`, after which the tab auto-closes ~5s later) — running a real `claude` session there with that repo's native commands + project MCP tools. **When launching, pass a clear, specific task string** so the derived tab name is descriptive. No confirmation — detect and launch. Use this whenever a task needs a repo's full toolset; the hub itself can only read/diagnose + run hub-compatible commands. **Fire-and-forget:** "launch that idea in a go and keep going" = launch the session for that idea AND immediately resume the current task — don't block on or babysit the new session; it works in parallel while the hub stays on its thread.

## Terminal Tab Status (every session, every project)

Keep this session's terminal tab title showing what you're doing. Set it as soon as the first real task starts, and update it at every status change:

```bash
~/.claude/scripts/set-tab-title.sh "<emoji> <status> · <label>"
```

| Emoji | When                                                  |
| ----- | ----------------------------------------------------- |
| 🔍    | researching / investigating / debugging               |
| 🔨    | implementing / editing files                          |
| 🧪    | running tests / verifying                             |
| 🙋    | about to stop and ask Jack for approval or a decision |
| ❓    | blocked — error or missing info Jack must resolve     |
| 📦    | PR opened, awaiting merge decision                    |
| ✅    | task finished                                         |

`<label>` = 1–3-word task label (kebab-case fine). Set 🙋/❓/✅ **before ending the turn** — that's the state Jack sees while the tab sits idle. The global hooks (Stop/Notification/PostToolUse → `tab-title-hook.sh`) re-stamp the latest value automatically, so only update it at transitions, never repeatedly. If Jack set a name via `/tab-title`, keep his label text and only update the emoji/status portion. `/tab-title --clear` returns the tab to automatic titles. Mechanism docs: `~/.claude/scripts/TAB_TITLES.md`.

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
- Starting any analyze/planning task (`/global-analyze`, `/global-quick-analyze`, or a repo's own `/analyze`)

The obvious-looking inference is often documented as **wrong** — that's what the KB exists to catch. Search it the way you'd search the web: cheap, early, often.

**Updating the KB:** it indexes `sw-cortex/DICTIONARY.md` directly — edit that file and the index refreshes itself on the next search (no ingest step). `/refresh-knowledge` distills new session learnings into the doc.

## Global Slash Commands

| Command                               | Description                                   |
| ------------------------------------- | --------------------------------------------- |
| `/start-day`                          | Morning routine: sync → tickets → KB → triage |
| `/slack-search [query]`               | Search Slack messages                         |
| `/db query [database] [sql]`          | Query databases                               |
| `/global-analyze [description]`       | Deep pre-implementation analysis              |
| `/global-quick-analyze [description]` | Quick codebase assessment                     |
| `/meeting [title]`                    | Save meeting notes + index to Qdrant          |
| `/refresh-knowledge`                  | Update the knowledge base docs                |
| `/draft-slack [context]`              | Draft a Slack message                         |
| `/ww [description]`                   | WishDesk work helper                          |
| `/tab-title [name]`                   | Set/clear this terminal tab title             |
| `/compact-global`                     | Compact + resume global context               |

## Global Skills

| Skill          | Trigger                                        |
| -------------- | ---------------------------------------------- |
| `n8n-workflow` | When asked to create n8n workflows/automations |

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
- `live_darklaunch_db` (MySQL `serp_test` on Hetzner `5.161.233.240:3306`) is the **REAL live production darklaunch mirror** — the name "test" is a **lie**; it is the most-current copy, not a throwaway/pytest DB.
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
- `git stash` is **FORBIDDEN** in all repos. Never `git add -A`. Advisory by default on anything risky/data-related.
- Inventory Days formula (Jason originated): `current inventory / (last-7-day use / 7)`.

---

### Executive Org Chart

All report to CEO/founder **Jason Kiefer**. Technology org is co-led by **Seth Finley (CTO)** + **Anna Kifer (Director, Software Dev & QA)**.

| Person                   | Title                               | Slack ID      |
| ------------------------ | ----------------------------------- | ------------- |
| Jason Kiefer             | Founder / CEO / owner               | `U07P61DHV`   |
| Ric Marquis              | CFO / VP Finance                    | `U01N7G9DSLC` |
| Seth Finley              | CTO (co-leads Technology)           | `U088ZMSCA`   |
| Matthew Patrick ("Matt") | COO / Operations & New Products     | `U01NS0UJ802` |
| Anna Kifer               | Director, Software Development & QA | `U013F8WT18X` |
| Clare McClaren           | VP Creative & Merchandising         | `U034VB6F886` |
| Mike Fraser              | Director of Supply Chain            | `U029Y2X828P` |
| Lindsay Monson           | Director of Marketing (Adwords/SEO) | —             |
| Melissa Mills McLoota    | VP People & Culture (HR/handbook)   | —             |
| Elisabeth Vezzani        | Co-founder                          | —             |
| Leslie Lyon              | Co-founder; Chief Creative Officer  | —             |

### Tech Principals & Key Owners

**Jason Kiefer** — CEO; final word on product/pricing/strategy. Despite being exec, deeply hands-on: processes WishDesk tickets, runs SQL/Retool, ships PRs, fixes data in Laravel (`design_boxes`, sw-design). Owns `jasonbkiefer` org: `SWAC` (=WishDesk), `swirl` (=WishWorks), `sw-design`. Originated: **core SKU** concept, 90% availability goal, `is_core` flag, `sa_inventory_days`, `total_inventory_days`, Inventory Days formula, canonical forecast view `serp.sugarwish.com/forecast/live-products`. Architected Proposal system, design suite, custom shoppe, Custom Merchandise + AI/SWIRL. Final escalation on discounts (`#enterprise`). Local SWAC repo: `/Users/jasonkiefer/Documents/GitHub/SWAC`.

**Jack Kiefer** — the user; Solutions Engineer; sole SERP owner-dev (~95% author). jack@sugarwish.com; Colorado; `Jack-Kiefer` org; repo `Jack-Kiefer/SERP`; prod server `/opt/SERP`. De-facto PM of SERP; runs weekly SERP meeting (Tue 8 AM); plans in `#serp-planning`. Owns: SERP, SERP↔Odoo↔Laravel sync, Volume & Supplier Forecasting app, shipping report, auto-disable/drop-level workflow, order queue, darklaunch replica, n8n automations, Retool dashboards, SERPY. Joined dev team ~mid-Feb 2025. Infra/Hetzner = **Munyr** (Jack is a consumer); cross-team design/product = **Jason**.

**Anna Kifer** — Director, Software Dev & QA; dev PM, QA gate, SERP sponsor. Owns Jira/WishWorks board; approves/assigns/triages WW-\* tickets (gated on Seth's technical approval). Gates QA, dev on-call, glitch-to-bug process, release timelines, "Tech L10". Primary liaison to Prixite/Manish; co-sponsor AWS→Hetzner. Ticket actions attributed to "Anna Kifer via WishWorks UI" in commits.

**Seth Finley** — CTO / lead infra + platform engineer (**internal employee, NOT a contractor**). Owns `sugarwish-odoo` + `sugarwish-laravel` (org `sethfinley`) + `sethfinley/sugarwish-frontend-react`; Odoo prod + staging-new on **Odoo.sh** (`sethfinley-sugarwish-odoo-main-*`). Runs DB replications/cutovers; oversees Jenkins (via Munyr); owns external API accounts (USPS, Smarty/Avalara, SendGrid). Reframed SERP as sequential phases (POs first). His Odoo work is **automated**, not manual record-editing.

**Matthew Patrick** — COO; ops-side product owner; SERP exec/business sponsor. Sequences Jack's priorities; confirms launch-viability. Primary consumer of `/forecast/ecard-inventory`.

**Ric Marquis** — CFO / VP Finance. Owns payables, QuickBooks, bill/PO reconciliation. **Hard non-negotiable SERP requirements (must precede Odoo deprecation):** FIFO costing, inventory valuation, COGS, monthly manufacturing report, PO report, roll-forward report. Works with **Erly** (heaviest Odoo inventory user) on costing.

**Mike Fraser** — Director of Supply Chain. Owns inventory accuracy, replenishment, purchasing/supplier forecasting; primary stakeholder of Jack's supplier forecast; skeptical of Odoo's inventory accuracy.

**Carolyn Pardee** (`U011CPHRPMH`) — Operations/Inventory Manager (NOT a software engineer). Owns BoM/kit/packaging setup in Odoo, inventory location rules, EW coordination. Jack's ops counterpart for SERPY (usual draft approver); one non-Jack SERP branch: `carolyn/pack-tomorrow`. Reluctant to move kits before SERP fully implemented.

### Operations, Warehouse & Purchasing

| Person            | Slack ID      | Site/Role                                                       |
| ----------------- | ------------- | --------------------------------------------------------------- |
| Sophie Jalowsky   | `U01JMCHDX0F` | Fulfillment ops & volume planning lead (EW+TY); Dir of Ops CO   |
| Tracy Kamin       | `U066CLB2R8Q` | TY/Taylor fulfillment lead (FC Mgr MI); executor                |
| Jose Miranda      | `U03DEL9KYR0` | EW warehouse lead; submits Serpy ops                            |
| William Meilinger | `U05PPBBJ4H4` | EW fulfillment/packing — **NOT Neal** (Neal = `U02SRPY7N2V`)    |
| Neal Hustava      | `U02SRPY7N2V` | Purchasing/buyer; wine/Vinebox owner (with Brian `U08KVEQD3FU`) |
| James Emeric      | `U06UV0142S0` | Buyer; reported forecast 1000-row export limit                  |
| Erly              | —             | Heaviest Odoo inventory user; feeds Ric's roll-forward          |

### Product Catalog Owners

| Person                    | Slack ID      | Decides                                                           |
| ------------------------- | ------------- | ----------------------------------------------------------------- |
| Clare McClaren            | `U034VB6F886` | VP Creative; ecard consolidation; coordinates annual price change |
| Kelley Meiser (kelleymax) | `U099GLS5D`   | Product-type migration; `drop_level`; tags seasonal/legacy        |

### Offshore Dev / QA Team (Prixite vendor — channel `#odoo-prixite` `C07QRF6MHD4`)

| Person                        | Track/Role                                       | Slack ID      | GitHub / Notes                                                                          |
| ----------------------------- | ------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| Manish Chaudhary              | Lead; most Odoo-experienced; SERP secondary lead | `U03858W1K7C` | Nepal; owns Odoo→SERP migration scripts; merges blue→main; applies live `manage` schema |
| Bilal Ahmed                   | Senior Integrations Dev                          | `U07BM9JHGAZ` | Pakistan; `bilalahmed-1994`; Laravel 11 upgrade                                         |
| Subash Chaudhary              | Laravel-track dev                                | `U03A13MS7KL` | Nepal                                                                                   |
| Parish Shrestha               | WishDesk/SWAC-track **technical lead**           | `U045FJ66K6K` | Nepal; `sw-parish` merge-bot; runs dev→staging→live                                     |
| Aashish Shrestha              | Junior dev (low-risk only)                       | `U03RUA9F5EX` | Nepal; `beingaashish` / `aashish/WW-*`                                                  |
| Munyr Ahmed                   | DevOps/infra lead                                | `U068USJ2LQM` | Pakistan; `itsmunyrhere`                                                                |
| Jaypee (John Pascual Lalucis) | Test Manager / QA                                | `U0201JZHJDR` | Philippines; `JaypeeLalucis`; bulk-updated ~14,000 `card_id`s                           |
| Dhon Kekim                    | QA Automation                                    | `U06QJFASK8W` | Philippines; `dhonkekimsugar`                                                           |
| Hamza Khan Niazi              | Historical Odoo dev                              | `U07RAQ8LCE5` | `prixite_customization` module; last commit Jul 2025                                    |
| Zain Arshad                   | Prixite Odoo (v15→v17 upgrade)                   | `U07QRFBM19C` | zain.arshad@prixite.com                                                                 |

**NOT interchangeable:** Manish = lead/Odoo+SERP; Subash = Laravel-track; Parish = SWAC-track; Aashish = junior.

**Munyr** owns **Jenkins** (org-wide CI/CD for ALL platforms, `ciservice.sugarwish.com`) and the company-wide **AWS→Hetzner migration**. The `manage` MySQL cluster is already fully on Hetzner (AWS `manage` shut down ~Apr 29 2026); darklaunch MySQL at `5.161.233.240` (created ~Apr 28 2026). Jack is a consumer of infra, NOT its driver.

### Customer Service & Other Roles

| Person               | Slack ID / GitHub                 | Role                                                                                   |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Madison Meilinger    | `U021G7V41D1`                     | CS & WishDesk ops lead — **NOT a developer**                                           |
| Madison Parks        | `madison-m-sugarwish`             | SWAC **developer** (Vinebox, email threading) — **Parks codes; Meilinger runs CS**     |
| Ellen Nelson         | `UMSMMGL22`                       | CS/WishDesk lead; Gift Concierge + WishDesk KB; billing lead                           |
| Payton Castaneda     | `U01ERBYFHMJ` / `paytoncastaneda` | WishDesk admin/agent setup; Outreach & Sales Tech                                      |
| Tara Kliebenstein    | —                                 | Billing lead                                                                           |
| Cris / Criston Sloan | `U040UH4GVPX` / `csloan-sw`       | Automation Engineer (reports to COO); owns `csloan-sw/livery` (=SWOP); SERP user id 13 |

### Repo / System Ownership

| Repo / System                              | Owner                                 | Notes                                                        |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------ |
| `Jack-Kiefer/SERP`                         | **Jack** (solo)                       | Reviewed by Seth+Anna; sponsor Matt; `carolyn/pack-tomorrow` |
| `sethfinley/sugarwish-laravel`             | **Seth** + Prixite                    | Main/legacy e-commerce monolith                              |
| `sethfinley/sugarwish-odoo`                | **Seth** + Prixite (Manish)           | `prixite_customization`; Odoo 15 modules                     |
| `sethfinley/sugarwish-frontend-react`      | **Seth**                              | React receiver app                                           |
| `jasonbkiefer/SWAC` (= WishDesk)           | **Jason** org; **Parish** lead/merger | CS ops: Madison Meilinger                                    |
| `jasonbkiefer/swirl` (= WishWorks + SWIRL) | **Jason** org; **Anna** runs board    | WW-\* tickets                                                |
| `jasonbkiefer/sw-design`                   | **Jason** + Clare McClaren            | Builder configs, box recipes, icon manifests                 |
| `csloan-sw/livery` (= SWOP)                | **Cris Sloan** (seeded by Jason)      | Print-station; MCP suite                                     |
| `laravel_live` (MySQL)                     | **Seth** (DB replications)            | SugarWish prod e-commerce — **NOT SERP**                     |
| Jenkins / CI/CD (all platforms)            | **Munyr**                             | `ciservice.sugarwish.com`; Seth oversees                     |
| Odoo prod + staging-new (Odoo.sh)          | **Seth**                              |                                                              |

> Repo ownership ≠ authorship. SWAC lives under `jasonbkiefer` but is built by the offshore dev team. **SERP is NOT in the SWIRL who-owns-what doc** — it is Jack's domain.

---

## The Systems & How They Connect

| Repo                | What it is                                                                | Stack                                                       | Prod branch / flow                                                 |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `SERP`              | In-house ERP replacing **Odoo 15**, built from scratch                    | Python FastAPI/Uvicorn + custom ORM on MySQL; Next.js/React | `main` (manual deploy); `dev` = development                        |
| `SWAC` (= WishDesk) | CS/fulfillment desk + proposal/receiver flows                             | React + Express + TS + MySQL + Drizzle                      | `live` (dev→staging→live)                                          |
| `sugarwish-laravel` | Main/legacy e-commerce monolith                                           | Laravel 11 / PHP 8.2 / MySQL 8                              | `main` ← `blue` (integration) ← `manage` (staging) ← `development` |
| `sugarwish-odoo`    | Custom Odoo 15 modules                                                    | Odoo 15.0.1.3 / PostgreSQL                                  | `main` ← `staging_new`                                             |
| `sw-design`         | Design/asset pipeline (ecards/sleeves/boxes/merch/Genie configs)          | Build scripts → S3 → WishDesk                               | —                                                                  |
| `swirl`             | SWIRL AI knowledge platform **AND** WishWorks ticket datastore (one repo) | docs + MCP/Slack/Qdrant                                     | —                                                                  |
| `livery`            | Ops-tooling MCP suite **AND** sleeve imposition/printing (Mac Mini)       | Express + MCP servers                                       | —                                                                  |

### SERP — The Odoo-Replacement ERP

- Live at `serp.sugarwish.com`. Target launch **~early Aug 2026** (before Q4/Halloween peak). Timelines have slipped repeatedly — treat all SERP dates as **soft**.
- **NOT** a dashboard/replica — SERP **re-computes** Odoo's logic locally on MySQL; intended to **replace Odoo entirely**.
- Two frontend apps: **red sidebar** = ERP (POs, kits, suppliers); **teal sidebar** = Forecast (isolated subsystem).
- **4 phases:** (1) Purchase Orders, (2) Bills, (3) Raw Materials/Components/Kits/BOMs, (4) Manufacturing Orders & Inventory. Odoo sunset target ~Jul 2026. Product-line rollout order: Popcorn/EW → cupped products → all.
- ~25–50% complete as of Jan 2026. Viable only after Seth reframed it into sequential pieces (POs first) with Odoo dual-running. **No "do nothing" option** — if SERP stalls, Odoo 15 must still be upgraded v15→v17 before deprecation.

**SERP schema & code:**

- `serp_*` MySQL tables = 1:1 mirror of Odoo PG schema (50+ models, ~1018 fields), using **Odoo dot-names** (`stock.picking`, `stock.move`, `mrp.bom`, `mrp.production`, `purchase.order`, `sale.order`, `account.move`, `stock.valuation.layer`, `stock.quant`, `res.partner`…).
- Costing is **FIFO** via `stock.valuation.layer` (SVL). Chain: `button_validate → _action_done → _consume_fifo → _create_out_svl → create_valuation_journal_entry` → Stock Journal (STJ, `journal_id=6`).
- `serp_product` bridge links to `components` (raw materials) and `receiver_products` (finished goods) via `component_id` / `receiver_product_id`.
- Single endpoint `POST /api/call_kw` dispatches to `@api.callable` model methods. New logic → fat ORM models in `serp_orm/models/`. **Never** add per-resource REST routers for ORM-backed resources. REST routers (`backend/routers/`) exist only for auth, forecast, Odoo sync, inventory_sync, receipts.
- **Canonical approved divergences** (documented in `docs/ODOO_APPROVED_DIFFERENCES.md`; suppressed in drift monitor): `button_confirm` allows empty PO (test-pinned); no bin-level putaway; byproducts via `serp_mrp_bom_byproduct`; sale-order names `f"S{ec_order_id}"` not via `ir.sequence`; no invoicing flow; no `supplier_rank` bumps; SERP uses **CONTINENTAL** accounting (Odoo = Anglo-Saxon); no reconciliation engine (`payment_state` force-written). **Any OTHER divergence = bug.** Fix against Odoo 15 source (`raw.githubusercontent.com/odoo/odoo/15.0`). Slash commands: `/check-odoo-alignment`, `/odoo-fix-divergence`.

**SERP auth (two unrelated layers):**

- **nginx HTTP Basic Auth** — `serp_admin` / `swserp12`, checks `/etc/nginx/.htpasswd`. Browser-cached (Safari flushes aggressively). `deploy.sh` does NOT regenerate `.htpasswd`. Repeated "sign in" popup = Basic-Auth cache flush, NOT a JWT bug.
- **In-app JWT login** — 15-min HS256 access token in memory; 7-day refresh token as HttpOnly cookie scoped to `/api/auth`.
- Identity/auth data in **`serp_res_users`** (MySQL `manage`, post-2026-03 migration); group-based RBAC via `serp_res_groups`. Retool `serp_users` is now a stripped bridge (`id` → `orm_user_id`), still hit on every authenticated request. `_backup_serp_users` is stale.
- Internal-vs-external redirect race: checks `user.groups?.some(g => g.full_name === 'base.group_user')`; right after login `groups` hasn't loaded → valid internal user briefly sent to `/external-access`. "Why does it think I'm external?" = groups-not-loaded race, not permissions.
- `is_internal` gates all internal API access (false → 403 `external_user_redirect`). External users = **suppliers** (Redstone, Blair Candy), portal-only.

**SERP deploy:**

- **Production is the Hetzner K3s cluster** (node `5.161.95.56`, namespace `serp`, app root `/opt/SERP`, live host `serp.sugarwish.com`). Deployments: `serp-backend` (replicas 2 — safe since live-path refresh tokens moved to shared Redis `serp:refresh_token:<hash>`), `serp-frontend`, `serp-workers` (replicas 1 — the ONLY place workers run). Darklaunch prod DB on Hetzner (`5.161.233.240`). The AWS EC2 `34.203.231.65` (`/opt/SERP`, PM2 + nginx, old `deploy.sh`) is **FROZEN LEGACY — NOT production, never deploy to it.**
- Deploy (manual): `ssh jack@5.161.95.56` then `cd /opt/SERP && bash deploy-k8s.sh main`. A merge to `main` is NOT live until this runs. `deploy-k8s.sh` runs the `migrate:serp-app` phase before rolling pods.
- **K3s deploy footgun:** each un-pruned deploy leaks ~1.3GB into `/var/lib/containerd` (Docker uses the containerd image store — `/var/lib/docker` looks tiny and misleads `du`); kubelet image GC force-kicks at 85% disk. `deploy-k8s.sh`'s final prune phase keeps current+prev `$TAG` + `:latest`.
- **AWS↔Hetzner split (post ~Apr 29 2026):** migrated to Hetzner = SERP app (K3s), darklaunch MySQL (`5.161.233.240`), `manage` cluster, Desk2/Desk3. **Still on AWS** = frozen legacy SERP EC2, ALB, ElastiCache Redis, S3 (`sw-serp` bucket), and **`laravel_live` MySQL** (RDS `database-1…us-east-1`, reached via **SSH tunnel** — that's why `laravel_live` queries need the bastion).
- **(Legacy AWS EC2 only)** PM2 caches env vars (`pm2 restart/reload` does NOT pick up `.env`; needed `pm2 delete serp-backend` then `pm2 start … --only serp-backend`); PM2 over non-interactive SSH needed `export PATH=/home/ubuntu/.nvm/versions/node/v20.20.1/bin:$PATH; PM2_HOME=/home/ubuntu/.pm2`. On Hetzner K3s prod there is **no app-side PM2** — env comes from the `serp-env` K8s secret (`envFrom`); changing it requires re-applying the secret + rolling the deployment.
- Local dev: backend `:8000`, frontend `:3002`; login `jack@sugarwish.com` / `localdev123`. Slack interactivity locally needs ngrok.
- **`deploy.sh`/`deploy-k8s.sh` do NOT run schema migrations against the prod `manage` cluster (now on Hetzner, not AWS RDS).** New `serp_*` tables/columns must be applied to the live `manage` DB manually (by Manish + DBA) **BEFORE** code ships.

**SERP workers** — three K3s deployments:

| K3s deployment  | What                      | `WORKERS_ENABLED` |
| --------------- | ------------------------- | ----------------- |
| `serp-backend`  | gunicorn, uvicorn workers | **false**         |
| `serp-frontend` | Next.js                   | —                 |
| `serp-workers`  | replicas 1 — only worker  | **true**          |

- All background workers share **one asyncio event loop** in `serp-workers` (replicas **1** — the ONLY place workers run). No row-level locking — a second worker replica (or multi-worker gunicorn) would double-fire Slack pings / emails / pickings. `WORKERS_ENABLED=false` on `serp-backend` is set via the `serp-env` K8s secret/`envFrom`, **invisible in inline `env:`** — check `kubectl exec -- printenv`.
- **Worker can silently hang forever** on idle-dropped sockets (`asyncpg pool.acquire()`, `xmlrpc.client`, PyMySQL) — the pod shows "Running" while wedged. Fixes: bounded `pool.acquire()` + `asyncio.wait_for` watchdog; supervisor restarts wedged workers (added 2026-05-29). Recovery: roll the `serp-workers` deployment.

### Darklaunch

- **Dual-write / parallel-run validation, NOT a feature-flag library.** `darklaunch_order_worker.py` **REPLAYS** Odoo's order writes through the SERP ORM into a separate MySQL mirror. **Never** touches live Odoo or the main SERP ORM pool.
- Gated by env **`SERP_DARKLAUNCH_ENABLED`** (default **False** in prod). When OFF, behavior is identical to pre-darklaunch. Darklaunch is **additive** — safe to disable temporarily.
- When ON, Serpy appends `SYNC_TARGET_SERP_DARKLAUNCH='serp_darklaunch'` alongside every Odoo target → **two** `odoo_sync_queue` items per op. Handlers in `backend/workers/handlers/serp_orm/` use the same functions as the SERP ORM, different connection pool (`get_darklaunch_pool`, `serp_orm/darklaunch_pool.py`). Routing-key prefixes: `serp:<entity>` vs `serp_darklaunch:<entity>`.
- **Invariant:** darklaunch must NOT change what the underlying op does.
- Cutover recorded per-env at `serp_darklaunch_meta.darklaunch_cutover_at` (prod `2026-06-04 09:27:20`, staging `2026-06-03 11:52:27`). Must be set BEFORE the seed snapshot or orders in the gap get lost. Validation gate: **<1% drift, stable 2 weeks**. Event log: `serp_darklaunch_processed_events`. Tools: `/compare-darklaunch`, `/compare-orders`, `compare_odoo_replica.py`.

### Serpy

- **AI inventory-ops agent** (Slack bot `SERPY` / `SERPY Dev`, user `U096P936NQ7`). Code in `backend/serpy/`. NOT a dev experiment, NOT a typo for SERP, NOT a human.
- Ops describe inventory changes in plain English → Serpy generates structured JSON ops → human approval → pushed to Odoo via XML-RPC. Drafts post to **`#inventorymanagement`** (`C03G8LP36P6`) for approval; web UI `serp.sugarwish.com/serpy/<draft_id>`.
- Pipeline: `classify_intent → find_products → propose_operations → DRAFT (serp_draft_operations/_live) → /save-raw-draft` (validates against `OpTypeRegistry` in `serpy/ops/types.py`) `→ /ai-submit` (DRAFT→PENDING_APPROVAL) → human approval → `odoo_sync_queue_live` (Retool PG) → odoo-sync worker (~30s poll) → XML-RPC + local mirror + Laravel (`manage` MySQL).
- Lifecycle: `DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED`. Drafts numbered ("Draft #860"). **Nothing hits DB or Odoo until approved.** Rule: "don't change anything about who can approve serpy."
- Drafts are **per-user**, keyed by Retool `serp_users.id`, **not** Slack id.
- In `x/y synced`: `y` = total ops, `x` = succeeded into Odoo. **Partial count = Odoo-side validation rejection, NOT a SERP failure.**
- Op families: `odoo_*` (Odoo), `serp_*` (local phantom kits), `laravel_*` (`manage` MySQL), cross-system.
- "Replace SKU" = **kit component swap** (remove old + add new across every kit), NOT archive-old + activate-new.
- Guards fire on **structured facts** (`images_present`, classifier `op_types`, `has_replayed_image`), NOT semantic overlap with user text. Embeddings may add long-tail examples but **never gate/drop** a guard rule.
- **Provenance floors** (anything before its path's go-live can't be Serpy): `product_template` path **2026-03-24**, `create_product` **2026-04-13**, `create_receiver_product_everywhere` (SA- path) **2026-05-05**.

### Supplier Forecast (Teal Sidebar) — Isolated Multi-DB Subsystem

- **Out of scope for `serp_orm`.** Uses `asyncpg`/SQLAlchemy + raw SQL under `backend/services/forecast/`, REST routers `routers/forecast/`. NOT the `env.cr`/ORM-RPC pattern.
- Reads **three DBs simultaneously** via `ForecastDatabaseConnector`: `laravel_live` MySQL (active SA SKUs + SA inventory, SSH tunnel), Retool PG (SA/size projections, lead-times), Odoo PG (BOM SA→RM + RM inventory).
- Two-tier cache (L1 in-process LRU + L2 Redis; ElastiCache `rediss://` prod). Stale-while-revalidate at 80% TTL. Per-source circuit breakers. TTLs: static 600s, dynamic 300s, volatile 120s.
- Two orchestration paths both live: `SupplierForecastPipeline` (`/api/forecast`) vs legacy `ForecastService.generate_forecast` (`/inventory`, `/suppliers`, `/export`) — **fixes in one don't propagate** (CSV export can show zeros while dashboard is correct).
- Rule: add new forecast logic in `services/forecast/` (not ORM); add a **new pipeline+endpoint** rather than mutating the default. `globals.css` doesn't hot-reload — per-page CSS in a `<style>` block in the `.tsx`.

### Odoo — The ERP / Inventory / Accounting Brain

- Odoo 15 (v15.0.1.3) on **Odoo.sh** under Seth's account — **NOT self-hosted**. Prod host `sethfinley-sugarwish-odoo-main-5932805.dev.odoo.com:5432`. **Staging URL/creds change on every rebuild** — cached staging strings go stale.
- **Puller, not receiver.** Odoo runs `ir.cron` jobs that **pull** orders from Laravel's REST API (~6-min cron). **Laravel does NOT push to Odoo.** No webhooks, no real-time.
- All imported SOs book under single catch-all partner **`sugarwish_customer`** / id **94** "SW Customer". **No per-customer Odoo partners** — real customer identity lives entirely in Laravel.
- Key crons: #26 "Update Failed Orders" (every 10 min); #57 "Send Failed Orders Email" (dumps/emails `failed_products_log`, then unlinks).
- Custom modules: `sugarwish_integration` (main bridge), `purchase_features`, `sales_features`, `stock_features`, `mrp_features`, `sale_stock_picking`, `pr_vendor_product_automation`, `sw_reports`, `odoo_logger`, `prixite_customization`.

### SWAC = WishDesk

- `SWAC` (repo) = `WishDesk` (product, internally "WishWorks"). One codebase serves **both** the admin/support console **and** customer-facing proposal/receiver flows.

| Subdomain             | Env        | Branch        | DB                                         |
| --------------------- | ---------- | ------------- | ------------------------------------------ |
| `desk.sugarwish.com`  | production | `live`        | `sugarwish_wishdesk` (RDS)                 |
| `desk3.sugarwish.com` | staging    | `staging`     | ⚠️ **points at LIVE DBs** — not isolated   |
| `desk2.sugarwish.com` | dev        | `development` | `sugarwish_wishdesk_dev` + `manage` dev DB |

- Branch flow: feature → `development` → `staging` → `live`. **Not `main`.** Branch naming `<username>/<desc>`. Ticket prefixes `WD-*` / `WW-*`.
- Two DB pools: `server/db.ts` = WishDesk DB; `server/sugarwish-db.ts` = Sugarwish DB.
- **All DB timestamps stored in Mountain Time, NOT UTC.**
- Local dev auth: **cookie-based sessions** (not JWT). Needs `ENABLE_LOCAL_AUTH_BYPASS=true` + `APP_ENV=local`. Route auth: `isAgentOrAdmin` (most admin routes; **`agent` role ≠ admin**), `isAdmin`, `isAuthenticated`. Dev login fixture: `jason` / `swdev123`.
- SWAC owns sleeve **resolution** (`server/services/sleeve-resolution.ts` writes `branding_records.physical_branding`); actual PDF imposition/printing done by **livery**.
- WishDesk MCP server must run as its own PM2 app (Jenkins deploy didn't restart it → stale code on desk2: 23 tools vs 28 local).

### Other Platforms

**Insightly** (`crm.na1.insightly.com`) — legacy sales CRM, system of record for accounts/buyers. Companies = `Organisation` records; buyers = `Contact` records. Being succeeded by in-house `swcrm` (WishDesk `swcrm_*`).

**Retool PostgreSQL** — **analytics/ops scratch + cache + config layer; NOT a source of truth.** Shared "Frankenstein" multi-app DB (~165 tables, ~40 SERP-owned). Hosts SERP↔Odoo sync engine, AI observability, auth bridge, forecast caches, supplier meta, legacy Insightly CRM, BI mirrors. Table suffix convention: bare/`_dev` (local) vs `_live` (prod). Retool has been observed **overwriting `updated_at`** — don't trust it as a change timestamp.

**n8n** — self-hosted at `n8n.sugarwish.com` (v1.78.1). Fleet of hourly inventory/ops alert workflows + sync glue. NOT app code. All post as bot user "n8n" (`U08QP0DL9L5`). Pattern: PG node (Odoo read) + MySQL node (live SugarWish) + Code node + IF gate + Slack alert.

**sw-design** — Jason-owned design/asset pipeline. Source of truth for `design_images`, box+sleeve dims (`boxes/*/box.json` → `design_boxes`), merch recipes, Genie/router quiz configs (`genies/{key}.json`). Builds → S3 (`s3://sugarwish-design/`) → WishDesk syncs in (full-overwrite). AI gen: Claude + Gemini + OpenAI.

**SWIRL** (Sugarwish Intelligence Reference Library) — Jason-owned `swirl` repo; org-wide knowledge platform (markdown KB + Qdrant + discoveries + slash commands). Interface: SWIRL Bot Slack DM. Same repo also holds the **WishWorks** git-backed ticket datastore (auto-commits for WW-#### tickets). **WishWorks** = internal dev bug/feature tracker (`desk.sugarwish.com/admin/wishworks/tickets`, introduced 2026-03-12, replaced the freeform glitch process). **SWIM** = WishDesk-embedded AI chatbot (Qdrant `kb-v2`/`instructions`/`agent-chats`). All three are **separate from Jack's sw-cortex**.

**livery / SWOP** ("Sugarwish Operations Platform", `csloan-sw/livery`, Cris Sloan) — two roles: (1) sleeve/slip **PDF imposition & printing** for branded products (drives LogoJet printers, runs on Mac Mini "fulfillment appliance"); (2) **MCP-tooling backbone** (`mcp-db-tool-live`, `mcp-slack`, `mcp-wishdesk`, `swim-kb`, `custom-shop-slip`). Debug mug/sleeve PDF issues → point to **livery**, not SWAC. Deploy: `feature/*`/`fix/*` → `dev` → `main` → `production` (pre-commit hook blocks direct prod commits).

### Fulfillment Centers

| Code   | Location                   | `location_id` | SKU suffix | People                                               |
| ------ | -------------------------- | ------------- | ---------- | ---------------------------------------------------- |
| **EW** | Englewood, CO (primary/HQ) | 1             | `-E`       | Sophie, Will Meilinger, Jose Miranda, rashad.johnson |
| **TY** | Taylor, MI                 | 2             | `-A`       | Tracy Kamin; same-day delivery                       |

- Perishables (cookies, brownies) tied to one building; carton'd shelf-stable (coffee, tea) can reship from either. Remaining 13 warehouses = partner/dropship (SGD, SGM, ST, WCC, MS, PM, CPD, CPF, LR, MSS, MC, CC, PNB).
- **Production slips = two-slip custom flow:** Slip 1 (Laravel, product production) + Slip 2 (SERP print interface, sleeve production, appended as page 2). `preprints` deducts on slip generation, adds back on cancellation. Print cron runs ~5 min after buyer order; pre-prints filed by location code (`ENGLEWOOD-FILED-143`). Custom sleeves = CEO Jason's "biggest near-term revenue opportunity"; cost ~$2–5 each (min ~1000 @ $4.99; ~7–9 business days after art approval).
- Custom branding is **JSON-driven**: `branding_records` has `digital_branding`, `physical_branding`, `merchandise` JSON. **Branding record = what is OFFERED; `ec_order.merchandise_selections` JSON = what recipient CHOSE.**

---

## The 13-Database Landscape

**10 MySQL, 3 PostgreSQL.** Several `serp_*` DBs are **disposable local rebuilds**, NOT peer remote servers. `retool` is a shared multi-app DB, NOT SERP-owned.

| Database (MCP key)                 | Engine     | Role                                                                                                                          |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `wishdesk`                         | MySQL      | WishDesk/WishWorks CS+CRM+billing (179 tables, SSH tunnel)                                                                    |
| `wishdesk_dev`                     | MySQL      | WishDesk dev/staging (~5,121 users, partial sandbox)                                                                          |
| `laravel_live`                     | MySQL      | SugarWish/Laravel **PROD** — orders/customers (SSH tunnel); co-hosts ~70 sparse `serp_*` tables                               |
| `manage`                           | MySQL      | SugarWish/Laravel **STAGING** (~8% of prod); holds SERP's upstream ORM tables + `serp_res_users` auth                         |
| `local` (→`serp_local`)            | MySQL      | SERP dev partial schema (`LOCAL_DB_NAME`); all `serp_*` + ~3,091–3,449 products; **missing** `ec_order`/`items`/`kits`/orders |
| `serp_prod_replica`                | MySQL      | Verbatim mirror of `laravel_live`, ZERO Odoo data — near-empty shell                                                          |
| `serp_staging_replica`             | MySQL      | Verbatim mirror of `manage`, ZERO Odoo data — near-empty shell                                                                |
| `serp_prod_darklaunch`             | MySQL      | Odoo PROD + `laravel_live` merged — future prod DB (lagging local snapshot)                                                   |
| `serp_staging_darklaunch`          | MySQL      | Odoo STAGING + `manage` merged — active staging SERP DB                                                                       |
| `live_darklaunch_db` (`serp_test`) | MySQL      | **Live PROD darklaunch** on Hetzner `5.161.233.240:3306`; canonical/most-current write target                                 |
| `odoo`                             | PostgreSQL | Odoo 15 ERP PROD — inventory/accounting source of truth                                                                       |
| `odoo_staging`                     | PostgreSQL | Near-identical staging clone (lags prod ~2 weeks / ~110k orders)                                                              |
| `retool`                           | PostgreSQL | Shared BI + SERP sync engine + auth bridge + AI observability + forecasting (~165 tables)                                     |

### Fingerprinting

- **Table prefix:** `serp_stock_move` = SERP's **MySQL mirror** of an Odoo model; same name **without** `serp_` (`stock_move`, `sale_order`) = native **Odoo PostgreSQL**. SugarWish/Laravel: `giftcards_card`, `ec_order`, `cart`, `preselect_orders`, `company`. WishDesk/CRM: `swcrm_*`, `swcrm_z_gmail_*`, `design_*`, `ds_*`, `orders_*`, `sw_billing_*`.
- **Darklaunch vs replica:** darklaunch DBs _only_ have `_migrations` + `serp_darklaunch_meta`. **Absence of `serp_darklaunch_meta` = it's a replica**, not darklaunch.
- `live_darklaunch_db` is consistently **AHEAD** of local `serp_prod_darklaunch` (e.g. ~35,983 vs ~34,289 moves) — treat it as canonical; the local is a lagging snapshot. Rebuild via `npm run db:push:prod-darklaunch`; **pause the worker first** (`pm2 stop serp-workers`) or get MySQL **1412 "table definition changed"**. Local Docker darklaunch: `127.0.0.1:3307`, user `devuser`.

### Two Separate Flags (do not conflate)

1. `*_replica` — clean verbatim Laravel/manage mirrors, no Odoo overlay.
2. `serp_shadow` (Hetzner) — handler-correctness validation under real prod traffic; gated by **`SERP_SHADOW_WRITES_ENABLED`**.
3. Darklaunch proper — `*_darklaunch` locally / `serp_test` on Hetzner; gated by **`SERP_DARKLAUNCH_ENABLED`**.
4. Local `serp_shadow_meta` — the **predecessor** mechanism to darklaunch (`serp_local`, cutover `shadow_cutover_at = 2026-05-08`); NOT the Hetzner DB.

`SERP_SHADOW_WRITES_ENABLED` ≠ `SERP_DARKLAUNCH_ENABLED`. `/compare-darklaunch` (renamed 2026-05-28 from `/compare-replica`) compares against the **darklaunch** DB, not `*_replica`.

### The `id` / `odoo_id` Join Invariant (the #1 footgun)

Three id buckets on every `serp_*` table holding both Odoo and SERP rows:

| Bucket                 | `id` vs `odoo_id`                                                                  | Origin                      |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| Odoo-seeded            | `id == odoo_id` (Odoo's own id, < 1B)                                              | seeder                      |
| Worker-created, linked | `id` = MySQL AUTO_INCREMENT past Odoo range; `odoo_id` = Odoo id → `id != odoo_id` | darklaunch worker           |
| SERP-origin            | `odoo_id IS NULL`                                                                  | worker, no Odoo counterpart |

- **ALWAYS join `darklaunch.odoo_id = odoo.id`, NEVER `id = id`** (IDs diverge independently).
- Durable origin test: **`odoo_id IS NULL` = SERP-origin** (increasingly common for new receiver-orders). NOT the `id >= 1_000_000_000` scheme — `SERP_ORIGIN_ID_FLOOR = 1_000_000_000` was **reversed the next day**; code assuming a 1B floor is stale.
- Worker rows most reliably identified by `name = 'S' + ec_order_id`, NOT heuristic `id != odoo_id`. **SERP data wins conflicts** — Jack explicitly rejected a `serp_id` surrogate.
- Child rows (`stock_move`, `stock_move_line`, quants) often have `odoo_id = NULL` until later stamped. Drift tooling only diffs rows where `odoo_id IS NOT NULL`.

---

## Odoo (PostgreSQL) — the ERP Source of Truth

- `sale_order` history begins **2022-11-15** (id=1); older orders only in legacy Laravel. Prod `sale_order` max id ~2,352,430; staging max ~2,342,312.

### Sales

**`sale_order`** (~2.21M rows) — `name` = `S#######` (used as `stock_picking.origin`). `state`: `sale`=active (~2.14M), `cancel` (~66k), `done` (6, ignore). `partner_id` is **ALWAYS 94** (grouping collapses to one bucket). **`sw_id`** = Laravel order id = THE cross-system join key. `name = 'S'+digits` is **NOT** the same as `id`. On confirm: spawns `stock_picking` + one `stock_move` per BOM component.

**`sale_order_line`** — `product_uom_qty`=ordered; `qty_delivered`=shipped (from `done` moves). `display_type`=`line_section`/`line_note` → header rows (no `product_id`); **exclude when summing**.

### Inventory

**`stock_picking`** — transfer header. `name` = `WAREHOUSE/OPERATION/number` e.g. `EW/OUT/3178644` (trailing number ≠ id ≠ SO number). `state`: draft→confirmed→`assigned` ("Ready" = reserved, **NOT shipped**)→`done` (~3.02M)/cancel. **Only `done` moves inventory**; stuck `assigned` pickings cause phantom reservations. `origin` = TEXT source-doc (`P01906`/MO/`S#######`) — join picking→PO via TEXT `origin`, NOT id. `move_type`: `one`=all-or-nothing (~99.7%, SW default) vs `direct`=partials allowed.

**`stock_picking_type`** (135 rows = 9 types × 15 warehouses) — `code`: `incoming` (Receipts AND Returns), `outgoing` (Deliveries ~3.0M), `internal`, `mrp_operation`. EW ids 1–9 (id 2 = Englewood Delivery Order); TY 10–18. Always join for `code + warehouse_id` (each warehouse reuses different ids).

**`stock_move`** (~**15.8M rows**: ~14.4M done, ~1.45M cancel) — see TL;DR footgun. Delivery = `location_id=2008` (EW/Stock/Fulfillment) → `location_dest_id=5` (Customers). ~4.4k `assigned` + ~1.3k `confirmed` are **stuck** from old/cancelled orders, falsely locking `stock_quant.reserved_quantity`. `bom_line_id` present on MO raw-material moves AND phantom-kit delivery moves.

**`stock_move_line`** (~14.5M) — `product_uom_qty`=reserved/planned; `qty_done`=executed. `do_unreserve()` can leave line at qty=0 while parent move stays `assigned` = **zombie reservation** (Odoo bug). Orphan-reservation diagnostic: `location_id=2008 AND product_uom_qty>0 AND state NOT IN ('done','cancel')`.

**`stock_valuation_layer`** (SVL, ~13.4–14.4M) — FIFO costing ledger, **company-wide FIFO** (all 115 `ir_property` rows `value_text='fifo'`). `quantity`/`value` are **SIGNED** (positive=receipt, negative=delivery/COGS). `remaining_qty`/`remaining_value` = unconsumed inbound portion (~3,900 layers >0); SUM(`remaining_value`) per product = current inventory $. **NO `sequence_number` column** — FIFO order = `id`/`create_date` ascending.

**`stock_quant`** — on-hand snapshot (not a log). **AVAILABLE = `quantity` − `reserved_quantity`.** Filter on-hand by `usage='internal'` (NOT `inventory_date IS NOT NULL`). Cycle-count to zero does NOT clear reservations → `quantity=0` + `reserved_quantity>0` = negative available = **root cause of negative "West Coast Qty"** in Laravel. ~5,900 negatives; only internal-location negatives are bugs (virtual-location negatives are normal). Odoo rejects quants on consumables/services.

**`stock_location`** (~2,686) — `usage`: `internal`=real owned stock (EW/Stock/Fulfillment **id 2008**, TY/Stock/Fulfillment id 2006); `supplier`=Vendors **id 4**; `customer`=Customers **id 5**; `production`=15; `inventory`(adjustment)=14; scrap=16. `sugarwish_id`: EW=1, TY=2, 0=Odoo-only, NULL=virtual. ~88 duplicate internal shelf locations.

**`stock_warehouse`** (15 rows, 13 active) — EW=id 1, TY=id 2. All warehouses `reception_steps=one_step`, `delivery_steps=ship_only` — receipt/delivery is **one move, not a chain**.

**`stock_scrap`** (~1,590): only `done` reduces inventory. **`stock_landed_cost`** (~97): adds VALUE only — does **NOT** add `stock_quant.quantity`.

### Manufacturing

**`mrp_production`** (~28k, mostly done) — `name` e.g. `EW/MO/05584`. **Phantom/kit BOMs create NO MOs** — kits explode directly into component delivery moves.

**`mrp_bom`** (~2,194) — `type`: `normal`=real manufacturing BOM; `phantom`=KIT (explodes at SO confirmation, NO MO). **All 813 phantom BOMs are `active=false`.** ~97.9% have `product_id` NULL (linked via `product_tmpl_id` only) — matching on `product_id` alone causes "no BOM found".

**`mrp_bom_line`** (~6,845) — `product_qty` = component qty per parent unit; **~437 lines have `product_qty=0`** (optional packaging) — filter `product_qty>0` as denominator. **`mrp_unbuild`** (~200): reverse-MO; `done` adds component stock, removes finished-good.

### Product

**`product_template`** (~7,278) — SKU prefixes (see Glossary). `detailed_type`: `product`=stockable, `consu`=consumable, `service`. **`sugarwish_id`** = external sync key, lives on **template only** (NOT `product_product`). **`product_product`** (~7,278) — `default_code` = SKU = THE cross-system join key (`SA-15-014-A`). **~483 rows have NULL `default_code`** — exclude (`WHERE default_code IS NOT NULL`). **Join Odoo↔Laravel on `default_code` (SKU), never `product_id`.** **`product_category`** (~137): organized by TYPE not pack size; cost method NOT a column here — it's `ir_property` keyed `res_id='product.category,<id>'`, all FIFO.

### Purchasing & Accounting

**`purchase_order`** (~1,992) — `name`=`P#####`. `state`: `purchase`=**APPROVED** (NOT "arrived"), `draft`, `cancel`. `effective_date` = **ACTUAL arrival** (NULL until receipt picking `done`). `invoice_status='invoiced'` = "fully billed for received-so-far" — open backorder still possible. **`purchase_order_line`** (~17,391): ~2,300 lines have `qty_received > product_qty` (over-receipts); `sale_order_id` always empty (all POs = pure stock replenishment). **`product_supplierinfo`**: `name` field = vendor's `res_partner.id` as INTEGER, not a text name.

**`account_move`** (~13.2M) — `move_type`: `entry`=GL journal (~13.22M, mostly auto inventory/COGS via STJ), `in_invoice`=vendor bill (~1,719), `out_invoice`=customer (**1 row, unused**). `payment_state` almost always `not_paid` — payments reconciled in **QuickBooks**, never back to Odoo; **not a source of truth**. **`account_journal`**: 8 journals; volume dominated by **STJ** (Inventory Valuation, id 6) + **BILL** (id 2). US sales tax = **Avatax** (external); `account_tax` is a placeholder. **PO→bill junction:** `account_move_purchase_order_rel` (~1,722; many-to-many — de-dupe on joins). Vendor billing is **100% manual** (posting a bill increments `qty_invoiced`; bills NOT auto-generated from POs).

### Partner

**`res_partner`** (~294: 170 vendors, 124 internal) — `customer_rank` = **0 for every row** (no real customers in Odoo). `supplier_rank>0` = vendor; id 94 = catch-all. **`res_company`**: single id=1 "Sugarwish Englewood", USD. **`res_users`**: staff/bots only; common bill creators Nora Stein, James Emeric.

---

## SERP (MySQL `serp_*`) — the In-House Odoo Re-Implementation

### The 4-DB Matrix — NEVER conflate replica with darklaunch

| DB                        | Seed source                | Odoo overlay? | Writer            | Contents                                                                     |
| ------------------------- | -------------------------- | ------------- | ----------------- | ---------------------------------------------------------------------------- |
| `serp_prod_replica`       | verbatim `laravel_live`    | NO            | SERP app          | ~19 sale_orders, 0 POs/MOs — **nearly empty**                                |
| `serp_staging_replica`    | verbatim `manage`          | NO            | SERP app          | 0 rows in most tables                                                        |
| `serp_prod_darklaunch`    | Odoo PROD + `laravel_live` | YES           | darklaunch worker | ~10.2k sale_orders, ~2k POs, ~5.5k pickings, ~34k moves — **future prod DB** |
| `serp_staging_darklaunch` | Odoo STAGING + `manage`    | YES           | darklaunch worker | ~36,144 moves, 1,971 POs — **active staging SERP DB**                        |

- DB routing: SERP app → `SERP_ORM_ENV`/`ACTIVE_ODOO_DB_NAME`; darklaunch worker → `DARKLAUNCH_DB_ENV`. **Routes independently.** If a SERP page shows empty Odoo-owned entities (normal BOMs, MOs, inventory) → **config-routing issue, not a bug** (ORM pointed at the clean replica).

### `serp_*` Table Reference

- **`serp_sale_order`** — PRIMARY ORDER BRIDGE. `order_type` enum (`receiver-order`/`preselect-order`): exactly one of `ec_order_id`/`preselect_order_id` set. `name` = `'S'+sw_id`. `state='sale'`=CONFIRMED. Dates: `create_date`/`write_date` (NOT `created_at`). ~19 rows in `laravel_live`; full data in `*_darklaunch`.
- **`serp_stock_picking`** — `state`: draft→waiting→confirmed→`assigned` (reserved/ready, **NOT shipped**)→`done` (shipped)→cancel.
- **`serp_stock_move`** — `component_order_id` → `component_orders` ties an Odoo move to a SugarWish component pick.
- **`serp_stock_quant`** — Available = `quantity` − `reserved_quantity`.
- **`serp_stock_valuation_layer`** — negative `quantity`/`value` = outbound/COGS. Same cols as Odoo + `odoo_id`.
- **`serp_stock_picking_type`** — `code` = direction/purpose, NOT progress.
- **`serp_product_template`** (~3,776) — **NO `default_code` column here.**
- **`serp_product_product`** (~3,449) — `default_code` lives here. THREE mutually-exclusive bridge FKs: `component_id`→components (~2,441), `buyer_product_id`→buyer*products (~386), `receiver_product_id`→receiver_products (~81); ~541 rows have NONE. \*\*Unified product FK target for all `serp*\*` tables.\*\*
- **`serp_purchase_order`** — `state='purchase'` = confirmed PO (Odoo term, not "a purchase happened"). `partner_id` = **VENDOR**.
- **`serp_res_partner`** — role via `supplier_rank`/`customer_rank`. `weeks_on_hand` = SugarWish-added, non-standard.
- **`serp_mrp_bom`** — `type` ENUM(`normal`,`phantom`) (no third value). In replica/`manage`: frozen April-2026 snapshot, **~224–228 phantom rows only, `odoo_id` NULL**, no normal BOMs/MOs (those live in darklaunch). Excluded from comparisons (`KNOWN_FILTERED_TABLES` filters `mrp_bom` to `active=true AND type!='phantom'`).
- **`serp_account_move_line`** — filter `display_type='product'` for real goods; `is_anglo_saxon_line` = system COGS (not manual).
- **`serp_res_company`** — exactly 1 row, id=1 (odoo_id=1). `company_id` always 1.
- `serp_product_supplierinfo` — dual local FKs + parallel Odoo FKs (`odoo_partner_id`, `odoo_product_id`); `delay`=lead-time days. `components.inventory_source` enum `'odoo'`/`'serp'` = per-component darklaunch switch (only **3 of 2524** are `'serp'` in prod darklaunch). `components.odoo_id` is **varchar** and synthetic.

---

## Laravel (`laravel_live` / `manage`) — the App & Order Domain

- **`laravel_live`** = SugarWish PRODUCTION app DB. Full Laravel schema AND ~70 sparse `serp_*` tables. SSH tunnel. **NOT SERP-only.** **`sku_type`/`is_core` real values exist ONLY here.**
- **`manage`** = staging (~8% of prod). Has staging-only tables (`gift_card_processing_progress`, `label_generation_logs`, `box_images`). Seed source for `serp_staging_*`. SERP auth in `manage.serp_res_users`. **In `manage`, ALL `receiver_products` default to `sku_type='legacy'`, `is_core=0` — NOT real classification.** Never infer prod state from `manage`.

### Order Domain (the gifting flow)

Flow: buyer checks out (`buyer_orders`) → creates gifts (`giftcards_card`, one per recipient) → recipient redeems → shipment (`ec_order`). Pre-curated direct-ship uses `preselect_orders`.

- **`giftcards_card`** (~4.9M) — PK is **`card_id`** (no `id`/`increment_id`). Gift = **choose-your-own credit**, NOT a stored-value card or pre-selected box. Source of truth for sender/receiver email. `card_status` TINYINT: **2**=redeemed/active (~80%), **1**=sent/awaiting (~329k), **0**=unredeemed/canceled (~669k), **4**=voided. `card_type`: print/email/offline/sms. `delivery_method='wishlink'` identifies a WishLink.
- **`ec_order`** (~4M) — one row = one physical shipment to one recipient. **0 rows in SERP/replica DBs** — real data only in `laravel_live`. `increment_id` = cross-system key to Odoo. `status`: `pending` (~99%, card issued NOT awaiting payment), `processing`/`complete`/`shipped`/`canceled`. `sw_fulfill`: 1=in-house, 0=vendor, NULL=legacy. **`oddo_synchronized`** (intentional typo) = Odoo sync flag. **`size` = `buyer_products.id` (MISNAMED, NOT a size).** **NO `recipient_email` column.** `is_printed=3` = address/label-blocked queue → **reset** after API fix (not terminal). `giftcards_card` ↔ `ec_order` = **1:MANY** (reships). JOIN: `ec_order.giftcards_card_id = giftcards_card.card_id`; `ec_order.size = buyer_products.id`. **`ec_order` has DB triggers with huge blast radius** — a broken trigger jeopardizes ALL insert/update/delete (WW-142); emergency lever: Munyr can disable triggers.
- **`receiver_orders`** is **NOT** the shipment table — `ec_order` is (70+ columns). `receiver_orders` only tracks notification/survey state.
- **`preselect_orders`** — direct-ship (sender pre-selects). `type` enum = ORDER CHANNEL (`preselect`/`sweet-shoppe`/`sweetificate`), not status. Same `oddo_synchronized` flag.
- **`buyer_orders`** (~1.3M) — checkout header (one purchase → many gifts). `status` and `preselect_status` = two independent state machines. `product_sku` is free-text cart text — always use `ec_order` for attribution.
- **`items`** — recipient's chosen flavors (one row per flavor, belongs to `ec_order`). **`component_orders`** — box/packaging component lines; `order_type`=`receiver-order`/`preselect-order`; `inventory_source`=`odoo`/`serp`.

### Two-Sided Product Model

| Table               | What it is                                             | Key facts                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buyer_products`    | What the **sender buys** (gift size/box/credit SKU)    | ~1,215; `odoo_id` populated on ALL rows; `type`: `ecard`(~906)/`sweetshoppe`/`sweetificate`; `default_kit`→`kits.id`. **Dual-homed**: Retool synced copy + `laravel_live` table                                       |
| `receiver_products` | Individual candy/snack **flavors the recipient picks** | ~5,000+; `product_id`/`sugarwish_id` = join to Odoo `product_template.sugarwish_id`; `inventory_qty`/`odoo_inventory` live here. **`product_id` = SugarWish id, NOT Odoo product_id**. **Non-`id` PK = `product_id`** |

- `kits`/`component_kits` = Laravel-side BOM (source of truth for component recipes); distinct from and can diverge from Odoo `mrp_bom`/`serp_mrp_bom`. `ecard` type ≠ a greeting-card image.
- **`users`** (sugarwish) — sender/buyer accounts. `account_type`: ''/Guest/Onboarding/Personal/Company/Both. Company relationship is **M:N via `company_users_pivot`** — **no single `company_id` on users**.

---

## WishDesk (`wishdesk`) — CS + CRM + Design + Billing

Not a support-only DB. Full CS+CRM+design+billing platform (internally "WishWorks"). 179 tables, primarily a **sales CRM + Gmail-AI assistant**. WishDesk is a **downstream replica** — customer/company/order truth lives in SugarWish (Laravel/Odoo); WishDesk stores ids + cached snapshots.

| Prefix                                    | Subsystem                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `swcrm_*`                                 | Full sales CRM (modeled on Insightly)                                       |
| `swcrm_z_gmail_*`                         | Gmail mirror + AI-draft (SWIM) email assistant (20+ tables, ~155k messages) |
| `orders_tickets` / `orders_ticket_events` | CS email ticketing                                                          |
| `sw_billing_tickets`                      | Slack-driven billing/finance queue                                          |
| `swcrm_actions`                           | sales tasks/to-dos (NOT customer-facing tickets)                            |
| `design_*`/`ds_*`/`merchandise_*`         | ecard/custom-product design studio                                          |

**Three independent ticket systems:** `orders_tickets` (CS email), `sw_billing_tickets` (Slack billing), `swcrm_actions` (sales tasks). Plus `wishdesk.orders_monthly_orders` = managed-gifting recurring-order planner (year-grid). **"Orders" means three different things** — see Gotchas.

- **`users`** = BOTH staff AND synced customers (split by `role`: `customer`~49k, `guest`~8.5k, `user`~5.9k, agent/admin few dozen). `role_type` staff: GC/HS/super/MOD/Billing/Sidekick/test. `sw_id` = FK to Laravel user id; `slackid` = staff Slack id.
- **`user_cache`** = denormalized customer snapshot synced from Laravel; join key is **`user_id`** (Laravel id), NOT `users.id`. CRM `'user'` object resolves via `user_cache.user_id`. Metrics are cached, not live.
- CRM object naming: lowercase (`user`, `opportunity`) = new/native; capitalized (`Opportunity`, `Contact`, `Organisation`) = legacy Insightly-imported.
- **`swcrm_leads`** (~158k): `lead_status` is messy free-text (~115k `Won - Setup Account` = bulk-imported converted customers); use `converted_*` columns.
- **`swcrm_opportunities`** (~36k) — use **`opportunity_state`** (OPEN/WON/LOST/INVALID/UNTAPPED), the authoritative field. Legacy `state` + free-text `status` exist but **do NOT use for reporting**. `category` = deal-SIZE bucket (SMALL/MEDIUM/LARGE/MEGA/NA), NOT product category.
- **`swcrm_pipelines`** — only ONE pipeline (`Default`), 3 stages: Expressed Interest → Active Discussion → Order Paid (WON).
- **`swcrm_links`** = polymorphic bidirectional M:N junction (backbone of all CRM relationships) — query both `(object_name,object_id)` AND `(link_object_name,link_object_id)`, dedupe. NO direct FK join tables between CRM entities.
- **`swcrm_activity`** and **`swcrm_campaign`** are EMPTY (use `swcrm_field_change_log` + `swcrm_opportunity_stage_history`). `dev_leads`/`dev_*` = a separate parallel CRM pipeline in prod, **NOT** dev copies.
- **`orders_tickets`** — email CS inbox. `ticket_id` = VARCHAR display id `SKTKT-...` (not the int PK); children join on **`ticket_id`** (VARCHAR). `orders_ticket_events.type`: filter `IN ('INBOUND_EMAIL','OUTBOUND_EMAIL','INTERNAL_NOTE')` for actual correspondence.
- **`sw_billing_tickets`** — billing/finance queue (Slack-driven); has `slack_*` columns tying each to its thread. **`proposals`** (~99.5k): config is JSON (`details_json`, `recipient_json`, `metadata`); `parent_proposal_id` = revision chain; locked version mirrors to `branding_records` (keyed `proposal_id`).
- **WishDesk sync** = ONE-WAY Laravel → WishDesk. `swcrm_z_gmail_messages.ai_draft_status`: GENERATED/EDITED/SENT_AS_IS/DISCARDED (only SENT_AS_IS/EDITED were actually sent). Threads by `gmail_thread_id`, not subject. RingCentral: `swcrm_ringcentral_calls` ~7,855.

---

## Retool (PostgreSQL) — SERP Operational Backbone + BI

Environment separation is by table-name **suffix**, not separate DBs. Production = **`_live`** tables.

| Domain                    | Local                                          | Prod                                                     |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| draft-ops                 | `serp_draft_operations`                        | `serp_draft_operations_live`                             |
| inventory-counts          | `serp_inventory_counts`                        | `serp_inventory_counts_live`                             |
| AI messages/turns         | `serp_ai_messages_dev`, `serp_ai_turns_dev`    | `serp_ai_messages_live`, `serp_ai_turns_live`            |
| Odoo sync queue + breaker | `odoo_sync_queue`, `odoo_sync_circuit_breaker` | `odoo_sync_queue_live`, `odoo_sync_circuit_breaker_live` |
| auth / user / forecast    | (no suffix)                                    | (no suffix)                                              |

- **Auth/AI:** Token tables `serp_refresh_tokens`/`serp_password_reset_tokens` are documented as Retool PG but actually live in **MySQL** (serp ORM). Serpy drafts-as-conversations (Apr 2026): event stream in `serp_ai_messages_{dev,live}` + `serp_ai_turns_{dev,live}`. Legacy `serp_ai_prompt_logs_live` is read-only/older.
- **`orders`** — mirror of SugarWish/Magento orders. `increment_id = '300' + id`. `path_status` = CS/routing classification (NOT fulfillment): includes `Test Account` (~62k rows — **filter out**), size buckets.
- **`sku_projections`** — per-SKU popularity at 3wk/8wk/1yr from **recipient gift-selection survey data**. No active/archive flag — join Odoo `product_product.active` to exclude discontinued.
- **`sku_supplier`** — per-SKU forecast config. `lookback_period` ENUM per-SKU: `8 Week` (default), `3 Week` (fast-moving), `Year` (seasonal). **No `case_qty` column here.**
- **`supplier`** — vendor replenishment config; **`default_case_qty` lives HERE**. Real suppliers: Jack's, Albanese, Blair Candy, Redstone, CJ Dannemiller, Nuts.com, Jerry's, Buckin' Nuts, Sew Many Tails, AG Alchemy, The Pound Bakery.
- **`rm_sku_supplier`** — RM SKU → supplier for automated RM POs; own `case_qty`. **`rm_weekly_demand_cache`** = authoritative RM purchasing forecast (PG, not SERP MySQL); column **`product_type_keys`** is PLURAL (ARRAY) — no singular `product_type_key`. **`bom_components_cache`** = cached BOM (RM→SA) mirrored from Odoo `mrp.bom` — use instead of querying Odoo live.
- **`operation_levels`** = canonical inventory thresholds + alert state. `previous_level`: **0**=critical/red, **1**=minimum/orange, **2**=below-goal/yellow, **3**=at-goal/green. Ops Slack workflow (every 20 min) **writes** `previous_level` + `time_turned_red/orange/yellow`; Daily Operations Message (8 AM) **reads** them for "days below threshold."
- **`opportunities`** (Retool) = legacy Insightly import (casing dups `Open`/`OPEN` — normalize); distinct from `wishdesk.swcrm_opportunities`. **`receiver_product_status`** drives Slack alerts — the `*_slack_ts`/`*_channel`/`*_alerted_at` columns are **de-dup guards**, not message content.
- **`serp_inventory_counts_live`** — `fulfillment_entry_index` groups independent count sessions. **VERIFIED = 2+ different users, same sku+location+entry_index, matching qty.** Uncounted SKUs get **ZEROED on sync** by design. `location_id` 2001/2002 = TEST data. **`serp_beginning_inventory_snapshots`** = pre-computed beginning-of-period on-hand (avoids scanning 8.8M-row `stock_move_line`).
- **`buyer_products` is dual-homed** (Retool synced copy used by forecast SQL + separate `laravel_live` table). BI mirrors (NOT transactional sources): `quickbooks_dashboard`, `stripe_dashboard`, `shopifymonthlydata`, `insightly_contact_data`.

---

## Cross-System: Inventory Source-of-Truth & Concurrent Writers

**Inventory is split — no single source of truth:**

- **SA (finished/sellable):** Laravel `receiver_products.inventory_qty` is master for what's available to sell (deducts pending un-imported orders immediately).
- **RM (raw material):** **Odoo only** (active `mrp_bom` + `stock_quant`).
- **Final available formula (canonical Dec 2024):** Odoo AVAILABLE qty (not on-hand) − orders Laravel still holding. Odoo syncs its number to Laravel → Laravel subtracts un-imported orders. The old Jan-2023 "Odoo is the source" statement is **superseded**.
- `receiver_products.odoo_inventory` ("West Coast Qty") = **cached int, NOT a live Odoo read** (source: Odoo `stock_quant usage='internal'`); can be off-by-one. Inventory adjustments in Odoo do **NOT** auto-propagate to Laravel `inventory_qty` (recurring bug).

**Concurrent writers / deadlocks:** Laravel backend, Retool apps, and n8n all write the same MySQL rows simultaneously → `ER_LOCK_DEADLOCK`. The n8n "Auto-Disable" workflow deadlocks against other writers → **partial application** (some rows silently not updated).

---

## Integrations & Sync (SERP ↔ Odoo ↔ Laravel)

### Three-System Correspondence

- **Laravel** = order origin (`ec_order`, `preselect_orders`, `giftcards`). **SERP** ingests as `serp_sale_order` (back-refs `sw_id`, `ec_order_id`). **Odoo** = legacy ERP, linked via `odoo_id` on every `serp_*` table. Source-of-truth is **per-entity**.

| Entity                                              | Owner         | Write path                                      |
| --------------------------------------------------- | ------------- | ----------------------------------------------- |
| Normal BOMs/MOs/POs/product creation                | Odoo-owned    | SERP → `odoo_sync_queue` → XML-RPC              |
| Phantom BOMs / kits (`serp_mrp_bom type='phantom'`) | SERP-owned    | local `serp_mrp_bom_line` via `serp_update_kit` |
| `receiver_products`, `component_kits`               | Laravel-owned | SERP → `manage` MySQL via `laravel_*` ops       |

### Cutover Strategy

- **DUAL-WRITE + PARALLEL TEST** — SERP and Odoo run side-by-side; Serpy writes to BOTH; Odoo → SERP one-way sync keeps SERP populated. Gate: **<1% drift, stable 2 weeks.** Target ~2026-06-04. Each env's authoritative cutover = its own `serp_darklaunch_meta.darklaunch_cutover_at`.
- **Jack's SERP milestones (targets):** repeatable sync script May 13 · dual-write wired Jun 3 · order queue expanded (`ec_order`+`preselect_orders`) Jun 24 · parallel test launched Jul 1 · parallel test complete Jul 15.

### `odoo_sync_queue` (Outbound Bus, SERP → Odoo)

- Lives in **Retool PostgreSQL** (`RETOOL_DATABASE_URL`), tables `odoo_sync_queue_live`/`_dev`. Direction is **SERP → Odoo via XML-RPC**, NOT Odoo → SERP. Worker: asyncio, ~30s poll, batches 50 (but **`BATCH_SIZE=1` in prod**), priority ASC then created_at ASC. Statuses: `pending → processing → done/synced/failed/partial/cancelled/dlq`.

| `sync_target`     | ~Count | Target                                                |
| ----------------- | ------ | ----------------------------------------------------- |
| `odoo`            | ~3044  | Odoo XML-RPC                                          |
| `multi`           | ~218   | fan-out                                               |
| `laravel`         | ~154   | `manage` MySQL via `handle_laravel_kit_composition()` |
| `serp`            | ~43    | SERP mirror                                           |
| `serp_darklaunch` | few    | darklaunch mirror                                     |

- `idempotency_key` = `'odoo:{entity}:{id}:{op}:{hash}'`. `odoo_id` populated ONLY after successful create where `odoo_response.verified=true`.
- **NO auto-retry, NO exponential backoff, NO functional DLQ** — `'failed'` rows are NEVER re-picked; require manual `/api/admin/sync-queue` retry. `recover_stuck_items` only resurrects `'processing'` >5min rows, never `'failed'`. `max_attempts` column is unused.
- Circuit breaker `odoo_sync_circuit_breaker(_live/_dev)`: OPENS after **5** consecutive failures, resets after **2** successes, `reset_timeout_seconds=30`. `ODOO_SYNC_DRY_RUN=True` generates fake odoo_ids (`99990000 + entity_id`).
- **Replay landmines** (unguarded handlers): `mrp_unbuild` and `purchase_order_state` `'edit'`/`'add'`.
- `entity_types`: `mrp_production`, `po_receipt`, `stock_picking`, `inventory_adjustment`, `stock_scrap`, `mrp_unbuild`, `purchase_order_state`.

### Two SERP Order Pipelines (+ Merchandise)

1. **Odoo sync queue** (`odoo_sync_worker.py`, Retool PG) — triggered on approved Serpy draft; warehouse ops vs Odoo via XML-RPC + mirrors to darklaunch. **PO receipts flow here.**
2. **Darklaunch order worker** (`darklaunch_order_worker.py`) — **NO queue**; polls `ec_order WHERE oddo_synchronized=1`; `POLL_INTERVAL=300s`, `BATCH_LIMIT=50`, single-threaded; dual-writes receiver/preselect orders to `serp_prod_darklaunch` only; never pushes back to Odoo. **Detector bug:** `detect_shipped_orders_odoo` had `ORDER BY … DESC LIMIT 50` stranding the oldest tail (observed 883 in-flight) — fix = oldest-first.
3. **Merchandise** (`order_queue_worker.py`, gated `ORDER_QUEUE_WORKER_ENABLED`): polls `component_orders WHERE order_type='merchandise' AND inventory_source='serp'`; writes **main/live SERP DB**.

Orders that never reach Odoo intentionally get `odoo_id=NULL`. `inventory_source='serp'` → main DB (merchandise queue); `inventory_source='odoo'` → darklaunch/replica DB.

### Performance (intentionally slow)

`button_validate → _action_done` = ~440–650 serial statements per 8–12 move shipment over ~80ms AWS→Hetzner RTT = **~35–72s/shipment** (~47–66s prod). Single-threaded ceiling ≈ **72 shipments/hr** (~6–7× below the 2025-12-29 peak of ~11,433). This is **intentional** — accounting fidelity over speed. **Do NOT batch** — would break `account_move.sequence_number` ordering and `/compare-costing` parity. Fix directions: batch per-move loops into recordset ops, co-locate DB. **Newest-first `LIMIT 50` starves the backlog** — detectors must process **oldest-first** by `MIN(create_date)`.

### Serpy Product-Write Fan-Out & Provenance

| Op type                                                              | Systems written                   |
| -------------------------------------------------------------------- | --------------------------------- |
| `create_odoo_product`                                                | Odoo + SERP                       |
| `create_component_everywhere` / `create_receiver_product_everywhere` | Odoo + Laravel + SERP             |
| `create_serp_tracked_component`                                      | Laravel + SERP only (**no Odoo**) |

- `create_uid=55` = Jack's shared login used by BOTH Serpy AND manual edits — **NOT** a Serpy signal. Canonical provenance ledger = `odoo_sync_queue_live` (search by `odoo_id` or `payload->>'sku'`). `origin` carries `'SERP Batch #<draft_id> op <n>'`. Manual UI imports fingerprinted by `ir_model_data.module='__export__'`.

### `odoo_id_stamper` (post-create stamping)

- Runs **after** the darklaunch worker creates rows (`workers/odoo_id_stamper.py`, own pool). Natural-key matching for `stock_move` is non-unique (adjacent orders share `product_id`/`qty=1`) → can **mis-stamp neighbor moves** (observed ~84% NULL, ~16% mis-stamped). **Frozen frontier signature** = `MAX(odoo_id)` stuck while `MAX(id)` climbs = dead stamper (SSL-closed idle conn). Gated by `ODOO_ID_STAMP_ENABLED`. **Fixed 2026-06-03:** high-volume order path created thousands of `odoo_id=NULL` rows because `stamp_child_odoo_ids` was only wired into the Serpy path, not the order path.

### Drift Monitor & `/compare-darklaunch`

- `compare_odoo_replica.py` diffs **Odoo prod (PG, source of truth)** column-by-column against `serp_*` shadow tables, joining on `odoo_id`. n8n "Darklaunch Drift Monitor" (`HpHN9Reme3L6bNBd`/`IalsmpKBKbJM4LXg`): cron `0 6-18 * * 1-5`; windows latest ~1000 ids/table; ~42 tables; Slack to `#jack-test`. **GENERATED** by `scripts/build_darklaunch_drift_n8n.py` — **do NOT hand-edit the JSON**; add suppressions to the Python.
- **Most drift is EXPECTED** (don't chase): (1) windowed seeding (~5000 most-recent ids); (2) `odoo_only` post-seed writes; (3) SERP-origin `odoo_id IS NULL` rows; (4) ~6h datetime drift; (5) reservation timing (SERP reserves immediately, Odoo ~6h later); (6) `stock_quant` freshness gap. **The only signal that matters: column-level `settled values: diverge` on Odoo-origin rows.** By-design suppression list (`WORKER_ROW_DIVERGENT_COLUMNS`): `sale_order.name`, `date_order`/`sw_datetime`, `sale_order_line.sequence`.

### Odoo ↔ Laravel Sync (`sugarwish_integration`)

- Odoo **POLLS** Laravel REST on a **~6-min cron** for `oddo_synchronized=0` rows — **no webhook**. Polled: `GET /api/odoo`, `/api/odoo/pre-pick`, `/api/odoo/failed-ecard-orders`, `/api/odoo/failed-prepick-orders`. Odoo finds products by `sugarwish_id`, creates `sale.order` keyed `sw_id=ec_order.id`, confirms (phantom-BOM explosion → deducts inventory), POSTs back to `/update-order-passed` or `/update-order-failed`. `UNRESOLVED_GRACE_SECONDS` = 15 min.
- **CRITICAL RACE:** state changes between polling cycles (<6 min) can be **missed entirely**. n8n "Odoo Order Sync Integrity Monitor" (`bR4rEQjFI3GuwkiY`, hourly at `:20`) resets `oddo_synchronized=0`+`component_imported=0`+`items.odoo_sync=0` for orders missing from Odoo; **~8–9% miss rate per run**; posts to `#api-autofix`.

### Per-Row Odoo Sync Flags (misspelling intentional)

Column is **`oddo_synchronized`** (two d's, one o) — NOT `odoo_synchronized`.

| Flag                          | Values                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `oddo_synchronized`           | `0`=not synced, `1`=pushed, `3`=stuck (archived SKUs), `5`=error |
| `ship_date_odoo_synchronized` | `0`/`1`/`2` (shipment/ship-date sync, independent)               |
| `items.odoo_sync`             | `0`=needs sync, `2`=synced, `5`=bypass Odoo (vendor drop-ship)   |

### Product Bridge & Failed-Products Loop

- Bridge key: `product_template.sugarwish_id` ↔ `manage.components.odoo_id`/`buyer_products.odoo_id`. Synthetic id conventions: kit products = `'500'+buyer_products.id`; component/packaging = `'800'+components.id`. `components.odoo_id` is **fabricated** (`'800'+id` as string) — joining it to an Odoo PK silently matches wrong rows; de-reference `800611 → components.id 611 → product_product.id 28006`.
- **Failed Products email** fires when `sugarwish_id` not found in active Odoo products; causes: `product_product.active=false` or NULL `sugarwish_id`, or a Laravel endpoint missing the `inventory_source='odoo'` filter → loops every ~10 min. `inventory_source='serp'` items do NOT exist in Odoo (Odoo must skip serp lines; Laravel sends full payload).

### External Services

- **AvaTax (Avalara):** `ec_order.avatax_status`: `not-processed/processed/sent/skipped/adjusted/voided/cancelled/locked`. Manual retry: DELETE `avatax_items` rows + set `avatax_status='not-processed'`. Root cause usually bad user-entered address (free-text state field). Alerts → `#avalara-alert`.
- **Smarty (SmartyStreets):** paid metered (5k validations, bumped by Seth); rate-limit stalls fulfillment via `is_printed=3`; recovery = renew + reset `is_printed`.
- **USPS:** token array index-swap between auth and label workflows is a recurring label-failure cause (not USPS outages). Use `apis.usps.com` (not `api.usps.com`).
- **Vendor drop-ship:** routing code **`550`** = Vinebox → Shopify → vendor ShipStation (WCC's vinebox.com account). Drop-shipped SKUs bypass Odoo (`odoo_sync=5`). Wine needs ShipCompliant/address compliance.
- **Tango Card:** `tango_orders` maps `ec_order_id`→Tango; `receiver_products.tango_utid` = catalog link.

### Genies/Routers & Qdrant

- Genies source of truth = **sw-design** `genies/{setting_key}.json`, NOT WishDesk `system_settings`. Pipeline → `s3://…/genies-sync.json` → `POST /api/quiz-config/sync-genies` → upserts `system_settings`. **FULL-OVERWRITE per key** — direct edits to `system_settings` get wiped on next sync.
- **Qdrant collections:** `kb-v2` (Product KB → SWIM), `instructions`, `agent-chats`, `kb-internal`, `discoveries_swirl`, `org-knowledge`. Embeddings: OpenAI `text-embedding-3-small`.

---

## Business Rules & Workflows

### Two Warehouses & Fulfillment Routing

- SKU site from `receiver_products.location_id`; **anything not location_id 2 defaults to Englewood**. BOMs deduct from `ew/stock/fulfillment` (2008). Production-slip printing hard-gated to EW/TY only (`validate_slip_rows`, `ALLOWED_LOCATIONS`).
- **Custom branding (sleeve) OVERRIDES default location/vendor:** Bakery & Cafe / Custom Mug & Treats default TY → **EW if sleeve/merch attached**; Mini Popcorn default external (Poppin & Mixin) → **CityPop if sleeve attached**.
- Custom mug: production=TY, but **forecast usage attribution=EW** (Jack explicit, twice-corrected). Forecast location = first item's `location_id`. Mug+treats can split EW+TY → doubled shipping + manual tracking emails.

### Seasonality & Capacity

- **Peak #1:** December holiday (~Dec 3–20). Supplier buffer locked by ~week 40 (early Oct). **Peak #2:** EAD (Employee Appreciation Day) = first Friday of March. Mid-summer slowest. Large summer bulk needs 2–3 wk lead + extra staff. BofA-scale clients need ~90 days notice.

### Forecasting & Redemption Model

- Redemption curve (`retool.redemption_curve`): ~**82.3%** day 0, ~71% day 1, ~48% day 7, ~41% day 11. Unredeemed = no inventory consumed. Discount tier uses **~70% redemption assumption**.
- **Purchasing/reorder rule (Ric):** keep 4 weeks on hand + coverage until next PO lands. No outstanding PO = 4 wks + lead time; outstanding PO = 4 wks + time-to-oldest-PO; PO outstanding > normal lead = 4 wks only.
- **Variance formula (Matthew):** Starting Odoo count + all Odoo purchases − all Odoo sales = Projected Inventory; compare vs physical count.
- **SA vs RM layers:** `rm_quantity = rm_inventory / bom_quantity`; `total_inventory = rm_quantity + sa_inventory − unreserved_qty`; `total_days = total_inventory / daily_rate`. A SKU "requires packing" when `bom_quantity > 0`.
- **SA buildable runway limited by its OWN matching RM** (`SA-19-044-A` → `RM-19-044-A`, derived as `'RM'+sa_sku[2:]`). Summing all shared RMs/cartons **wildly inflates** inventory. **A carton does NOT count as an RM** for SA runout. Negative inventories are **acceptable/expected** — do NOT guard against them. Forecast at **parent-SKU granularity** (`_PREFIX_LEN=11`).

### SKU Naming, Suffixes & Classification

- **`-A` suffix** = standard/non-branded, Taylor (location_id 2). **`-E` suffix** = branded Englewood (location_id 1). Orders with a sleeve **must use `-E`**; non-branded **must use `-A`** (n8n hourly "SKU/branding mismatch" flag). `-A` and `-E` are the **same product** — roll up as ONE in forecasts. **"Move qty from `-A` to `-E`" (same location) = a PAIR of inventory adjustments, never a `stock_transfer`.** **ROUTING RULE:** attribute new products / historical sales to **`-E` rows**.
- **Product-line source of truth = `laravel_live.product_type`** (via `receiver_products`) + SA-NN- prefix number. **Odoo categories are inconsistent and must NOT be used.**

| product_type | Line             | product_type | Line                |
| ------------ | ---------------- | ------------ | ------------------- |
| 1/156        | Candy            | 25           | 12 Nights           |
| 2            | Popcorn          | 39           | Gourmet Pantry      |
| 3/45         | Cookies/Brownies | 51           | Gourmet Goods & Spa |
| 5            | Snacks           | 550          | Vinebox             |
| 6            | Dog Swag         | 10           | Wine Tastings       |
| 16/40        | Candles/Spa      | 14           | Wine                |
| 19/20        | Coffee/Tea       | 567          | Bakery & Cafe       |

- A `category` / `receiver_products.product_type` mismatch silently makes a product **non-orderable** despite stock + enabled (Retool alert + n8n daily ~7am MDT).
- **3-tier classification:** `sku_type` ∈ {`core`,`seasonal`,`legacy`}; `is_core` tinyint(1); `drop_level` int. `is_core` must equal `(sku_type=='core')`, enforced **only in app code** (`core_flag_for_sku_type`) — **NO DB trigger**, write both columns. Added Feb 2026 at Jason's request (~220 SA SKUs). SERP is canonical for classification; belongs on **parent SKUs only** (`parent_sku IS NULL`); propagates parent→child only in the **forecast READ pipeline**. Child SKU: `LEFT(sku,2) IN ('SA','FG')` AND >4 dash-segments.
- **Forecast simulation:** CORE = always replenished; SEASONAL/LEGACY run out and are NOT reordered — their demand redistributes onto surviving CORE SKUs in the same product_type. **Core 90% goal:** keep ≥90% of core SKUs live. `drop_level` = floor below which a SKU is disabled; `threshold` (~2× drop_level) = alert trigger. **Serpy writes `receiver_products` in `manage` DB** — must whitelist `sku_type`/`is_core` in `RECEIVER_PRODUCT_WRITABLE`.

### Live Availability & Auto-Disable

- Auto-disable when `actually_available − inventory_reservations ≤ drop_level`: sets `status='disabled'` + cascades to child SKUs (`inventory_link` = parent `product_id`). Runs ~1×/min (n8n). Pre-pick bypasses drop level. "Live choice" rule: `archive != 1` AND `status='enabled'` AND `deleted_at IS NULL` AND within date AND `(odoo_inventory − active reservations) > drop_level`. `drop_level` fallback = `feature_attributes` id=1 (`receiver-inventory-drop-level`, value **100**). Parent SKUs = length 11; children = first 11 chars + suffix. Ops lever: lower `drop_level` (often to 5 or 1), re-enable parent+child.

### Kits & BOMs — Three Parallel Independent Systems

A "replace X with Y" must touch all three:

| System                           | Owns                                              | SKU prefixes            | Key op                                                                          |
| -------------------------------- | ------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Laravel `kits`/`component_kits`  | Colored-box packaging                             | B-\*                    | `laravel_update_kit`; `buyer_products.default_kit`→`kits.id`; `components.hide` |
| SERP `serp_mrp_bom` phantom BOMs | Shippers, inserts, paper, cups, merch recipe keys | S-_, I-_, P-_, E-_/C-\* | `serp_update_kit`; `serp_find_kits_by_sku` (phantom only)                       |
| Odoo `mrp_bom`                   | Manufacturing recipes                             | RM-\*                   | —                                                                               |

- **CRITICAL id-namespace trap:** Laravel `kits.id` and SERP `serp_mrp_bom.id` collide numerically (e.g. 682 is a phantom-BOM id, NOT a `kits.id`). `serp_find_kits_by_sku` returns `serp_mrp_bom.id` wrongly passed as `kit_id` to `laravel_update_kit` → all ops fail.
- Swap = `remove_component(old)` + `add_component(new)` + `hide=1` old / `hide=0` new across all three. **Discontinue = ARCHIVE** (`product_product.active=false` / `components.hide=1`), never delete. New Serpy-created `receiver_products` default to `status='disabled'`, `archive=1` — must be manually enabled. Phantom BOMs **cannot** be created via Odoo API (UI only).
- After Apr 2026: Laravel sends items+box, Odoo adds shipper/insert/paper via phantom-BOM explosion; both together define a complete kit.

### Popcorn (special mechanism — read before touching)

- Popcorn flavors (`SA-02-*`) have **NO BOM**. Each flavor = a **$0 selection token** in Laravel only, **archived in Odoo**. Cost is on the **sticker SKU** (`L-B02-REG-23-0NN-COX`) + a 32oz cup. `receiver_products.product_id` = sticker's id; `/api/odoo` keys by `product_id` → resolves to costed sticker.
- **Do NOT fix COGS by adding a BOM or resolving by `product_sku`** — resolve by `product_id` (→ sticker). Popcorn is **vendor-fulfilled** (City Pop / Poppin & Mixin); orders should **NOT** contain merch/sleeves (WW-964). Approved divergence: `feature/popcorn-phantom-explode` flips ~48 `SA-02-*` BOMs `normal→phantom` in SERP local/darklaunch seed **only, NEVER in live Odoo** (`make_popcorn_boms_phantom()`). Popcorn forecast splits by vendor **CityPop vs Poppin** (no collapse).

### Kit Explosion Scope (SERP delivery path)

- Phantom BOM explosion scoped to **`items`-origin lines ONLY** (gift selections). `component_orders` lines (wine/flower/candy-box/buyer-product phantom kits) do **NOT** explode — prevents double-booking. Legacy Odoo: every `stock.move` has `bom_line_id=NULL` + `sale_line_id` (flat 1:1); kit expansion happens at order-build time. Newer SERP-driven Laravel flow (`insertComponentOrdersFromRecipeBom → SerpBomService`, gated by `hasMerchandise()`) uses SERP phantom BOMs.

### Sleeves, Branding & Custom Merch

- Sleeve chain: `proposals.details_json` → `branding_records` (`physical_branding`, `digital_branding`, approval flags, `print_render_status`) → `ec_order` (design via `giftcards_card` records, **NOT** a column on `ec_order`). To fulfill **without** sleeve: NULL `physical_branding`/`digital_branding`, approvals=0, `print_render_status='not_required'`, swap giftcards-card design, regenerate slip.
- Sleeves resolve by **`ec_order.size`** (= `buyer_products.id`) → `physical_branding.entries[].buyer_product_ids[]` keyed by box family (`box_sku`: `a_small`, `a_medium`, `c_medium`, `h_medium`). Multiple products in same box share ONE entry. **"Missing sleeve" bugs = `buyer_product_id` absent from the entry's array → fix = ADD the id, don't create a new entry.**
- `branding_records.review_status`: 0=unset, 1=needs review, 2=CS review, 3=approved. `accessory_images.review_status` (mug images): only 0/1/2 written — **no real "approved"** value; approval = "Choose Variant" → S3 + `review_status=0` + `original_print_image_url`. Mug images normalized to **720×720 px**. SWAC mug-image-review endpoints must carry **`isAgentOrAdmin`** (`agent` ≠ admin).
- `recipe_snapshot` lives in `ec_order.merchandise_selections → $.items[0].recipe_snapshot` + `branding_records.merchandise`. Key = `CONCAT(cube_size,'cube-bp', ec_order.size)`. **Livery does NOT read `recipe_snapshot`** — it uses `branding_records.physical_branding.entries[].box_sku` matched by `ec_order.size`.

### Billing, Cancellation & Discounts

- Default "undo" = **cancel-and-credit −10%** (credits 90% of gift value to corporate credit balance; within 1 year; not redeem-only). True money-back refund = "Refunds - Without Cancelation" Slack shortcut (rarer).
- **Redeem-only accounts:** pay 10% upfront, billed 90% on redemption; if cancelled before redemption, NOT eligible for 90% credit; cannot combine with HHS/PPS.
- Enterprise promo codes (`Enterprise5`/`8`/`15`) **do NOT work on pre-pick (preselect) orders** — billing applies discount manually. WishLinks: $2/link + redemptions; can now cancel-and-credit −10%.
- Revenue metric **"sales with sleeves"** = % of ecard value with sleeves ÷ total ecard value (NOT dollar value of sleeves).
- **Discount approval:** non-standard discounts require approval **before quoting** (`#enterprise`; escalate → Jason). Custom-box MOQ **1500 units** (8–10 wk lead); 1000–1500 units = +$250 setup. Annual price change coordinated by **Clare** via Slack List; **Caley** does bulk buyer-product updates by hand. Size names: Mini, Small, Medium, Large, X-large, Grand, Deluxe.

### Costing, Accounting & Manufacturing

- Costing source of truth = `stock_valuation_layer` / `serp_stock_valuation_layer`, NOT `standard_price`. **One JE per `stock.move`** (not per picking) — SERP creates+posts per-move in a loop; consolidating to one-JE-per-picking is **wrong**. **Manufactured quantity rule:** SERP MO sync uses **actual manufactured quantity**, never back-fills from BOM standard; use `bom_qty_ratio_historical` for past batches. Equivalency: candy=1, popcorn=0.5; cost-per-equivalent = dollars ÷ units (Ric corrected Jack 2026-04-03).

### Order Lifecycle, Slip Batching & Provenance Floors

- Odoo processes lifecycle **per-order, interleaved** — 6 `ir.cron` jobs (Orders/Prepicks/Component-orders/Component-prepicks/Failed-orders/Failed-prepicks, priorities 1–6, `numbercall=-1`) pull `GET /api/odoo?perPage=500`. **No per-order webhooks.** Order-id ranges: `sw_id < 600,000,000` = receiver/`ec_order`; `sw_id >= 600,000,000` = **preselect/wholesale** (bridge via `preselect_order_id`). Order-number prefixes: `200`/`2000`=receiver, `6000`=preselect.
- Production slip batch number = `COALESCE(MAX(production_slip_batch)+1, 900000001)`. `ec_order` UPDATE sets `is_printed=1`+batch+`batch_date`; `preselect_orders` has **NO `batch_date`** column. Only `is_pdf_generated=1` rows participate. `sw_fulfill=0` skips label requirement.
- Provenance floors: Jack's local Claude transcripts go back only to **2026-05-04**; EW warehouse launch floor **2026-05-19**.

### Wine (special case)

- **Wine should be marked NOT core** (~29 `product_type=10` + ~29 `type=14` were still core as of 2026-06-01, inflating the %). Wine uses a **CATEGORY-GOAL model** (target available-count per sub-category), keyed `'Category|product_type_id'` in `retool.operation_levels`. Wine = `receiver_products.product_type IN (10,14)` (exclude 25 '12 Nights', 550 'Vinebox'). Wine FC = `location_id 5` (WCC). Wine purchased as `SA-14-xxx` with **NO real BOM/RM**; `rm_ordered`=0 is **EXPECTED** (replenished via WCC gravity racks outside Odoo PO flow).

---

## n8n & Automations

Hosted at `n8n.sugarwish.com`. All post as bot "n8n" (`U08QP0DL9L5`); messages end `_Automated with this n8n workflow_`. Workflow JSON in `sw-cortex/workflows/n8n/`. **`active:false` in an export ≠ inactive in prod**; export IDs differ from live IDs — check `n8n.sugarwish.com` for actual state.

| Workflow                          | Export / Live ID                         | Schedule         | Action                                                                                                     |
| --------------------------------- | ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Daily Operations Message          | `dailyOpsMsg01` / `ZH5i32eGyRE6Zb1f`     | Daily 8 AM MT    | Posts "Daily Inventory Status Report" → `#live-product-warnings` `C084Z9EKDSL`                             |
| Operations Slack                  | `opsSlackWorkflow01`                     | Every 20 min     | Level-change alerts; **writes** `time_turned_*` to `operation_levels`                                      |
| Disable Unreserved Products       | `z3gsFEZ9Z0853Gj1` / `VRdmXlm2XTeRbOyT`  | Every 1 min      | Auto-disables SKUs with no real availability; **known deadlock source**; also the 330s "oversell" offender |
| Cost Tracker Weekly Average       | `costTrackerWeekly` / `8tETscs44BzY1f3J` | Mon 8 AM         | Posts "Weekly Cost Tracker Report" → `#ops-and-tech`                                                       |
| Odoo Order Sync Integrity Monitor | `bR4rEQjFI3GuwkiY`                       | hourly `:20`     | resets sync flags → `#api-autofix` `C088M68FD47`                                                           |
| Sheets Export (forecast → Retool) | `pLjFlQDc9kEeA8DG`                       | hourly           | → `#jack-test` `C083M27KU8L`                                                                               |
| Add Retool Incremental Tables     | `givRuaU8E7jawAGD`                       | daily midnight   | SKU/size sync → `#jack-test`                                                                               |
| Darklaunch Drift Monitor          | `HpHN9Reme3L6bNBd`/`IalsmpKBKbJM4LXg`    | `0 6-18 * * 1-5` | → `#jack-test`                                                                                             |
| Preselect Address Auto-Fixer      | `Zp59HJx19mly3lQ1`                       | —                | zip/state fixes → `#preselect-address-fixes` `C0A1F8FS6R0`                                                 |

- **Disable Unreserved — 3-factor formula (live-verified):** `final_available = Actually Available − SW Reserved (inventory_reservations.status='active') − Orders Not Imported (items.odoo_sync IN (0,1))`. SKU scope `default_code LIKE 'FG-%'/'SA-%'/'L-B02%'`, `sugarwish_id` 1–800,000. **NOT two separate ids** — `z3gsFEZ9Z0853Gj1` already contains the 3-factor formula (commit `d7bf45f`); the "2-factor older version" narrative is wrong.
- Inventory thresholds + days-below-threshold live in **Retool `operation_levels`**, computed from timestamps written by Ops Slack — NOT computed at report time. Sentinel-object guard: Code nodes return `{no_alerts:true}`/`{no_changes:true}` to prevent empty alerts.
- **n8n sanctioned production writes are intentional** (not read-only violations): `UPDATE receiver_products SET status='disabled'`; UPDATE sync flags on `items`/`ec_order`/`preselect_orders`.
- Credentials: `sw_live_creds` (MySQL live), `Retool` (PG), `Odoo_read` (PG read replica), `Slack account`. "Live Darklaunch DB" creds = `serp_test` MySQL.

---

## How Jack Works (Tools & Preferences)

### Jack's Working Preferences (read first)

- **Minimal, additive change.** Extend existing pages/tabs/structures; never create new ones. Do exactly what's asked.
- **Advisory by default for anything risky or data-related.** Surface SQL / diffs / full new-file contents as TEXT; let Jack apply. "ok I updated the projections" = he already applied it (NOT a request).
- **Never edit `.env`/secrets directly.** State the diff. **Never execute production DB writes** — surface SQL only.
- **Fix in the seeder, not via direct DB edits.** Local replica/darklaunch data is **disposable** — reseed, never `UPDATE` to fix drift.
- **Read-only drift/diff tools must be strictly read-only against live.**
- **Verify before claiming done** — confirm the data path actually changed (right pipeline? page refreshed? table populated?).
- **Root-cause only, TDD.** "NO WORKAROUNDS — FIX THE ROOT CAUSE"; write a failing test first.
- **Strictly-scoped commits.** Never `git add -A`. **`git stash` is FORBIDDEN** in all repos (caused a silent 4-hunk drop). Never commit/push without explicit per-action permission. Never work directly on the integration branch.
- **Stop immediately when Jack takes over / says "nevermind."**

### Git & Deploy (per-repo — NOT uniform)

| Repo                  | Branch off    | Promotion                                             | Deploy                                                                                             |
| --------------------- | ------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **SERP**              | `dev`         | feature → `dev` → `main`                              | **MANUAL** on Hetzner K3s node: `ssh jack@5.161.95.56 → bash deploy-k8s.sh main` — NOT auto-deploy |
| **SWAC/WishDesk**     | `development` | `development` → `staging` → `live`                    | Parish runs promotions                                                                             |
| **sugarwish-laravel** | `development` | feature (`SUG-*`/`WW-*`) → `manage` → `blue` → `main` | Jenkins jobs for `manage`/`blue`/`live`; live runs manually                                        |
| **sugarwish-odoo**    | —             | `staging_new` → `main`                                | —                                                                                                  |

- `blue` = **integration branch**, NOT production (`main` is). `WW-*` tickets are NOT SWAC-exclusive; `SUG-*` is NOT Laravel-only — both span repos. `/pr-to-blue` (renamed from `/merge-to-blue`). June 2026 renamed `ww-*` slash commands to `sw-*` (**command-prefix only — WW-\* ticket prefix unchanged**).
- **SWAC and Laravel intentionally bundle multiple unrelated features per branch/PR — do NOT suggest splitting.**

### SERP Env Flags (independent switches)

| Flag                              | Gates                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `SERP_DARKLAUNCH_ENABLED`         | Darklaunch Odoo-mirroring writes                              |
| `SERP_SHADOW_WRITES_ENABLED`      | Shadow/prod-traffic validation (distinct from darklaunch)     |
| `ORDER_MANAGEMENT_WRITES_ENABLED` | Prod writes from Order Management page                        |
| `ORDER_QUEUE_WORKER_ENABLED`      | Merchandise order queue worker                                |
| `PACK_TOMORROW_ENABLED`           | Pack-tomorrow feature                                         |
| `ODOO_ID_STAMP_ENABLED`           | odoo_id stamping (off → no Odoo DB/XML-RPC during processing) |

Removed/legacy: `USE_SERP_AS_LIVE`, `USE_MOCK_ODOO` (keep `LIVE_SSH_*`). `ODOO_SOURCED_ORDERS_ENABLED` was consolidated into `SERP_DARKLAUNCH_ENABLED` — treat standalone references as legacy.

### SERP Test & Local-DB Rules

- Tests may **write to exactly ONE DB: `serp_test`** — NOT Retool, NOT `manage`. Serpy/queue tests that update Odoo run against **staging Odoo**.
- `mcp__python__run_python` is the **required** way to run Python validation — never `./venv/bin/python -c`. Always verify table structure with **live MCP queries**, not schema files.
- To align ORM with Odoo: `curl https://raw.githubusercontent.com/odoo/odoo/15.0/addons/<module>/models/<file>.py`, quote the matching method, write a **failing test first**, then fix citing line numbers.
- 4 local DBs rebuilt together via `npm run db:seed` (wipes + reseeds). `npm run db:pull` (~2m) only when `manage` schema changes. Seeder **caps windowed tables** (`account_move`, `stock_move_line`) at latest 5–10k ids — "nothing compared" in drift reports is **by design**. **`APP_ENV` must be `local`** for safe seeding. Seed order: Odoo first → APPEND SERP-native tables (phantom kits). Each table wiped between seeds.

### The Three "Wish" Systems (do NOT conflate)

| System        | What it is                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **WishDesk**  | CS ticketing/CRM at `desk.sugarwish.com` (built on SWAC); has `swcrm_z_gmail_*` Gmail tables                        |
| **WishWorks** | Internal dev bug/feature tracker (`WW-####`) at `desk.sugarwish.com/admin/wishworks/tickets`; introduced 2026-03-12 |
| **SWIRL**     | Company-wide knowledge repo + "SWIRL Bot" Slack DM                                                                  |

**WishBot** (`U0AHZK4FDSA`): DM or tag in a thread (not main channel) to create a WW ticket. Ticket **TRACK** routes to the codebase/team (`laravel`/`wishdesk`/`retool`/`react-receiver`/`react/proposals`) — wrong track = wrong team. `/ww` slash command **self-updates** from `jasonbkiefer/SWIRL` on each invocation (must re-read the freshly-downloaded file).

### sw-cortex (Jack's Personal Tooling — NOT production)

- Personal work-intelligence platform. MCP servers: db (read-only), slack-search (Qdrant, encrypted), knowledge (semantic search over `DICTIONARY.md`), jack-slack (Slack post/read), logs, github. `~/.mcp.json` runs via `npx tsx` — **no build step but requires Claude Code restart after editing `.ts`**.
- 30s query timeout (MySQL `max_execution_time=30000`; PG `statement_timeout=30000`; plus JS `Promise.race`). **`limit` param caps RESULT ROWS only** — does NOT stop a slow scan. `query_database_from_file` requires file under `~/Desktop/Projects` (override `MCP_DB_ALLOWED_DIRS`).
- `jack-slack` MCP posts as "jackbot" (uses `JACK_SLACK_BOT_TOKEN`, a Bot token not user token; bot must be invited to the channel).
- **The discoveries feature is removed.** There is no `add_discovery`/`mcp__discoveries__*` server and no `.claude/rules/db-discoveries.md` rule. Institutional knowledge now lives in this file (`DICTIONARY.md`) and is searched via the `knowledge` MCP (`mcp__knowledge__search_knowledge`); `/refresh-knowledge` distills new learnings into it.
- **Org-wide shared AI tooling (livery + SWIRL):** livery ships read-only MCP servers (`mcp-db-tool-live` with SQL keyword-blocklist + timeouts + SQLite audit log, `mcp-slack`, `mcp-wishdesk` stdio→HTTP proxy, `swim-kb` Qdrant). On the primary dev machine, live RDS / WishDesk require SSH tunnels first (live RDS → `localhost:13306`, WishDesk → `localhost:3001`). SWIRL is **symlinked** (not submoduled) into SWAC/Laravel/sw-design.

### Operational Alerting & Error Channels

| Channel / var                       | ID            | Use                                                                                             |
| ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `#serp-planning`                    | `C0ADCHKB9QQ` | Strategy/timeline                                                                               |
| `#serp-bugs-features`               | `C0986P364BC` | SERP testing/bugs                                                                               |
| `#serp-errors`                      | `C0B1SSZSV8W` | SERP worker/runtime errors; SERPY draft-sync results                                            |
| `#jack-test`                        | `C083M27KU8L` | SERPY/SERP-500 errors + **automated darklaunch reconciliation reports** — NOT a scratch channel |
| `#inventorymanagement`              | `C03G8LP36P6` | SERPY draft approval + Odoo/Laravel firefighting                                                |
| `#ops-and-tech`                     | `C025KEUDK99` | Inventory source-of-truth rules + weekly cost report                                            |
| `#api-autofix`                      | `C088M68FD47` | Self-healing workflows only — **informational, no action needed** (Seth standing instruction)   |
| `#odoo-prixite`                     | `C07QRF6MHD4` | Odoo vendor work                                                                                |
| `SLACK_INVENTORY_CHANNEL`           | `C0A19EW6RU3` | Inventory alerts                                                                                |
| `expiration_alert_slack_channel_id` | `C0A3ERYUGG1` | Expiration alerts                                                                               |
| `WISHLINK_PREPICK_SLACK`            | `C097SRFM85D` | Proposal approval                                                                               |

- **Order retry gotcha:** `order_dispatch_logs.status` must be `failed` for Retry to fire — any other status = silent no-op (manually UPDATE to `failed` first).
- Most `:rotating_light:` alerts in `#api-warnings`/`#avalara-alert`/`#live-product-warnings`/`#address-error` are routine auto-resolved noise. **"Fixed" rarely means root-caused** — usually a one-off data patch for one customer. `#low-nps-scores` is a **reference/learning channel**, not a resolution channel (every detractor NPS auto-generates a ticket; surveys go to **recipients**, not buyers).

### Dev Fixtures & Credentials

| Item                       | Value                                | Notes                          |
| -------------------------- | ------------------------------------ | ------------------------------ |
| SWAC/WishDesk dev login    | `jason` / `swdev123`                 | Non-secret fixture, `/auth`    |
| SERP prod nginx Basic Auth | `serp_admin` / `swserp12`            | Browser-cached HTTP Basic gate |
| SERP local login           | `jack@sugarwish.com` / `localdev123` | local dev                      |

---

## Gotchas & Footguns

### "Orders" Means Three Different Things

| Table                            | Purpose                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `wishdesk.orders_tickets`        | CS support tickets **about** orders (~411 rows, all `CLOSED`) — NOT the orders themselves |
| `retool.orders`                  | Actual e-commerce orders (~250k+), mirroring SugarWish/Laravel                            |
| `wishdesk.orders_monthly_orders` | Managed-gifting / recurring-order planner (year-grid)                                     |

### "Reserved" and `move_type` — Same Name, Different Meaning

- **Odoo `reserved`** = `stock_quant.reserved_quantity`. **Laravel `reserved`** = a large order sitting in the buyer's **CART**. Unrelated.
- `stock_picking.move_type`: shipping **policy** (`one` ship-complete vs `direct` allow-backorders). `account_move.move_type`: accounting **document type** (`entry`/`in_invoice`/`out_invoice`). Same column name, different meaning.

### `ec_order` Footguns

- `receiver_orders` is NOT the shipment table (`ec_order` is). `ec_order.size` is MISNAMED (= `buyer_products.id`). `buyer_orders.product_sku` is free-text — use `ec_order` for attribution. `ec_order` triggers have huge blast radius (Munyr can disable).

### Core Inventory Structural Problems

- **Single-location limitation:** Laravel can only pull available inventory from ONE Odoo stock location; nearly all SKUs stored under `ew/stock/fulfillment` even when physically in TY — Odoo cannot distinguish EW vs TY.
- **Off-site vendor stock is invisible** (vendors hold cartons/slips/stickers, ship in as POs land; Mike infers by subtraction). **No inventory snapshot-in-time mechanism** — cannot prove systems matched at a point in time, complicating reconciliation/cutover. **Leadership distrusts Odoo inventory** (default: Odoo is wrong, not the forecast).
- **Outer-shipper stockouts** (corrugated mailing boxes: 2/4/8/12-pick, grand, mini) HOLD shopped orders until a pallet arrives.
- **Negative inventory / oversell:** Laravel holds qty for orders not yet imported to Odoo → Odoo never reserves/subtracts → caches stagnant; when order ships fast, inventory never deducted. Team resolves "reserved negatives" manually daily; workaround: nudge Odoo on-hand by 1, apply, revert.

### Laravel ↔ Odoo Sync Bugs

- Archiving/disabling a SKU on one side without the other breaks SERPY sync. Inventory added to Odoo **before** the SKU exists in Laravel never gets picked up. Orders stuck at `oddo_synchronized=3` reference archived/disabled SKUs. Common root cause: matching Odoo `product_product.active=false` (archived variant) while the template stays active.

### Duplicate Charges & Orders

- Stripe charge with no order / duplicate charge = known race (WW-798, WW-1085); the daily detection n8n job has silently failed without alerts. Checkout add-to-cart race: a hardcoded **2-second `setTimeout`** between `/buyer/recipient-info` and `/buyer/add-to-cart` silently drops the cart item if the session write is slow. Duplicate orders are frequently **backend system-generated** (queue/dispatch re-fires), not double-clicks — check `order_queue_batches`/dispatch logs (one order shipped 24× in ShipStation).

### Custom Mug / Sleeve / Branding Print Files

- Mug print image source = **`ec_order.merchandise_selections.items[N].design_selected.print_image_url`** (matched by `item_id` to `branding_records.merchandise.items[N]`) — **NOT** `branding_records.merchandise.items[0].designs[0]…`. If `ec_order`'s `design_selected` is NULL, patching the branding record alone does NOT fix the PDF.
- Print files silently fall back to low-res: `ENABLE_BRANDING_RENDER_CRON` never set in live `.env` → `print_url=null` → 50 DPI JPEG fallback (`s3_url`). Livery: `renderUrl = render.print_url || render.s3_url`.
- **Two box-SKU vocabularies — do NOT cross-map:** RECIPE boxes (`merchandise_packaging_recipes` / `recipe_snapshot.outer_box_sku`): `c_1`, `c_1.25`, `c_1.5`, `c_2`, `c_3`, `c_4`. LIVERY/SLEEVE boxes (`branding_records.physical_branding`): `a_mini`, `a_small`, `a_medium`, `a_large`, `a_xlarge`, `c_1`, `c_small`, `h_small`. (`c_1` ≠ `c_small` — a real bug class.)
- **Fixing data in SWAC does NOT regenerate Livery's cached PDFs** — they're cached at `{batch}/{orderId}_sleeve.pdf`. To pick up a fix: click **"Regenerate"** (`POST /reset-status/:orderId`), then re-run `generate-batch`. Dashboard cell falls back to `all[0]` (looks fine) but the print path throws "no sleeve entries."
- **5 distinct "no sleeve / wrong sleeve" root causes:** (a) `buyer_product_id` duplicated across two box entries → 2 sleeves; (b) `box_sku` not in `SKU_TRIM_TABLE` (e.g. `h_*`) → `normalizeSkuKey` throws → whole PDF aborts; (c) missing size entry; (d) NULL `physical_branding`; (e) `design_box_override`-only ghost rows.

### SERP / Darklaunch Footguns

- **Timezone (~6h offset is BY DESIGN):** SERP/darklaunch stores **naive Mountain Time** (America/Denver); Odoo PG stores **naive UTC**. Every comparison MUST convert Denver wall-clock to UTC accounting for DST (−7h MST / −6h MDT). Seeding incident: a laptop in Eastern stamped `darklaunch_cutover_at` 2h off, creating a dead zone — always use the time of the Odoo prod seed, NOT laptop-local `NOW()`.
- **Dual-write failure modes:** `stock_picking` stuck in `confirmed`/`assigned` (expected `done`) usually = (1) `sugarwish_integration` overrides `button_validate` calling private `_action_done` (blocked over XML-RPC); (2) `put_product_qty` wizard → empty API → `JSONDecodeError`; (3) **UoM mismatch** (sync sends `uom_id=1` Units but product is `lb`) — look up the product's real `uom_id` first. SERP = atomic upsert; Laravel = SELECT-then-UPDATE → cross-system oversell risk during parallel run.
- **Worker / picking creation:** `action_confirm` does **NOT** create a picking (permanent divergence). The darklaunch worker is the **SINGLE** picking creator (`action_process_new_order`) — adding a second creator on `action_confirm` produces two pickings. Intentionally omitted: no `procurement.group`, no lot/serial, no package/owner tracking, no `ir.model.data`/`env.ref()`, chatter only on document-level models.

### Other Footguns

- **Odoo BOMs/quants:** "we don't use Odoo phantom BOMs anymore." Phantom BOMs **cannot** be created via the Odoo API (UI only). Inventory corrections = inventory adjustments, not phantom-BOM consumption. SERP's own phantom-BOM concept is separate.
- **Odoo.sh 330s timeout:** prod Odoo has a 330-second statement timeout. `NOT IN`/`!=`/`<>` on indexed columns of multi-million-row tables → seq scan → exceeds 330s. Use positive `IN`-lists. Known offender: n8n `VRdmXlm2XTeRbOyT` ("oversell"). Check `odoo.log` for "reaching the timeout limit of 330.0 seconds."
- **FastAPI serialization:** `response_model` **silently strips** fields not in the Pydantic schema (SERP has `ForecastItem` vs `ForecastItemSchema` — fields added to one but not the other vanish). Raw-dict endpoints with NO `response_model` serialize `Decimal` as a JSON **string** → frontend `.toFixed()` throws; fix with `float()` at the converter.
- **Forecast data sources:** projections always read from **`size_projections_copy`** (not `size_projections`). `product_type_key` (PTK) = `'ProductType|Size'`; dashboard and `sa_projections.sql` MUST produce identical PTK strings. Three non-interchangeable "days of inventory" metrics: SA Days / Total Days (`/forecast/live-products`, last-7-day basis), supplier `total_inventory` (`/forecast/dashboard`, 25-week forecast), ecard days-to-90% (`/forecast/ecard-inventory`, simulation).
- **April 2026 — BOM/kit expansion moved out of Odoo:** Jack intentionally moved expansion into Laravel/SERP; Odoo now receives pre-expanded component items. Buyer-product/packaging info **disappeared from Odoo sale orders** (~2026-04-16) — pull from **`component_orders`** in Laravel instead.
- **SSH tunnels:** remote prod DBs (live Laravel, WishDesk) only reachable through a bastion-host SSH tunnel. `paramiko` removed `DSSKey` → switch tunnel library to **ssh2 / ssh2-python**.
- **`receiver_products.product_id`** is the SugarWish product id, **NOT** Odoo `product_id`.

---

## Terminology / Glossary

**Business model:** corporate/personal gifting. Buyer sends an **eCard** → **recipient** clicks through and **chooses their own gift** → ships to their door. The recipient (not buyer) picks the SKU at redemption. Catalog: candy, snacks, cookies, popcorn, eCards, flowers, custom mugs/merch, custom-branded merchandise — not candy-only.

**Warehouse jargon:** "**shop**" (verb) = warehouse pick/pack a gift order (NOT browsing). "**pick**" (noun) = treat count in a size (2/4/6/8/12/16-pick → box/shipper size). "**shopped and shipped**" = packed and sent.

**Gift sizes (ascending price):** Mini → Small → Medium → Large → X-large → Grand → Deluxe.

### SKU Prefix Taxonomy

`default_code` (Odoo) / `sku` (Laravel) prefixes:

| Prefix                                  | Meaning                                                            | System       |
| --------------------------------------- | ------------------------------------------------------------------ | ------------ |
| `RM-`                                   | Raw Material (bulk, received via POs)                              | Odoo BOMs    |
| `SA-`                                   | Sub-Assembly / saleable finished good; has Odoo BOM                | Odoo BOMs    |
| `FG-`                                   | Finished-Goods kit (sellable receiver product)                     | Odoo BOMs    |
| `C-`/`E-`                               | Cartons/containers/cups/packaging                                  | —            |
| `S-`                                    | Shippers/outer boxes                                               | Laravel kits |
| `B-`                                    | Box components                                                     | Laravel kits |
| `I-`                                    | Inserts                                                            | —            |
| `L-`                                    | Labels/stickers                                                    | —            |
| `M-`/`M-CCC-`/`M-CEW-`                  | Mug/merchandise                                                    | SERP-tracked |
| `VB-`/`V-`                              | Wine/bottles                                                       | —            |
| lowercase words / `h_*` / `a_*` / `c_*` | Saleable kit/category/sleeve box-size products (often phantom-BOM) | —            |

- **Numeric middle segment = product line:** `01`/`156`=candy, `02`=popcorn, `03`=cookies, `10`/`14`=wine, `19`=coffee, `20`=tea, `21`=cocoa, `40`=socks/merch, `45`=brownies.
- **Box SKU token order:** `[type][product-letter]-REG-[YEAR]-[color]-[size]`. **YEAR token is critical** — boxes get re-versioned (`REG-22` → `REG-25`); BOMs must be swapped when ops switches.
- RM → SA via Manufacturing Order (one RM + one carton → SA). `WW-###`/`SUG-###` = Jira ticket prefixes (unrelated to SKUs). `swcrm_`/`ec_`/`component_` = table prefixes (unrelated).

### `sugarwish_id` / `odoo_id` Prefix Encoding

`product_template.sugarwish_id` bridges Odoo product → Laravel:

| Prefix     | Maps to                          | Resolution                                         |
| ---------- | -------------------------------- | -------------------------------------------------- |
| `800`      | Laravel `components` row         | Strip `800` → `components.id` (`8002578` → `2578`) |
| `500`      | `buyer_products` row             | —                                                  |
| plain int  | `receiver_products.product_id`   | —                                                  |
| `0`/`NULL` | No SW mapping (~1,371 templates) | —                                                  |

`components.odoo_id` is **fabricated** (`'800'+components.id` as string) — NOT a real Odoo product id.

**Odoo-tracked vs SERP-tracked:** SERP-tracked = custom-branded merch (mugs, t-shirts) — lives entirely in SERP's own `stock_quant`/`stock_move`/`buyer_orders` infra, **never in Odoo**; processed via `component_orders` that bypass the kit system.

### Kits, BOMs, Recipes

- **kit** = **phantom BOM** (`mrp_bom.type='phantom'`), also called "recipe" — auto-explodes into component lines on sale/delivery. **normal BOM** = manufacturing BOM, reduced only via manual MO, does NOT auto-explode. `serp_mrp_bom.type` = ENUM(`normal`,`phantom`) (no third value).
- **Recipe key** (`erecipe`/`recipe`, e.g. `1cube-bp6978`) = lookup key for a packaging config in `merchandise_packaging_recipes`, snapshotted onto orders as `ec_order.merchandise_selections` JSON → `recipe_snapshot.recipe_key`/`outer_box_sku`. Composition driven by recipe key → `mrp.bom` → `serp_product_product`, NOT order rows.
- **Multiple kit sources can disagree:** Laravel `kits`/`component_kits`, SERP phantom BOM, Odoo `mrp_bom`. The box that ships often comes from the SERP phantom BOM while the Laravel kit is empty. SERP UI: `serp.sugarwish.com/kits`.

### Order Lifecycle Tables

| Table              | Purpose                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `giftcards_card`   | eCard before redemption; source of truth for sender/receiver email              |
| `ec_order`         | Redeemed receiver order (one shipment); `size` = `buyer_products.id` (MISNAMED) |
| `items`            | Recipient's chosen flavors (one row per flavor)                                 |
| `preselect_orders` | Buyer pre-selects contents + recipient address                                  |
| `component_orders` | Box/packaging component lines; `inventory_source` = `odoo`/`serp`               |

- **Preselect / Pre-pick:** buyer chooses recipient's flavors up front (vs standard eCard where recipient chooses). Often bulk B2B. Bypasses cart and drop-level; promo codes do NOT apply; buyer enters recipient's address; ship-dated prepicks prioritized over FIFO. Disabled site-wide Oct 2021 (caused majority of stockouts despite <4% of sales); later relaunched.
- **WishLink:** shareable redemption link (`giftcards_card.delivery_method='wishlink'`). $2.50/card OR 10%-down + charge-on-redemption. Single-Use or Multi-Use. Prefer `delivery_method` over `is_wishlink`.
- **Prepay programs:** **HHS** = Holiday Head Start; **PPS** = Pre-Pay/budgeted prepay. Client pre-pays a lump sum → tiered bonus credit (~18% effective vs 15% standard large-order discount). Triggers/renews **"SugarWish Premium"** status.
- **Custom Shoppe / Custom Shop** = custom-branded-product storefront (logo'd mugs, merch). Own Retool Location. Team: Sophie + Neal. Generates custom-shop PDF + sleeve PDF.

### Warehouse Locations & Forecasting Terms

- **EW** = Englewood, CO (`location_id 1`, suffix `-E`); **TY** = Taylor, MI (`location_id 2`, suffix `-A`). Stored in legacy `locations` table — **no FK** to Odoo `serp_stock_location`. **Bakery & Cafe** (`product_type 567`) is split in SERP forecast: `Bakery&Cafe@EW`/`@TY` (driven by `product_type` + `location_id` of the **first item** in order). Picking name prefixes: `EW/OUT`/`EW/IN`/`EW/MO`/`EW/INT`; worker-created outbound named `EW/OUT/%` origin `RO-%`/`PSO-%`.
- **Forecasting RM vs SA vs Carton:** SA runout depends only on its own RMs (not cartons); `total_inventory` is per-RM-row. Forecast color codes (`/forecast/live-products`): **GREEN** = inventory available; **ORANGE** = SA (manufactured) runs out but RM remains; **YELLOW** = on-hand runs out but incoming PO not arrived; **RED** = all inventory runs out.
- **Popcorn phantom explode:** `feature/popcorn-phantom-explode` flips ~48 `SA-02-*` BOMs `normal→phantom` in SERP seed only. Popcorn forecast splits by vendor **CityPop vs Poppin** (no collapse).

### System Acronyms

- **SERP** = Jack's in-house ERP replacing Odoo 15. **SERPY** = SERP's AI ops agent (Slack bot). **Darklaunch** = SERP's dual-write shadow processing (writes only into local `serp_*_darklaunch`, never prod; validated by `/compare-darklaunch`; UNRELATED to feature-flag/canary darklaunches).
- **manage** / `manage.sugarwish.com` = SugarWish Laravel admin/management app + DB; serves as the dev/staging SugarWish DB AND the staging SERP schema source. "Test on manage" = the Laravel manage staging environment.
- **Livery / SWOP** = "Sugarwish Operations Platform" (`csloan-sw/livery`, Cris Sloan) — print/image-rendering for branded products + MCP-tooling backbone. **SWIRL** = Jason's org-wide knowledge platform; **SWIM** = WishDesk-embedded AI chatbot. Both separate from sw-cortex.
- **SWAC** = WishDesk (the GitHub description "SugarWish Activity Coordinator" is misleading).
