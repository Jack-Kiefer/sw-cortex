# Command: research

Research-only investigation using an agent team (swarm). Investigate deeply, synthesize, and **report** — no implementation, no PR, no "ready to build?" gate. Use this to answer a question or understand a system; use SERP's `/serp-analyze` or SWAC's `/swac-analyze` when you want research that flows into a build.

## Usage

```
/research [question or topic]
```

`/research` differs from the research→build commands (`/serp-analyze`, `/swac-analyze`) in one way: it **stops at the report.** There is no `approval-block`, no implementation handoff, no "Say implement." It answers and ends.

---

description: Research-only swarm — parallel teammates with a shared task list; reports findings and stops.
allowed-tools: Task, Grep, Glob, Read, Bash, mcp

---

# Research Request: $ARGUMENTS

## Step 0: Options-first intake (ALWAYS, before spawning the team)

**Invoke the `options-first-intake` skill** and follow it (the AskUserQuestion mechanics + the 5 shared rules + fold-picks into `$ARGUMENTS`). The second axis here is **APPROACH** — distinct candidate angles to investigate as separate options, alongside SCOPE (the real area/page/system/table/file). Do the cheap recon first (a KB search, a glance at the relevant code/tables) so the options are concrete. If run in a SWAC session, lean the recon on the `wishdesk-analyze-extras` skill's subsystem map.

## Model Strategy

- **Lead (you)**: Opus — for coordination and synthesis.
- **Teammates**: cost-efficient models per the `research-team` skill's roster table (haiku for fast MCP-bound researchers, sonnet for web/codebase). The skill owns the per-role model choice — follow it rather than forcing one model.

---

## Step 1: Run the research swarm

**Invoke the `research-team` skill** and follow it — it is the single source of truth for the swarm: parallelize across a team by default (≥2, cap 4), choose the roster from what THIS task needs (codebase-researcher always, +context/db/web as the task warrants — never a fixed set), time-box every researcher, poll via `TaskList`/`TaskGet`, and `TaskStop` any that overruns. Don't hand-roll a fixed roster here.

**In a SWAC session, also invoke the `wishdesk-analyze-extras` skill** alongside it — it supplies WishDesk's tools (`mcp-db-tool`/`mcp-db-tool-live`, not the hub's generic `mcp__db`), the env tiers, and the desk/proposal/sleeve subsystem map the researchers should use. (Run from the hub with no SWAC-specific target? The generic core's `mcp__db`/`mcp__knowledge`/`mcp__slack-search` tools are correct.)

## Step 2: Synthesize Progressively

Integrate findings as each researcher reports; start drafting after 2–3 core reports (the `research-team` skill governs the poll/stop loop and the "found it early → shut down silently" rule). Combine into: what was discovered per angle → the answer → open questions / things to watch.

- **Run cheap verifications yourself** — but only facts that change the answer (a precision check, an enum value): one SQL query, one grep, one read. Never a new teammate or a new research round.
- **Compress, never re-paste.** Teammate reports are raw material — the report carries only distilled conclusions and the file:line map. Never relay a researcher's table verbatim.

---

## Step 3: Save Key Insights

If the research surfaced durable SugarWish ground truth (a gotcha, ownership fact,
schema quirk), add it to `sw-cortex/DICTIONARY.md` — the knowledge MCP indexes it
automatically. Skip this for task-specific findings.

---

## Step 4: Shut Down Team & Present the Report

**Invoke the `presenting-analysis` skill** and follow it — it owns the capped report template and the say-it-once output discipline. Shut the team down **before** presenting (the `research-team` skill's silent-teardown rule — `TaskStop` each member, then `TeamDelete`; never narrate it).

**Two `/research`-specific riders:**

- **SKIP the closing `approval-block` gate.** This command does not lead to a build, so there is no "Ready to implement?" question. End on the findings/answer itself.
- **Drop "Plan" and "Implementation Map" from the template** unless the question was explicitly about _how to build_ something. A pure research report is: **what was discovered per angle → the answer → risks / open questions / what to watch.** No build steps.

If the research surfaced fixable issues and Jack later wants them built, that's a separate `/go`/`/launch` → `/implement` step — `/research` never implements.
