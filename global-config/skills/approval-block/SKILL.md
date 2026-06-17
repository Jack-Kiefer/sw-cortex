---
name: approval-block
description: How to stop and ask Jack for approval — the final text of the turn must state exactly what is being approved (root cause, concrete diff/plan, scope). Use whenever ending a turn to await approval for a plan, implementation, merge, or any gated action.
disable-model-invocation: false
---

# The Approval Block

When a flow stops for Jack's approval, the **LAST text of the turn** must spell out
what he is approving. Jack returns to an idle tab and reads only the final message —
mid-turn analysis, status notes, and recaps don't reliably surface the plan.

## Format

> **What you're approving:** <1 line — root cause / what gets built> · <the concrete
> change: files + before/after diff or plan steps> · <scope: branch
> `feature|bugfix/<slug>`, tests, PR base>
>
> <the action question — e.g. "Approve and I'll implement this in a worktree (own
> branch + dev server + TDD).">

## Rules

- **The approval block is the LAST thing said — emit nothing after it.** No cleanup
  narration, no team-teardown status ("teammates went idle…", "the team won't delete…"),
  no "awaiting your go-ahead," no retries. Finish all teardown/verification BEFORE writing
  the block (silently — see the `research-team` skill). Jack returns to an idle tab and
  reads only the final message; anything after the block buries the very thing he's
  approving.
- **Never end on a bare "Awaiting your approval."** If a stray tool call was unavoidable
  after the block (a tab title, a teardown attempt that stalled), RESTATE the full block
  as the final message so the turn ends on it — don't follow it with a status line.
- Set the tab title to the "approve?" state (`🙋 approve? · <slug>`) before ending the
  turn — see the `tab-status` skill where the flow has one.
- Advisory asks ("what do I need to change?") get the diff or SQL **as text** inside
  the block — never applied until told to.
- Consumers: the `presenting-analysis` skill's closing gate, the analyze/implement flows'
  approval step, `/jira-start`, and any other flow that gates implementation on approval.
