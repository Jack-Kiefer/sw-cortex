---
name: research-team
description: Standing rulebook for a research/analysis swarm — parallelize across a TEAM by default, choose the roster from what the task needs (at least 2 agents, never a fixed set), time-box every researcher, and TaskStop any that runs long. Use when running the research/plan phase of an analyze flow (or any task that means spawning a team of researchers to investigate in parallel). Repo-specific tooling/gates layer on top via that repo's analyze-extras skill.
disable-model-invocation: false
---

# Research Team — parallelize the investigation, time-box every agent

Fires for the research/plan phase: when the work means investigating across several
angles before writing a plan. The default is a **team working in parallel**, not the
lead digging serially. The lead coordinates and synthesizes — it does NOT do the bulk
of the digging itself.

> **Repo-specific layer:** this is the generic core. The repo you're in supplies its own
> tooling, KB-gate, and roster tuning via its `*-analyze-extras` skill (e.g.
> `serp-analyze-extras`, `wishdesk-analyze-extras`) — invoke that alongside this one when
> the analyze command tells you to. Where this skill says "the KB"/"MCP tools" generically,
> the extras skill names the exact tools and any hard pre-gate.

## 1. Parallelize by default — at least 2 agents

- **Spawn a team, not a solo lead.** A team turns a 10-minute serial sweep into a
  ~3-minute parallel one. Spawn all researchers **in a single message** so they run
  concurrently.
- **Always at least 2 researchers** — codebase-researcher (always) plus ≥1 more angle.
  Most tasks warrant 2–4.
