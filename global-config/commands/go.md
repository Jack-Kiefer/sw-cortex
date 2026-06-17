# Command: go

The **one command for everything.** `/go` opens a **real Claude Code session in the right project** (a new VS Code terminal tab, labeled for the project, with that repo's full native commands + MCP tools) and — unless you only named a repo — kicks off the right work on your task there.

`/go` first reads enough of the task to **classify it as research (a question to answer) or implementation (a change to make)**, then routes to the right writable repo and launches the session with the matching first prompt — a **research/answer** prompt for questions, or the repo's **analyze** command for changes. You don't say which it is; `/go` decides from the wording (see Step 1.6).

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <task description>   # detect repo → open its session → run the repo's analyze on the task
/go serp                 # bare repo name → JUST open a SERP session, no analyze, no task
/go swac                 # JUST open a SWAC session
/go cortex               # JUST open a sw-cortex session
```

Examples:

- `/go fix the forecast zeros on live-products` → **implementation** → presents pickable scope+approach options → opens SERP, runs `/analyze fix the forecast zeros…` already scoped to your picks
- `/go the proposal sleeve isn't resolving for medium boxes` → **implementation** → presents options → opens SWAC, runs `/global-analyze …`
- `/go how does the redemption curve feed size_projections?` → **research** → opens SERP with a plain research/answer prompt (no `/analyze`); the session investigates and reports there
- `/go serp` → opens a bare SERP session, nothing else (no options — the repo is already an explicit pick)

**Options-first:** unless you only named a repo, `/go` pops up a few pickable options (which area + which approach) before launching, so you click rather than type a paragraph. See Step 0.5.

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task, open that repo's session **bare — no analyze, no prompt**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT>
```

(`wishdesk` → SWAC.) Report which repo opened, tell Jack to switch to the new tab, done. Skip the rest.

## Step 0.5 — Options-first intake (ALWAYS, before routing)

**Jack should rarely have to type an open-ended task.** Unless Step 0 already handled it (bare repo name), use the **`AskUserQuestion`** tool to turn whatever he typed into a few pickable options BEFORE you route or launch — even if his input is a full sentence. Do the cheap reconnaissance first (route the task per Step 1, glance at the KB / the relevant repo) so the options are concrete and specific, not generic.

Ask 1–3 questions. For an **implementation** task, the options cover both:

- **SCOPE — _what_ he means:** the specific area / page / system / table / SKU-family the task touches. Turn a vague phrase into concrete targets (e.g. for "fix the forecast zeros" → "live-products view", "ecard-inventory simulation", "CSV export", "dashboard").
- **APPROACH — _how_ to go after it:** the candidate fix paths / angles, phrased as distinct options (e.g. "patch the converter to `float()`", "add the field to the Pydantic schema", "trace the pipeline first").

For a **research** task (per Step 1.6) there's no fix to scope — instead narrow the **question**: which subsystem/file/table to look in, or which interpretation of the question he means (e.g. for "how does the redemption curve work" → "the curve math itself", "where it feeds size_projections", "the data source it reads"). Don't offer fix-path options for a pure question.

Rules for the options:

- Make the **first option your recommended one** and append " (Recommended)" to its label.
- Options must be **specific to this task and repo** — derived from the actual routing + a quick look, not boilerplate. Bad: "Frontend / Backend / Both". Good: names the real view, worker, table, or file.
- Jack can always pick "Other" to type freely — that's the escape hatch, not the default path.
- Keep it to 1–3 questions. If after a genuine look the task is already fully specified AND single-approach (nothing meaningful to choose), skip asking and say so in one line — but default to asking.

Fold Jack's picks into the task string you pass to the launcher so the new session starts already-scoped. THEN continue to Step 1 (routing is likely already done from the recon above) → Step 2 → Step 3.

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

So: **if the routed repo is sw-cortex, skip Steps 2–4 entirely. Do NOT call `launch-repo-session.sh`.** There is **no `/analyze` in sw-cortex** (it's a SERP-only command) — just do the work right here in the current session: research/diagnose the task inline (folding in any Step 0.5 picks) and proceed. Say in one line that you're handling it in the hub (no new tab, to avoid double-loading context).

A new terminal is only worth it when the task needs a **different** repo's toolset/cwd (SERP or SWAC). For sw-cortex there's nothing to gain — the hub already has everything.

## Step 1.6 — Classify: research (a question) or implementation (a change)?

You already know enough from routing to tell what KIND of task this is. Decide between two modes — you don't need deep certainty, just enough to route the prompt:

- **RESEARCH** — the task is a **question to answer / something to understand**, no code change expected. Signals: starts with how/why/what/where/which/does/can/is, "explain", "trace", "figure out", "look into", "find out", "where does X come from", "how does X work", "what's causing Y" with no ask to fix it. The deliverable is an **answer/explanation**, not a diff.
- **IMPLEMENTATION** — the task is a **change to make**. Signals: fix, add, change, update, make X do Y, build, wire up, remove, rename, refactor, "it's broken — fix it", "make it require…". The deliverable is a **code change** (which the repo's analyze command preps).

If it's genuinely ambiguous (a bug report that's half "why" and half "fix it"), default to **IMPLEMENTATION** — analyze researches first anyway, so it covers the question on the way to the change. Only pick RESEARCH when the task is clearly just asking to understand/find something.

This classification decides which first prompt Step 2 builds. (sw-cortex tasks never reach here — Step 1.5 handles both research and changes inline.)

## Step 2 — Build the first prompt for that repo (SERP / SWAC only)

The first prompt the new session runs depends on the **mode from Step 1.6** and the **repo**:

| Mode               | SERP                                              | SWAC (WishDesk)                        |
| ------------------ | ------------------------------------------------- | -------------------------------------- |
| **Implementation** | `/analyze <task>` (SERP's research-swarm analyze) | `/global-analyze <task>`               |
| **Research**       | a plain research/answer prompt (below)            | a plain research/answer prompt (below) |

(sw-cortex is handled inline in Step 1.5 — it never reaches this step, and has no `/analyze` of its own.)

**Implementation** → the initial prompt is the analyze command + the task, e.g. `/analyze fix the forecast zeros on live-products`.

**Research** → do NOT use `/analyze` (it's implementation-flavored — it preps a change). Instead pass a plain instruction that tells the new session to investigate **in that repo with its full toolset** and just report the answer — no edits, no PR. Build it as:

```
Research only — answer this, don't change any code: <task>. Use this repo's tools (code search, MCP, DB, KB) to investigate and report findings. Set the tab title with set-tab-title.sh as you go (🔍 while researching, ✅ when answered).
```

So a SERP research /go becomes a launcher prompt like:
`Research only — answer this, don't change any code: how does the redemption curve feed size_projections? Use this repo's tools (code search, MCP, DB, KB) to investigate and report findings. Set the tab title with set-tab-title.sh as you go (🔍 while researching, ✅ when answered).`

## Step 3 — Launch

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> "<first-prompt>"
```

where `<first-prompt>` is what Step 2 built — `/analyze <task>` (SERP impl) / `/global-analyze <task>` (SWAC impl), or the **research/answer prompt** for a research task.

Pass ONLY the repo root and the prompt — **do NOT add `--label` or call `set-tab-title.sh` yourself**, and do NOT run `claude` inline. The launcher queues the request and the Go Launcher extension opens the tab, deriving a descriptive name from the task prompt automatically (e.g. `🔨 make SERPY require an MO date`, or `🔍 how redemption curve feeds size_projections` for research). The running session then updates the title as it works (`🔍 researching` → `🙋 approve?` / `✅ done`, after which the tab auto-closes). Reconstructing the old `set-tab-title.sh 'SERP' ; claude '<prompt>'` form is wrong — it bypasses the queue and produces a bare `SERP` title.

## Step 4 — Report

- **One line**: which repo you routed to, the **mode**, and why (e.g. "Routed to **SERP**, implementation — forecast/darklaunch; opening a session running `/analyze`." or "Routed to **SERP**, research — opening a session to investigate and answer, no code change.").
- A new terminal tab opens **automatically** (the Go Launcher VS Code extension watches `~/.claude/go-queue/` and opens a terminal per request — no keypress, no Accessibility), titled with the task. It auto-closes ~5s after it reaches `✅ done`. Tell Jack to switch to it; it's running the analyze (impl) or the investigation (research) with that repo's full native tooling. This hub session stays put.
- **Multiple at once:** to launch several (e.g. "launch a go for each issue"), call the launcher once per item — each drops its own request file and the extension opens a separate tab for each. They don't clobber.
- If no tab appears, the extension may not be loaded yet (needs a VS Code reload after first install) — check `~/.vscode/extensions/go-launcher/` exists and reload the window.

`/go` does NOT do the work itself — it classifies, routes, launches, and starts the analyze (impl) or the research (research). The real work happens in the project session.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "fix X in a new go", "spin up a session for X", "open a session to do X", "look into Y in a go", "just open serp" — treat it EXACTLY like `/go`: same classify (research vs impl, Step 1.6), same routing, same bare-vs-task logic, same per-repo first prompt, run the launcher immediately, no confirmation.

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
