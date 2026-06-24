---
name: presenting-analysis
description: Standing rulebook for presenting a research/analysis result — paragraph-first by default (one tight 3–6 sentence paragraph + an offer to expand; the full sectioned findings/plan/Implementation Map appear ONLY when Jack says "more"), a strict relevance gate, and the say-it-once / no-narration output discipline. For research→build flows (/serp-analyze, /swac-analyze) the full Implementation Map is still built internally as the implementer's brief but kept under the fold. Use when presenting the results of a research/analysis phase (the /serp-analyze, /swac-analyze, /research, or /jira-start present step), or whenever writing up findings for approval. Repo-specific gates/tooling layer on via that repo's analyze-extras skill.
disable-model-invocation: false
---

# Presenting an Analysis

Fires when a research/analysis phase is done and it's time to present the result for
approval. **Default to a tight paragraph, not a multi-section report.** Jack reads the
paragraph; he asks for more only if he needs it. Follow the paragraph-first rule and the
discipline below; end with the approval gate.

## The paragraph-first rule — this is what Jack wants

**Lead with ONE tight paragraph (3–6 sentences). Then offer to expand. Stop.** That
paragraph is the whole default presentation — the answer/recommendation, the one or two
things that would change, and the single biggest risk if there is one. No section
headers, no bulleted findings, no plan list, no map — unless Jack asks. End the paragraph
with a one-line offer:

> _Say "more" for the full findings / plan / implementation map, or ask about any part._

That's it. A paragraph + the offer is the complete turn (then the approval gate below).
If the honest answer needs two short paragraphs, fine — but never reach for the sectioned
template by default.

**On "more" (or a pointed question):** expand only what was asked. "more" → the full
sectioned breakdown (the template below). A pointed question ("what's the risk?", "which
files?") → answer just that part. Don't dump the whole template for a narrow question.

## Relevance gate — applies to the paragraph AND any expansion

**Present ONLY what changes the answer or the build. Cut everything else.** Before every
sentence, ask "does this change what gets decided or built?" — if no, delete it.

- **No background, no recap, no "context."** Don't re-explain how the system works, don't
  restate the task, don't narrate what you searched. Jack knows the task; he wants the
  conclusion.
- **Conclusions, not evidence.** "list_price reads from Odoo via
  `products.controller:fetch_live`" — not the three queries you ran to learn that.
- **One fact, once.** No fact repeats across the paragraph and an expansion.

When in doubt, cut. A 4-sentence paragraph that's all signal beats a 40-line report.

## Say it once (applies to every turn leading up to the presentation, too)

This presentation is the ONLY place findings appear. Do NOT dump findings or pre-narrate
the plan in the turns before it — no "key findings: 1… 2… 3…" mid-research. While
researching, emit at most one tight status line per turn (or nothing). Producing the
content twice — once as narration, once in the presentation — is the verbosity this forbids.

## The expansion template — ONLY shown on "more", never by default

This is the sectioned breakdown Jack gets when he says "more". Each section has a hard
line cap (a ceiling, not a target); omit any section that doesn't apply. Tight phrases and
`file:symbol` references, not sentences.

```
### Research Findings  (≤4 lines total — one per angle, OMIT any angle that's N/A)
**Codebase**: [...]   **Institutional Knowledge**: [...]
**External Patterns**: [...]   **Data Considerations**: [... or omit]

### Recommendation  (≤3 lines — what to build, decisively; no options survey)
[...]

### Implementation Plan  (≤6 numbered steps, one line each — OMIT for a pure-research question)
1. ...

### Implementation Map  (terse: file + symbol anchor per change site — OMIT for a pure-research question)
[file + symbol anchor (function/dict/router name) for every change site — exact line
numbers confirmed at implementation time · test files to extend/create · a **Landmines**
section collected via the `landmine-check` skill · executable by someone with ZERO
conversation context — it becomes the implementer's brief verbatim]

### Risks & Open Questions  (≤3 bullets — real unknowns only; omit if none)
- ...
```

## `/serp-analyze` & `/swac-analyze` (research→build) — build the Map internally, still show only the paragraph

These flows hand off to an implementer session, and the **Implementation Map IS that
implementer's brief** — so you must still produce the full Map (per the expansion template)
and pass it into the implementer's prompt / task chunks. But what you show **Jack** is the
same paragraph + offer — the Map travels to the implementer under the fold, not onto Jack's
screen. He can say "more" to see it. (`/research` has nothing to build, so it never
produces a Map — paragraph + answer, done.)

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

## End with the approval gate — the paragraph + one-line gate IS the turn

End with the **approval block** per the `approval-block` skill — the LAST text of the
turn, ONE line of what's being approved (root cause / what gets built · files · scope:
branch, tests, PR base) plus the action question. It comes right after the paragraph and
the "say more" offer. Don't restate the paragraph — a second recap is the verbosity to
avoid. The approval-block skill owns the full STOP/emit-nothing-after/restate-if-stray-tool-call
rules — follow it, don't re-derive them here. (For a `/research`-style pure question there's
no build to approve — close on the answer paragraph + the "ask about any part" offer, no
approval gate; the `/research` command's rider covers this.)
