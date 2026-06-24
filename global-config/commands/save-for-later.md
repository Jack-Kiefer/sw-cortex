---
description: Save a rich summary of THIS chat to a save-for-later file, then close the tab
---

# Command: save-for-later

Distill **this entire chat** — what it was for, what it actually did, where it left off —
into one save-for-later file, so you (or a future `/resume-later`) can pick it up cold days
later with full context. After saving, **close this terminal tab** (the save IS the
hand-off, the same way merging a PR closes a `/go` tab).

## Usage

```
/save-for-later                 # save this chat under an auto-derived title
/save-for-later <short note>    # save with a title/headline you supply
```

`$ARGUMENTS` (optional) is a short human title/headline for the save. If empty, derive a
2–5 word title from what this session worked on.

---

## What you (Claude) must do

### Step 1 — Resolve this session's context

Run the helper to capture the repo/branch/session-id/cwd of THIS session:

```bash
~/.claude/scripts/save-for-later.sh context
```

It prints `CWD=`, `REPO=`, `REPO_NAME=`, `BRANCH=`, `SESSION_ID=`, `DATE=`, `STAMP=`. Hold
these — they go in the frontmatter and are what `/resume-later` uses to relaunch in the
right repo on the right branch.

### Step 2 — Allocate the save file path

Pick a slug from the title (`$ARGUMENTS` if given, else your derived title) and get a
stamped path:

```bash
~/.claude/scripts/save-for-later.sh newpath "<slug>"
```

This prints an absolute path like
`~/.claude/save-for-later/active/2026-06-24-1042-forecast-zeros.md`. Write the save there.

### Step 3 — Write the save file (this is the heart of the command)

Write a file at that path with this exact shape. The frontmatter keys are load-bearing —
`/resume-later`, `/close-later`, the merge hook, and `/start-day` all parse them, so keep
the key names and the `key: value` format. Fill the body **richly** — this is the whole
point: a future session reads ONLY this file to get back up to speed.

```markdown
---
title: <short headline — the title you used for the slug>
repo: <REPO_NAME from Step 1>
repo_root: <REPO from Step 1>
branch: <BRANCH from Step 1>
cwd: <CWD from Step 1>
session_id: <SESSION_ID from Step 1>
pr: <PR number if this session opened one, e.g. 123 — else leave blank>
status: active
created: <DATE from Step 1>
updated: <DATE from Step 1>
next: <ONE-LINE next step — shows in /start-day and the resume picker>
---

# <title>

## Summary

<2–4 sentences: what this session was about and the current state. Written for cold-read —
assume the reader has zero memory of the chat.>

## What this session did

- <bullet per concrete thing accomplished — files changed, decisions made, commands run,
  bugs found/fixed, questions answered>
- ...

## Files touched

- `path/to/file` — <what changed and why>
- ... (or "none — research only")

## Where it left off / next steps

1. <the very next action to take, concretely>
2. <then…>

- <anything blocked and on what>

## Open questions / decisions pending

- <unresolved fork, thing waiting on Jack, assumption that needs confirming> (or "none")

## Key commands / context to re-establish

- <the build/test/run command, the DB/query, the URL, the worktree path — whatever a
  resumed session needs to get hands-on fast>

## Branch / PR state

- branch `<branch>` — <pushed? open PR #? merged? dirty working tree?>

## Transcript pointer

- session `<session_id>` · repo `<repo>` · started <DATE>
- (full transcript: `~/.claude/projects/<cwd-slug>/<session_id>.jsonl`)
```

Be generous and specific in the body — concrete file paths, exact commands, real numbers.
Re-running `/save-for-later` in a session that already has a save: **update the same file**
(find it via `~/.claude/scripts/save-for-later.sh list active` matching this `session_id`
or `branch`), bump `updated:` and refresh the body — don't create a duplicate.

### Step 4 — Confirm, then close this tab

1. Print a 2–3 line confirmation: the title saved, the file path, and the one-line `next`.
2. Set the tab to done: `~/.claude/scripts/set-tab-title.sh "✅ saved · <slug>"`.
3. **Close this tab** — the save is the hand-off:

   ```bash
   ~/.claude/scripts/close-own-tab.sh
   ```

   (Same mechanism the post-merge teardown uses; the tab disappears shortly. If it can't
   resolve the tty it leaves the tab open and says so — that's fine.)

> Note: closing the tab ends the session. Make sure the save file is fully written
> (Step 3 done) **before** calling `close-own-tab.sh` — once the tab closes you can't add
> to it. If you're unsure the save captured enough, say so and skip the close.
