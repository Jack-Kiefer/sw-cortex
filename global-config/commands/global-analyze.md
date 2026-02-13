# Command: global-analyze

Deep research using agent teams (swarms).

---

description: Research using agent teams - parallel teammates with shared task list.

---

# Research Request: $ARGUMENTS

## Model Strategy

- **Lead (you)**: Opus - for coordination and synthesis
- **Teammates**: Sonnet - for cost-efficient research (ALWAYS specify `model: "sonnet"`)

---

## Step 1: Create the Team

```
Create an agent team called "research-team" to investigate: $ARGUMENTS
```

---

## Step 2: Create Tasks & Spawn Teammates

Create focused tasks in the task list, then spawn teammates to work on them.

### Core Teammates (always spawn)

#### 1. codebase-researcher

```
Spawn with: model: "sonnet", subagent_type: "general-purpose"
```

**Scope**: Explore the codebase for files, patterns, and architecture relevant to: $ARGUMENTS

- Use Glob, Grep, and Read to find related code
- Identify existing patterns and conventions to follow
- Map affected files and integration points
- Find similar implementations that could serve as templates

**Constraints**: Stay focused on the codebase. Do not search the web or databases. Report your findings within a reasonable scope — don't exhaustively explore every tangentially related file. If you find the core relevant files and patterns, that's enough.

**When done**: Send your findings to the lead as a message. If you find nothing relevant, report that quickly — don't keep searching.

#### 2. context-researcher

```
Spawn with: model: "sonnet", subagent_type: "general-purpose"
```

**Scope**: Search Slack messages AND existing discoveries for institutional knowledge about: $ARGUMENTS

- Use `mcp__slack-search__search_slack_messages` to find past discussions (try 2-3 query variations)
- Use `mcp__discoveries__search_discoveries` to find documented knowledge
- Use `mcp__discoveries__get_table_notes` if database tables are involved
- Look for historical context, past decisions, stakeholders

**Constraints**: These are fast MCP calls — run your searches, summarize what you find, and report. Don't over-analyze results. If searches return nothing relevant, report "no relevant Slack/discovery results" and stop.

**When done**: Send your findings to the lead as a message.

#### 3. web-researcher

```
Spawn with: model: "sonnet", subagent_type: "general-purpose"
```

**Scope**: Search the web for best practices, patterns, and external solutions related to: $ARGUMENTS

- Use WebSearch for 2-4 targeted queries
- Use WebFetch on the most promising results
- Look for established patterns, libraries, and approaches
- Focus on practical implementation guidance, not theory

**Constraints**: Limit to 2-4 web searches and 2-3 page fetches. Summarize key findings concisely. Don't go down rabbit holes.

**When done**: Send your findings to the lead as a message.

### Optional Teammate (spawn only if task involves database work)

#### 4. db-researcher

```
Spawn with: model: "sonnet", subagent_type: "general-purpose"
```

**Only spawn this teammate if "$ARGUMENTS" clearly involves database schemas, data migration, queries, or data modeling.**

**Scope**: Analyze database schemas relevant to: $ARGUMENTS

- Use `mcp__db__list_tables` and `mcp__db__describe_table` to explore schemas
- Document relevant table structures, relationships, and field meanings
- Save any new discoveries with `mcp__discoveries__add_discovery`

**Constraints**: Focus on the specific tables relevant to the task. Don't explore the entire database. If you identify the key tables and relationships quickly, report and stop.

**When done**: Send your findings to the lead as a message.

---

## Step 3: Synthesize Progressively

**DO NOT wait indefinitely for all teammates.**

Follow this protocol:

1. **As each teammate reports in**, acknowledge their findings and start integrating them into your analysis
2. **After 2-3 teammates have reported**, begin drafting your synthesis — don't wait for stragglers
3. **If all core teammates have reported**, proceed to the final output even if the optional db-researcher hasn't finished
4. **If a teammate goes idle without reporting**, send them ONE follow-up message asking for their status. If they still don't respond, proceed without them and note the gap.

### Synthesis Structure

Combine all findings into:

1. **What was discovered** from each research angle
2. **Expert recommendation** on what to build and how
3. **Implementation steps** (concrete, actionable)
4. **Risks and open questions**

---

## Step 4: Save Discoveries

Save key insights using `mcp__discoveries__add_discovery`:

```
mcp__discoveries__add_discovery({
  title: "Brief title",
  source: "exploration",
  description: "What was learned",
  type: "fact|relationship|pattern|insight",
  tags: ["relevant", "tags"],
  priority: 2
})
```

---

## Step 5: Shut Down Team & Present Results

1. Send shutdown requests to all teammates
2. After teammates confirm shutdown, delete the team with TeamDelete
3. Present your final analysis to the user

### Output Format

```
## Analysis Complete: [Task Summary]

### Research Findings

**Codebase**: [key files, patterns, architecture insights]

**Institutional Knowledge**: [Slack discussions, existing discoveries]

**External Patterns**: [best practices, libraries, approaches from the web]

**Data Considerations**: [schema impacts, if any — or "N/A"]

### Recommendation

[Your expert synthesis — what to build and the recommended approach]

### Implementation Plan

1. [Step 1]
2. [Step 2]
...

### Risks & Open Questions

- [Risk/question 1]
- [Risk/question 2]

### Ready to implement?

Say "implement" and I'll create a team to build this.
```

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
