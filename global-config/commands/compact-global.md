# Command: compact-global

Save a session summary to persistent memory, then stop.

---

## Instructions

**STOP all other work immediately.**

### Step 1: Save a Session Summary

Write a memory file in your persistent memory directory (the per-project `memory/` dir) named `session_[brief-kebab-slug].md` with `type: project` frontmatter, containing:

```
## What Was Done
List what was accomplished this session. Be specific - files changed,
features added, bugs fixed, decisions made.

## Context
Background info needed to understand this work. Why it matters,
related systems, constraints.

## Current State
Where things stand now. What's working, what's not, what's partial.

## Next Steps
What would need to happen next if resuming this work.

## Key Files
Important files involved (paths).
```

Add a one-line pointer to it in `MEMORY.md`.

If the session produced durable SugarWish ground truth (a gotcha, ownership fact, schema quirk — not just task state), also add it to `sw-cortex/DICTIONARY.md` so the knowledge MCP picks it up.

### Step 2: Confirm to User

```
## Session Saved

**Summary**: [one-line description]

**Memory file**: [filename]
```

### Step 3: Stop

Wait for new instructions.
