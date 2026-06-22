---
name: presenting-analysis
description: Standing rulebook for presenting a research/analysis result — a strict relevance gate (present ONLY what changes the answer or the build; cut everything else) plus the capped "Analysis Complete" template (findings, recommendation, plan, Implementation Map, risks — omit any section that doesn't apply) and the say-it-once / no-narration output discipline. Use when presenting the results of a research/analysis phase (the /analyze, /global-analyze, /research, or /jira-start present step), or whenever writing up findings (+ optionally a plan + implementation map) for approval. Repo-specific gates/tooling layer on via that repo's analyze-extras skill.
disable-model-invocation: false
---

# Presenting an Analysis

Fires when a research/analysis phase is done and it's time to present findings + plan +
map for approval. The presentation IS the implementer's brief — terse, executable, said
exactly once. Follow this template and the discipline below; end with the approval gate.

## Output discipline (applies to every turn leading up to the presentation, too)

- **Direct and concise.** Lead with the answer/status in one line. No process narration,
  no restating the task, no hedging, no long recaps.
- **Say it ONCE.** This presentation is the ONLY place findings, the plan, and the map
  appear. Do NOT dump findings or pre-narrate the plan in the turns before it — no "key
  findings: 1… 2… 3…" mid-research, no preview of the steps. While researching, emit at
  most one tight status line per turn (or nothing). Producing the content twice — once as
  narration, once in the template — is the exact verbosity this forbids.

## Relevance gate — the most important rule

**Present ONLY what changes the answer or the build. Cut everything else.** This is the
rule Jack cares about most: the analysis should be _much more concise, only relevant
things._ Before every line, ask "does this change what gets decided or built?" — if no,
delete it. Specifically:

- **Omit any section that doesn't apply.** A section is not a checklist item to fill — it's
  there only if it carries weight. No findings for an angle you didn't need to research? Drop
  the line. No real risks? Write `Risks: none` and move on. A pure question with nothing to
  build? Drop **Plan** and **Implementation Map** entirely (see the `/research` rider).
- **No background, no recap, no "context" paragraph.** Don't re-explain how the system
  works, don't restate the task, don't narrate what you searched. Jack knows the task; he
  wants the conclusion.
- **One fact, once.** If a detail is in the Map, it does not also go in Findings. No fact
  appears in two sections.
- **Findings are conclusions, not evidence.** "list_price reads from Odoo via
  `products.controller:fetch_live`" — not the three queries you ran to learn that.

When in doubt, cut. A 12-line analysis that's all signal beats a 40-line one padded with
sections that "should" be there.

## The template — a budget AND a filter, not a starting point

The whole presentation is the implementer's brief, NOT prose to read top-to-bottom. Each
section has a hard line cap — and the cap is a ceiling, not a target. Tight phrases and
`file:symbol` references, not sentences. If a section fits in one line, use one line. If it
doesn't apply, **omit the whole section** (per the relevance gate). Never explain your
reasoning, restate the task, or hedge.

```
## Analysis Complete: [one-line task summary]

### Research Findings  (≤4 lines total — one per angle, OMIT any angle that's N/A; don't list angles you didn't need)
**Codebase**: [...]   **Institutional Knowledge**: [...]
**External Patterns**: [...]   **Data Considerations**: [... or omit]

### Recommendation  (≤3 lines — what to build, decisively; no options survey)
[...]

### Implementation Plan  (≤6 numbered steps, one line each — OMIT entirely for a pure-research question with nothing to build)
1. ...

### Implementation Map  (the brief — terse: file + symbol anchor per change site — OMIT entirely for a pure-research question)
[file + symbol anchor (function/dict/router name) for every change site — exact line
numbers are confirmed at implementation time, don't read whole files now · test files to
extend/create · a **Landmines** section collected via the `landmine-check` skill · the map
must be executable by someone with ZERO conversation context — it becomes the implementer's
brief verbatim]

### Risks & Open Questions  (≤3 bullets — real unknowns only; omit the section if none)
- ...
```

## Before presenting

- **Run the `landmine-check` skill** on the touched files/tables and fold its output into
  the Implementation Map's Landmines section (or fold it into a researcher's brief so it
  runs in parallel — see the `research-team` skill).
- Do NOT write to the knowledge base (`DICTIONARY.md`) — not part of this flow.

## Do all teardown BEFORE presenting — never after

Any team/cleanup work (shutting down researchers, `TeamDelete`) happens **before** you
write the presentation, and **silently** — see the `research-team` skill's "shut the team
down, silently" rule. Get it out of the way first so the presentation can be the last
thing on screen. A stalled `TeamDelete` is not a reason to keep talking — leave the idle
team to be reaped and present anyway.

## End with the approval gate — the plan IS the last thing said

End with the **approval block** per the `approval-block` skill — the LAST text of the
turn, ONE line of what's being approved (root cause / what gets built · files · scope:
branch, tests, PR base) plus the action question. Do NOT restate the plan/map/findings —
they're directly above; a second recap is the verbosity to avoid. The approval-block skill
owns the full STOP/emit-nothing-after/restate-if-stray-tool-call rules — follow it, don't
re-derive them here.
