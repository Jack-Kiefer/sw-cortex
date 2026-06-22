# Command: go

The **task entry point.** `/go` opens a **real Claude Code session in the right project** (a new VS Code terminal tab, labeled for the project, with that repo's full native commands + MCP tools) and — unless you only named a repo — kicks off the work there with **a slash command chosen by intent**: an **actionable** task (fix/add/change) fires **`/analyze`** (SERP) — full research → build → PR — and a **pure question** fires **`/research`** — investigate → answer → stop. `/go` = pick the repo, pick the command, launch it. (`/launch` is the keep-this-tab-open variant for already-scoped fixes — see the `/launch` command.)

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <actionable task>    # detect repo → open its session → /analyze (research → build → PR)
/go <pure question>      # detect repo → open its session → /research (investigate → answer → stop)
/go serp                 # bare repo name → JUST open a SERP session, no command, no task
/go swac                 # JUST open a SWAC session
/go cortex               # JUST open a sw-cortex session
```

Examples:

- `/go fix the forecast zeros on live-products` → opens a SERP session running **`/analyze`** → it researches, builds the fix, and opens a PR (actionable task)
- `/go the proposal sleeve isn't resolving for medium boxes` → opens a SWAC session running **`/global-analyze`** → researches then builds (SWAC's research→build pipeline)
- `/go how does the redemption curve feed size_projections?` → opens SERP running **`/research`** → researches and reports the answer, then stops (pure question — nothing to build)
- `/go serp` → opens a bare SERP session, nothing else (the repo is already an explicit pick)

**Launch-and-go:** `/go` launches immediately — it does **not** pop a pre-launch question asking which area or angle to investigate first. Routing is automatic (Step 1) and the launched command (`/analyze` or `/research`) does its own deep research pass over everything the task touches.

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task, open that repo's session **bare — no analyze, no prompt**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT>
```

(`wishdesk` → SWAC.) Report which repo opened, tell Jack to switch to the new tab, done. Skip the rest.

## Step 0.1 — Bare ticket number? It's a WishWorks ticket → SWAC, and carry the ticket ID to the PR.

If `$ARGUMENTS` is ONLY a ticket reference — `WW-###`, `WW###`, or a bare number like `65` (case-insensitive, optional `WW-` prefix) — treat it as a **WishWorks dev-request ticket** (these are SWAC work; same `WW-###` tickets `/ww` manages). Do this:

