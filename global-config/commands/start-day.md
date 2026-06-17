# Command: start-day

Jack's morning kickoff. Runs the start-of-day routine in **strict order** and ends with a
single triage briefing: what needs Jack's attention today.

Four steps, run **in this exact sequence** — step 4 (Slack triage) is **wrong** if step 1
(sync) hasn't finished, so do not parallelize 1 and 4.

```
/start-day            # full routine: sync → tickets → knowledge → triage
/start-day skip-sync  # skip the Slack sync (use the existing index as-is)
/start-day skip-kb    # skip the knowledge-base refresh step
```

`$ARGUMENTS` may contain `skip-sync` and/or `skip-kb`. Anything else is ignored.

---

## What you (Claude) must do

Set the tab title at the start: `~/.claude/scripts/set-tab-title.sh "🔨 starting · start-day"`.
Update it as you move between steps. First run **Step 0** (the setup health-check), then the four
numbered steps **in order**. After each step, print a one-line `✅ Step N done` so Jack can see
progress. End with the **Morning Briefing** (below).

### Step 0 — Setup health-check (NON-BLOCKING — always continue to Step 1)

Before the routine proper, confirm the hub's plumbing is intact and surface anything broken. This
step **never blocks** — run every check, render a `### 🩺 Setup health` panel with one ✅/⚠️ line
per item (each ⚠️ gets a one-line remedy), then proceed to Step 1 regardless of results. It's
purely advisory: don't restart anything, don't reinstall anything, don't remove any worktree — just
report. Speed: batch the file/env/git checks into **one** Bash call, and fire the MCP probes as
parallel tool calls (a slow/erroring probe is a ⚠️, not something to wait on — keep timeouts tight,
~5s).

Run these seven checks:

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

Render the panel, print `✅ Step 0 done`, and continue to Step 1 even if items are ⚠️.

### Step 1 — Sync Slack (BLOCKING — must finish before Step 4)

Unless `skip-sync` was passed, run the Slack sync and **wait for it to complete**:

```bash
cd ~/Desktop/Projects/sw-cortex && npm run slack:sync
```

This indexes new Slack messages into Qdrant. Step 4 reads that index, so it **must not start
until this returns**. If the sync errors, say so plainly, then call
`mcp__slack-search__get_slack_sync_status` and tell Jack how stale the index is, and ask whether
to continue triage against the stale index or stop. Do **not** silently skip ahead.

If `skip-sync`: note it, call `get_slack_sync_status`, and report the index's current freshness so
Jack knows what the triage in Step 4 is based on.

### Step 2 — WishDesk tickets (what's left to do)

Show Jack his open WishWorks tickets. **Do not query the `wishdesk` MySQL DB for this** —
WW-#### tickets are `.md` files in the `jasonbkiefer/SWIRL` repo (`wishworks/dev-requests/active/`),
not a DB table. The authoritative path is the `/ww` mechanism.

Read `~/.claude/commands/ww.md` and follow its **"show my tickets"** flow (it self-updates from
SWIRL on each run and fetches tickets via `SWIRL_GITHUB_TOKEN`). Produce Jack's assigned/active
list, sorted by priority. If `SWIRL_GITHUB_TOKEN` is unset (the flow prints SKIP), say so and tell
Jack to `export SWIRL_GITHUB_TOKEN=...` in `~/.zshrc` — don't fall back to a DB guess.

Summarize: ticket id, title, priority/status, one-line "what's left." Keep it tight.

### Step 2b — Open PRs & deploy status (SERP)

A quick read-only pass over SERP's repo state — what's awaiting Jack on the PR/deploy side. SERP is
the repo he owns and merges; this stays SERP-only.

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

Print `✅ Step 2b done`.

### Step 3 — Light KB touch-up (just yesterday's learnings)

Unless `skip-kb` was passed, do a **lightweight, incremental** pass — NOT the full
`/refresh-knowledge` workflow (that's the weekly, multi-agent, token-heavy rebuild; do not run it
here). The goal is small: look at what happened / what was learned **in the past day** and update
or correct anything in `DICTIONARY.md` that's now out of date.