- **Drop to INLINE (no team) when a team would be pure overhead** — say so in one line
  when you do. Two cases:
  - a trivial one-file change where you already know the exact file; OR
  - **the lead can reach the answer faster by reading source directly** (files are
    findable by name/grep, the angles aren't independent enough to parallelize, or
    you'll have the full picture before researchers even spin up). A team you out-run is
    worse than no team: the idle members add nothing and then stall teardown. If you
    catch yourself thinking "they went idle without findings, I already got it from
    source" — that task should have been inline. Prefer 1–2 `Explore` calls or an inline
    sweep over a `TeamCreate` whenever the investigation is findable rather than genuinely
    multi-angle.
- **Cap: 4 researchers.** Past that, coordination overhead outweighs the parallelism.
  Need more angles than 4? Widen an existing agent's brief instead of adding a body.

## 2. Choose the roster from THIS task — never a fixed set

codebase-researcher is the only fixed member. Pick the rest by what the task actually
needs, and state in one line why each non-codebase agent earns its slot.

| Researcher              | Spawn when…                                                                                                                                                                                                                                                                                                                                                                           | subagent_type / model                           | Budget |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| **codebase-researcher** | always                                                                                                                                                                                                                                                                                                                                                                                | `Explore` (returns conclusions, not file dumps) | ~3 min |
| **context-researcher**  | institutional history is load-bearing (cross-team decisions, ownership) — **3–5** `mcp__knowledge__search_knowledge` queries FIRST (the task terms AND adjacent topics: neighboring systems, the cross-system flow, the data source behind it), THEN `mcp__slack-search__*`; chase any new term a hit surfaces with a follow-up query, and keep searching the KB as new terms surface | `general-purpose`, `model: haiku`               | ~90s   |
| **db-researcher**       | DB schemas / queries / migrations / data modeling across several tables (for 1–2 tables the lead runs `describe_table` itself) — `mcp__db__list_tables`/`describe_table` on the relevant tables only                                                                                                                                                                                  | `general-purpose`, `model: haiku`               | ~90s   |
| **web-researcher**      | external libraries / third-party APIs / unfamiliar tech — never for internal plumbing the KB/codebase already covers — 2–4 `WebSearch` + 2–3 `WebFetch`                                                                                                                                                                                                                               | `general-purpose`, `model: sonnet`              | ~3 min |

When a task needs two angles of the same kind (two distinct subsystems to map, codebase

- a separate integration surface), give a second researcher of that type its own scoped
  brief rather than overloading one — still within the cap of 4.

## 3. Time-box every researcher — no agent runs unbounded

- **Create one task per researcher** (`TaskCreate`) before/at spawn — this is what makes
  each agent pollable via `TaskList`/`TaskGet` and stoppable via `TaskStop`.
- **Note the spawn wall-clock** for each agent so you can tell when its budget (table
  above) has elapsed. `Date.now()` isn't available in inline reasoning — read the clock
  from a tool result or just track elapsed roughly.
- **Poll, don't block.** Check `TaskList`/`TaskGet` and integrate findings as each
  reports in; start drafting after 2–3 core reports.
- **When a researcher blows its budget:** send ONE status ping via `SendMessage`. If it
  still hasn't reported within ~30s of the ping, **`TaskStop` it and proceed without
  it** — fold the missing angle into Risks & Open Questions, and run a single cheap
  verification yourself if it's load-bearing.
- **Overall Phase 1 budget: ~5 min wall-clock** spawn → presented analysis. Per-agent
  budgets keep any one researcher from eating the whole window. A stopped agent with a
  noted gap beats a stalled run — never sit idle on a wedged agent.

## 4. Found the answer early? Shut the team down — silently, then move on

If you find what you need while teammates are still out, **shut them ALL down
immediately** and cancel obsolete tasks. Don't wait for or integrate late corroborating
reports — skim one line for contradictions and move on. A wrong detail in a late report
costs more time correcting than it adds.

**Teardown order — `TaskStop` BEFORE `TeamDelete`:** an idle/running member blocks
`TeamDelete`, so `TaskStop` every member first, _then_ `TeamDelete`. This is the bug that
stalls cleanup when you skip it.

**Teardown is best-effort and SILENT — it must never delay or clutter the presentation:**

- Do the teardown **before** you present the analysis, not after. The approval turn ends
  on the plan/approval block (the `presenting-analysis` skill owns this) — never on
  cleanup narration.
- If `TeamDelete` still won't complete (members slow to stop), **leave the idle team to be
  reaped and move on in the SAME turn.** Idle agents consume nothing. Do NOT retry
  `TeamDelete` in a loop, and do NOT emit status lines about it ("teammates went idle…",
  "the team won't delete…", "I won't keep retrying…") — that chatter is exactly what
  buries the plan. One silent attempt, then proceed regardless of the result.

## 5. Every researcher brief ends with the same hard cap

> HARD CAP: report ≤25 lines, conclusions only — no per-row tables, no raw SQL output,
> no full schema dumps. One line per non-load-bearing fact. Only cover entities named in
> the task. Budget: \<Ns\> — if you can't finish, report what you have and stop; the lead
> may stop you at the deadline.

## Search the knowledge base aggressively — broad, recurring, and FIRST

The SugarWish dictionary is not preloaded into context, so
`mcp__knowledge__search_knowledge` is the lead's and every researcher's only access to
ground-truth (systems, tables, columns, cross-system flows, owners, gotchas). The KB
exists to catch the wrong-but-plausible inference, and the trap is usually filed under a
topic adjacent to what you literally searched. So search a LOT, not once:

- **First, before reasoning.** A researcher whose brief touches any SugarWish entity runs
  KB queries before it greps or reads. Don't reason about a table/system/flow you haven't
  searched. (Your repo's analyze-extras skill may make this a hard pre-gate — honor it.)
- **Broad, not literal.** Each KB search round covers the task terms PLUS adjacent
  topics — the systems one layer up/down, the cross-system flow the change sits in, the
  data source behind it, neighboring features sharing its tables. Vary the wording; one
  query per distinct angle. Default to **3–5** queries, more when several systems are in play.
- **Recurring, not one-shot.** Search again whenever a NEW term surfaces mid-research — a
  table name a researcher reports, a system the codebase touches, a gotcha a memory hints
  at. A ~200ms `mcp__knowledge__search_knowledge` call that corrects a framing is far
  cheaper than building on a wrong assumption. Keep checking the whole run as the picture
  sharpens.
- **Chase the thread.** When a hit names something you hadn't searched, run a follow-up
  query on it before moving on. Expand truncated hits with `get_knowledge_section` when
  load-bearing. Searching too much is not the failure mode here; searching too little is.

## Synthesis

Compress, never re-paste — teammate reports are raw material; the presented analysis
carries only distilled conclusions and the file:line map. Run cheap verifications
yourself (one SQL query, one grep, one read, **one KB search on a term that just
surfaced**) only for facts that change the recommendation — never spin up a new teammate
or a new research round for them.
