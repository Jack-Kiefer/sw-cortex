# Command: go

The **research entry point.** `/go` opens a **real Claude Code session in the right project** (a new VS Code terminal tab, labeled for the project, with that repo's full native commands + MCP tools) and — unless you only named a repo — kicks off a **deep research pass** on your task there. **`/go` always researches first; it never implements.** It investigates, finds the issue(s), and reports them. When it finds multiple issues, it offers to **launch a separate fix session per issue** — that's `/launch` → `/implement` (see Step 2 and the `/launch`/`/implement` commands). `/go` = find the problem; `/launch` = fix it.

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <task description>   # detect repo → open its session → deep-research the task (no implementing)
/go serp                 # bare repo name → JUST open a SERP session, no research, no task
/go swac                 # JUST open a SWAC session
/go cortex               # JUST open a sw-cortex session
```

Examples:

- `/go fix the forecast zeros on live-products` → opens a SERP **research** session → it diagnoses, finds the issue(s), lists each with root cause + file:line + fix, and offers "launch fixes for those" → you say that and `/launch` fires a `/implement` session per fix
- `/go the proposal sleeve isn't resolving for medium boxes` → opens a SWAC **research** session → diagnoses + reports the issue(s) + offers to launch the fix(es)
- `/go how does the redemption curve feed size_projections?` → opens SERP, researches, and reports the answer (a pure question — nothing to fix)
- `/go serp` → opens a bare SERP session, nothing else (no options — the repo is already an explicit pick)

**Options-first:** unless you only named a repo, `/go` pops up a few pickable options (which area + which angle to investigate) before launching, so you click rather than type a paragraph. See Step 0.5.

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task, open that repo's session **bare — no analyze, no prompt**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT>
```

(`wishdesk` → SWAC.) Report which repo opened, tell Jack to switch to the new tab, done. Skip the rest.

## Step 0.5 — Options-first intake (ALWAYS, before routing)

Unless Step 0 already handled it (bare repo name), **invoke the `options-first-intake` skill** and follow it (the AskUserQuestion mechanics + the 5 shared rules + fold-picks) BEFORE you route or launch. Do the cheap recon first — route the task per Step 1 and glance at the KB / the relevant repo — so the options are concrete.

`/go`-specific rider — **the second axis is ANGLE, not APPROACH.** `/go` always launches a **research** session (not a fix), so scope the **investigation**, never a fix path:

- **ANGLE — _where_ to look first:** which subsystem/file/table/flow the research should start from, or which interpretation of the task he means (e.g. for "fix the forecast zeros" → "trace the converter/pipeline", "check the Pydantic schema", "check the SQL source"; for "how does the redemption curve work" → "the curve math itself", "where it feeds size_projections", "the data source it reads").
- Don't phrase options as "apply fix A vs fix B" — `/go` doesn't fix; it investigates. Fix paths get decided later, after research, when you `/launch` the fix.

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

## Step 1.6 — `/go` is ALWAYS research-first (deep research before any change)

**`/go` always launches a RESEARCH session — it never kicks off `/analyze`/`/global-analyze` as the first prompt.** Every `/go` opens a session that does a deep research pass first: investigate, understand, and find the issue(s). It does NOT start editing code, and it does NOT begin the implementation pipeline. Implementation is a separate, later step — you launch it explicitly via `/launch` (which fires `/implement`) once research has surfaced what to fix. (`/go` = find the problem; `/launch` = fix it.)

You still note what KIND of task this is — but only so the research session knows how to **close**, not whether to research:

- **Pure question** (how/why/what/where/which, "explain", "trace", "look into", "find out") → the session investigates and reports the answer. Done.
- **Reported change / bug** ("fix X", "it's broken", "make it do Y") → the session still **researches first**: it diagnoses, finds the issue(s), and reports them — then, if it found something fixable, it surfaces the fix(es) so you can launch them (see Step 2's "finding-issues close"). It does **not** implement here.

Either way the launched prompt is a research prompt. (sw-cortex tasks never reach here — Step 1.5 handles them inline.)

## Step 2 — Build the (always-research) first prompt for that repo (SERP / SWAC only)

The new session ALWAYS runs a research prompt — for both SERP and SWAC, for both a pure question and a reported bug. Do **not** pass `/analyze` or `/global-analyze` (those implement; `/go` is research-only). Build the prompt from this template, filling in the "finding-issues close" so a bug-style task ends by offering to launch the fix(es):

```
Research only — do NOT change any code, do NOT implement, do NOT open a PR: <task>. Use this repo's full tools (code search, MCP, DB, KB) to investigate deeply and report findings. If you find one or more fixable issues, present them as a clear numbered list — each with its root cause, the file:line, and the concrete fix — and end by telling Jack he can say "launch fixes for those" (or pick specific ones) to spin up a separate /implement session per fix. Do NOT implement any of them yourself. Set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting issues/answer, ✅ when answered).
```

The **finding-issues close** is the important part: when the research finds **multiple** issues, the session lists them and explicitly offers to **launch a separate fix session per issue**. That hand-off is exactly what `/launch fixes for those` does — one terminal per fix, each running `/implement` (see the `/launch` command).

So a SERP `/go` (whether "how does X work" or "fix the forecast zeros") becomes a launcher prompt like:
`Research only — do NOT change any code, do NOT implement, do NOT open a PR: fix the forecast zeros on live-products. Use this repo's full tools (code search, MCP, DB, KB) to investigate deeply and report findings. If you find one or more fixable issues, present them as a clear numbered list — each with its root cause, the file:line, and the concrete fix — and end by telling Jack he can say "launch fixes for those" to spin up a separate /implement session per fix. Do NOT implement any of them yourself. Set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting issues/answer, ✅ when answered).`

## Step 3 — Launch

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> "<research-prompt>"
```

where `<research-prompt>` is what Step 2 built (always the research/answer prompt — never `/analyze`/`/global-analyze`).

Pass ONLY the repo root and the prompt — **do NOT add `--label` or call `set-tab-title.sh` yourself**, and do NOT run `claude` inline. The launcher queues the request and the Go Launcher extension opens the tab, deriving a descriptive name from the task prompt automatically (e.g. `🔍 forecast zeros on live-products`). The running session then updates the title as it works (`🔍 researching` → `🙋 presenting issues` → `✅ done`, after which the tab auto-closes). Reconstructing the old `set-tab-title.sh 'SERP' ; claude '<prompt>'` form is wrong — it bypasses the queue and produces a bare `SERP` title.

## Step 4 — Report

- **One line**: which repo you routed to and that it's a research pass, e.g. "Routed to **SERP** — opening a research session to investigate the forecast zeros; it'll report the issue(s) and offer to launch fixes." Don't say "running /analyze" — `/go` no longer does that.
- A new terminal tab opens **automatically** (the Go Launcher VS Code extension watches `~/.claude/go-queue/` and opens a terminal per request — no keypress, no Accessibility), titled with the task. It auto-closes ~5s after it reaches `✅ done`. Tell Jack to switch to it; it's researching with that repo's full native tooling. This hub session stays put.
- **The fix step is separate:** once the research session lists issues, Jack says **"launch fixes for those"** (or names specific ones) and `/launch` fires **one `/implement` session per fix** — see the `/launch` command. `/go` itself never implements.
- If no tab appears, the extension may not be loaded yet (needs a VS Code reload after first install) — check `~/.vscode/extensions/go-launcher/` exists and reload the window.

`/go` does NOT do the work itself, and it does NOT implement — it classifies, routes, and launches a **research** session. Fixing happens later via `/launch` → `/implement`.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "look into Y in a go", "spin up a session for X", "open a session to dig into X", "research X in a go", even "fix X in a new go", "just open serp" — treat it EXACTLY like `/go`: same routing, same bare-vs-task logic, same **research-first** launch (always the research prompt, never `/analyze`), run the launcher immediately, no confirmation. Note "fix X in a new go" still means **research** here — `/go` investigates X and offers to launch the fix; it doesn't implement. (To go straight to implementing an already-scoped fix, that's `/launch` → `/implement`, not `/go`.)

**Launch the fixes after research:** when a `/go` research session has listed issues and Jack says **"launch fixes for those"** / "launch a fix for each" / names specific ones — that's the `/launch` command: route+classify each fix and fire **one `/implement` session per fix** (SERP), keeping the original tab open. One terminal per fix, never one session bundling several.

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
