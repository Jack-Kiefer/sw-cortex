# Command: start-day

Jack's morning kickoff. Orchestrates the start-of-day routine as a **single ultracode Workflow**
(parallel agents under one fan-out) and ends with a single triage briefing: what needs Jack's
attention today.

The steps are **independent and run concurrently** — with **one** load-bearing ordering
constraint: Slack triage (Step 4) reads the index that the Slack sync (Step 1) writes, so
**triage must not start until sync has finished**. Everything else fans out in parallel. (Step 1b
syncs the Gemini meeting notes from Drive into Qdrant — an orchestrator step alongside the Slack
sync, but nothing waits on it.)

```
/start-day               # full routine: sync ‖ tickets ‖ PRs ‖ KB ‖ diagnostic → triage
/start-day skip-sync     # skip the Slack sync (use the existing index as-is)
/start-day skip-kb       # skip the knowledge-base touch-up step (Step 3)
/start-day skip-diagnostic   # skip the Claude-setup diagnostic step (Step 5)
/start-day skip-shutdown # skip the worktree shutdown step (Step 6 — leave all worktrees)
/start-day skip-reseed   # skip the weekly WishDesk local reseed (Step 7)
/start-day days=7        # widen the diagnostic / KB look-back window (default 3 days)
```

`$ARGUMENTS` may contain `skip-sync`, `skip-kb`, `skip-diagnostic`, `skip-shutdown`, `skip-reseed`, and/or `days=N`.
Anything else is ignored.

---

## Standing directive (always, every run)

**Run this entire routine at `ultracode` effort, orchestrated as a single Workflow.** Before
doing anything else:

1. **Effort = ultracode.** Treat this as a standing ultracode opt-in for the routine — the
   morning briefing should be the most thorough version of itself. (If the session isn't already
   on ultracode, raise effort to it for this command; token cost is not a constraint here.)
2. **Drive it with the `Workflow` tool — author ONE workflow script**, not inline Task
   subagents. The whole routine is the workflow: a `phase('Wave A')` that fans out Steps
   **0, 2, 2b, 2c, 3, 5** in `parallel()` while the Slack sync runs in the background, a **barrier**
   on the sync, then a `phase('Triage')` running Step 4, then a `phase('Shutdown')` running
   Step 6. The step bodies below are the per-agent prompts; the orchestration model section maps
   them onto the script.

This standing directive is the whole reason the command exists in its current form — do not fall
back to inline Task subagents, and do not run at a lower effort, unless Jack says so in the
invocation.

---

## What you (Claude) must do

You are the **orchestrator**. Set the tab title at the start:
`~/.claude/scripts/set-tab-title.sh "🔨 starting · start-day"` — and **only you** (the main
thread) touch the tab; the workflow's agents must never call `set-tab-title.sh`. The global hooks
re-stamp it, so update it only at real transitions.

### Orchestration model — author and run ONE Workflow script

Per the standing directive, the routine runs as a **single `Workflow` call**, not inline Task
subagents. Pass the script **inline** to the `Workflow` tool. It has three phases plus the
background sync, and exactly **one** load-bearing barrier (sync → triage). Build it like this:

1. **`meta` block** — `name: 'start-day'`, a one-line `description`, and `phases` matching the
   three `phase()` titles below (`Wave A`, `Triage`, `Shutdown`).
2. **Kick the Slack sync off first** as a background shell step **outside** the workflow (Step 1
   is `npm run slack:sync`, which the workflow's agents can't run) — start it with
   `Bash(run_in_background: true)` **before** the `Workflow` call, OR pass `skip-sync`'s status
   in via the script's `args`. Simplest correct shape: start the bg sync, then call `Workflow`;
   the Triage phase doesn't begin until you've confirmed the sync finished (see the barrier
   below). The sync is the **only** thing the workflow waits on.
3. **`phase('Wave A')` — fan out the read steps with `parallel()`.** One `agent()` call each
   for **Step 0** (health-check), **Step 2** (tickets), **Step 2b** (PRs/deploy), **Step 2c**
   (saved-for-later chats), **Step 2d** (SERPY draft integrity), **Step 3** (KB touch-up), **Step 5**
   (Claude-setup diagnostic). Each
   agent's prompt **is the step body below**;
   each must `return` exactly the compact result block that step specifies — give each a `schema`
   (or a tight "return only this panel" instruction) so the returns come back clean. These have no
   inter-dependencies, so a single `parallel([...])` barrier collecting all five is correct here.
   - Step 0 and Step 5 both touch the live setup; Step 0 owns the **only** live MCP probes (Step 5
     stays transcript-only) — keep that split in their prompts so they don't double-probe.
   - **Step 5's agent is read-only but its `fixes` get APPLIED by the orchestrator after Wave A**
     (like Step 3's KB edits): the agent returns `{panel, fixes}`, then the main thread writes the
     memories / `~/CLAUDE.md` rules / safe `settings.json` allows and pushes global config. This is
     Jack's standing auto-fix directive — recurring friction (and Jack's own corrections) get a
     durable fix every run, not just a recommendation.
4. **Barrier on the sync.** After Wave A's `parallel()` resolves, the script (or you, between the
   `Workflow` return and a second call) must ensure the **Slack sync has completed** before Triage.
   If you ran the sync as a bg Bash step, gate Triage on it: don't enter `phase('Triage')` until
   the sync process has exited. (With `skip-sync`, there's nothing to wait on — Triage can run in
   the same pass.)
5. **`phase('Triage')` — Step 4.** One `agent()` for Slack triage; its prompt is Step 4's body. It
   reads the index the sync just wrote, so it **must** come after the barrier.
