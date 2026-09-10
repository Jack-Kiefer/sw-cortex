---
description: Mark this tab BLOCKED — waiting on something outside the session (keeps the tab, stops the nagging)
---

> **Effort:** mechanical — run this at **low reasoning effort**. It is one scripted Bash call plus one line of output.

Mark this session's tab as **blocked and parked**: it is waiting on something Jack (or someone/something else) has to do, and it should sit there quietly saying so until that changes. This is the "I can keep this tab around without it bugging me" state.

`$ARGUMENTS` is **what you're waiting on** (e.g. `Munyr to merge the infra PR`, `the nightly darklaunch run`, `Anna's answer on the sleeve rule`).

## What to run

If the argument is `--clear`, hand the tab back to its normal status by setting whatever the session is actually doing now (or `~/.claude/scripts/set-tab-title.sh --clear` for full automatic titles).

Otherwise run exactly:

```bash
~/.claude/scripts/set-tab-title.sh "⛔ Blocked waiting on $ARGUMENTS"
```

If `$ARGUMENTS` is empty, ask Jack what it's waiting on in one line rather than setting a bare `⛔ Blocked` — the whole point of this state is that the tab says *what* it's waiting on.

## Then STOP

After setting the title, **end the turn.** Say one short line — e.g. "⛔ Parked — blocked waiting on Munyr to merge the infra PR." Do not keep working, do not start adjacent tasks, do not poll for the thing you're blocked on. The tab is a parking spot; Jack comes back to it when the blocker clears.

## How ⛔ behaves (why it doesn't nag)

⛔ is a **sticky, quiet** state — unlike the other statuses:

- **It survives a reply.** The `UserPromptSubmit` hook auto-demotes a resting 🙋/❓/✅ tab to 🔨 the moment Jack types into it, but ⛔ is **exempt** — a blocked tab stays blocked even if Jack pokes it, because a message isn't the same as the blocker clearing. Clear it deliberately: set the next real status (🔨/🧪/…) when work actually resumes, or `/blocked --clear`.
- **Live tool activity won't overwrite it.** The `--activity` PostToolUse hook forces a working tab's emoji to 🔨/🧪 so a busy tab can never show a checkmark; ⛔ is **exempt** there too, so an incidental tool call doesn't silently un-park the tab. (The transient `· <activity>` suffix and the `— <did trail>` still ride along as usual.)
- **It is not ❓.** ❓ is owned by the `Notification` hook — a live Claude Code popup needing an answer *right now*. ⛔ means "parked, waiting on someone else, no popup, nothing needed from you this second."

So the tab reads plainly as `⛔ Blocked waiting on <thing>` and just sits there.

Relay the script's one-line output. Mechanism docs: `~/.claude/scripts/TAB_TITLES.md`.
