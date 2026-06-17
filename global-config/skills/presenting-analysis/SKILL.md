---
name: presenting-analysis
description: Standing rulebook for presenting a pre-implementation analysis — the capped "Analysis Complete" template (findings, recommendation, plan, Implementation Map, risks) plus the say-it-once / no-narration output discipline. Use when presenting the results of a research/analysis phase (the /analyze, /global-analyze, or /jira-start present step), or whenever writing up findings + a plan + an implementation map for approval. Repo-specific gates/tooling layer on via that repo's analyze-extras skill.
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

## The template — a budget, not a starting point

The whole presentation is the implementer's brief, NOT prose to read top-to-bottom. Each
section has a hard line cap. Tight phrases and `file:symbol` references, not sentences. If
a section fits in one line, use one line. Never explain your reasoning, restate the task,
or hedge.

```
## Analysis Complete: [one-line task summary]

### Research Findings  (≤4 lines total — one per angle, omit any that's N/A)
**Codebase**: [...]   **Institutional Knowledge**: [...]
**External Patterns**: [...]   **Data Considerations**: [... or omit]

### Recommendation  (≤3 lines — what to build, decisively; no options survey)
[...]

### Implementation Plan  (≤6 numbered steps, one line each)
1. ...

### Implementation Map  (the brief — terse: file + symbol anchor per change site)
[file + symbol anchor (function/dict/router name) for every change site — exact line
numbers are confirmed at implementation time, don't read whole files now · test files to
extend/create · a **Landmines** section collected via the `landmine-check` skill · the map
must be executable by someone with ZERO conversation context — it becomes the implementer's
brief verbatim]

### Risks & Open Questions  (≤3 bullets — real unknowns only; "N/A" if none)
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
