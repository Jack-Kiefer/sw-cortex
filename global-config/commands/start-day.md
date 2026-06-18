# Command: start-day

Jack's morning kickoff. Orchestrates the start-of-day routine as a **team of parallel
subagents** and ends with a single triage briefing: what needs Jack's attention today.

The steps are **independent and run concurrently** — with **one** load-bearing ordering
constraint: Slack triage (Step 4) reads the index that the Slack sync (Step 1) writes, so
**triage must not start until sync has finished**. Everything else fans out in parallel.

```
/start-day               # full routine: sync ‖ tickets ‖ PRs ‖ KB ‖ diagnostic → triage
/start-day skip-sync     # skip the Slack sync (use the existing index as-is)
/start-day skip-kb       # skip the knowledge-base touch-up step (Step 3)
/start-day skip-diagnostic   # skip the Claude-setup diagnostic step (Step 5)
/start-day skip-shutdown # skip the worktree shutdown step (Step 6 — leave all worktrees)
/start-day days=7        # widen the diagnostic / KB look-back window (default 3 days)
```

`$ARGUMENTS` may contain `skip-sync`, `skip-kb`, `skip-diagnostic`, `skip-shutdown`, and/or `days=N`.
Anything else is ignored.

---

## What you (Claude) must do

You are the **orchestrator**. Set the tab title at the start:
`~/.claude/scripts/set-tab-title.sh "🔨 starting · start-day"` — and **only you** (the main
thread) touch the tab; subagents must never call `set-tab-title.sh`. The global hooks
re-stamp it, so update it only at real transitions.

Run the routine in **two waves**:

- **Wave A (parallel):** kick off the **Slack sync** (Step 1) so it runs in the background,
  and in the **same message** spawn one subagent each for **Step 0** (health-check),
  **Step 2** (tickets), **Step 2b** (PRs/deploy), **Step 3** (KB touch-up), and **Step 5**
  (Claude-setup diagnostic). Use the **Task tool** with `subagent_type: general-purpose`
  (use `Explore` for the read-only research steps if you prefer). Each subagent gets the
  step body below as its task prompt and returns the **compact result block** that step
  specifies — nothing more. Spawn them in one batch so they run at once.
- **Barrier:** wait for the Slack sync to finish (and collect every subagent's return).
- **Wave B:** only now spawn the **Step 4** (Slack triage) subagent — it depends on the
  freshly-written index.

When every subagent has returned, **you** (not a subagent) assemble the **Morning Briefing**
(below) and apply any `DICTIONARY.md` edits Step 3 proposed. Print a one-line `✅ Step N done`
as each result lands so Jack sees progress.

> **Why subagents:** the steps are independent reads against different systems (git, GitHub,
> SWIRL, Slack, transcripts) — running them concurrently keeps the morning routine fast and
> each agent's context focused. The sync→triage order is the **only** thing that must be
> serial; the two-wave structure above is what enforces it.

### Step 0 — Setup health-check · Wave A subagent

> **Subagent contract.** Spawn this as one Task-tool subagent in Wave A. It returns the
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

6. **go-launcher extension installed.** `[ -d ~/.vscode/extensions/go-launcher ]`. This is what makes
   `/go` actually open tabs. ✅ if present; ⚠️ remedy: "`/go` will silently queue requests that never
   open a tab — reinstall the Go Launcher extension and reload the VS Code window."

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

**Return:** the rendered `### 🩺 Setup health` panel (the subagent does not print `✅ Step 0
done` — the orchestrator does that when the result lands).

### Step 1 — Sync Slack · Wave A barrier (must finish before Step 4)

> **Orchestrator runs this — not a subagent.** Kick the sync off at the **start of Wave A**
> (e.g. `run_in_background`) so it overlaps the Wave-A subagents, then **block on it** before
> spawning Step 4. It is the single ordering barrier in the routine.

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
Step 4 may spawn alongside the rest of Wave A.)

### Step 2 — WishDesk tickets · Wave A subagent

Show Jack his open WishWorks tickets. **Do not query the `wishdesk` MySQL DB for this** —
WW-#### tickets are `.md` files in the `jasonbkiefer/SWIRL` repo (`wishworks/dev-requests/active/`),
not a DB table. The authoritative path is the `/ww` mechanism.

Read `~/.claude/commands/ww.md` and follow its **"show my tickets"** flow (it self-updates from
SWIRL on each run and fetches tickets via `SWIRL_GITHUB_TOKEN`). Produce Jack's assigned/active
list, sorted by priority. If `SWIRL_GITHUB_TOKEN` is unset (the flow prints SKIP), say so and tell
Jack to `export SWIRL_GITHUB_TOKEN=...` in `~/.zshrc` — don't fall back to a DB guess.

Summarize: ticket id, title, priority/status, one-line "what's left." Keep it tight.

