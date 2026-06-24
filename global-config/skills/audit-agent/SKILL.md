---
name: audit-agent
description: Post-mortem another Claude agent's bad output — reconstruct the context/docs/instructions it actually had, find the ROOT cause of why it went wrong (a missing/wrong/ambiguous instruction, a stale doc, an un-searched KB entry, a misleading name), and land durable fixes (CLAUDE.md, .claude/rules, a skill, the KB/DICTIONARY, or a session memory) so the next agent does better. Use when Jack pastes a chunk of output/transcript from another agent (or describes what one did) and says "audit this", "why did it do that", "figure out what went wrong", or "make it not happen again".
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

# Audit Agent — diagnose a bad result, fix the cause, not the symptom

Jack pastes output (or a transcript snippet, or a description) from **another Claude
agent** and asks you to audit it. The other agent produced a bad result — wrong answer,
wrong file edited, hallucinated a column/table, ignored an instruction, over-built,
went off the rails. Your job is a **post-mortem**: figure out what that agent was
working from, find the **root cause** of the failure, and make a **durable fix** so the
next agent in that situation does better.

This is NOT "redo the task correctly." The deliverable is the **diagnosis + the
fix to the agent's operating context**, not a corrected version of the original output
(though you may show the correct answer to prove the diagnosis). You are improving the
_system that produced the agent_, not patching one output.

> **The whole point:** a bad agent result is almost never "the model is dumb." It's
> almost always a **context failure** — the agent was missing a fact, given a stale or
> ambiguous instruction, never told to search the place where the truth lived, or
> tripped by a misleading name the docs warn about _somewhere it didn't look_. Find
> THAT, and fix THAT, so it doesn't recur.

---

## 1. Intake — capture exactly what you're auditing

From what Jack pasted, pin down:

- **The bad output itself** — the specific claim, edit, command, or decision that was
  wrong. Quote the exact span. If he pasted a long transcript, isolate the failing
  step(s); don't audit the whole thing if one step went wrong.
- **What "wrong" means here** — factually false? right fact / wrong action? violated a
  working-style rule (over-built, edited a read-only repo, replaced instead of extended)?
  ignored an explicit instruction? hallucinated a schema/API? Name the failure class —
  it points at which fix surface applies (§4).
- **Which agent / repo / command** produced it, if knowable — a `/go` session in SERP, a
  SWAC `/swac-analyze`, a raw Claude chat, a subagent. This tells you **which
  CLAUDE.md, which `.claude/rules`, which skills, which MCP tools** were in scope. If
  it's not stated and matters, ask in one line; otherwise infer from the content and say
  what you assumed.

If the paste is too thin to diagnose (no idea what it was asked, what it had, or why
it's wrong), ask the **one** question that unblocks you — don't guess at a root cause
from vibes.

## 2. Reconstruct the agent's context — what did it actually have to work with?

You can't diagnose a context failure without reconstructing the context. Pull the
**actual** instructions/docs/tools that agent was operating under — read them, don't
recall them:

- **Global instructions:** `~/CLAUDE.md` (symlinked from
  `sw-cortex/global-config/CLAUDE.md`) — the working-style rules, repo routing,
  the inlined SugarWish ground-truth TL;DR.
- **Repo instructions:** the involved repo's `CLAUDE.md` and `.claude/rules/*.md` (only
  SERP and sw-cortex have a `rules/` dir; SWAC and the read-only repos are CLAUDE.md
  only). Read the rules that bear on what the agent was doing.
- **Skills in scope:** `~/.claude/skills/*/SKILL.md` and the repo's `.claude/skills/` —
  did a skill that _should_ have fired not fire? Was its `description` trigger too narrow
  to match what the agent was doing? Did a skill give wrong guidance?
