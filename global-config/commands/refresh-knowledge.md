# Command: refresh-knowledge

Refresh **SUPPLEMENTARY_KNOWLEDGE.md** — the big-picture, hard-to-derive knowledge about SugarWish and
Jack's job that an AI can't get from a schema or a single file.

It mines **all of these sources** and folds them into one long document:

- **Claude Code chats** — every top-level transcript where Jack typed (corrections, "no it's actually…",
  repeated clarifications, intent) → the _things AI keeps getting wrong_.
- **Discoveries MCP** — Jack's accumulated dense insights.
- **Databases (data dictionary)** — per heavy DB (odoo, laravel_live, wishdesk, serp\_\*, retool):
  **what each table is FOR and what its columns / enum values MEAN**, plus cross-system linkage.
- **Slack** — institutional lessons: who-knows-what, decisions, recurring glitch root-causes, business rules.
- **Codebase + ownership** — every repo, what it does, branch/deploy convention, **and WHO owns/operates each**.
- **n8n processes** — how Jack automates things (the workflow exports + how they run).

Then a **fact-check pass** re-verifies every fact is still up to date against the live DBs/repos before writing.

Built to run **weekly**. Each run is **incremental** (mines only what's new since last time) and **merges**
into the existing doc — **never duplicates a fact**. If two versions of a fact exist, they become one
extensive fact (Jack's #1 rule).

## Usage

```
/refresh-knowledge                 # incremental: mine what's new since last run, merge into the doc
/refresh-knowledge full            # full rebuild from all sources (use occasionally / first run)
/refresh-knowledge status          # show last-run watermark and how much is new, do nothing else
```

The canonical doc lives at: `~/Desktop/Projects/sw-cortex/SUPPLEMENTARY_KNOWLEDGE.md`
(override by passing a path as the last arg, e.g. `/refresh-knowledge full ~/some/OTHER.md`).

`$ARGUMENTS` = the words after the command (may contain `full`/`status` and/or a doc path).

---

## What you (Claude) must do

Parse `$ARGUMENTS`: detect `full` (→ `--full`), `status` (status-only), and any explicit doc path.
Default doc = `~/Desktop/Projects/sw-cortex/SUPPLEMENTARY_KNOWLEDGE.md`.

Scripts live in `~/.claude/scripts/` (synced from `global-config/scripts/`):
`knowledge-refresh-prep.py`, `knowledge-extract-user-msgs.py`, `knowledge-refresh-stamp.py`.

### Step 1 — Prep (find what's new, shard it)

```bash
python3 ~/.claude/scripts/knowledge-refresh-prep.py --doc "<DOC>" [--full]
```

Read the JSON it prints. Note `mode`, `since`/`sinceISO`, `now`, `docExists`, `shardManifest`,
`shardCount`, `newTranscripts`, `totalTranscripts`, `statePath`.

- **`status` arg:** print this summary to Jack (last run, new transcript count, mode that _would_ run) and STOP.
- If `mode == "incremental"` and `newTranscripts == 0` **and** no other source looks stale: tell Jack there's
  nothing new and ask whether to run a `full` refresh anyway. Otherwise continue.

### Step 2 — Run the refresh workflow

Launch the Workflow below. Pass `args` = the prep JSON object **plus** the slack-sync-status and
discoveries tool-result file paths if you have them this session (otherwise the miners fetch fresh).

The workflow has 5 phases. On **incremental**, scope each miner to what's new/changed since `sinceISO`
and tell it to surface only NEW/CHANGED facts vs. what the existing doc already states. On **full**, run
the full breadth below.

1. **Mine** (all sources, in parallel):
   - **Chat miners** — one per shard in `shardManifest`. Each reads its file list and runs
     `python3 ~/.claude/scripts/knowledge-extract-user-msgs.py <file>...` to get **only Jack's typed
     messages** (logs/tool-output filtered, sidechains skipped). Hunt for corrections, repeated
     clarifications, "no it's actually…", business rules, roles, intent. Incremental = new transcripts only.
   - **Discoveries miner** — re-mine the discoveries MCP (`mcp__discoveries__list_discoveries`, read in
     chunks). Incremental: focus on discoveries created/updated since `sinceISO`.
   - **DB data-dictionary miners** — one per heavy DB (`odoo` split into inventory/mrp + sales/purchase/acct,
     `laravel_live`, `wishdesk`, `serp_prod_replica`, `retool`). Each does `describe_table` on the important
     domain tables and cheap `GROUP BY` queries to **decode what status/enum/flag VALUES MEAN** in business
     terms, plus FK/odoo_id cross-system linkage. Always LIMIT; never dump bulk data; skip framework plumbing.
   - **Slack institutional-lessons miners** — sharded by theme (org/people, SERP-vs-Odoo decisions,
     ops/fulfillment, recurring-glitch root-causes, business/pricing/enterprise). ≥12 searches each + read
     context on the best hits.
   - **Ownership + systems-map miner** — `mcp__github__` (top committers/branches per repo) + Slack for human
     titles → for each repo: what-it-is, architecture role, branch/deploy convention, ticket prefix, active
     people, and **who owns/leads it**; then which team owns which system boundary.
   - **n8n-process miner** — read the workflow JSON exports in `~/Desktop/Projects/sw-cortex/workflows/n8n/`
     (what each does, trigger/schedule, systems touched, why it exists) + a few Slack searches on how they run.

   Each miner returns structured candidate facts (topic, category, fact/columns, evidence, ai_misconception).

2. **Merge into existing doc (no duplicates):** read the current `SUPPLEMENTARY_KNOWLEDGE.md`, treat its
   existing facts as the baseline, and fold the new candidates in — **updating** an existing fact when the
   new info extends/corrects it, **adding** only genuinely new facts, **never creating a second copy**.
3. **Synthesize** the full updated document (keep it long; preserve all prior good content; section
   structure: TL;DR / Roles & Org (who owns what) / Systems + map / **Databases data-dictionary** (table →
   purpose → key columns/values) / Integrations & Sync / Business Rules / **n8n & Automations** / Tools &
   Workflow / Glossary / Things AI Keeps Getting Wrong / Gotchas).
4. **Completeness critic** pass.
5. **Fact-check pass (verify up to date):** batch the merged facts and re-verify each against the live
   source — DB facts re-confirmed with `mcp__db__` (`describe_table` / cheap `GROUP BY`: does the table/
   column/enum still exist with that meaning?); repo/ownership facts sanity-checked with `mcp__github__`.
   Mark each `verified-current` / `corrected` (fix the text) / `unverifiable` / `stale-removed`. Drop stale,
   keep corrected. Then final assembly.

Write the returned markdown to `<DOC>` (Write tool).

### Step 3 — Stamp the watermark

Only after the doc is written successfully, using prep's `now` (NOT wall-clock):

```bash
python3 ~/.claude/scripts/knowledge-refresh-stamp.py --doc "<DOC>" --at <PREP_now>
```

### Step 4 — Report

Tell Jack: mode, how many transcripts/discoveries/DBs/repos were in scope, how many facts were added vs.
updated, how many the fact-check pass **corrected or removed as stale**, and the doc path. Keep it short.

---

## The Workflow script (pass to the Workflow tool)

Adapt paths/args from Step 1. `args` carries the prep JSON (`P`). Sketch of the 5-phase shape:

```js
export const meta = {
  name: 'refresh-knowledge',
  description: 'Mine chats/discoveries/DBs/Slack/codebase/n8n for SugarWish supplementary knowledge, merge into the existing doc with no duplicate facts, then fact-check that every fact is up to date',
  phases: [
    { title: 'Mine',       detail: 'chat shards + discoveries + per-DB dictionary + Slack lessons + ownership + n8n' },
    { title: 'Merge',      detail: 'fold new facts into existing doc facts; dedupe; no duplicates' },
    { title: 'Synthesize', detail: 'rewrite the full long sectioned document' },
    { title: 'Critic',     detail: 'completeness pass' },
    { title: 'FactCheck',  detail: 'verify each fact still current against live DBs/repos; correct/drop stale' },
  ],
}
const P = args                          // prep JSON from Step 1
const SCRIPTS = '/Users/jackkief/.claude/scripts'
const FACT_SCHEMA = { /* topic, category(enum), fact, evidence, ai_misconception */ }

// ---- Mine (scope = new on incremental, everything on full) ----
phase('Mine')
const shards = JSON.parse(/* Read(P.shardManifest) */)
const incr = P.mode === 'incremental'
const chat = shards.map(sh => () => agent(/* extract Jack's words via knowledge-extract-user-msgs.py; hunt corrections/roles/rules */,
  { label: `chat-shard-${sh.shard}`, phase: 'Mine', schema: FACT_SCHEMA }))
const disc = () => agent(/* discoveries MCP; incr -> since P.sinceISO */, { label: 'discoveries', phase: 'Mine', schema: FACT_SCHEMA })
// Heavier source miners — always on `full`; on incremental include them but ask for only NEW/CHANGED vs the doc.
const DBS = ['odoo:inventory-mrp','odoo:sales-purchase-acct','laravel_live','wishdesk','serp_prod_replica','retool']
const dbMiners = DBS.map(d => () => agent(/* describe_table + GROUP BY to DECODE column/enum meaning; LIMIT; link odoo_id */,
  { label: `db:${d}`, phase: 'Mine', schema: DICT_SCHEMA }))
const SLACK_THEMES = ['org-people','serp-vs-odoo-decisions','ops-fulfillment','recurring-glitches','business-pricing-enterprise']
const slackMiners = SLACK_THEMES.map(t => () => agent(/* >=12 searches + get_slack_context; institutional lessons */,
  { label: `slack:${t}`, phase: 'Mine', schema: FACT_SCHEMA }))
const ownership = () => agent(/* per-repo what/owner/branch/ticket-prefix + who-owns-which-boundary */, { label: 'ownership', phase: 'Mine', schema: FACT_SCHEMA })
const n8n = () => agent(/* read workflows/n8n/*.json: what/trigger/systems/why */, { label: 'n8n', phase: 'Mine', schema: FACT_SCHEMA })
const mined = (await parallel([...chat, disc, ...dbMiners, ...slackMiners, ownership, n8n])).filter(Boolean)
const candidates = mined.flatMap(r => r.facts || [])

// ---- Merge into existing doc (NO DUPLICATES) ----
phase('Merge')
const existingDoc = P.docExists ? /* Read(P.docPath) */ '' : ''
const merged = await agent(/* fold candidates into existingDoc facts: UPDATE/ADD, never a 2nd copy; one extensive fact each */,
  { label: 'merge-into-doc', phase: 'Merge', schema: MERGED_SCHEMA })

// ---- Synthesize (Phase 3) -> Critic (Phase 4) -> FactCheck (Phase 5) ----
// Synthesize the long sectioned doc from merged.merged; run a completeness critic; then batch the facts and
// re-verify each LIVE (mcp__db__ describe_table / GROUP BY; mcp__github__ commits) — correct or drop stale —
// and assemble the final markdown. Return it as the final text.
return { document: /* final markdown */, added, updated, corrected, removedStale, mode: P.mode }
```

> The DB-dictionary miners and the FactCheck phase mirror the deep-dive build script at
> `~/Desktop/Projects/sw-cortex/.wf-db-n8n-deepdive.js` — reuse its `DICT_SCHEMA`, `GROUP BY` decode method,
> and `VERDICT_SCHEMA` verbatim. `full` runs all miners; incremental scopes chats/discoveries to new and asks
> the heavier miners for only NEW/CHANGED facts vs. the existing doc.

## Notes

- **Incremental is the point.** A weekly run typically mines a handful of new transcripts + recent
  discoveries and merges — fast and cheap. Use `full` after big changes (new DB, new repo, big refactor).
- **The watermark is per-doc** (`<doc-dir>/.knowledge-refresh.json`). Delete it to force a full run.
- Subagent/workflow transcripts (under `subagents/`, `workflows/`) are intentionally **excluded** — they
  contain no human turns and would pollute the "AI keeps getting wrong" signal.
- Manual edits to the doc are preserved on incremental runs (the merge reads the doc as the baseline). A
  `full` rebuild regenerates from sources, so prefer incremental for day-to-day.
- The depth this command mines (DB data-dictionary, n8n, ownership, Slack lessons) + the final fact-check
  pass matches the multi-workflow first build. Keep it; don't trim sources on a weekly run.
