# Command: global-analyze

Deep research for actionable tasks, feature requests, or questions requiring thorough investigation.

**THIS IS A READ-ONLY COMMAND. NO FILES ARE CREATED OR MODIFIED.**

## When to Use

- Feature requests or new functionality
- Complex tasks needing research before implementation
- Questions requiring deep investigation across codebase, Slack, databases
- Understanding how something works or should work
- Exploring options before making a decision

## Usage

```
/global-analyze [task, feature request, or question]
```

## Examples

```
/global-analyze "integrate payment processing system"
/global-analyze "how does the order fulfillment flow work"
/global-analyze "what's the best way to add inventory forecasting"
/global-analyze "why is the ecard system structured this way"
```

---

description: Deep research for tasks, features, or questions - explores codebase, Slack, databases, web. Read-only.
allowed-tools: Task, WebSearch, WebFetch, Grep, Glob, Read, Bash(read-only)

---

# Analysis Request: $ARGUMENTS

## CRITICAL CONSTRAINTS - READ THESE FIRST

**YOU ARE IN READ-ONLY ANALYSIS MODE.**

- DO NOT create any files
- DO NOT modify any files
- DO NOT write any code
- DO NOT run any commands that change state
- ONLY read, search, and analyze
- ONLY output your findings as text in this conversation

**MANDATORY: SAVE DISCOVERIES BEFORE PRESENTING OUTPUT**

You MUST call `mcp__discoveries__add_discovery` for each significant insight BEFORE showing your analysis to the user. This is not optional. Do not present output until discoveries are saved.

---

## Phase 1: Parallel Research (Launch ALL at once)

Launch these subagents **in parallel** using the Task tool in a single message.

**IMPORTANT: Each agent has LIMITS to prevent blocking. If an agent finds more to explore, it reports back and Phase 2 will continue the work.**

### 1.1 Slack Search (subagent_type: general-purpose, model: haiku)

```
Search Slack for discussions about: [topic]

TOOLS TO USE (call these directly as tools, NOT via Bash):
- mcp__slack-search__search_slack_messages - semantic search with query parameter
- mcp__slack-search__get_slack_context - get surrounding messages using channelId and timestamp from search results

LIMITS:
- Max 10 tool calls total
- Return results after limits reached

REPORT FORMAT:
1. What you found (summarize key messages/decisions)
2. If you hit limits and there's more: "MORE_TO_EXPLORE: [specific queries to try next]"
```

### 1.2 Discoveries Search (subagent_type: general-purpose, model: haiku)

```
Search existing discoveries for: [topic]

TOOLS TO USE (call these directly as tools, NOT via Bash):
- mcp__discoveries__search_discoveries - semantic search with query parameter
- mcp__discoveries__get_table_notes - get notes for specific database/table

LIMITS:
- Max 10 tool calls total
- Return results after limits reached

REPORT FORMAT:
1. Relevant discoveries found (summarize each)
2. Table notes found (summarize key insights)
3. If you hit limits: "MORE_TO_EXPLORE: [specific areas to search next]"
```

### 1.3 Codebase Exploration (subagent_type: general-purpose, model: haiku)

```
Find key files related to: [topic]

LIMITS:
- Max 10 tool calls total
- NO bash commands
- NO counting files
- NO exhaustive exploration

YOUR ONLY GOAL: Find the 3-5 most important files and summarize what they do.

REPORT FORMAT:
1. Key files (path + 1-line purpose) - MAX 5 FILES
2. Brief pattern summary (2-3 sentences)
3. "MORE_TO_EXPLORE: [specific files/dirs to look at next]" if there's more

Use Grep, Glob, Read only.
```

### 1.4 External Research (subagent_type: general-purpose, model: haiku)

```
Search externally for: [topic]

LIMITS:
- Max 10 tool calls total
- Get key info quickly, don't go deep

REPORT FORMAT:
1. Best practices found
2. Recommended libraries/patterns
3. Warnings/pitfalls
4. If you hit limits: "MORE_TO_EXPLORE: [specific topics needing deeper research]"

Use WebSearch, WebFetch
```

### 1.5 Database Analysis (subagent_type: general-purpose, model: haiku) - if applicable

```
Analyze database structures for: [topic]

TOOLS TO USE (call these directly as tools, NOT via Bash):
- mcp__db__list_tables - list tables in a database (pass database: "wishdesk|sugarwish|odoo|retool")
- mcp__db__describe_table - get table schema (pass database and table)
- mcp__db__query_database - run SELECT queries (pass database, query, and limit)

LIMITS:
- Max 10 tool calls total
- Focus on schema understanding, not data analysis
- Always include LIMIT in queries

REPORT FORMAT:
1. Tables involved (name + purpose)
2. Key relationships
3. Important columns
4. If you hit limits: "MORE_TO_EXPLORE: [specific tables/relationships to investigate]"
```

**Launch all relevant agents in ONE message for parallel execution.**

---

## Phase 2: Review & Fill Gaps

After Phase 1 agents return:

### 2.1 Collect "MORE_TO_EXPLORE" items

Look for any agent that reported "MORE_TO_EXPLORE: ..." and list those items.

### 2.2 Identify critical gaps

- What's essential but still unclear?
- What connections need verification?
- What would block implementation if unknown?

### 2.3 Launch follow-up agents (if needed)