- **The command it ran:** if a slash command drove it, read that command file
  (`~/.claude/commands/*.md` or the repo's `.claude/commands/`) — the failure may be in
  the command's instructions, not the model.
- **The knowledge base:** the SugarWish dictionary is **not** preloaded — agents reach it
  only via `mcp__knowledge__search_knowledge`. A huge class of bad results is "the truth
  was in the KB and the agent never searched it" (or searched the wrong terms). Search
  the KB yourself for the topic the agent got wrong — **if the correct fact is there, the
  failure is that the agent didn't search, or wasn't told to.** If it's NOT there, the KB
  has a gap to fill.
- **Session memories:** `~/.claude/projects/<project>/memory/` — was there a memory that
  encodes exactly the trap the agent stepped on? If yes, why didn't it surface/apply? If
  no, that's a memory worth writing.

Reconstruct only what's relevant to the failing step. The output of this phase is a
short, concrete answer to: **"Given what this agent could see, was the bad result
inevitable, avoidable, or actively invited by its instructions?"**

## 3. Root cause — the FIVE-WHYS, landing on a context defect

Trace the bad output back to a fixable defect in the agent's operating context. Don't
stop at the symptom ("it used the wrong column") — keep asking _why_ until you hit
something you can change in a doc/rule/skill/KB/memory:

> _It queried `odoo_synchronized` and got nothing_ → why? → _it guessed the column name_
> → why? → _the real column is misspelled `oddo_synchronized` and the agent didn't know_
> → why? → _that gotcha lives in the KB and the agent never searched the KB before
> writing SQL_ → **root cause: nothing forced a KB search before query-writing for this
> path** → fixable.

Classify the root cause into one (or more) of these — each maps to a fix surface in §4:

| Root-cause class              | Tell                                                                                                                                 | Fix surface                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Missing fact**              | the truth exists nowhere the agent could reach                                                                                       | add it to the **KB/DICTIONARY** (or a memory)                                                                      |
| **Un-searched fact**          | the truth WAS in the KB/rules/memory but the agent never looked                                                                      | strengthen the **trigger** — make the command/skill force the search; or sharpen a skill `description` so it fires |
| **Stale / wrong instruction** | a CLAUDE.md / rule / command said something no longer true                                                                           | correct the **doc**                                                                                                |
| **Ambiguous instruction**     | the instruction could be read two ways and the agent picked wrong                                                                    | disambiguate the **doc** — add the failing case as an explicit example                                             |
| **Missing guardrail**         | a working-style rule (minimal change, read-only repos, no stash) should have caught it but isn't stated where the agent would see it | add/relocate the **rule** so it's in scope for that path                                                           |
| **Misleading name**           | a table/column/repo name invites the wrong inference (`serp_test` is live, `laravel_live` isn't SERP, SWAC=WishDesk)                 | ensure the **KB/TL;DR** warns about it for that topic                                                              |
| **Model slip**                | genuinely the model's mistake despite correct, in-scope context                                                                      | rare — only conclude this after ruling out the above; the fix is usually a sharper instruction anyway              |

Be honest about "model slip" — it's the lazy diagnosis. Reach for it only after you've
confirmed the context was actually correct, complete, and in-scope. Most "the model
messed up" results are really "the context invited the mistake."

## 4. Fix — land a durable change on the right surface

Make the fix that prevents recurrence, on the surface §3 pointed to. **Respect Jack's
working style**: minimal, additive, in-scope. Extend the existing doc/rule/skill — don't
rewrite it, don't add a new file when an existing one is the right home, don't scope-creep
into adjacent cleanup.

- **CLAUDE.md (global or repo):** correct/disambiguate the instruction, or add the
  failing case as an explicit example next to the rule it violates. Global lives in
  `sw-cortex/global-config/CLAUDE.md` (edit there, it's the symlink source — never edit
  `~/CLAUDE.md` directly).
- **`.claude/rules/*.md`:** add or sharpen a path-scoped rule (SERP / sw-cortex only).
- **A skill:** if a skill should have fired but its `description` didn't match, **widen
  the description trigger**; if a skill gave wrong guidance, fix the guidance. If the gap
  is a whole missing behavior, a new skill may be warranted — but prefer extending one.
- **The KB / `DICTIONARY.md`:** if the fact was missing or a name was un-warned, add it to
  `sw-cortex/DICTIONARY.md` (the KB indexes it directly; the index refreshes on next
  search — no ingest step). This is the highest-leverage fix for "wrong inference about a
  SugarWish system/table/column."
- **A session memory:** for a trap specific to Jack's workflow that isn't doc-worthy,
  write a memory per the memory protocol (one fact per file + a one-line `MEMORY.md`
  pointer). Good for "the agent did X; the right move was Y, because Z."

**Scope discipline:** fix the cause you diagnosed. If you spot _other_ latent issues while
reconstructing the context, **list them as follow-ups** — don't fix them unprompted
(that's the over-building the audit is supposed to catch). One audit, one root cause, one
fix surface, unless Jack says cast wider.

**Global-config changes need syncing:** edits under `sw-cortex/global-config/` only take
effect after `bash scripts/sync-global-config.sh push` (pull first). Edits to a repo's own
`.claude/` or `DICTIONARY.md` are live in place. Note which applies in your report.

## 5. Report — diagnosis first, then the fix

Lead with the **root cause in one or two sentences** — what the agent had, what it was
missing, and why that produced the bad result. Then:

- **The fix you made** (or propose) — which surface, what changed, why it prevents
  recurrence. If it's a `global-config` edit, say it needs a `sync push`.
- **Proof, if useful** — the correct answer/action the agent should have produced, to
  confirm the diagnosis is right (not to redo the task).
- **Follow-ups** — other latent issues you noticed but deliberately didn't fix, as a
  short list for Jack to greenlight or drop.

Keep it tight. The value is the **correct diagnosis and the durable fix**, not a long
narration of the investigation. If the root cause turns out to be genuinely
unfixable-in-context (a true one-off model slip with correct context), say so plainly
rather than inventing a doc change to look productive.
