# Command: global-analyze

Deep research using agent teams (swarms).

---

description: Research using agent teams - parallel teammates with shared task list.

---

# Research Request: $ARGUMENTS

## Step 0: Options-first intake (ALWAYS, before spawning the team)

**Invoke the `options-first-intake` skill** and follow it (the AskUserQuestion mechanics + the 5 shared rules + fold-picks into `$ARGUMENTS`). The second axis here is **APPROACH** — distinct candidate angles/fixes as separate options, alongside SCOPE (the real area/page/system/table/file). Do the cheap recon first (a KB search, a glance at the relevant code/tables) so the options are concrete. If run in a SWAC session, the recon + scoping should lean on the `wishdesk-analyze-extras` skill's subsystem map.

## Model Strategy

- **Lead (you)**: Opus — for coordination and synthesis.
- **Teammates**: cost-efficient models per the `research-team` skill's roster table (haiku for fast MCP-bound researchers, sonnet for web/codebase). The skill owns the per-role model choice — follow it rather than forcing one model.

---

## Step 1: Run the research swarm

**Invoke the `research-team` skill** and follow it — it is the single source of truth for the swarm: parallelize across a team by default (≥2, cap 4), choose the roster from what THIS task needs (codebase-researcher always, +context/db/web as the task warrants — never a fixed set), time-box every researcher, poll via `TaskList`/`TaskGet`, and `TaskStop` any that overruns. Don't hand-roll a fixed roster here.

**In a SWAC session, also invoke the `wishdesk-analyze-extras` skill** alongside it — it supplies WishDesk's tools (`mcp-db-tool`/`mcp-db-tool-live`, not the hub's generic `mcp__db`), the env tiers, and the desk/proposal/sleeve subsystem map the researchers should use. (Run from the hub with no SWAC-specific target? The generic core's `mcp__db`/`mcp__knowledge`/`mcp__slack-search` tools are correct.)

## Step 3: Synthesize Progressively

Integrate findings as each researcher reports; start drafting after 2–3 core reports (the `research-team` skill governs the poll/stop loop and the "found it early → shut down silently" rule). Combine into: what was discovered per angle → recommendation → implementation steps → risks/open questions.

---

## Step 4: Save Key Insights

If the research surfaced durable SugarWish ground truth (a gotcha, ownership fact,
schema quirk), add it to `sw-cortex/DICTIONARY.md` — the knowledge MCP indexes it
automatically. Skip this for task-specific findings.

---

## Step 5: Shut Down Team & Present Results

**Invoke the `presenting-analysis` skill** and follow it — it owns the capped "Analysis Complete" template (Findings · Recommendation · Plan · Implementation Map · Risks), the say-it-once output discipline, and the closing `approval-block` gate (the LAST text of the turn, then STOP). Shut the team down **before** presenting (the `research-team` skill's silent-teardown rule — `TaskStop` each member, then `TeamDelete`; never narrate it).

Close on the `approval-block`, not a bare "Say implement" line — state what's being approved and end on `Ready to implement? Say "implement" and I'll build this.` as the action question.

---

## If User Says Implement

Create a new team for implementation:

```
Create an agent team called "impl-team" to implement: $ARGUMENTS

Use Sonnet for all teammates (model: "sonnet").
```

Spawn teammates based on work needed (only the roles that are actually required):

- **backend-dev**: Backend/API changes
- **frontend-dev**: Frontend/UI changes
- **db-dev**: Database migrations
- **test-dev**: Tests

Each teammate should:

- Work in their own area (no file conflicts)
- Use `model: "sonnet"` explicitly
- Report completion via message to the lead
- If their area has no work needed, report that quickly and stop

Apply the same progressive synthesis pattern: don't wait indefinitely for all teammates. Start reviewing and integrating work as it comes in.

After implementation, verify: type checks, lint, tests pass.
