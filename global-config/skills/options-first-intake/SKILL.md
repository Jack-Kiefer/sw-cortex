---
name: options-first-intake
description: The options-first intake convention — before routing/assessing/researching a task, turn whatever Jack typed into a few pickable AskUserQuestion options instead of making him type an open-ended paragraph. Holds the invariant rules every intake shares; each command supplies its own second axis. Consumed by /go, /launch, /global-analyze, /global-quick-analyze, and SERP /analyze + /quick-analyze.
disable-model-invocation: false
---

# Options-first intake

**Jack should rarely have to type an open-ended task.** Before you route, assess, or research, use the **`AskUserQuestion`** tool to turn whatever he typed into a few pickable options — even when he wrote a full sentence. **Do the cheap reconnaissance first** (a glance at the relevant repo / one or more KB searches on the task terms) so the options are concrete and specific, not generic. A misread scope makes the whole intake ask the wrong question.

Ask **1–3 questions** whose options cover two axes:

- **SCOPE — _what_ he means:** the specific area / page / system / table / SKU-family / file the task touches. Turn a vague phrase into concrete targets — name the real view, worker, table, or file.
- **The second axis depends on the command** (the consumer supplies it): for a fix-prep command it's **APPROACH** (candidate fix paths, as distinct options); for a research-only command it's **ANGLE** (where to look first / which interpretation of the question). The consuming command states which axis applies and gives examples.

## The 5 shared rules for the options

- Make the **first option your recommended one** and append " (Recommended)" to its label.
- Options must be **specific to this task** — derived from the recon, not boilerplate. Bad: "Frontend / Backend / Both". Good: names the real view, worker, table, or file.
- Jack can always pick "Other" to type freely — that's the escape hatch, not the default path.
- Keep it to **1–3 questions**. If after a genuine look the task is **already fully specified AND single-approach** (nothing meaningful to choose), skip asking and say so in one line — but **default to asking**.
- **Fold Jack's picks into the task** before the command's next step, so the rest of the flow runs already-scoped.