**Return:** the tight ticket list (one line per ticket) as the subagent's result.

### Step 2b — Open PRs & deploy status (SERP) · Wave A subagent

A quick read-only pass over SERP's repo state — what's awaiting Jack on the PR/deploy side. SERP is
the repo he owns and merges; this stays SERP-only. (Fold into the Step 2 subagent if you prefer one
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

### Step 3 — Light KB touch-up · Wave A subagent

> **Subagent contract.** This subagent **does not edit `DICTIONARY.md` itself** — it
> **returns the proposed edits as text** (for each: the exact existing line to change or the
> section to add to, plus the new wording, and a one-line why). The **orchestrator** applies
> them with the Edit tool after the subagent returns. This keeps all writes on the main
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

### Step 4 — Slack triage · Wave B subagent (needs Step 1 done first)

> **Spawn this only after the Slack sync barrier clears** (or immediately, if `skip-sync`).
> It reads the index Step 1 wrote. Returns the "needs your attention" item list.

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

### Step 5 — Claude-setup diagnostic · Wave A subagent

> **Subagent contract.** Read-only. This step diagnoses **Jack's Claude Code setup**, not his
> SugarWish work: where the tooling itself got in the way over the last few days, and what to
> change so it stops. It **only reads transcripts** (no live MCP/DB probes — Step 0 owns the
> live snapshot) and **proposes** config/behaviour fixes as text; it never edits
> `settings.json`, `~/CLAUDE.md`, `.env`, or any config itself. Returns the
> `### 🩺 Claude-setup friction` panel.

Where Step 0 asks "is the plumbing up _right now_," this asks "what actually went _wrong_ over
the last few days, and how do we prevent it." They pair: a cluster here often has its live
confirmation in Step 0 (e.g. recurring go-launcher Accessibility denials ↔ Step 0's
go-launcher check).

1. **Mine the transcripts.** Run the extractor (stdlib-only, read-only) over the look-back
   window (default 3 days; if `days=N` was passed, use it):

   ```bash
   python3 ~/.claude/scripts/claude-setup-friction.py --days 3 --json
   ```

   It scans top-level `*.jsonl` across **all** repos' project dirs (the Claude setup is global,
   so this is intentionally not scoped to sw-cortex), buckets every `is_error` tool_result +
   API/overload `system` error, dedupes by signature, and tags each cluster `guardrail`
   (working-as-intended) vs fixable. Use `--json` for the structured form; drop it (optionally
   with `--top 0`) for a human read. The helper lives in `global-config/scripts/` and syncs to
   `~/.claude/scripts/`.

2. **Diagnose the top clusters** (by count). For each meaningful one, classify it:
   - **Broken setup → fix it.** Missing module / env (`ModuleNotFoundError: yaml`,
     externally-managed-environment), MCP server error/unreachable, MCP "outside allowed roots",
     macOS Accessibility / VS Code tab automation failing, DB pool/connection errors, repeated
     API overload (529). These get a **concrete fix**: the exact `pip install …`, the
     `settings.json` permission `allow` rule, the MCP `allowedRoots`/env change to add, the OS
     permission to grant, or "restart Claude Code after the `.ts` MCP edit." Surface the change
     as text — **do not apply it.**
   - **Correct guardrail Claude fought → behavioural note, NOT a loosened guard.** `git stash`
     blocked, write/git denied in a read-only repo, a `sleep`/chained-shell block, "File has not
     been read yet," "user rejected the tool use." These denials are **working as intended** —
     the recommendation is _"stop doing X / do Y instead"_ (a one-line note for `~/CLAUDE.md` or
     a memory), **never** "allow git stash" or "make that repo writable." Cross-check
     `DICTIONARY.md` / `~/CLAUDE.md`: many of these already have a documented rule, so the fix
     is "Claude should already know this" — flag the recurring ones.

   Lean on the KB: search `mcp__knowledge__search_knowledge` for the root cause before
   recommending (e.g. "`.ts` MCP edits need a Claude Code restart," "`mcp__python__run_python`
   is required over `./venv/bin/python`," "read-only repos are hook-enforced — hand off, don't
   retry"). The obvious fix is often already documented as the _wrong_ one.

3. **Skip the genuinely transient.** A one-off 529 or a single navigation race isn't a setup
   problem — only flag API-overload if it's a **repeated, high-count** cluster (then the fix is
   behavioural: smaller batches / retry posture, not a config change). Note in the panel how
   many low-signal clusters were rolled up so nothing is silently dropped.

**Return:** a `### 🩺 Claude-setup friction (last N days)` panel — top 3–5 clusters, each as
`count · what · why · fix`, with fixable items separated from guardrail-hits, plus a one-line
"biggest single win" Jack can act on today. If nothing meaningful surfaced, return "setup ran
clean — no recurring friction."

