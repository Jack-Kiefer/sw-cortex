# Command: go

The **task entry point.** `/go` gets you into the right project with **a slash command chosen by intent**: an **actionable** task (fix/add/change) fires **`/serp-analyze`** (SERP) — full research → build → PR — and a **pure question** fires **`/research`** — investigate → answer → stop. `/go` = pick the repo, pick the command, run it.

**By default `/go` WARM-SWAPS this tab into the target repo — it does NOT spawn a new one.** When this session runs in a Herdr pane (the normal case), `/go` enqueues `/cd <repo>` + the analyze command into **this same pane** via `herdr agent prompt`. `/cd` loads the target repo's `CLAUDE.md`, its `.mcp.json` MCP servers, and its settings, and drops sw-cortex's — all **in the same process, keeping the warm prompt cache**. No new tab, no teardown, no second full load of `~/CLAUDE.md`. This tab **becomes** the SERP/SWAC session. (Why: a fresh-tab launch cold-boots a new `claude` that re-writes the entire cached prefix — tools + system + both `CLAUDE.md`s — at the full cache-WRITE premium every time. The warm `/cd` swap pays none of that. Verified on Claude Code v2.1.246+.)

`/go` still **spawns a separate tab** in the cases that genuinely need a second session: **fire-and-forget / parallel** ("launch that and keep going" — this tab must keep working), **`/launch`** (its contract is keep-this-tab-open + a new tab per fix), and **VS Code / no Herdr pane** (self-prompt unavailable → fall back to `launch-repo-session.sh`). (`/launch` is the keep-this-tab-open variant for already-scoped fixes — see the `/launch` command.)

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <actionable task>    # detect repo → warm-swap THIS tab into it → /serp-analyze (research → build → PR)
/go <pure question>      # detect repo → warm-swap THIS tab into it → /research (investigate → answer → stop)
/go serp                 # bare repo name → JUST swap this tab to SERP, no command, no task
/go swac                 # JUST swap this tab to SWAC
/go cortex               # JUST work in sw-cortex (already here — inline)
```

Examples:

- `/go fix the forecast zeros on live-products` → warm-swaps this tab into SERP and runs **`/serp-analyze`** → it researches, builds the fix, and opens a PR (actionable task)
- `/go the proposal sleeve isn't resolving for medium boxes` → warm-swaps this tab into SWAC and runs **`/swac-analyze`** → researches then builds (SWAC's research→build pipeline)
- `/go how does the redemption curve feed size_projections?` → warm-swaps into SERP and runs **`/research`** → researches and reports the answer, then stops (pure question — nothing to build)
- `/go serp` → swaps this tab to a bare SERP session, nothing else (the repo is already an explicit pick)

**Launch-and-go:** `/go` runs immediately — it does **not** pop a pre-launch question asking which area or angle to investigate first. Routing is automatic (Step 1) and the launched command (`/serp-analyze` or `/research`) does its own deep research pass over everything the task touches.

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task (`wishdesk` → SWAC), open that repo's session **bare — no analyze, no prompt** — two cases:

- **This session runs in a Herdr pane (`HERDR_PANE_ID` set — check with `echo $HERDR_PANE_ID`):** **warm-swap THIS pane in place with `/cd`** — same tab and position, same process, warm cache, keeping full context. This is the SAME mechanism as Step 3a, just with **no analyze command** (bare repo = `/cd` only). Enqueue the swap via a detached helper:

  ```bash
  PANE="$HERDR_PANE_ID"; HB="$(command -v herdr)"
  nohup bash -c '
    H="$1"; P="$2"; R="$3"
    "$H" agent wait   "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true   # wait for THIS turn to end
    "$H" agent prompt "$P" "/cd $R" --wait --until idle --timeout 120000 >/dev/null 2>&1
  ' _ "$HB" "$PANE" "<REPO_ROOT>" >/dev/null 2>&1 &
  disown
  ```

  **Both Claude and Codex have `/cd`**, so this one enqueue warm-swaps either agent identically — no agent detection needed for a bare `/cd`. (Bare `/go` sends only `/cd` — no follow-on prompt — so the command-registration race in Step 3a doesn't apply here.) Then say in ONE line that the tab is warm-swapping to that repo, and **END THE TURN IMMEDIATELY with no further tool calls** — the detached helper waits for this turn to end, then sends `/cd`, which swaps the working dir + loads the repo's `CLAUDE.md`/`AGENTS.md` (+ MCP servers on Claude) in the same warm process.

  **Do NOT use `herdr-switch-repo.sh`** — it SIGINTs the process and hard-runs `herdr agent start claude`, which (a) cold-reboots, losing all context, and (b) in a **Codex** pane kills Codex and leaves a dead bare shell, since it can only restart a `claude` agent. The warm `/cd` avoids both.

- **Otherwise (VS Code / no Herdr pane):** launch a bare session the normal way:

  ```bash
  ~/.claude/scripts/launch-repo-session.sh <REPO_ROOT>
  ```

  Report which repo opened, tell Jack to switch to the new tab, done.

Either way, skip the rest.

## Step 0.1 — Bare ticket number? It's a WishWorks ticket → SWAC, and carry the ticket ID to the PR.

If `$ARGUMENTS` is ONLY a ticket reference — `WW-###`, `WW###`, or a bare number like `65` (case-insensitive, optional `WW-` prefix) — treat it as a **WishWorks dev-request ticket** (these are SWAC work; same `WW-###` tickets `/ww` manages). Do this:

1. **Normalize** to `WW-###` (a bare `65` → `WW-065`; keep the number's own width — `WW-65` if that's how it's filed).
2. **Fetch the ticket** so the research is scoped to what the ticket actually asks — read `wishworks/dev-requests/active/WW-###.md` from the SWIRL repo the same way `/ww` does (the GitHub-contents fetch in `/ww`, or `mcp__github__get_file { repo: "SWIRL", path: "wishworks/dev-requests/active/WW-###.md" }`). Pull out the ticket **title** and a one-line summary.
3. **Route to SWAC** and launch a research session whose task is the ticket's title/summary — exactly like a normal `/go <task>`, but built from the fetched ticket.
4. **Carry the ticket ID forward.** Embed `WW-###` in the launched prompt and tell the session it is the ticket for this work, so that when it later implements + ships, the **branch name is `jack/WW-###-<desc>`** and the **PR title/body reference `WW-###`** (SWAC convention — e.g. `jack/WW-065-ideas-web-ui`; `/ship-it`'s change log + PR cite the ticket). The ticket ID must survive all the way to the PR.

If the ticket can't be fetched (not found in `active/`, no SWIRL token), say so in one line and ask whether to proceed with just the ticket ID as the scope. Then continue to the launch. (A ticket number **with** extra task text — `/go WW-065 also fix the sleeve` — is not "bare": treat it as a normal task in Step 1, but still carry the `WW-###` through to the branch/PR per point 4.)

## Step 0.2 — Already have a recently-closed chat on this exact topic? Resume THAT instead of starting fresh.

Before routing a real task (`$ARGUMENTS` is task/question text — not a bare repo name or bare ticket, both handled above), check whether Jack **just recently closed a saved chat on the same thing**. If so, resuming that chat — with its full context, branch, and next-step — beats launching a cold session that re-derives everything. This is the "see if I have a conversation recently closed on this and resume it" behavior.

1. **List the recently-closed saves.** Run:

   ```bash
   ~/.claude/scripts/save-for-later.sh list closed
   ```

   Each line is TSV: `file<TAB>title<TAB>repo<TAB>branch<TAB>pr<TAB>updated<TAB>nextstep`. If there are **none**, skip straight to Step 1 (launch fresh) — say nothing about it.

   **Recency gate:** only consider saves whose `updated` (column 6, `YYYY-MM-DD`) is **within the last ~14 days** of today. An older closed topic must NOT hijack a new `/go` — drop those rows before matching.

2. **Match the task against those saves — conservatively.** Compare `$ARGUMENTS` semantically against each candidate's **title** and **nextstep** (and its `branch`). A match is **strong** only when the distinctive terms clearly line up — the same feature/bug/subsystem, not just a shared common word ("fix", "the", a repo name). Examples: `/go finish the serp-published-kits publisher` ↔ a closed save titled _serp-published-kits publisher_ = **strong**; `/go look at inventory` ↔ a save _core-SKU report buy-goal limiting RM_ = **weak** (only "inventory-ish" overlaps) → not a match. When in doubt, treat it as **weak**.

2.5. **Drop any candidate that's ALREADY a live session — never resume a topic that's currently open in another running tab.** Call `mcp__sessions__list_sessions` and, for each strongly-matched save, check whether an active session is already on that same work: its `repo` matches the save's repo AND its live `task` (tab title) or branch clearly covers the save's topic/branch. If so, that topic is **already being worked** — **exclude it from the resume candidates** (resuming would spawn a second tab on the same thing / branch). If the mesh is unavailable (tool errors — Herdr down), skip this filter and proceed with the recency+match gates alone. (Only strong matches survive to here, so this is a cheap final guard, not a broad scan.)

3. **Strong match → auto-resume it (no confirmation).** Jack chose zero-friction resume, so on a single strong match, launch it immediately — do NOT ask first. Read the matched save file for its `repo_root`, then launch the resume loader exactly as `/resume-later` does:

   ```bash
   ~/.claude/scripts/launch-repo-session.sh <repo_root_from_save> "/resume-later-load <absolute-path-to-matched-save-file>"
   ```

   Then **report in one line and stop** — e.g. "Found a recently-closed chat on this — **resuming `serp-published-kits publisher`** in SERP on `jack/published-kits`. Switch to the new tab." Do **not** also launch a fresh `/serp-analyze`/`/swac-analyze`/`/research` session; the resume IS the launch. (The resumed session's `/resume-later-load` gets it back on the branch and re-establishes context.)
   - **`updated` within 14 days is the auto-resume gate.** A closed save older than that never auto-resumes here — it's still reachable via `/resume-later`, just not automatically hijacking a fresh `/go`.
   - If **two or more** saves match strongly (rare), don't guess — show the matches (title, repo, branch, closed-date) and ask which to resume, or whether to start fresh. Auto-resume is only for a single unambiguous strong match.

4. **No match / only weak matches / the only strong match is already a live session → fall through to Step 1 and launch fresh, silently.** Do not mention the near-misses; a `/go` with no _resumable_ prior chat behaves exactly as it does today. (This step never _blocks_ a launch — worst case it's a no-op and Step 1 runs.)

> This reuses the existing save/resume machinery end-to-end: `save-for-later.sh list closed` is the corpus, `/resume-later-load <file>` is the resume path (same one `/resume-later` uses), and `mcp__sessions__list_sessions` is the live-session filter (never resume a topic already open in a running tab). Nothing new is stored; `/go` just checks the closed saves first and, on a clear topic match that isn't already live, resumes instead of starting over.

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

- The hub itself, `/go` and other hub slash commands, `global-config`, the write-guard, MCP servers (db/github/slack/knowledge/logs/jack-slack), the DICTIONARY/knowledge base, n8n workflow exports under this repo, tab-title/launch scripts, Qdrant/Slack-sync code. (`/serp-analyze` is **SERP-only**, not a hub command.)

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

**Orphan analysis/research → default to SERP.** The exception to "ask which repo" is a **pure analysis/research question that doesn't belong to SERP, SWAC, or sw-cortex** (a general SugarWish data/Slack/cross-system question with no clear owning repo). Don't ask and don't handle it inline — **route it to SERP and launch a `/research` session there.** SERP sessions carry telemetry, so this keeps the research tracked instead of running untracked in the hub. (This applies only to **analysis that has no repo home** — a genuine sw-cortex change still routes to sw-cortex and runs inline per Step 1.5, and anything with a real SERP/SWAC angle routes there as usual.)

Repo roots:

- SERP → `/Users/jackkief/Desktop/Projects/SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex`

## Step 1.5 — Routed to sw-cortex? Do it INLINE — do NOT launch a new terminal.

The hub session you're already in **IS** a sw-cortex session — same cwd, same MCP tools, same native commands. Launching a new terminal for a sw-cortex task would spawn a second `claude` process that reloads `~/CLAUDE.md` + sw-cortex's `CLAUDE.md` from scratch — **paying the full context cost twice for nothing.**

So: **if the routed repo is sw-cortex, skip Steps 2–4 entirely. Do NOT call `launch-repo-session.sh`.** There is **no `/serp-analyze` in sw-cortex** (it's a SERP-only command) — just do the work right here in the current session: research/diagnose the task inline and proceed. Say in one line that you're handling it in the hub (no new tab, to avoid double-loading context).

**Title this tab as you work — the inline path needs it just as much as a launched one.** A launched session gets the tab-status rider in its prompt (Step 2); an inline hub task has no such prompt, so unless you call the setter yourself the tab keeps whatever floor the hook seeded and never reflects the work. So set it at the first real step and advance it as you go, exactly as the Terminal Tab Status section of `~/CLAUDE.md` describes:

```bash
~/.claude/scripts/set-tab-title.sh "\U0001f50d <what you're looking into>"   # then \U0001f528 building, \U0001f9ea verifying, \U0001f4e6 PR open, \u2705 done
```

A new terminal is only worth it when the task needs a **different** repo's toolset/cwd (SERP or SWAC). For sw-cortex there's nothing to gain — the hub already has everything.

**But ship the change as a PR to `main`, built in a throwaway worktree — never commit to the hub's `main` and never `git checkout` a branch in the hub working copy.** "Inline" means the _session_ runs in the hub; it does **not** mean committing straight to `main`. A sw-cortex change makes a **PR to `main` exactly like SERP does**, and like SERP's `/deploy` the branch is made in a **separate git worktree under `/tmp`** so the hub's own checkout never leaves `main`:

```bash
ROOT=/Users/jackkief/Desktop/Projects/sw-cortex
WT=/tmp/cortex-pr-<desc>
git -C "$ROOT" worktree add --force -B <desc> "$WT" origin/main   # SERP-style worktree, NOT a checkout in the hub
# make ALL edits + the commit inside the worktree (git -C "$WT" …), never the hub dir
git -C "$WT" push -u origin <desc>
gh -C "$WT" pr create --base main --head <desc> --title "…" --body "…"   # or: cd "$WT" && gh pr create …
# after Jack merges — IMMEDIATELY pull the merge into the hub's main, then clean up:
git -C "$ROOT" pull --ff-only origin main          # advance the hub's main to include the merged PR (right away)
git -C "$ROOT" worktree remove --force "$WT" && git -C "$ROOT" worktree prune
# then set ✅ done and STOP — do NOT close the tab; Jack closes tabs himself
```

Pause for Jack's review/merge unless he says to merge. **The moment the PR is merged, `git -C "$ROOT" pull --ff-only origin main`** so the hub's `main` isn't left behind the merge — then remove the worktree, set `✅ done`, and stop. **Do NOT close the terminal after the merge** — the tab stays open; Jack closes tabs himself (`close-own-tab.sh` is reserved for explicit close commands like `/save-for-later`). If `global-config/` changed, run `sync-global-config.sh push` after the pull. (Heads-up: `~/CLAUDE.md` is a symlink into the hub checkout, so editing it via that path writes to the hub on `main` — make `global-config/` edits **inside the worktree path** instead, so nothing lands on the hub's `main`.)

## Step 1.6 — `/go` fires a slash command by intent: `/serp-analyze` (actionable) or `/research` (pure question)

**`/go` runs a slash command in the swapped-into session, not a raw prompt** — and which one depends on whether there's something to BUILD:

- **Reported change / bug** ("fix X", "it's broken", "make it do Y", "add Y") → fire **`/serp-analyze <task>`** (SERP). `/serp-analyze` is the full pipeline: it researches first, then flows straight through to a build + open PR. This is the actionable path — `/go` no longer stops at research for a fix; the `/serp-analyze` session does the deep research AND the build.
- **Pure question** (how/why/what/where/which, "explain", "trace", "look into", "find out" — nothing to build) → fire **`/research <task>`** (the read-only command). It investigates with a research swarm, presents the answer, and **stops** — no build, no PR.

So the intent classification decides the **command**. Actionable → `/serp-analyze` (research→build). Question → `/research` (research→answer→stop). (sw-cortex tasks never reach here — Step 1.5 handles them inline.)

**SWAC has its own `/swac-analyze` (no `/serp-analyze`) and no `/research` of its own** — for a SWAC actionable task fire **`/swac-analyze <task>`** (the WishDesk-specific research→build command — it researches the desk/proposal/sleeve subsystems, then builds with the SWAC worktree+dev-server+wait-for-"ship it" contract from the `/launch` spec); for a SWAC pure question fire **`/research <task>`** (the generic research command works in any repo session).

## Step 2 — Build the analyze prompt: pick the slash command, then pass the task

The swapped-into session runs a **slash command** chosen in Step 1.6 — `/serp-analyze` (SERP actionable), `/swac-analyze` (SWAC actionable), or `/research` (pure question, either repo). Pass the task as the command's argument plus the tab-title rider:

```
/serp-analyze <task>     # SERP, actionable — research then build then PR
/research <task>    # pure question — research, answer, stop
```

Append the tab-status rider to whichever command you fire so the session keeps its tab title current:

```
/serp-analyze <task> — set the tab title with set-tab-title.sh as you go (🔍 researching → 🔨 building → 📦 PR → ✅ done; 🙋/❓ when it needs you).
```

For a **`/research`** launch (pure question), the rider is: `set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting the answer, ✅ when answered).`

**Also append the session-mesh check** to every launch rider so the new session notices if another session is already on the same work (see the Session Mesh section of `~/CLAUDE.md`): ` — first call mcp__sessions__check_overlap { task: "<the task>" }; if it overlaps a peer, send that peer ONE heads-up via mcp__sessions__message_session and tell Jack, otherwise just proceed.` So the full SERP rider becomes tab-status + this. (Skip only if the mesh isn't available — the tool will error and the session works solo.)

So a SERP `/go fix the forecast zeros on live-products` builds the analyze prompt:
`/serp-analyze fix the forecast zeros on live-products — set the tab title with set-tab-title.sh as you go (🔍 researching → 🔨 building → 📦 PR → ✅ done; 🙋/❓ when it needs you).`

And a SERP `/go how does the redemption curve feed size_projections?` builds:
`/research how does the redemption curve feed size_projections? — set the tab title with set-tab-title.sh as you go (🔍 while researching, 🙋 when presenting the answer, ✅ when answered).`

This analyze prompt is what Step 3 enqueues into the pane (warm-swap), OR passes to `launch-repo-session.sh` (new-tab exceptions).

### Step 2.5 — Images attached? Carry them into the analyze prompt as file paths.

Both the warm-swap enqueue and the new-tab launch pipe are text-only, but the swapped-into/launched session's Read tool can view PNG/JPG files — so images ride along **as file paths in the prompt**. If Jack's `/go` message includes images, handle both attachment kinds:

- **File path in the message** (drag-dropped a file — the path is already text): use it directly.
- **Pasted image** (`[Image #N]` chip — exists only in this session's transcript, no path): re-materialize it to disk first:

  ```bash
  ~/.claude/scripts/extract-session-images.sh          # dumps the last user message's pasted images
  ```

  It prints one absolute path per line (files land in `~/.claude/go-attachments/`). Empty output = no pasted images found (e.g. the transcript hasn't flushed) — say so in one line rather than launching with a dangling reference.

Then append an image rider to the Step 2 prompt so the launched session actually looks at them, e.g.:

```
/serp-analyze <task> — first, Read these image(s), they are part of the task: /Users/jackkief/.claude/go-attachments/<...>.png — set the tab title with set-tab-title.sh as you go (…).
```

No launcher/extension changes are involved — the prompt passes through unmodified, and `taskSlug` only affects the tab name. (Skip this step when the message has no images.)

## Step 3 — Run it: warm-swap THIS tab by default; spawn a new tab only for the exceptions

**Decide which path first — warm-swap is the default.** Take the new-tab path ONLY when one of these holds:

- **Fire-and-forget / parallel** — Jack said "launch that and keep going", "spin that off and continue", or is firing several `/go`s that must run at once. This tab has to keep working, so the task needs its OWN session → new tab.
- **`/launch`** — its contract is keep-this-tab-open + a separate tab per fix. (That's the `/launch` command, not `/go`.)
- **No Herdr pane** — `echo $HERDR_PANE_ID` is empty (VS Code / bare terminal). `herdr agent prompt` can't self-enqueue, so fall back to a new tab.

Otherwise → **warm-swap** (3a). The warm-swap has two variants by pane agent — **Claude** (default) or **Codex** — detected via `herdr agent get`; see the Codex sub-note in 3a.

### 3a — Warm-swap (default): `/cd` + analyze in THIS pane, no new process

The two prompts (`/cd <repo>` then the analyze prompt Step 2 built) must fire as **separate, sequential turns** — `/cd` fully settling BEFORE the analyze prompt is sent. **Do NOT send two bare back-to-back `herdr agent prompt` calls** — without waiting between them, both texts land in the input buffer before the agent processes the first, and they **CONCATENATE** onto one line (`/cd` then receives `/Users/…/SERP<the entire analyze prompt>` as its path → `Couldn't find a directory`). This was verified to fail. The fix is a **detached helper** (same shape as `herdr-switch-repo.sh`) that waits for THIS turn to go idle, then sends each prompt with **`--wait --until idle`** so the next one only fires after the previous turn settles:

```bash
PANE="$HERDR_PANE_ID"; HB="$(command -v herdr)"
nohup bash -c '
  H="$1"; P="$2"; R="$3"; A="$4"
  "$H" agent wait   "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true   # wait for THIS turn to end
  "$H" agent prompt "$P" "/cd $R"  --wait --until idle --timeout 120000 >/dev/null 2>&1  # /cd settles first
  sleep 4                                                                                  # let the dest repos project commands register (see note)
  "$H" agent prompt "$P" "$A"      --wait --until idle --timeout 60000  >/dev/null 2>&1  # then the analyze prompt
' _ "$HB" "$PANE" "<REPO_ROOT>" "<ANALYZE_PROMPT>" >/dev/null 2>&1 &
disown
```

Then **report one line (Step 4) and END THE TURN with no further tool calls** — the detached helper drives the pane: it waits for this turn to finish, sends `/cd` (which swaps the working directory and loads the repo's `CLAUDE.md` + `.mcp.json` servers, dropping sw-cortex's, keeping the warm prompt cache), **waits ~4s for the destination repo's project commands to register**, then sends the analyze prompt so it runs in the now-SERP/SWAC session. This tab **is** that session from here on.

- **The `sleep 4` is load-bearing — do NOT drop it.** `/cd`'s `--until idle` returns the moment `/cd` prints "Moved to …", but the destination repo's `.claude/commands/` (`/serp-analyze`, `/swac-analyze`, …) register *asynchronously* a beat later. Send the analyze prompt too soon and it fails with **`Unknown command: /serp-analyze`** and the task text lands as **"Args from unknown skill"** (verified live — this is exactly the bug the delay fixes). ~4s is comfortably past the registration window; the `/cd` swap itself is unaffected (it already completed).

- **Why the detached helper** — the FIRST prompt can't be sent inline: `herdr agent wait --until idle` needs THIS turn to end first (the agent is "working" = you), and you can't `--wait` on your own turn from inside it. `nohup … & disown` detaches so the helper runs after the turn ends. Same reason `herdr-switch-repo.sh` uses a detached helper.
- **`--wait --until idle` is load-bearing** — it's what makes `/cd` and the analyze prompt separate turns instead of one concatenated line. Never drop it, and never collapse to two bare `agent prompt` calls.
- **First-visit trust prompt** — if you've never worked in `<REPO_ROOT>` in this session, `/cd` shows a workspace-trust dialog; the `--wait --until idle` on the `/cd` call blocks the helper until it settles (idle after approval), so the analyze prompt still fires cleanly afterward. Mention it in the Step 4 line if it's a repo you haven't touched.
- **Don't call `set-tab-title.sh` or `/cd` yourself in THIS turn** — the helper enqueues them; the swapped-into session (this same pane, next turn) owns its title via the analyze command's rider.

#### If this pane is running CODEX, not Claude — enqueue Codex `/cd`, no analyze command

The pane might be a **Codex** session, not Claude (Herdr runs both). Codex CLI has its OWN `/cd` (shipped v0.149.0; warm-swaps the working dir + reloads the destination's `AGENTS.md` project context, history preserved) and Herdr drives a Codex pane through the exact same `herdr agent prompt` socket — so the warm-swap mechanism is identical. Two differences only: detect the agent, and **Codex has no analyze command** (`/serp-analyze` / `/swac-analyze` / `/research` are Claude Code commands — Codex can't run them), so you enqueue ONLY `/cd` (bare repo swap), plus the raw task as a plain prompt if there is one.

Detect the pane's agent first:

```bash
AGENT="$(herdr agent get "$HERDR_PANE_ID" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("agent",{}).get("agent",""))')"
# "claude" → the Claude helper above.  "codex" → the Codex helper below.
```

For a Codex pane, the helper sends Codex `/cd` (and the task as a second plain prompt only if `/go` carried a task — no rider, no slash-analyze):

```bash
PANE="$HERDR_PANE_ID"; HB="$(command -v herdr)"
nohup bash -c '
  H="$1"; P="$2"; R="$3"; T="$4"
  "$H" agent wait   "$P" --until idle --timeout 60000 >/dev/null 2>&1 || true
  "$H" agent prompt "$P" "/cd $R" --wait --until idle --timeout 120000 >/dev/null 2>&1   # Codex /cd
  sleep 4                                                                                 # let dest AGENTS.md/context settle
  [ -n "$T" ] && "$H" agent prompt "$P" "$T" --wait --until idle --timeout 60000 >/dev/null 2>&1   # raw task, only if one was given
' _ "$HB" "$PANE" "<REPO_ROOT>" "<RAW_TASK_OR_EMPTY>" >/dev/null 2>&1 &
disown
```

- **Codex `/cd` reloads AGENTS.md, but its MCP-tool reload is UNVERIFIED** — Codex wires MCP via `~/.codex/config.toml` / `codex mcp`, not a per-repo `.mcp.json` that `/cd` re-scans, and the docs only promise the AGENTS.md/project-context reload (they explicitly note `/cd` does NOT re-materialize the environment). So a Codex warm-swap gets the repo + its instructions, but may NOT pick up the repo's live tools. Say so in the Step 4 line ("Codex `/cd` — repo + AGENTS.md loaded; live tools may need a manual reconnect").
- **No `/serp-analyze` / `/research` for Codex** — never enqueue a slash-analyze command into a Codex pane; it isn't a Codex command. A bare `/go <repo>` is just `/cd`; a task-carrying `/go` sends `/cd` then the task text as an ordinary prompt for Codex to work on directly.
- Everything else (detached helper, `--wait --until idle` to keep the two prompts as separate turns, end-the-turn-then-it-fires) is identical to the Claude path.

### 3b — New tab (exceptions only): `launch-repo-session.sh`

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> "<ANALYZE_PROMPT>"
```

Pass ONLY the repo root and the prompt — **do NOT add `--label` or call `set-tab-title.sh` yourself**, and do NOT run `claude` inline. The launcher opens a Herdr tab (or a VS Code terminal in the fallback), deriving a descriptive name from the task automatically, and the running session updates the title as it works. For fire-and-forget, `--keep-original` behavior is what `/launch` uses; plain `/go` fire-and-forget spawns the tab and you immediately resume this session's current thread.

## Step 4 — Report

- **One line**, matching the path you took:
  - **Warm-swap:** "Routed to **SERP** — warm-swapping this tab into SERP and running `/serp-analyze` for the forecast zeros (research → build → PR)." (Add "(first visit — approve the trust prompt)" if it's a repo you haven't `/cd`'d to yet.) Then end the turn.
  - **New tab:** "Routed to **SERP** — opening a separate `/serp-analyze` tab for the forecast zeros; this tab keeps going." Tell Jack to switch to the new tab.
- **Warm-swap consumes THIS tab** — after the queued prompts fire, this pane is the SERP/SWAC session (sw-cortex tooling is gone until you `/cd` back). That's intended. If you need the hub AND the task at once, that's the fire-and-forget / new-tab path instead.
- **For an actionable analyze run, the build happens in this same session** — research flows straight to a PR. For a `/research` run (pure question), it answers and stops; a fixable issue it surfaces can be spun into its own tab later with `/launch` (→ `/implement`).
- If the warm-swap doesn't fire (`herdr agent prompt` errored): check `herdr status` (server running?). If Herdr is down, fall back to Step 3b (new tab) or just `/cd` manually.

`/go` classifies, routes, picks the command, and either warm-swaps this tab into the repo (default) or spawns a separate tab (fire-and-forget / `/launch` / no-Herdr).

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "look into Y in a go", "spin up a session for X", "open a session to dig into X", "fix X in a new go", "just open serp" — treat it EXACTLY like `/go`: same routing, same bare-vs-task logic, same **recently-closed-chat check (Step 0.2 — resume a matching recently-closed save instead of starting fresh)**, same **intent-picks-the-command** run (`/serp-analyze` for an actionable fix/change, `/research` for a pure question), and the same **warm-swap-this-tab default** (Step 3a) vs new-tab exceptions (Step 3b) — go immediately, no confirmation. "fix X in a new go" is **actionable** → it fires `/serp-analyze` (research → build → PR); by default that warm-swaps this tab into SERP. A pure "how/why does X work" → `/research`. **Note the wording:** a phrase like "spin up a session" / "open a session" / "in a new go" reads as fire-and-forget only when Jack also signals he wants THIS tab to keep going ("and keep going", "and continue", or he's clearly mid-task here); a plain "fix X in a go" with nothing to keep doing here is the ordinary warm-swap. When in doubt between warm-swap and a new tab, warm-swap (it's cheaper and reversible with `/cd`). (To skip research and go straight to building an already-scoped fix while keeping this tab open, that's `/launch` → `/implement`, not `/go`.)

**Launch fixes into their own tabs:** when Jack says **"launch fixes for those"** / "launch a fix for each" / names specific ones — that's the `/launch` command: route+classify each fix and fire **one `/implement` session per fix** (SERP), keeping the original tab open. One terminal per fix, never one session bundling several (subject to `/launch`'s same-file coalescing gate).

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