1. **Normalize** to `WW-###` (a bare `65` → `WW-065`; keep the number's own width — `WW-65` if that's how it's filed).
2. **Fetch the ticket** so the research is scoped to what the ticket actually asks — read `wishworks/dev-requests/active/WW-###.md` from the SWIRL repo the same way `/ww` does (the GitHub-contents fetch in `/ww`, or `mcp__github__get_file { repo: "SWIRL", path: "wishworks/dev-requests/active/WW-###.md" }`). Pull out the ticket **title** and a one-line summary.
3. **Route to SWAC** and launch a research session whose task is the ticket's title/summary — exactly like a normal `/go <task>`, but built from the fetched ticket.
4. **Carry the ticket ID forward.** Embed `WW-###` in the launched prompt and tell the session it is the ticket for this work, so that when it later implements + ships, the **branch name is `jack/WW-###-<desc>`** and the **PR title/body reference `WW-###`** (SWAC convention — e.g. `jack/WW-065-ideas-web-ui`; `/ship-it`'s change log + PR cite the ticket). The ticket ID must survive all the way to the PR.

If the ticket can't be fetched (not found in `active/`, no SWIRL token), say so in one line and ask whether to proceed with just the ticket ID as the scope. Then continue to the launch. (A ticket number **with** extra task text — `/go WW-065 also fix the sleeve` — is not "bare": treat it as a normal task in Step 1, but still carry the `WW-###` through to the branch/PR per point 4.)

## Step 1 — Otherwise, pick the writable repo (decide and go; routing itself needs no question)

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

- The hub itself, `/go` and other hub slash commands, `global-config`, the write-guard, MCP servers (db/github/slack/knowledge/logs/jack-slack), the DICTIONARY/knowledge base, n8n workflow exports under this repo, tab-title/launch scripts, Qdrant/Slack-sync code. (`/analyze` is **SERP-only**, not a hub command.)

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

Repo roots:

- SERP → `/Users/jackkief/Desktop/Projects/SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex`

## Step 1.5 — Routed to sw-cortex? Do it INLINE — do NOT launch a new terminal.

The hub session you're already in **IS** a sw-cortex session — same cwd, same MCP tools, same native commands. Launching a new terminal for a sw-cortex task would spawn a second `claude` process that reloads `~/CLAUDE.md` + sw-cortex's `CLAUDE.md` from scratch — **paying the full context cost twice for nothing.**

So: **if the routed repo is sw-cortex, skip Steps 2–4 entirely. Do NOT call `launch-repo-session.sh`.** There is **no `/analyze` in sw-cortex** (it's a SERP-only command) — just do the work right here in the current session: research/diagnose the task inline and proceed. Say in one line that you're handling it in the hub (no new tab, to avoid double-loading context).

A new terminal is only worth it when the task needs a **different** repo's toolset/cwd (SERP or SWAC). For sw-cortex there's nothing to gain — the hub already has everything.

## Step 1.6 — `/go` fires a slash command by intent: `/analyze` (actionable) or `/research` (pure question)

**`/go` launches the session with a slash command, not a raw prompt** — and which one depends on whether there's something to BUILD:

- **Reported change / bug** ("fix X", "it's broken", "make it do Y", "add Y") → fire **`/analyze <task>`** (SERP). `/analyze` is the full pipeline: it researches first, then flows straight through to a build + open PR in the launched session. This is the actionable path — `/go` no longer stops at research for a fix; the launched `/analyze` session does the deep research AND the build.
- **Pure question** (how/why/what/where/which, "explain", "trace", "look into", "find out" — nothing to build) → fire **`/research <task>`** (the read-only command). It investigates with a research swarm, presents the answer, and **stops** — no build, no PR.

So the intent classification now decides the **command**, not just how the session closes. Actionable → `/analyze` (research→build). Question → `/research` (research→answer→stop). (sw-cortex tasks never reach here — Step 1.5 handles them inline.)

**SWAC has no `/analyze` or `/research` of its own** — for a SWAC actionable task fire **`/global-analyze <task>`** (it already researches-then-builds, with the SWAC worktree+dev-server+wait-for-"ship it" contract from the `/launch` spec); for a SWAC pure question fire **`/research <task>`** (the generic research command works in any repo session).

## Step 2 — Build the first prompt: pick the slash command, then pass the task

The launched session runs a **slash command** chosen in Step 1.6 — `/analyze` (SERP actionable), `/global-analyze` (SWAC actionable), or `/research` (pure question, either repo). Pass the task as the command's argument plus the tab-title rider:

```
/analyze <task>     # SERP, actionable — research then build then PR
/research <task>    # pure question — research, answer, stop
```

Append the tab-status rider to whichever command you fire so the session keeps its tab title current:

```
/analyze <task> — set the tab title with set-tab-title.sh as you go (🔍 researching → 🔨 building → 📦 PR → ✅ done; 🙋/❓ when it needs you).
```

For a **`/research`** launch (pure question), the rider is: `set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting the answer, ✅ when answered).`

So a SERP `/go fix the forecast zeros on live-products` becomes the launcher prompt:
`/analyze fix the forecast zeros on live-products — set the tab title with set-tab-title.sh as you go (🔍 researching → 🔨 building → 📦 PR → ✅ done; 🙋/❓ when it needs you).`

And a SERP `/go how does the redemption curve feed size_projections?` becomes:
`/research how does the redemption curve feed size_projections? — set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting the answer, ✅ when answered).`

## Step 3 — Launch

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> "<slash-command-prompt>"
```

where `<slash-command-prompt>` is what Step 2 built — `/analyze …` (SERP actionable), `/global-analyze …` (SWAC actionable), or `/research …` (pure question).

Pass ONLY the repo root and the prompt — **do NOT add `--label` or call `set-tab-title.sh` yourself**, and do NOT run `claude` inline. The launcher queues the request and the Go Launcher extension opens the tab, deriving a descriptive name from the task prompt automatically (e.g. `🔍 forecast zeros on live-products`). The running session then updates the title as it works (`🔍 researching` → `🙋 presenting issues` → `✅ done`, after which the tab auto-closes). Reconstructing the old `set-tab-title.sh 'SERP' ; claude '<prompt>'` form is wrong — it bypasses the queue and produces a bare `SERP` title.

## Step 4 — Report

- **One line**: which repo you routed to and which command it's running, e.g. "Routed to **SERP** — opening an `/analyze` session for the forecast zeros (research → build → PR)." or for a question: "Routed to **SERP** — opening a `/research` session to answer how the redemption curve feeds size_projections."
- A new terminal tab opens **automatically** (the Go Launcher VS Code extension watches `~/.claude/go-queue/` and opens a terminal per request — no keypress, no Accessibility), titled with the task. It auto-closes ~5s after it reaches `✅ done`. Tell Jack to switch to it; it's working with that repo's full native tooling. This hub session stays put.
- **For an actionable `/analyze` launch, the build happens IN that session** — research flows straight to a PR, no bounce back to the hub. For a `/research` launch (pure question), the session answers and stops; if it surfaces a fixable issue you can later spin the fix into its own tab with `/launch` (→ `/implement`).
- If no tab appears, the extension may not be loaded yet (needs a VS Code reload after first install) — check `~/.vscode/extensions/go-launcher/` exists and reload the window.

`/go` does NOT do the work in THIS session — it classifies, routes, picks the command (`/analyze` for actionable, `/research` for a question), and launches it in a new tab.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "look into Y in a go", "spin up a session for X", "open a session to dig into X", "fix X in a new go", "just open serp" — treat it EXACTLY like `/go`: same routing, same bare-vs-task logic, same **intent-picks-the-command** launch (`/analyze` for an actionable fix/change, `/research` for a pure question), run the launcher immediately, no confirmation. "fix X in a new go" is **actionable** → it fires `/analyze` (research → build → PR) in the new tab. A pure "how/why does X work" → `/research`. (To skip research and go straight to building an already-scoped fix while keeping this tab open, that's `/launch` → `/implement`, not `/go`.)

**Launch fixes into their own tabs:** when Jack says **"launch fixes for those"** / "launch a fix for each" / names specific ones — that's the `/launch` command: route+classify each fix and fire **one `/implement` session per fix** (SERP), keeping the original tab open. One terminal per fix, never one session bundling several (subject to `/launch`'s same-file coalescing gate).

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