Scope it to yesterday's transcripts only:

1. Find which transcripts changed in the last day:

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
   already stated? If a fact **extends or corrects** an existing line, edit that line in place. If
   it's genuinely new, add it in the right section. **Never create a duplicate** — one extensive
   fact per topic (Jack's #1 KB rule). Skip anything task-specific or already documented.

4. Write the edits straight to `~/Desktop/Projects/sw-cortex/DICTIONARY.md` (Edit tool). The
   knowledge MCP re-indexes it on the next search — no ingest step.

Keep it surgical: a handful of targeted edits, not a rewrite. If yesterday surfaced nothing
KB-worthy, say "nothing new to fold in" and move on. **Do not** stamp the `/refresh-knowledge`
watermark — that belongs to the weekly full run, and stamping it here would make the next
`/refresh-knowledge` skip everything before now.

> `DICTIONARY.md` is the canonical doc the knowledge MCP indexes. `~/CLAUDE.md` is a symlink to
> `global-config/CLAUDE.md`; its SugarWish ground-truth section mirrors `DICTIONARY.md`. Editing
> `DICTIONARY.md` is enough — don't also hand-edit `CLAUDE.md` unless Jack asks. If something big
> changed and a full reconcile is warranted, flag it and suggest Jack run `/refresh-knowledge`.

### Step 4 — Slack triage (needs Step 1 done first)

**Only after Step 1 has completed.** Find what Jack hasn't responded to and what needs attention
from the **past day**.

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

---

## Morning Briefing (final output)

Pull the three substantive steps into one briefing. Keep it scannable:

```
## ☀️ Morning Briefing — <today's date>

### 🩺 Setup health
- <one-line summary, e.g. "6/6 MCP · bastion · token · queue all ✅"; list any ⚠️ with its remedy>

### 🎫 WishDesk — what's left
- WW-### · <title> · <priority> — <what's left>
- ...

### 🚀 Deploy & PRs (SERP)
- dev is <N> commits ahead of main → `/pending-deploy SERP` to review + gate  (or "in sync")
- #<num> · <title> · (yours / review requested)   — open PRs awaiting you, or "no open PRs"

### 📚 Knowledge base (living doc)
- <N facts updated / M added in DICTIONARY.md, or "nothing new to fold in">

### 💬 Needs your attention (Slack, past day)
- [#channel](<slack-permalink>) · <person>: <the ask>  (you haven't replied)
- ...

### 🔕 Skipped as noise
- <one line: e.g. "12 routine alerts in #api-warnings, #avalara-alert">
```

End by asking which item Jack wants to start with. Set the tab to `🙋 await · start-day`
before ending the turn.

## Notes

- **Step 0 is non-blocking and report-only.** It surfaces broken plumbing (MCP down, missing
  go-launcher extension, bastion unreachable, etc.) but never restarts, reinstalls, prunes a
  worktree, or stops the routine — always continue to Step 1. The worktree check in particular is
  list-and-flag only, and never touches the protected/locked worktrees.
- **Order is load-bearing:** sync (1) before triage (4). Step 0, Step 2/2b, and Step 3 can run
  anytime, but keep the printed order so Jack reads health → tickets → deploy/PRs → KB → triage
  top-to-bottom.
- **Step 2b (deploy/PRs) stays SERP-only and gate-free** — it's a light dev→main count plus a pointer
  to `/pending-deploy SERP`, which owns the real lint+test readiness gate. Don't run tests here.
- **`DICTIONARY.md` is a living document.** Step 3 keeps it current with small daily edits —
  fold in / correct yesterday's learnings, never duplicate. The heavy reconcile stays with the
  weekly `/refresh-knowledge`; the daily pass deliberately does **not** touch its watermark, so the
  two never collide.
- **Otherwise read-only and advisory.** Beyond the `DICTIONARY.md` touch-up, this command never
  posts to Slack, never writes to a production DB, and never archives a ticket. It surfaces and
  recommends; Jack acts.
- This command lives in `global-config/commands/`. After editing it, sync with
  `bash scripts/sync-global-config.sh push` so `~/.claude/commands/start-day.md` is updated.
