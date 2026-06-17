---
name: landmine-check
description: Sweep .claude/rules, session memories, and the knowledge base for documented gotchas that apply to the files/tables a task will touch, and emit a Landmines list for the Implementation Map or implementer brief. Use when building an Implementation Map, briefing an implementer, or before editing an unfamiliar subsystem. The exact rule files / memory path / examples for a given repo come from that repo's analyze-extras skill.
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Landmine Check

Given the task's touched files, tables, and subsystems, collect the documented
gotchas BEFORE implementation — the obvious-looking inference is often documented as
wrong, and that documentation is spread across three places.

> **Repo-specific layer:** this is the generic core. Your repo's `*-analyze-extras` skill
> names the exact `.claude/rules/*.md` files, the session-memory directory path, and the
> kind of traps that repo files. Honor it when sweeping.

**Who runs this:** the lead during synthesis, OR a spawned researcher folded into the
research swarm (the `research-team` skill). The three sweeps below are fast, bounded
calls — finish them within the researcher's wall-clock budget (~90s) and report the
Landmines list back; if a sweep would blow the budget, report what you found and stop
rather than running unbounded. The codebase-researcher is the natural owner when
landmines aren't given their own agent.

## 1. Path-scoped rules

Match the touched paths against this repo's `.claude/rules/*.md` and read the matching
ones. Pull only the rules that bear on the planned change. (Your repo's analyze-extras
skill lists the rule files that exist; repos with no `.claude/rules/` skip this sweep.)

## 2. Session memories

```bash
rg -il '<keyword1>|<keyword2>|<table-or-file-name>' \
  ~/.claude/projects/<this-project's-memory-dir>/memory/
```

Keywords = table names, subsystem names, file basenames, feature nouns from the
plan. Read the hits — `reference_*`/`feedback_*`/`project_*` memories often encode
exactly the trap. (Your repo's analyze-extras skill gives the exact memory directory
path and example traps.)

## 3. Knowledge base

This is the highest-value sweep of the three: the dictionary is not preloaded, so
`mcp__knowledge__search_knowledge` is the only access to the documented gotchas, and the
trap is exactly the wrong-but-plausible inference you'd otherwise carry into the
Implementation Map.

Run **3–5** `mcp__knowledge__search_knowledge` queries (more when the change spans several
systems/tables) — and don't search only the literal task terms. Search **adjacent topics**
too: the systems one layer up/down from what you're touching, the cross-system flow the
change sits in, the data source behind it, neighboring features that share its tables. The
trap is often filed under a topic you didn't think to name. One query per distinct angle;
vary the wording.

If a hit surfaces a NEW term you hadn't searched (a table name, a system, a gotcha),
**run a follow-up query on it** — chase the thread rather than stopping at the first
round. Expand truncated hits with `get_knowledge_section` only when load-bearing. Err
toward more queries, not fewer — a missed gotcha here becomes a bug in the plan.

## Output

Append a **Landmines** section to the Implementation Map / brief — one bullet per
gotcha: the trap + how it applies to THIS change + source (rule/memory/KB). Skip
generic advice; include only traps someone could actually step on in this task. If
the sweep finds nothing, say "no documented landmines found" — don't pad.