For each gap or MORE_TO_EXPLORE item, spawn a **targeted** agent:

```
subagent_type: general-purpose, model: haiku

TASK: [specific follow-up from MORE_TO_EXPLORE or gap identified]

LIMITS:
- Max 10 tool calls total
- Return what you find, don't be exhaustive

REPORT: Findings + "MORE_TO_EXPLORE: ..." if still incomplete
```

**Launch follow-ups in parallel. Max 3 follow-up agents per round.**

### 2.4 Repeat if necessary

If follow-ups report more gaps, do ONE more round max. Then move to Phase 3 with what you have.

**Don't chase perfection. Get enough to make a recommendation.**

---

## Phase 3: Synthesis & Analysis

After all research is complete, analyze findings:

- Requirements Extraction
- Implementation Assessment
- Risk Identification
- Alternative Approaches (2-3 options with tradeoffs)

### Expert-Level Solution Design

**Think like a senior/staff engineer.** Don't just solve the immediate problem—consider:

1. **Beyond the Ask**: What would an expert developer actually build here? The user's request may be a symptom of a deeper need. Identify the underlying problem and propose the right solution, even if it differs from what was asked.

2. **Architecture & Scale**: How would this need to evolve? Design for the next 2-3 iterations, not just today's requirements. Consider extensibility without over-engineering.

3. **Production Concerns**: What would break at scale? What monitoring, error handling, and observability would a senior engineer add? What edge cases would they anticipate?

4. **Maintenance Burden**: Will this be a pain to maintain? An expert prioritizes simplicity and debuggability over cleverness. Flag solutions that create technical debt.

5. **Industry Patterns**: What do companies solving similar problems use? Reference real-world architectures, not just textbook patterns.

6. **Trade-off Transparency**: Every solution has costs. Be explicit about what you're trading off (complexity, performance, flexibility, time-to-implement).

**Challenge the obvious solution.** If the first approach that comes to mind is straightforward, ask: "Why wouldn't an expert do this?" There's often a reason.

## Phase 4 & 5: Save Discoveries + Output (in parallel)

Launch the discovery subagent **in the background** while you present output.

### Launch Discovery Logger (subagent_type: general-purpose, model: haiku, run_in_background: true)

```
Save discoveries from this research session.

CRITICAL: Call MCP tools DIRECTLY as tools. Do NOT run them as Bash commands.

FINDINGS TO LOG:
[Paste your key findings here - architecture, patterns, relationships, gotchas]

TOOLS TO USE (call directly, NOT via Bash):
- mcp__discoveries__search_discoveries - search with query parameter
- mcp__discoveries__add_discovery - add new discovery
- mcp__discoveries__update_discovery - update existing discovery by id
- mcp__discoveries__delete_discovery - delete discovery by id

STEP 1: SEARCH FOR EXISTING DISCOVERIES FIRST
Call the mcp__discoveries__search_discoveries tool with a query parameter to find existing discoveries on the topic.

STEP 2: UPDATE OR ADD
For each significant finding, call the appropriate tool:

- If existing discovery is outdated: call mcp__discoveries__update_discovery with id and updated fields
- If new knowledge: call mcp__discoveries__add_discovery with title, source, description, type, tags
- If discovery is wrong: call mcp__discoveries__delete_discovery, then add_discovery

Required fields for add_discovery:
- title: "Concise title"
- source: "exploration"
- description: "What was learned and why it matters"
- type: one of "fact", "relationship", "pattern", "insight", "anomaly"

Optional fields:
- sourceDatabase: "wishdesk", "sugarwish", "odoo", or "retool"
- tableName: specific table name
- tags: array of strings
- priority: 1-4 (4 is critical)

WHAT TO SAVE/UPDATE:
- Architecture and system design found
- How components integrate
- Codebase patterns and conventions
- Business logic and workflows
- Gotchas, edge cases, limitations
- External patterns/libraries worth remembering

LIMITS: Max 10 tool calls (searches + updates + adds combined)
```

**Immediately proceed to output while discoveries save in background.**

---

## Output (TEXT ONLY - NO FILES)

Present your analysis:

```
## ANALYSIS COMPLETE: [Task Summary]

### Requirements
- **Objective**: [core goal]
- **Success Criteria**: [measurable outcomes]

### Research Findings
#### External Patterns Discovered
#### Codebase Insights
#### Slack/Institutional Knowledge
#### Discoveries Found

### Expert Recommendation

#### What an Expert Would Actually Build
[Don't just answer the literal question—identify what the user really needs. If the ask is a symptom of a bigger problem, name it. Propose what a senior engineer would recommend, even if it differs from the original request.]

#### Why This Approach
[Justify with concrete reasoning: scalability, maintainability, team familiarity, production hardening. Reference industry patterns or prior art where relevant.]

#### What I'd Avoid (and Why)
[Name the obvious/simple solutions that seem tempting but have hidden costs. Be specific about the failure modes.]

#### Trade-offs to Accept
[Every solution has costs. Be explicit: what are you trading for what? Let the user make an informed choice.]

### Implementation Plan
#### Recommended Approach
#### Step-by-Step Plan

### Risks & Considerations
### Questions for Clarification

### Ready to Implement?
Say "implement" or "go ahead" and I will begin.
```

**STOP HERE. Wait for user approval before any implementation.**
