# Command: go

The **one command for everything.** `/go` opens a **real Claude Code session in the right project** (a new VS Code terminal tab, labeled for the project, with that repo's full native commands + MCP tools) and — unless you only named a repo — kicks off the proper analysis on your task there.

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <task description>   # detect repo → open its session → run the repo's analyze on the task
/go serp                 # bare repo name → JUST open a SERP session, no analyze, no task
/go swac                 # JUST open a SWAC session
/go cortex               # JUST open a sw-cortex session
```

Examples:

- `/go fix the forecast zeros on live-products` → opens SERP, runs `/analyze fix the forecast zeros…`
- `/go the proposal sleeve isn't resolving for medium boxes` → opens SWAC, runs `/global-analyze …`
- `/go serp` → opens a bare SERP session, nothing else

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task, open that repo's session **bare — no analyze, no prompt**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --label <LABEL>
```

(`wishdesk` → SWAC.) Report which repo opened, tell Jack to switch to the new tab, done. Skip the rest.

## Step 1 — Otherwise, pick the writable repo (no questions; decide and go)

Choose exactly ONE of SERP / SWAC / sw-cortex. Read-only repos (Odoo, sugarwish-laravel, livery, sw-design, swirl, infra) resolve to the writable repo that owns the change you'd make. Match the task against these — pick by the strongest signal:

### → SERP (the in-house ERP: forecasting, inventory, Odoo-parity, sync)

- **Forecasting:** supplier forecast, live-products / ecard-inventory / dashboard views, SA/RM/days-of-inventory, `size_projections`, redemption curve, demand redistribution, the teal-sidebar app.
- **Inventory & ops:** drop levels, auto-disable, `operation_levels`, core/seasonal/legacy classification (`sku_type`/`is_core`), inventory counts, beginning-inventory snapshots, oversell/negative-inventory.
- **SERPY:** the AI inventory-ops agent, drafts, op types, kit/component swaps via SERPY, draft approval flow.
- **Odoo parity / ORM:** anything about `serp_*` tables matching Odoo, `/check-odoo-alignment`, divergences, costing/SVL/FIFO, MOs/POs/BOMs, `call_kw`, fat ORM models.
- **Darklaunch & sync:** drift reports, `compare-darklaunch`/`compare-orders`/`compare-costing`, `odoo_sync_queue`, the darklaunch order worker, `odoo_id_stamper`, the workers pod, dual-write.
- **Cross-system data flow you fix on YOUR side:** an order not syncing Odoo→SERP, `serp_*` ingestion, the sync queue, `oddo_synchronized` handling, ec_order→serp_sale_order bridging. (Odoo & sugarwish-laravel are read-only — but the part you'd change lives in SERP.)
- **SERP infra/app:** SERP deploy, K3s, SERP auth/JWT, the red-sidebar ERP UI, SERP migrations.

### → SWAC / WishDesk (CS desk, proposals, receiver flows, sleeve resolution)

- **Sleeves & branding (the resolution/data side):** `branding_records`, `physical_branding`, sleeve resolution (`sleeve-resolution.ts`), "missing/wrong sleeve" bugs, proposal→branding mirroring, mug-image review. (livery RENDERS the PDF and is read-only — but the resolution/data feeding it is SWAC.)
- **Proposals:** the proposal builder, `proposals` table, revision chains, locked versions.
- **CS / CRM / desk:** WishDesk admin console, `swcrm_*`, tickets (`orders_tickets`/`sw_billing_tickets`/`swcrm_actions`), Gmail/SWIM email assistant, the receiver app, customer-facing flows.
- **WishDesk app behavior:** auth/sessions, agent-vs-admin route guards, the Drizzle/Express backend, desk2/desk3 environments.
- **Design assets you fix on YOUR side:** ecard/box/genie configs live in sw-design (read-only) — but how WishDesk CONSUMES them (sync-in, `system_settings`, quiz-config) is SWAC.

### → sw-cortex (this hub & personal tooling)

- The hub itself, `/go`/`/analyze`/`/deploy` and other slash commands, `global-config`, the write-guard, MCP servers (db/github/slack/knowledge/logs/jack-slack), the DICTIONARY/knowledge base, n8n workflow exports under this repo, tab-title/launch scripts, Qdrant/Slack-sync code.

### Read-only repos → where they route

| If the task seems to be about… (read-only)                   | Route to                        | Because                                                 |
| ------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------- |
| **Odoo** (ERP data, crons, modules)                          | SERP                            | your work is the SERP-side parity/sync                  |
| **sugarwish-laravel** (e-commerce app, `ec_order`, checkout) | SERP                            | your side is the sync/ingestion; you don't edit Laravel |
| **livery** (sleeve/slip PDF imposition, printers)            | SWAC                            | the data/resolution feeding it is SWAC's                |
| **sw-design** (design pipeline, `design_*`, box/genie JSON)  | SWAC                            | how WishDesk consumes the assets is SWAC's              |
| **swirl** (SWIRL KB, WishWorks tickets)                      | sw-cortex (tooling) or hand-off | not usually a code change you make                      |
| **sugarwish-infrastructure**                                 | hand-off (Munyr)                | you don't deploy infra                                  |

If a request truly can't be placed (e.g. "fix the Vinebox drop-ship" — could be Laravel/livery with no clear SERP/SWAC angle), say so in one line and ask which repo rather than guessing. If genuinely split across two writable repos, pick the primary and mention the other.

Repo roots & labels:

- SERP → `/Users/jackkief/Desktop/Projects/SERP` · label `SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC` · label `SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex` · label `sw-cortex`

## Step 2 — Build the analyze prompt for that repo

The new session should START by analyzing the task. The analyze command DIFFERS by repo:

| Repo                | First prompt the session runs                           |
| ------------------- | ------------------------------------------------------- |
| **SERP**            | `/analyze <task>` (SERP's local research-swarm analyze) |
| **SWAC** (WishDesk) | `/global-analyze <task>`                                |
| **sw-cortex**       | `/analyze <task>` (sw-cortex's local analyze)           |

So the initial prompt passed to the launcher is the analyze command + the task, e.g. for a SERP task: `/analyze fix the forecast zeros on live-products`.

## Step 3 — Launch

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --label <LABEL> "<analyze-command> <task>"
```

It opens a new VS Code terminal tab titled `[<repo>]` and starts `claude` there with that prompt — so the session comes up and immediately runs the repo-appropriate analyze on your task.

## Step 4 — Report

- **One line**: which repo you routed to and why (e.g. "Routed to **SERP** — forecast/darklaunch; opening a SERP tab running `/analyze`.").
- **On success** ("Opened a new VS Code terminal tab (…)"): tell Jack to switch to the new `[<repo>]` tab — that's where it's analyzing, with full native tooling. This hub session stays put.
- **On failure** (Accessibility fallback printed): relay the paste-able command verbatim; note he can grant VS Code Accessibility (System Settings → Privacy & Security → Accessibility) and re-run, or paste it himself. Never claim it launched if it didn't.

`/go` does NOT do the work itself — it routes, launches, and starts the analyze. The real work happens in the project session.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "fix X in a new go", "spin up a session for X", "open a session to do X", "just open serp" — treat it EXACTLY like `/go`: same routing, same bare-vs-task logic, same per-repo analyze, run the launcher immediately, no confirmation.

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
