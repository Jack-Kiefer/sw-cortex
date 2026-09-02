---
description: Rebuild the Herdr tabs lost in a crash, each resumed onto its original conversation
---

# Command: restore-sessions

Bring back the Claude sessions that were open when the machine crashed (or when Herdr's
server died). Each lost tab comes back as a Herdr tab in the right repo, running
`claude --resume <id>` on its **original conversation** — full history, not a fresh start.

Run this **from the hub** (sw-cortex), same place you run `/go`.

## Usage

```
/restore-sessions              # restore everything from the last 24h (max 12 tabs)
/restore-sessions --dry-run    # show what WOULD come back; create nothing
/restore-sessions --max 5      # only the 5 most recent
/restore-sessions --since 48   # widen the window to 48 hours
```

## What to do

Run the script and report what came back:

```bash
bash ~/.claude/scripts/restore-crashed-sessions.sh [args]
```

Then **verify the sessions actually resumed** — a created tab is not a resumed session.
Wait ~10s and check that each pane has a live agent:

```bash
herdr agent list | jq -r '.result.agents[] | "\(.pane_id)  \(.agent_status)  \(.terminal_title_stripped)"'
```

Report the count restored and any that failed. If a session's title re-writes itself from
its restored context (e.g. a stale "🧪 running tests" becomes "🔨 Deploy held on <bug>"),
that's the strongest confirmation the history really loaded.

## Why this works

Nothing about it is specific to any one crash:

- **Herdr** persists its layout to `~/.config/herdr/session.json` — tab titles and cwds
  survive the server dying, because the file is written as you work.
- **Claude** stores every conversation as a `.jsonl` under `~/.claude/projects/<slug>/`,
  which is what `--resume` reads. A crash never loses conversation history.
- **The tab-title log** (`~/.claude/tab-titles/<session-id>.log`) ties the two together:
  its lines are the same `--did` trail the tab was showing, so a log's mtime tells you the
  session was live, and its filename gives you the session id to resume.

The script walks those logs newest-first, resolves each to its project dir, and reopens it.
Sessions already live in Herdr are skipped, so it is **safe to re-run** — it won't
double-open anything.

## Gotchas

- **Worktree sessions** resume into their worktree, not the repo root. Check the real path
  with `git worktree list` — the on-disk directory often uses a **hyphen** where the branch
  uses a slash (`jack-WW-2898-...` for branch `jack/WW-2898-...`), so an `ls` on the branch
  name wrongly reports it missing. If the worktree truly was removed, the session is skipped;
  the conversation is still on disk and resumable by hand with `claude --resume <id>`.
- **Untitled tabs** (a plain shell that never ran a named task) have no tab-title log, so
  they aren't restored — there's no conversation behind them to bring back.
- **Restoring many tabs at once costs RAM**, and each session spawns its own MCP servers.
  Restoring 9 sessions meant ~300 node processes. If the crash was memory-related, bring back
  the handful you're actually working (`--max 4`) rather than all of them, and see the
  "Machine memory" section of CLAUDE.md before anyone starts a typecheck.
