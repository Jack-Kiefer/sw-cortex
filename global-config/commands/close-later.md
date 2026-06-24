---
description: Mark a saved-for-later chat done (active -> closed), with a closing note
---

# Command: close-later

Retire a saved-for-later entry: move it from `active/` to `closed/` and stamp a closing
note. Use this when the work a save was tracking is **finished** (and there was no PR merge
to auto-close it — merging a PR closes the matching save automatically via the merge hook).

Usually run this **inside a resumed save session** (it closes that session's own save), but
it also works from the hub against any save.

## Usage

```
/close-later                  # close the save tied to THIS session (by branch/session_id)
/close-later <n>              # close the nth active save from the list
/close-later <text>           # close the save whose title/branch best matches <text>
/close-later <n> <note>       # close it with an explicit closing note
```

`$ARGUMENTS` (optional): a number / matching text, optionally followed by a closing note.

---

## What you (Claude) must do

### Step 1 — Identify which save to close

- **No selector given:** resolve THIS session's branch and match it to an active save:

  ```bash
  ctx=$(~/.claude/scripts/save-for-later.sh context)   # gives BRANCH=, REPO_NAME=, SESSION_ID=
  ~/.claude/scripts/save-for-later.sh find-by-branch "<BRANCH from ctx>"
  ```

  If that finds exactly one save, use it. If it finds none, fall back to listing
  (`save-for-later.sh list active`) and ask which one.

- **Number / text selector:** list with `~/.claude/scripts/save-for-later.sh list active`
  and pick by index or best title/branch match. If ambiguous, show matches and ask — don't
  guess.

If there are no active saves at all, say so and stop.

### Step 2 — Compose a closing note

Write 1–3 sentences: what got finished, the outcome (PR #, merged?, decision reached), and
anything worth knowing if it's ever reopened. If Jack supplied a note in `$ARGUMENTS`, use
that (you may enrich it). This becomes a `## Closed (<date>)` section appended to the file.

### Step 3 — Close it

```bash
~/.claude/scripts/save-for-later.sh close "<absolute-path-to-save-file>" "<closing note>"
```

This moves the file to `closed/`, sets `status: closed`, stamps `closed:` + `updated:` to
today, and appends the note. It prints the new path under `closed/`.

### Step 4 — Confirm

One line: which save you closed and where it moved, e.g.
"Closed **forecast zeros on live-products** → `~/.claude/save-for-later/closed/2026-06-24-1042-forecast-zeros.md`."

Do **not** close the terminal tab here (that's `/save-for-later`'s job, and PR-merge
teardown handles its own tab). `/close-later` only retires the save record.