6. **`phase('Shutdown')` — Step 6.** The **one writing step**. `/shutdown`'s logic removes
   worktrees, so it must **not** run inside a read-only research agent — run Step 6 as the
   **orchestrator** (a Bash/command step you drive), not as a workflow `agent()`. Sequence it after
   Wave A returned (so Step 0's worktree snapshot is captured). Skip it on `skip-shutdown`.
7. **`return`** the collected result blocks from the workflow so you (the orchestrator) have all of
   them in hand. Then **you** — not the workflow — apply any `DICTIONARY.md` edits Step 3 proposed
   (with the `Edit` tool, on the main thread) and assemble the **Morning Briefing** below. Print a
   one-line `✅ Step N done` as each result lands so Jack sees progress.

> **Why a workflow:** the steps are independent reads against different systems (git, GitHub,
> SWIRL, Slack, transcripts) — fanning them out in one `parallel()` keeps the morning routine fast
> and each agent's context focused, and the workflow gives Jack a live progress tree (`/workflows`).
> The sync→triage order is the **only** thing that must be serial; the barrier above enforces it.
> The two writes (the `DICTIONARY.md` touch-up and the Step 6 worktree shutdown) stay on the
> **orchestrator/main thread**, never inside a workflow agent.

### Step 0 — Setup health-check · Wave A agent

> **Workflow-agent contract.** This is one `agent()` in the workflow's `phase('Wave A')`
> `parallel()`. It returns the
> rendered `### 🩺 Setup health` panel (one ✅/⚠️ line per item, ⚠️ remedies inline) as its
> result — nothing else. It is **non-blocking and report-only** with ONE exception — check 8
> (Docker + local dev DB) may auto-start those if down (Jack opted in), bounded so it can't hang
> the routine. Otherwise: never restart, reinstall, prune a worktree, or stop the routine. The MCP
> probes below are the only ones that touch live servers (Step 5 deliberately does not), so they
> live here.

Confirm the hub's plumbing is intact and surface anything broken. Run every check, render a
`### 🩺 Setup health` panel with one ✅/⚠️ line per item (each ⚠️ gets a one-line remedy). It's
advisory: don't reinstall anything, don't remove any worktree — just report. The **one exception**
is check 8 (Docker + local dev DB), which Jack opted to let **auto-start** if down — every other
check stays report-only. Speed: batch the file/env/git checks into **one** Bash call, and fire the
MCP probes as parallel tool calls (a slow/erroring probe is a ⚠️, not something to wait on — keep
timeouts tight, ~5s).

Run these eight checks:

1. **MCP servers reachable (6).** These can only be probed from inside the session via the tools
   themselves (a shell can't see MCP state). Call one cheap read-only tool per server and mark ✅ if
   it returns, ⚠️ if it errors/times out:
   - `mcp__db__list_databases` (db)
   - `mcp__github__list_repos` (github)
   - `mcp__slack-search__get_slack_sync_status` (slack-search)
   - `mcp__jack-slack__slack_list_channels` (jack-slack)
   - `mcp__logs__get_log_stats` (logs)
   - `mcp__knowledge__search_knowledge { query: "ping", limit: 1 }` (knowledge)

   Report `✅ N/6 MCP servers reachable` (or list the down ones). ⚠️ remedy: "restart Claude Code /
   check that server's env in `~/.mcp.json`; `.ts` edits need a Claude Code restart."

2. **Default model pinned.** `grep '"model"' ~/.claude/settings.json` — expect `claude-opus-4-8[1m]`.
   ✅ if present and matches; ⚠️ if the pin is missing or changed (config-only — no API call). Report
   the value found. ⚠️ remedy: "re-add `\"model\": \"claude-opus-4-8[1m]\"` to `~/.claude/settings.json`."

3. **`SWIRL_GITHUB_TOKEN` set.** `[ -n "$SWIRL_GITHUB_TOKEN" ]`. Step 2 (tickets) depends on it. ✅ if
   set; ⚠️ remedy: "`export SWIRL_GITHUB_TOKEN=…` in `~/.zshrc` — Step 2 will SKIP without it."

4. **SSH tunnel / bastion reachable.** Reachability only — **do not run a DB query** (heavy live hit).
   Read `LIVE_SSH_HOST` / `LIVE_SSH_TUNNEL_PORT` from `~/Desktop/Projects/sw-cortex/.env` and probe
   with a short-timeout `nc -z -w5 "$LIVE_SSH_HOST" 22` (or `ssh -o BatchMode=yes -o ConnectTimeout=5`
   using `LIVE_SSH_KEY_PATH`/`LIVE_SSH_USER`, running just `true`). ✅ if reachable; ⚠️ remedy:
   "bastion unreachable — `laravel_live`/WishDesk DB queries will fail until it's back (check VPN/host)."

5. **Stale/dead worktrees (report-only).** `git -C "$SERP" worktree list` (SERP =
   `/Users/jackkief/Desktop/Projects/SERP`). Flag any worktree whose path no longer exists on disk
   (a `git worktree prune` candidate). **NEVER remove or prune anything** — and explicitly skip /
   never flag the protected ones: the locked `SERP/.claude/worktrees/wf_817b7ab1-a1b-*` set, the
   agent worktree, and the sibling `serp-hotfix-mo-grounding`. ✅ if clean; ⚠️ just lists the dead
   paths with remedy "stale worktree metadata — Jack can `git -C \$SERP worktree prune` if he wants
   (don't do it for him)."

6. **go-launcher extension installed.** VS Code installs it as `~/.vscode/extensions/jackkief.go-launcher-<version>`,
   NOT a bare `go-launcher` dir — test the glob: `compgen -G '/Users/jackkief/.vscode/extensions/jackkief.go-launcher-*' >/dev/null`
   (or `ls -d ~/.vscode/extensions/jackkief.go-launcher-* 2>/dev/null | grep -q .`). This is what makes
   `/go` actually open tabs. ✅ if any versioned dir is present; ⚠️ only if NONE match — remedy: "`/go`
   will silently queue requests that never open a tab — rebuild + install with
   `bash global-config/vscode-extensions/go-launcher/build-and-install.sh` and reload the VS Code window."

7. **go-queue dir exists.** `[ -d ~/.claude/go-queue ]` (the launcher `mkdir -p`s it, so this is
   informational). ✅ if present; ⚠️ is benign — "will be created on first `/go`."

8. **Docker + local dev DB up (auto-start if down).** SERP's local dev stack runs in Docker
   (Docker Desktop on this Mac — no Colima) via `SERP/docker-compose.yml`: the local MySQL is the
   **`serp-mysql`** container on host port **3307**, alongside `serp-redis` (6379), `serp-mailpit`,
   `serp-minio`. Unlike the other checks, this one is **allowed to start things** (Jack opted in) —
   but it must **never hang the routine**, and this Mac has **no `timeout`/`gtimeout` binary**, so do
   NOT wrap calls in `timeout`. Bound every step by Docker/compose's own flags + a bounded poll loop
   instead. Sequence:
   - **Docker daemon:** `docker info >/dev/null 2>&1`. If it fails, start Docker Desktop with
     `open -ga Docker`, then poll readiness in a **bounded** loop (no `timeout`): up to ~12 tries of
     `docker info >/dev/null 2>&1 && break` with `sleep 5` between — i.e. cap ~60s, then give up and
     ⚠️ rather than wait forever. (`open -g` keeps it in the background so it doesn't steal focus.)
   - **Local DB container:** once the daemon is up, check `serp-mysql`:
     `docker ps --filter name=^/serp-mysql$ --filter status=running --format '{{.Names}}'`. If absent,
     bring the stack up detached: `docker compose -f /Users/jackkief/Desktop/Projects/SERP/docker-compose.yml up -d`
     (compose returns once containers are created; it does not block on healthchecks). Then confirm
     port 3307 is listening: `nc -z -w5 127.0.0.1 3307`.
   - **Report:** ✅ `Docker + serp-mysql(:3307) up` if both were already running; `🔧 started Docker
/ serp-mysql` if this check booted them; ⚠️ with a remedy if either couldn't be brought up within
     the bound (e.g. "Docker daemon didn't come ready in ~60s — open Docker Desktop manually" or
     "`serp-mysql` failed to start — check `docker compose -f SERP/docker-compose.yml logs serp-mysql`").
     Keep the daemon-boot wait bounded so a stuck Docker can't stall the morning routine — on timeout,
     ⚠️ and move on. This is the ONLY Step 0 item permitted to start anything; everything else stays
     report-only.

**Return:** the rendered `### 🩺 Setup health` panel (the agent does not print `✅ Step 0
done` — the orchestrator does that when the result lands).

### Step 1 — Sync Slack · Wave A barrier (must finish before Step 4)

> **Orchestrator runs this — NOT a workflow agent.** `npm run slack:sync` is a shell command the
> workflow's agents can't run, so kick it off yourself with `Bash(run_in_background: true)` at the
> **start of Wave A** so it overlaps the workflow's Wave-A agents, then **block on it** before the
> `phase('Triage')` Step 4 begins. It is the single ordering barrier in the routine.

Unless `skip-sync` was passed, run the Slack sync and **wait for it to complete**:

```bash
cd ~/Desktop/Projects/sw-cortex && npm run slack:sync
```

This indexes new Slack messages into Qdrant. Step 4 reads that index, so it **must not start
until this returns**. If the sync errors, say so plainly, then call
`mcp__slack-search__get_slack_sync_status` and tell Jack how stale the index is, and ask whether
to continue triage against the stale index or stop. Do **not** silently skip ahead.

If `skip-sync`: note it, call `get_slack_sync_status`, and report the index's current freshness so
Jack knows what the triage in Step 4 is based on. (With `skip-sync` there's no sync to wait on, so
Step 4 may run alongside the rest of Wave A.)

**Also fast-forward the SERP main clone's `dev`** (belt-and-suspenders so it self-heals each
morning even if a PR was merged elsewhere — GitHub UI, another machine — without touching this
clone). Run this alongside the Slack sync; it's a fire-and-forget hub-side shell command, not a
workflow agent. **Fast-forward only — never rebase, never stash** (a dirty local seed snapshot must
not block it), and only when the clone is actually on `dev`:

```bash
SERP=/Users/jackkief/Desktop/Projects/SERP
if [ "$(git -C "$SERP" branch --show-current)" = "dev" ]; then
  git -C "$SERP" fetch origin dev --quiet && git -C "$SERP" merge --ff-only origin/dev
fi
```

If it's not on `dev` (mid-feature-branch), skip silently. If the fast-forward can't apply (local
`dev` diverged — not a clean FF), note it in one line and move on; don't force anything. This
mirrors the hub's own `pull --ff-only origin main` post-merge rule.

### Step 1b — Sync meeting notes from Drive · orchestrator (main thread, NOT a workflow agent)

> **Orchestrator runs this — NOT a workflow agent.** It fetches Jack's Gemini meeting-note Docs
> from Google Drive, which **requires the `mcp__claude_ai_Google_Drive__*` MCP tools**, and MCP
> tools only work on the main session thread — a workflow agent can't call them. It's the
> meeting-notes analogue of Step 1's Slack sync: fetch new source → index into the same Qdrant
> collection. It has **no ordering dependency on triage** (Step 4 triages Slack, not meetings), so
> run it alongside the Slack sync and let it finish whenever; it does not gate any later phase.

Unless `skip-sync` was passed, do a **Drive→file→index catch-up** of the meeting notes so they're
searchable via `/slack-search` alongside Slack. Follow the **`/sync-meetings` command's logic** —
read `~/.claude/commands/sync-meetings.md` and do exactly what it does (it is the single source of
truth for this):

1. List the Gemini meeting-note Docs in Drive (Docs whose title ends in **"Notes by Gemini"**) via
   `mcp__claude_ai_Google_Drive__search_files`.
2. Determine which are **new or edited** since the last sync (compare against the files already in
   `~/Desktop/Projects/sw-cortex/knowledge/meetings/` — skip Docs whose file exists and whose
   `modifiedTime` isn't newer). Default to the **incremental** path here — do NOT force a full
   `all` re-fetch in the morning routine.
3. For each Doc to sync, fetch its text (`mcp__claude_ai_Google_Drive__read_file_content`, piping
   large results to disk via `jq -r '.fileContent'`) and write it as
   `knowledge/meetings/YYYY-MM-DD-<slug>.md` (the filename convention `sync-meetings.md` specifies).
4. Run the file-based indexer: `cd ~/Desktop/Projects/sw-cortex && npm run meetings:sync -- --meetings-only`.

If `skip-sync` was passed, skip this too (it shares the flag with the Slack sync) and note it. If
the Drive MCP is unavailable/errors, note it in one line and continue the routine — don't block the
morning briefing on it. This step is **incremental and idempotent** (deterministic Qdrant point IDs
overwrite; a meeting is never stored twice), so it's safe to run every morning.

**Result:** a one-line `### 📝 Meeting notes` for the briefing — `synced N new/updated Docs → C
chunks` / `already current — nothing new` / `skipped (skip-sync)` / `Drive unavailable — skipped`.

### Step 2 — WishDesk tickets · Wave A agent

Show Jack his open WishWorks tickets. **Do not query the `wishdesk` MySQL DB for this** —
WW-#### tickets are `.md` files in the `jasonbkiefer/SWIRL` repo (`wishworks/dev-requests/active/`),
not a DB table. The authoritative path is the `/ww` mechanism.

Read `~/.claude/commands/ww.md` and follow its **"show my tickets"** flow (it self-updates from
SWIRL on each run and fetches tickets via `SWIRL_GITHUB_TOKEN`). Produce Jack's assigned/active
list, sorted by priority. If `SWIRL_GITHUB_TOKEN` is unset (the flow prints SKIP), say so and tell
Jack to `export SWIRL_GITHUB_TOKEN=...` in `~/.zshrc` — don't fall back to a DB guess.

Summarize: ticket id, title, priority/status, one-line "what's left." Keep it tight.

**Return:** the tight ticket list (one line per ticket) as the agent's result.

### Step 2b — Open PRs & deploy status (SERP) · Wave A agent

A quick read-only pass over SERP's repo state — what's awaiting Jack on the PR/deploy side. SERP is
the repo he owns and merges; this stays SERP-only. (Fold into the Step 2 agent if you prefer one
fewer agent — both are read-only SERP/SWIRL reads; keep their outputs distinct in the return.)

**Open PRs awaiting Jack.** List open `Jack-Kiefer/SERP` PRs that involve him — authored by, assigned
to, or review-requested of Jack. Use `mcp__github__list_pull_requests { repo: "SERP", state: "open" }`
(or `gh pr list --repo Jack-Kiefer/SERP --state open`). One line each: `#<num> · <title> · (yours,
<mergeable?> / review requested)`. If `gh`/the github MCP errors, note it and move on (don't block).

**Deploy status (light count only).** Show how far SERP's `dev` is ahead of `main` — the queue for
the next deploy — without running any gate:

```bash
SERP="/Users/jackkief/Desktop/Projects/SERP"
git -C "$SERP" fetch origin --prune --quiet
AHEAD=$(git -C "$SERP" rev-list --count origin/main..origin/dev)
BEHIND=$(git -C "$SERP" rev-list --count origin/dev..origin/main)
echo "AHEAD=$AHEAD BEHIND=$BEHIND"
```

Report `SERP: dev is <AHEAD> commits ahead of main → run /pending-deploy SERP to review + gate`. If
`BEHIND > 0`, flag drift (`main` has commits not on `dev` — hotfix not merged back?). **Do NOT run
lint/tests here** — the readiness gate is `/pending-deploy SERP`'s job; this is just the count + a
pointer to it. If `AHEAD = 0` and `BEHIND = 0`, say "in sync — nothing pending."

**Return:** the PR line(s) + the one-line deploy status.

### Step 2d — SERPY draft integrity (bom↔product↔sku mismatch) · Wave A agent

> **Workflow-agent contract.** One `agent()` in `phase('Wave A')`'s `parallel()`. **Fully
> read-only** (`mcp__db__*` SELECTs against `serp_app` + `odoo` only — never writes). Returns the
> rendered `### 🧯 SERPY draft integrity` panel and nothing else.

A silent-data-loss check born from a real incident (2026-07-15, draft #1444): SERPY staged a
manufacturing-order op whose identity fields **disagreed with each other** — `product_id`, the
`bom_id`, and the free-text SKU each pointed at a **different** product. Odoo builds an MO's
finished good from `product_id` but its **raw-component moves from `bom_id`**, so it made one
product while **consuming another product's raw material** — draining RM-21-074-A by 512 units.
The sync reported success, so nothing surfaced it for weeks; it only came out when the wrongly-
drained RM read low after a receipt. PR #485 added a **worker-side preflight** (`_assert_bom_matches_product`
in `workers/handlers/manufacturing.py`) that now BLOCKS this at sync time — but this Step is the
**detective control**: it re-scans what already shipped (older ops, and any op the guard couldn't
catch) so a hidden mismatch can't sit unnoticed.

**The check — a recent SERPY MO op is BAD when its `bom_id`'s finished product_template ≠ its
`product_id`'s product_template.** The op payloads live in `serp_app` (MySQL); the product/BOM
identity lives in `odoo` (Postgres) — so this is a two-query cross-DB join done in the agent, not
one SQL statement.

1. **Pull recent SERPY MO ops** from `serp_app` (last ~14 days is enough for a daily run; widen on
   demand). Query with `mcp__db__query_database { database: "serp_app", query: … }`:

   ```sql
   SELECT id AS queue_id, odoo_id AS mo_id, status, created_at,
     CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.bom_id'))     AS UNSIGNED) AS bom_id,
     CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.product_id')) AS UNSIGNED) AS product_id,
     JSON_UNQUOTE(JSON_EXTRACT(payload,'$.draft_id'))    AS draft_id,
     JSON_UNQUOTE(JSON_EXTRACT(payload,'$.description'))  AS descr
   FROM odoo_sync_queue_live
   WHERE entity_type='mrp_production' AND operation='create'
     AND status IN ('synced','partial')
     AND JSON_EXTRACT(payload,'$.bom_id') IS NOT NULL
     AND created_at >= (NOW() - INTERVAL 14 DAY)
   ORDER BY created_at DESC;
   ```

2. **Resolve every distinct `bom_id` and `product_id` to its `product_tmpl_id`** in one round-trip
   each against `odoo` (dedupe the id lists first — usually a few dozen):

   ```sql
   -- BOM → finished template
   SELECT id AS bom_id, product_tmpl_id FROM mrp_bom WHERE id IN (<distinct bom_ids>);
   -- product → template
   SELECT id AS product_id, product_tmpl_id FROM product_product WHERE id IN (<distinct product_ids>);
   ```

3. **Flag any op where `bom.product_tmpl_id != product.product_tmpl_id`.** That is the exact defect
   (the MO's BOM builds a different product than its finished-good id). **Compare at the
   product_TEMPLATE level, not the variant/product_id level** — two variants of one template can
   legitimately share a BOM, so a template match is NOT a mismatch (avoids false positives). If a
   `product_id` resolves to a template that has **no active BOM at all** (a raw-material or junk
   product staged as a finished good — also seen in the incident), flag it too, tagged `(product not
manufacturable)`.

4. **For each flag, name the real damage** so Jack can act: report `MO <mo_id> (draft #<draft_id>):
bom <bom_id> builds <bom_sku> but product_id <product_id> is <product_sku>`. If time permits,
   add the one line of actual over-consumption from
   `SELECT pt.default_code, sm.product_uom_qty FROM stock_move sm JOIN product_product pp ON pp.id=sm.product_id
 JOIN product_template pt ON pt.id=pp.product_tmpl_id WHERE sm.raw_material_production_id=<mo_id> AND sm.state='done'`
   (in `odoo`) — the wrongly-consumed RM is what actually needs reconciling.

5. **Also surface silently-STUCK ops** (the same draft that carried the mismatch, #1444, ALSO had an
   op that hard-**failed** and was never retried — `failed` rows are never auto-repicked, so a needed
   MO just never happened). In the same `serp_app` pull, add a second bucket: any `odoo_sync_queue_live`
   row (ANY `entity_type`, not just MO) with `status IN ('failed','dlq')` and
   `created_at >= NOW() - INTERVAL 14 DAY`. Report each as `stuck: <entity_type> "<descr>" (draft
#<id>) — <first line of error_message>`. This is a distinct signal from the mismatch (a mismatch
   reports success; a stuck op reports failure) — surface both, they hide in the same drafts.

**Bound it:** dedupe the id lists before the `IN (…)` (don't send thousands of ids), and cap the
window at 14 days for the daily run. If either DB errors or times out, note it in the panel and move
on — never block the briefing.

**Return:** the `### 🧯 SERPY draft integrity` panel with up to two sub-lines:

- **Mismatches** — if none, `✅ SERPY MO drafts (last 14d): all bom↔product↔sku consistent — no hidden
mismatches.` If any, a `🔴` header (`N mismatched MO op(s) — wrong RM likely consumed, needs
reconciling`) + one line per flagged MO (mo_id · draft · builds-vs-is · wrongly-consumed RM), and
  the pointer "reconcile in Odoo (unbuild the MO / inventory-adjust the RM); the sync-side guard (PR
  #485) blocks new ones."
- **Stuck ops** — if none, omit or `✅ no failed/dlq SERPY ops in 14d`. If any, `🔴 N stuck SERPY op(s)
never retried` + one line each (entity_type · draft · error), pointer "retry via `/api/admin/sync-queue`
  or re-stage — failed rows are never auto-repicked."

### Step 2c — Saved-for-later chats · Wave A agent

> **Workflow-agent contract.** One `agent()` in `phase('Wave A')`'s `parallel()`. It returns
> the rendered `### 🗂️ Saved for later` panel and nothing else. It is **read-mostly** with one
> bounded write: it may auto-close a save whose PR has already merged (same as the merge hook,
> just caught a day later) — never deletes a save, never touches anything else.

Surface the `/save-for-later` chats Jack parked so they don't get forgotten. List the active saves:

```bash
~/.claude/scripts/save-for-later.sh list active
```

Each line is TSV: `file<TAB>title<TAB>repo<TAB>branch<TAB>pr<TAB>updated<TAB>nextstep`. If there are
none, return "none parked — clean slate."

**Backstop the merge hook.** For each save that has a `pr` number, check whether that PR has merged
since it was parked (a merge done from the GitHub UI or by a teammate won't have fired the
PostToolUse hook). For SERP saves: `gh pr view <pr> --repo Jack-Kiefer/SERP --json state -q .state`
(SWAC: `--repo <swac-repo>`). If a PR shows `MERGED`, auto-close that save and note it:

```bash
~/.claude/scripts/save-for-later.sh close "<file>" "Auto-closed during /start-day: PR #<pr> merged."
```

(If `gh` errors, skip the check — don't block; just list the save as still active.)

**Return:** the `### 🗂️ Saved for later` panel — one line per remaining active save
(`title · repo · branch · age · next step`), plus a line for any auto-closed-this-run. If none,
the single "none parked" line.

### Step 3 — Light KB touch-up · Wave A agent

> **Workflow-agent contract.** This agent **does not edit `DICTIONARY.md` itself** — it
> **returns the proposed edits as text** (for each: the exact existing line to change or the
> section to add to, plus the new wording, and a one-line why). The **orchestrator** applies
> them with the Edit tool after the agent returns. This keeps all writes on the main
> thread, in one place, and matches Jack's "surface the diff, then apply" preference.

Unless `skip-kb` was passed, do a **lightweight, incremental** pass — NOT the full
`/refresh-knowledge` workflow (that's the weekly, multi-agent, token-heavy rebuild; do not run it
here). The goal is small: look at what happened / what was learned **in the past day** and update
or correct anything in `DICTIONARY.md` that's now out of date.

Scope it to the recent transcripts (default the last day; if `days=N` was passed, use that window):

1. Find which transcripts changed in the window (default 1 day):

   ```bash
   find ~/.claude/projects -maxdepth 2 -name '*.jsonl' -mtime -1
   ```

   (Top-level `*.jsonl` only — skip `subagents/` and `workflows/` subdirs, which have no human turns.)

2. Extract just Jack's typed messages from those files and skim for **new ground truth or
   corrections** — "no it's actually…", a renamed table/column/flag, a changed owner, a new gotcha,
   a date that's now wrong:

   ```bash
   python3 ~/.claude/scripts/knowledge-extract-user-msgs.py <those files>
   ```

3. For each candidate, check `DICTIONARY.md` (read it / `mcp__knowledge__search_knowledge`): is this
   already stated? If a fact **extends or corrects** an existing line, plan to edit that line in
   place. If it's genuinely new, plan to add it in the right section. **Never create a duplicate** —
   one extensive fact per topic (Jack's #1 KB rule). Skip anything task-specific or already documented.

4. **Return the proposed edits as text** (do NOT edit the file — the orchestrator applies them).
   For each: the exact existing line/section, the new wording, and a one-line why. The orchestrator
   then writes them to `~/Desktop/Projects/sw-cortex/DICTIONARY.md` with the Edit tool; the knowledge
   MCP re-indexes on the next search — no ingest step.

Keep it surgical: a handful of targeted edits, not a rewrite. If the window surfaced nothing
KB-worthy, return "nothing new to fold in." **Do not** stamp the `/refresh-knowledge`
watermark — that belongs to the weekly full run, and stamping it here would make the next
`/refresh-knowledge` skip everything before now.

**Return:** the proposed edits (or "nothing new to fold in").

> `DICTIONARY.md` is the canonical doc the knowledge MCP indexes. `~/CLAUDE.md` is a symlink to
> `global-config/CLAUDE.md`; its SugarWish ground-truth section mirrors `DICTIONARY.md`. Editing
> `DICTIONARY.md` is enough — don't also hand-edit `CLAUDE.md` unless Jack asks. If something big
> changed and a full reconcile is warranted, flag it and suggest Jack run `/refresh-knowledge`.

### Step 4 — Slack triage · `phase('Triage')` agent (needs Step 1 done first)

> **This agent runs in `phase('Triage')`, only after the Slack sync barrier clears** (or
> immediately, if `skip-sync`). It reads the index Step 1 wrote. Returns the "needs your
> attention" item list.

Find what Jack hasn't responded to and what needs attention from the **past day**.

Use `mcp__slack-search__search_slack_messages` (and `get_slack_context` / `get_slack_thread` to
expand the interesting hits) with `afterDate` = yesterday's date. Run several angled searches —
direct mentions of Jack, questions in his channels, threads he's in, anything addressed to him —
since semantic search won't surface everything from one query.

Focus the channels Jack actually owns/watches (from the knowledge base): `#serp-planning`,
`#serp-bugs-features`, `#serp-errors`, `#inventorymanagement`, `#ops-and-tech`, `#odoo-prixite`,
plus DMs. **Skip `#jack-test` entirely** — it is the automated SERPY darklaunch
drift/reconciliation feed (hourly `:rotating_light:` reports), not a to-do; never surface it.
**Down-rank known noise:** `#api-autofix` is informational (Seth's standing instruction —
no action needed), and most `:rotating_light:` alerts in `#api-warnings` / `#avalara-alert` /
`#live-product-warnings` / `#address-error` are routine auto-resolved noise. `#low-nps-scores` is a
reference channel, not a to-do.

For each item that genuinely needs Jack: who, which channel, the ask, and whether he's already
replied in-thread. **Surface only — do not post or reply to anything.** If Jack wants to respond,
he can use `/draft-slack`.

**Include a clickable Slack link for every item.** The search results carry `channelId` and
`timestamp` (and `threadTs` when it's a threaded message) — build a permalink from them so Jack can
jump straight to the message:

- Workspace base: `https://sugarwish.slack.com/archives`
- Message id = the `timestamp` with the dot removed, prefixed with `p` (e.g. `1781621889.662819`
  → `p1781621889662819`).
- Top-level / DM message: `https://sugarwish.slack.com/archives/<channelId>/p<ts-no-dot>`
- Threaded reply: `https://sugarwish.slack.com/archives/<channelId>/p<ts-no-dot>?thread_ts=<threadTs>&cid=<channelId>`
  (use the **reply's** own `timestamp` for the `p…` part, and the parent `threadTs` for the query
  string; if you only have the parent, link the parent's `threadTs` as the `p…` id).

Render each as a markdown link on the channel/person so the briefing line stays scannable, e.g.
`[#ops-management](https://sugarwish.slack.com/archives/G01.../p178...)`.

### Step 5 — Claude-setup diagnostic + auto-fix · Wave A agent (diagnoses) + orchestrator (applies)

> **Workflow-agent contract.** The Wave-A agent is **read-only**: it diagnoses **Jack's Claude Code
> setup** (not his SugarWish work) — where the tooling itself got in the way over the last few days —
> by reading transcripts only (no live MCP/DB probes — Step 0 owns the live snapshot). It does **not**
> edit anything itself; instead it returns BOTH the `### 🩺 Claude-setup friction` panel **and** a
> structured `fixes` list the **orchestrator** then auto-applies (same propose→apply split as Step 3's
> KB edits — all writes stay on the main thread). **Jack's standing directive (2026-06-24): the
> fixable friction should be auto-fixed every run, not just recommended — update the setup/config and
> the prompts/instructions so the friction stops happening.** So this step no longer merely surfaces
> text: the orchestrator MAKES the durable change.

Where Step 0 asks "is the plumbing up _right now_," this asks "what actually went _wrong_ over
the last few days, and how do we prevent it." They pair: a cluster here often has its live
confirmation in Step 0 (e.g. recurring go-launcher Accessibility denials ↔ Step 0's
go-launcher check).

1. **Mine the transcripts — BOTH tool-errors AND Jack's corrections.** Two signals, both load-bearing:

   **(a) Tool-error friction.** Run the extractor (stdlib-only, read-only) over the look-back window
   (default 3 days; if `days=N` was passed, use it):

   ```bash
   python3 ~/.claude/scripts/claude-setup-friction.py --days 3 --json
   ```

   It scans top-level `*.jsonl` across **all** repos' project dirs (the Claude setup is global,
   so this is intentionally not scoped to sw-cortex), buckets every `is_error` tool_result +
   API/overload `system` error, dedupes by signature, and tags each cluster `guardrail`
   (working-as-intended) vs fixable. Use `--json` for the structured form; drop it (optionally
   with `--top 0`) for a human read. The helper lives in `global-config/scripts/` and syncs to
   `~/.claude/scripts/`.

   **(b) Jack's own corrections — the strongest "did it wrong" signal.** A tool error is Claude
   tripping a guard; a _correction from Jack_ is Claude doing the wrong thing and Jack having to
   say so. **Treat every corrective message Jack typed as a clear directive: find what Claude did
   wrong and make a durable fix so it doesn't happen again.** Mine Jack's typed messages over the
   window and pull out the corrections — the tells: a message that leads with "no" / "nope", "stop",
   "don't", "you should have", "I told you", "why did you", "that's wrong", "not what I asked",
   "instead", "actually …", a repeated request after Claude gave a non-answer, or an explicit
   "from now on / always / never / each time" instruction. Use the same extractor that Step 3 uses:

   ```bash
   python3 ~/.claude/scripts/knowledge-extract-user-msgs.py $(find ~/.claude/projects -maxdepth 2 -name '*.jsonl' -mtime -3)
   ```

   For each correction, read enough of the surrounding turn to see **what Claude did** that prompted
   it, then classify the underlying mistake into the SAME three buckets as the tool-errors below and
   emit a `fix` (usually `kind: "note"` — a memory or `~/CLAUDE.md` rule; occasionally `kind:
"config"` when the correction was "change the setup," e.g. "always allow edits" → a settings
   change). A correction that _already_ matches an existing memory/rule but recurred = the rule isn't
   biting → propose the sharper wording. Corrections are **high-priority fixes** — weight them above
   tool-error volume, since they're Jack explicitly telling Claude to stop a behaviour.

2. **Diagnose the top clusters** (by count). For each meaningful one, classify it into ONE of three
   buckets, and emit a structured `fix` object (see Return) describing the durable change so the
   orchestrator can apply it:
   - **Broken setup → CONFIG fix (`kind: "config"`).** Missing module / env (`ModuleNotFoundError:
yaml`, externally-managed-environment), MCP server error/unreachable, MCP "outside allowed
     roots", macOS Accessibility / VS Code tab automation failing, DB pool/connection errors,
     repeated API overload (529), a recurring permission prompt for a safe read-only command. The
     fix is a **concrete, idempotent action**: the exact `pip install …`, the `settings.json`
     permission `allow` entry to add, the MCP `allowedRoots`/env change, "restart Claude Code after
     the `.ts` MCP edit," etc. Provide it as both a one-line human description AND, where it's a
     `settings.json` `permissions.allow` add, the exact string to insert (e.g. `Bash(rg:*)`).
   - **Recurring behaviour Claude should already get right → DURABLE NOTE fix (`kind: "note"`).**
     Claude keeps doing X and the tool/DB rejects it, but the right behaviour is a _rule_, not a
     config change: schema-guessing columns before `describe_table` (the ~45 "unknown column"
     cluster), malformed `mcp__github__search_code` grammar, `ls .claude/skills/<name>` from a
     worktree cwd, Playwright typing before a snapshot/ref, `python3 -c "import yaml"` against
     system Python. The fix is a **memory or `~/CLAUDE.md` line** that makes the rule stick. Give
     the proposed memory slug + body (or the exact `~/CLAUDE.md` working-style bullet) so the
     orchestrator can write/strengthen it. If a memory already exists but isn't biting, say so and
     propose the _sharper_ wording (the orchestrator updates the existing file, never duplicates).
   - **Correct guardrail Claude fought → DURABLE NOTE fix (`kind: "note"`), NOT a loosened guard.**
     `git stash` blocked, write/git denied in a read-only repo, a `sleep`/chained-shell block,
     "File has not been read yet," "user rejected the tool use." These denials are **working as
     intended** — the durable fix is a behavioural note (_"stop doing X / do Y instead"_), **never**
     "allow git stash" or "make that repo writable." Cross-check `DICTIONARY.md` / `~/CLAUDE.md` /
     existing memories: most already have a rule, so flag it as a recurring "Claude should already
     know this" and propose strengthening the existing note — never weaken the guard, never add a
     permission that defeats it.

   Lean on the KB: search `mcp__knowledge__search_knowledge` for the root cause before classifying
   (e.g. "`.ts` MCP edits need a Claude Code restart," "`mcp__python__run_python` is required over
   `./venv/bin/python`," "read-only repos are hook-enforced — hand off, don't retry"). The obvious
   fix is often already documented as the _wrong_ one.

3. **Skip the genuinely transient.** A one-off 529 or a single navigation race isn't a setup
   problem — only flag API-overload if it's a **repeated, high-count** cluster (then the fix is a
   `note`: smaller batches / retry posture, not a config change). Note in the panel how many
   low-signal clusters were rolled up so nothing is silently dropped — and do **not** emit a `fix`
   for a transient cluster.

**Return:** an object with two fields:

- `panel` — a `### 🩺 Claude-setup friction (last N days)` markdown panel: top 3–5 clusters, each
  `count · what · why · fix`, fixable separated from guardrail-hits, plus a one-line "💡 biggest
  single win." If nothing meaningful surfaced, `panel` = "setup ran clean — no recurring friction"
  and `fixes` = `[]`.
- `fixes` — a list of durable-change objects the orchestrator will APPLY, each:
  `{ kind: "config" | "note" | "repo", cluster: "<short name>", count: <n>,
action: "<one-line what to do>", target: "<settings.json | ~/CLAUDE.md | memory:<slug> | shell |
repo:SERP | repo:SWAC>", payload: "<the exact allow-string / memory body / CLAUDE.md bullet /
command to run — OR, for kind:repo, a clear task prompt describing the code change>",
rationale: "<why this stops the friction>" }`.
  Use `kind: "repo"` when the durable fix is a **code change inside a repo** (not a hub config/note) —
  e.g. a friction cluster whose real root cause is a bug or missing guard in SERP or SWAC source.
  Only include a `fix` for a cluster genuinely worth a durable change this run (skip transient and
  already-well-covered ones). Order by count desc.

> **Orchestrator applies the `fixes` (on the main thread, after the agent returns) — Jack's standing
> auto-fix directive.** For each fix, in this safe order, and report what was applied in the briefing:
>
> - `kind: "note"`, `target: memory:<slug>` → **write or update** the memory file under
>   `…/sw-cortex/memory/` (one fact per file, with frontmatter; if `<slug>` exists, sharpen it in
>   place — never duplicate) and add/refresh its one-line pointer in `MEMORY.md`.
> - `kind: "note"`, `target: ~/CLAUDE.md` → add/refine the working-style bullet in
>   `…/sw-cortex/global-config/CLAUDE.md` (the symlinked source; never hand-edit `~/CLAUDE.md`).
> - `kind: "config"`, `target: settings.json` → add the exact `permissions.allow` entry (or env/MCP
>   change) to `~/.claude/settings.json` **only if it's strictly additive and safe** (a read-only
>   command allowlist, a missing-module install). Use the `update-config` skill's conventions.
>   **NEVER** add a permission that loosens a guardrail Claude correctly fought (no `git stash`, no
>   making a read-only repo writable) — those are always `note`s, enforced by the bucket rules above.
> - `kind: "config"`, `target: shell` (e.g. `pip install …`) → run it if it's a safe, idempotent
>   install; otherwise surface it as a one-liner for Jack.
> - `kind: "repo"`, `target: repo:SERP` → **do NOT edit SERP inline from the hub.** Auto-`/launch`
>   a session to implement the fix: run `~/.claude/scripts/launch-repo-session.sh --keep-original
/Users/jackkief/Desktop/Projects/SERP "<payload task prompt>"` (fire-and-forget — it opens a real
>   SERP session in a new tab that researches→builds→PRs the change; don't block on it). **The
>   `--keep-original` flag is MANDATORY here:** this launch fires from the long-lived HUB tab, and
>   `launch-repo-session.sh` closes the originating tab BY DEFAULT — omitting the flag closes the
>   hub out from under Jack (it has, 3×). Any `launch-repo-session.sh` call made from the hub must
>   pass `--keep-original`; only `/go` (which runs from a disposable launched tab) omits it. Note in
>   the briefing that a SERP session was launched for it. _(Jack's directive 2026-06-24: "for serp
>   changes /launch something automatically to implement.")_
> - `kind: "repo"`, `target: repo:SWAC` → **make the change locally** — apply the SWAC code edit
>   directly on the main thread (SWAC is writable from the hub), or open a quick local edit; don't
>   `/launch` for it. _(Jack's directive 2026-06-24: "for wishdesk just make them locally.")_
>   After applying config/`~/CLAUDE.md`/MCP-template changes, **`bash scripts/sync-global-config.sh
push`** so `~/.claude` picks them up (and note in the briefing if a Claude Code restart is needed,
>   e.g. for `.ts` MCP or `mcp.json` changes). Memory files need no sync. If a fix is ambiguous or
>   would touch something risky, **don't apply it — list it under "needs Jack" in the panel** instead.

### Step 6 — Shut down not-in-use worktrees · orchestrator (the one destructive step)

> **Orchestrator runs this — NOT a workflow agent — and it is the ONLY step that writes.** It
> removes worktrees, so it must not run inside a read-only research agent. Run it **after Wave A has
> returned** (so Step 0's worktree snapshot is already captured for the briefing) — sequence
> doesn't otherwise matter; it touches only writable repos' worktrees, nothing the other steps read.

Unless `skip-shutdown` was passed, run the **`/shutdown`** command's full logic (read
`~/.claude/commands/shutdown.md` and follow it): sweep SERP + SWAC + sw-cortex and remove every
worktree that is **not in use**, leaving anything in use untouched. Do **not** reimplement the rules
here — `/shutdown` is the single source of truth for them. The load-bearing guarantees it enforces:

- **Keep if in use** — dirty working tree, commits not on its upstream, a live dev server, or a
  live claude session with its cwd inside it. Only fully-clean, idle worktrees are removed.
- **Hard-skip the protected set** — the locked `SERP/.claude/worktrees/wf_817b7ab1-a1b-*`, the
  `agent-*` worktree, and the sibling `serp-hotfix-mo-grounding` are **never** touched.
- **Non-interactive** — never ask; when in doubt, keep and report.

This is distinct from **Step 0's** worktree check, which stays list-and-flag-only (it flags _dead_
worktrees whose path is gone, and never removes anything). Step 6 is the one that actually acts —
and only on clean, idle worktrees.

**Result:** the same combined summary `/shutdown` produces (removed / kept-in-use / protected), which
the orchestrator folds into the briefing's `### 🧹 Worktrees` line.

### Step 7 — Weekly WishDesk local reseed · orchestrator (writes LOCAL db only) · ONCE A WEEK

> **Orchestrator runs this — NOT a workflow agent.** It refreshes Jack's **local** WishDesk DB
> (`sugarwish_wishdesk_new` on `127.0.0.1`) from the dev WishDesk DB so local dev work has current
> data. It writes ONLY the local DB (never dev/manage/live) and preserves `users`/`proposals` so
> login survives. It is the second writing step (after Step 6); everything else stays read-only.

**This runs at most once per week.** Gate on a stamp file so a daily `/start-day` doesn't reseed
every morning — reseed only if it hasn't run in the last 7 days (or `skip-reseed` was NOT passed):

```bash
STAMP="$HOME/.claude/.last-wishdesk-reseed"
if [ -f "$STAMP" ] && [ "$(find "$STAMP" -mtime -7 2>/dev/null)" ]; then
  echo "reseed: skipped (ran $(date -r "$STAMP" '+%a %b %d'))"   # within 7 days → skip
else
  echo "reseed: due (last ran $( [ -f "$STAMP" ] && date -r "$STAMP" '+%a %b %d' || echo 'never'))"
fi
```

If `skip-reseed` is in `$ARGUMENTS`, skip unconditionally and note it. If it's NOT due (ran <7 days
ago), skip and note when it last ran — do NOT reseed.

**If due:** run the **`/reseed-wishdesk-local`** command's full logic (read
`~/.claude/commands/reseed-wishdesk-local.md` and follow it) — it does a plaintext dev→local copy
(works on Node ≥23 where the repo's `npm run migration-seed` crashes on the TLS-to-IP issue),
replaces the data tables, skips the large `swcrm_*` CRM tables, and preserves local users. It is
**non-interactive here** (start-day is unattended): treat the once-a-week gate as the confirmation —
do not prompt. After a successful load, `touch "$STAMP"`.

**Result:** a one-line `### 🌱 Local reseed` for the briefing — `reseeded N tables from dev` /
`skipped (ran <date>)` / `skipped (skip-reseed)` / `failed: <reason>`.

---

## Morning Briefing (final output)

Once the workflow has returned every result block (and you've applied any Step 3 KB edits **and any
Step 5 auto-fixes**), stitch the results into one briefing in this **printed order** — keep it
scannable. In the friction section, report what was **applied** this run (memories written/sharpened,
`~/CLAUDE.md` rules added, `settings.json` allows added, SERP sessions `/launch`ed, SWAC edits made),
not just what was recommended — and list anything deferred under "needs Jack":

```
## ☀️ Morning Briefing — <today's date>

### 🩺 Setup health
- <one-line summary, e.g. "6/6 MCP · bastion · token · queue all ✅"; list any ⚠️ with its remedy>

### 🩺 Claude-setup friction (last <N> days)
- ✅ APPLIED: <count>× <cluster> — <durable fix made> (memory/CLAUDE.md/settings/launched-SERP/SWAC-edit)
- ✅ APPLIED: <correction Jack made> — <rule written so it won't recur>
- <GUARDRAIL> <count>× <cluster> — <behavioural note strengthened>  (or "setup ran clean")
- ⏭️ needs Jack: <any fix too risky/ambiguous to auto-apply, surfaced not applied>
- 💡 biggest single win: <one concrete change>

### 🎫 WishDesk — what's left
- WW-### · <title> · <priority> — <what's left>
- ...

### 🚀 Deploy & PRs (SERP)
- dev is <N> commits ahead of main → `/pending-deploy SERP` to review + gate  (or "in sync")
- #<num> · <title> · (yours / review requested)   — open PRs awaiting you, or "no open PRs"

### 🧯 SERPY draft integrity
- ✅ SERPY MO drafts (last 14d): all bom↔product↔sku consistent  (or "🔴 <N> mismatched MO op(s):")
- 🔴 MO <mo_id> (draft #<id>): bom builds <sku_a> but product is <sku_b> — wrongly consumed <RM ×qty>; reconcile in Odoo

### 🗂️ Saved for later
- <title> · <repo> · `<branch>` · <age> — next: <one-line next step>   (`/resume-later` to pick up)
- ... (or "none parked — clean slate"; note any auto-closed this run: "✅ closed <title> — PR merged")

### 📚 Knowledge base (living doc)
- <N facts updated / M added in DICTIONARY.md, or "nothing new to fold in">

### 📝 Meeting notes
- <synced N new/updated Docs → C chunks, or "already current — nothing new" / "skipped (skip-sync)" / "Drive unavailable — skipped">

### 🧹 Worktrees
- <N removed (clean+idle), M kept in use (dirty/unpushed/live), K protected skipped — or "none to clean">

### 💬 Needs your attention (Slack, past day)
- [#channel](<slack-permalink>) · <person>: <the ask>  (you haven't replied)
- ...

### 🔕 Skipped as noise
- <one line: e.g. "12 routine alerts in #api-warnings, #avalara-alert">
```

End by asking which item Jack wants to start with. Set the tab to `🙋 await · start-day`
before ending the turn.

## Notes

- **It runs as ONE Workflow at ultracode, with one barrier.** Per the standing directive at the
  top, author and run a single `Workflow` script (don't fall back to inline Task subagents).
  `phase('Wave A')` fans out Step 0, 2, 2b, 2c, 3, 5 in a single `parallel()` while the Slack sync runs
  in the background; the sync→triage order is the **only** serial dependency — `phase('Triage')`
  (Step 4) waits on the sync barrier; then `phase('Shutdown')` (Step 6). The **orchestrator owns
  the tab, the `DICTIONARY.md` writes, the Step 6 worktree shutdown, and the final briefing**; the
  workflow's agents only read + return their block.
- **Printed order is load-bearing for reading, not execution.** The phases execute in parallel
  within Wave A (plus Step 6 after Wave A), but assemble the briefing top-to-bottom: health →
  setup-friction → tickets → deploy/PRs → saved-for-later → KB → meeting-notes → worktrees →
  triage, so Jack scans it in a stable order.
- **Step 0 is non-blocking and report-only, with one opted-in exception.** It surfaces broken
  plumbing (MCP down, missing go-launcher extension, bastion unreachable, etc.) but never restarts,
  reinstalls, prunes a worktree, or stops the routine — **except check 8 (Docker + local dev DB),
  which Jack opted to let auto-start if down** (bounded poll, no `timeout` binary on this Mac, ⚠️ and
  move on if it can't come up). The worktree check in particular stays list-and-flag only, and
  never touches the protected/locked worktrees. It owns the **only live MCP probes** — Step 5
  stays transcript-only so the two don't double-probe.
- **Step 1b (meeting-notes sync) is an orchestrator step, like Step 1.** It fetches the Gemini
  "… - Notes by Gemini" Docs from Google Drive via the `mcp__claude_ai_Google_Drive__*` MCP tools —
  which only work on the main thread, so it can't be a workflow agent — writes any new/edited ones
  to `knowledge/meetings/`, then runs the file-based indexer (`npm run meetings:sync`) which
  chunks/embeds/encrypts/upserts into the same `slack_messages_encrypted` collection `/slack-search`
  already searches. It shares the `skip-sync` flag with Step 1, is incremental + idempotent
  (deterministic point IDs never double-store a meeting), and **nothing waits on it** (triage reads
  Slack, not meetings). Full logic lives in `/sync-meetings` (`~/.claude/commands/sync-meetings.md`).
- **Step 2b (deploy/PRs) stays SERP-only and gate-free** — it's a light dev→main count plus a pointer
  to `/pending-deploy SERP`, which owns the real lint+test readiness gate. Don't run tests here.
- **`DICTIONARY.md` is a living document.** Step 3 keeps it current with small daily edits —
  fold in / correct yesterday's learnings, never duplicate. The Step 3 agent **proposes**; the
  orchestrator applies. The heavy reconcile stays with the weekly `/refresh-knowledge`; the daily
  pass deliberately does **not** touch its watermark, so the two never collide.
- **Step 5 (Claude-setup diagnostic + AUTO-FIX) is about the tooling, not the work.** It mines
  transcripts TWO ways: (a) tool-error friction via `claude-setup-friction.py` (read-only,
  stdlib-only — deliberately no third-party imports, since a missing module is one of the failures
  it diagnoses), and (b) **Jack's own corrections** (messages where Jack told Claude it did
  something wrong — "no…", "stop…", "from now on…") via `knowledge-extract-user-msgs.py`, which are
  the highest-priority signal. It **distinguishes broken setup (config fix) from recurring
  behaviour + guardrails Claude fought (a durable note/rule, never loosen the guard)**. **Per
  Jack's standing directive (2026-06-24), the fixable friction is AUTO-APPLIED every run, not just
  recommended:** the Wave-A agent stays read-only and returns `{panel, fixes}`; the **orchestrator**
  then applies each fix on the main thread — write/sharpen a memory, add a `~/CLAUDE.md` rule, add a
  safe additive `settings.json` allow (NEVER one that loosens a guard Claude correctly fought), or
  for a **repo code fix route by repo: SERP → auto-`/launch` a session to implement it; SWAC →
  edit locally** — then `sync-global-config.sh push`. Anything risky/ambiguous is surfaced under
  "needs Jack," not applied. It still never weakens a guardrail.
- **Step 6 (worktree shutdown) is the one destructive step** — it removes clean, idle worktrees
  via `/shutdown` (orchestrator-run, never a workflow agent). It only ever touches writable repos'
  worktrees, keeps anything in use, and hard-skips the protected/locked set. Skip it with
  `skip-shutdown`. This is separate from Step 0's worktree check, which stays flag-only.
- **Otherwise read-only and advisory.** Beyond the `DICTIONARY.md` touch-up and the Step 6 worktree
  shutdown, this command never posts to Slack, never writes to a production DB, never archives a
  ticket, and never applies a setup/config change. It surfaces and recommends; Jack acts.
- This command lives in `global-config/commands/` and its helper in `global-config/scripts/`
  (`claude-setup-friction.py`). After editing either, sync with
  `bash scripts/sync-global-config.sh push` so `~/.claude/commands/start-day.md` **and**
  `~/.claude/scripts/claude-setup-friction.py` are updated.
