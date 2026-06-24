---
description: List saved-for-later chats and relaunch one as a real session in its repo
---

# Command: resume-later

Pick up a previously `/save-for-later`'d chat. Lists your active saves; when you choose one
it **launches a real Claude Code session in that save's repo** (a new VS Code terminal tab,
that repo's full tooling), seeded to read the save file, get back on the right branch, and
continue where you left off.

Run this **from the hub** (sw-cortex) — same place you run `/go`.

## Usage

```
/resume-later                 # list active saves, ask which to resume
/resume-later <n>             # resume the nth save from the list
/resume-later <text>          # resume the save whose title/branch best matches <text>
```

`$ARGUMENTS` (optional): a number from the list, or text to match a save.

---

## What you (Claude) must do

### Step 1 — List the active saves

```bash
~/.claude/scripts/save-for-later.sh list active
```

Each line is TSV: `file<TAB>title<TAB>repo<TAB>branch<TAB>pr<TAB>updated<TAB>nextstep`.
If there are **none**, say "No saved-for-later chats." and stop.

### Step 2 — Pick one

- **No `$ARGUMENTS`:** render the list as a clean numbered table — `#`, title, repo,
  branch, age (from `updated`), and the one-line next step — then ask which to resume (or
  use `AskUserQuestion` with one option per save if there are ≤4). Stop and wait for the
  pick; do **not** auto-launch.
- **`$ARGUMENTS` is a number:** take that row.
- **`$ARGUMENTS` is text:** match it against title/branch; if ambiguous, show the matches
  and ask.

### Step 3 — Launch a real session in the save's repo

Read the chosen save file to get its `repo_root` and `branch`, then launch a session there
seeded with the loader command so the new session reads the save and continues:

```bash
~/.claude/scripts/launch-repo-session.sh <repo_root> "/resume-later-load <absolute-path-to-save-file>"
```

- Pass ONLY the repo root + the prompt — no `--label`, no inline `set-tab-title.sh`/`claude`
  (same contract as `/go`). The Go Launcher extension opens the tab and names it from the
  prompt; the resumed session drives the title from there.
- The prompt is `/resume-later-load <file>` — a tiny loader command (its own synced global
  command, `resume-later-load.md`, so it resolves in the launched SERP/SWAC/sw-cortex
  session) that the new session runs first thing: it reads the save, checks out the branch,
  summarizes where things stand, and asks what to do next.

### Step 4 — Report

One line: which save you're resuming and where, e.g.
"Resuming **forecast zeros on live-products** → opening a SERP session on branch
`jack/forecast-zeros`." A new tab opens automatically; tell Jack to switch to it. This hub
session stays put.

---

The loader the launched session runs first thing — `/resume-later-load <file>` — is its own
synced global command (`resume-later-load.md`): it reads the save, checks out the branch,
re-establishes context, and briefs Jack. See that command for its steps.
