---
description: Loader for /resume-later — reads a save file, gets on its branch, and briefs Jack
---

# Command: resume-later-load

The loader that `/resume-later` fires inside the **newly launched session** (not the hub).
It is the first thing that session does: read the save file, get on the right branch,
re-establish context, and brief Jack on where things stand. If a user types
`/resume-later-load <file>` directly, do the same.

This is a real, standalone command (synced to `~/.claude/commands/` so it exists in **every**
repo) precisely because `/resume-later` launches a session in SERP/SWAC/sw-cortex and seeds
it with `/resume-later-load <file>` — that target session must be able to resolve the command.

## Usage

```
/resume-later-load <absolute-path-to-save-file>
```

`$ARGUMENTS` is the absolute path to the save file (the one `/resume-later` passes).

---

## What you (Claude) must do

When invoked with a save file path as `$ARGUMENTS`:

1. **Read the save file** at that path. It has the full frontmatter + body written by
   `/save-for-later`. If the path is missing or the file doesn't exist, say so in one line
   and stop (don't guess at a different save).
2. **Get on the right branch.** If `branch` is set and exists, check it out
   (`git -C <repo_root> checkout <branch>`); if the working tree is dirty or the branch is
   gone, don't force it — just report the discrepancy.
3. **Re-establish context.** Read the body's "Where it left off / next steps", "Key
   commands", and "Files touched" sections. Skim the named files if useful.
4. **Brief Jack**: a tight recap — what this work was, current state, and the concrete next
   step(s) from the save — then ask whether to proceed with step 1 of "next steps" or do
   something else. Set the tab title to `🔍 resumed · <slug>`.
5. Leave the save in `active/`. It gets closed by `/close-later`, or automatically when its
   PR merges (the merge hook). Do **not** create a new save here.
