---
description: Re-explain the last thing (or $ARGUMENTS) as a short, fact-checked, plain-English answer
---

> **Effort:** this command is a **rewrite + verify** pass, not new research. Run it at **low-to-medium reasoning effort**. Only escalate if a claim needs a real check (a query, a file read, a search) before you can stand behind it.

# Command: nerf

**"Nerf" it — take something complicated and hand it back simple.**

Jack ran this because the last explanation (or a chunk of text he pasted) was too long, too hedged, too jargon-y, or too structured to be useful. His ask is: **say the same true thing, shorter and plainer** — and make sure it's actually *true* before you shorten it.

## What to nerf

- **`/nerf` with no arguments** → the **immediately preceding explanation in this conversation** (your last substantive answer). That's the default and the common case.
- **`/nerf <text or topic>`** → `$ARGUMENTS` is the thing to simplify: pasted text, a quoted paragraph, or a topic name ("nerf the darklaunch drift thing").

## The two jobs, in this order

### 1. Fact-check it first — nerfing is not the same as softening

Simplification is where wrong claims hide. Before rewriting, go back over the substance and mark each claim as one of:

- **Verified** — you checked it this session (a query result, a file you read, a KB hit, a command's output), or it's in `~/CLAUDE.md` / the knowledge base.
- **Unverified** — you inferred it, or it came from a plan doc / ticket / someone's summary rather than the running system.
- **Wrong** — you now think the original explanation was actually incorrect.

Check anything cheap and load-bearing rather than shipping it unverified: run the `describe_table`, re-read the file, `mcp__knowledge__search_knowledge` the term. **Don't do a whole new research pass** — this is a cleanup command, not `/research`. If verifying a claim would take real work, keep it and label it, don't silently drop it.

**If you find the original was wrong, say so in one plain sentence at the top and give the corrected version.** Correcting is the point; a nerfed wrong answer is worse than the long one.

Two SugarWish-specific traps to re-check, since they're exactly the kind of thing that survives a rewrite:

- **A plan doc / ticket describes the TARGET state, not the current one.** Don't restate it in the present tense without checking live.
- **A `serp_*` table exists in more than one DB.** If a count or row set backs a claim, confirm which DB it came from (`laravel_live` vs `serp_app` vs `serp_test`).

### 2. Rewrite it plain

Target: **a short paragraph — 3-6 sentences** — that a smart person with no context on this subsystem could read once and get. Add **at most 3-5 short bullets** only if the thing is genuinely a list (steps, options, causes). Nothing else.

**Do:**

- Lead with the answer / the bottom line. First sentence carries the point.
- Use ordinary words. Expand or drop jargon — say "the copy that mirrors Odoo" instead of "the darklaunch replica" unless the name itself is the point.
- Keep concrete specifics that matter: numbers, table names, file paths, dates, the actual decision.
- State things flatly. "X happens because Y." Cut "it's worth noting", "essentially", "in order to".

**Don't:**

- No headers, no tables, no nested bullets, no bold-label lists, no code blocks unless the answer *is* a command or a snippet.
- No preamble ("Here's a simpler version…"), no closing recap, no "let me know if you want more detail" boilerplate.
- No hedging stack ("it may possibly be that…"). One uncertainty marker, if it's real: "I haven't verified X."
- **Don't drop the caveat that changes what Jack does.** Brevity never eats a real constraint — if the thing only works on staging, or breaks above 10k rows, that stays.

## Output shape

Just the nerfed explanation. Then, only if either applies, one line each:

- `Corrected: <what the earlier version got wrong>` — when the fact-check found an error.
- `Unverified: <claim>` — when something load-bearing is still an assumption.

That's the whole output. If Jack wants the long version back, he'll ask.

## Examples

```
/nerf                                  # simplify the answer you just gave
/nerf the darklaunch drift monitor     # simplify a named topic
/nerf <pasted wall of text>            # simplify what he pasted
```