### Step 6 — Shut down not-in-use worktrees · orchestrator (the one destructive step)

> **Orchestrator runs this — not a subagent — and it is the ONLY step that writes.** It removes
> worktrees, so it must not run inside a read-only research agent. Run it **after Wave A has
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

---

## Morning Briefing (final output)

Once every subagent has returned (and you've applied any Step 3 edits), stitch the results into
one briefing in this **printed order** — keep it scannable:

```
## ☀️ Morning Briefing — <today's date>

### 🩺 Setup health
- <one-line summary, e.g. "6/6 MCP · bastion · token · queue all ✅"; list any ⚠️ with its remedy>

### 🩺 Claude-setup friction (last <N> days)
- <FIX> <count>× <cluster> — <fix> ; <FIX> <count>× <cluster> — <fix>
- <GUARDRAIL> <count>× <cluster> — <behavioural note>  (or "setup ran clean")
- 💡 biggest single win: <one concrete change>

### 🎫 WishDesk — what's left
- WW-### · <title> · <priority> — <what's left>
- ...

### 🚀 Deploy & PRs (SERP)
- dev is <N> commits ahead of main → `/pending-deploy SERP` to review + gate  (or "in sync")
- #<num> · <title> · (yours / review requested)   — open PRs awaiting you, or "no open PRs"

### 📚 Knowledge base (living doc)
- <N facts updated / M added in DICTIONARY.md, or "nothing new to fold in">

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

- **It's an agent team, with one barrier.** Wave A (Step 0, 2, 2b, 3, 5 + the background Slack
  sync) fans out as parallel subagents; the sync→triage order is the **only** thing that's
  serial — Step 4 waits for the sync. Spawn the Wave-A agents in a single message so they run
  concurrently. The **orchestrator owns the tab, the `DICTIONARY.md` writes, and the final
  briefing**; subagents only read + return their block.
- **Printed order is load-bearing for reading, not execution.** The steps execute in parallel
  (plus Step 6 after Wave A), but assemble the briefing top-to-bottom: health → setup-friction →
  tickets → deploy/PRs → KB → worktrees → triage, so Jack scans it in a stable order.
- **Step 0 is non-blocking and report-only, with one opted-in exception.** It surfaces broken
  plumbing (MCP down, missing go-launcher extension, bastion unreachable, etc.) but never restarts,
  reinstalls, prunes a worktree, or stops the routine — **except check 8 (Docker + local dev DB),
  which Jack opted to let auto-start if down** (bounded poll, no `timeout` binary on this Mac, ⚠️ and
  move on if it can't come up). The worktree check in particular stays list-and-flag only, and
  never touches the protected/locked worktrees. It owns the **only live MCP probes** — Step 5
  stays transcript-only so the two don't double-probe.
- **Step 2b (deploy/PRs) stays SERP-only and gate-free** — it's a light dev→main count plus a pointer
  to `/pending-deploy SERP`, which owns the real lint+test readiness gate. Don't run tests here.
- **`DICTIONARY.md` is a living document.** Step 3 keeps it current with small daily edits —
  fold in / correct yesterday's learnings, never duplicate. The Step 3 subagent **proposes**; the
  orchestrator applies. The heavy reconcile stays with the weekly `/refresh-knowledge`; the daily
  pass deliberately does **not** touch its watermark, so the two never collide.
- **Step 5 (Claude-setup diagnostic) is about the tooling, not the work.** It mines transcripts
  via `claude-setup-friction.py` (read-only, stdlib-only — deliberately no third-party imports,
  since a missing module is one of the failures it diagnoses), and it **distinguishes broken
  setup (fix the config) from correct guardrails Claude fought (a behavioural note, never loosen
  the guard)**. It surfaces fixes as text — it never edits `settings.json`, `~/CLAUDE.md`,
  `.env`, or any config itself.
- **Step 6 (worktree shutdown) is the one destructive step** — it removes clean, idle worktrees
  via `/shutdown` (orchestrator-run, never a subagent). It only ever touches writable repos'
  worktrees, keeps anything in use, and hard-skips the protected/locked set. Skip it with
  `skip-shutdown`. This is separate from Step 0's worktree check, which stays flag-only.
- **Otherwise read-only and advisory.** Beyond the `DICTIONARY.md` touch-up and the Step 6 worktree
  shutdown, this command never posts to Slack, never writes to a production DB, never archives a
  ticket, and never applies a setup/config change. It surfaces and recommends; Jack acts.
- This command lives in `global-config/commands/` and its helper in `global-config/scripts/`
  (`claude-setup-friction.py`). After editing either, sync with
  `bash scripts/sync-global-config.sh push` so `~/.claude/commands/start-day.md` **and**
  `~/.claude/scripts/claude-setup-friction.py` are updated.
