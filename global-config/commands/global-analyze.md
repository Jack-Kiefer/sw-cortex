# Command: analyze

Deep analysis of a task or feature request before implementation. Researches how others solve similar problems, explores the codebase, identifies complications, and produces a comprehensive implementation plan.

**THIS IS A READ-ONLY COMMAND. NO FILES ARE CREATED OR MODIFIED.**

## Usage

```
/analyze [task description or feature request]
```

## Examples

```
/analyze "integrate payment processing system"
/analyze "add real-time notifications to chat"
/analyze "implement inventory forecasting with demand prediction"
```

---

description: READ-ONLY analysis - researches patterns, explores codebase, identifies risks. Never modifies files.
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

---

## Phase 1: Parallel Research (Use Subagents)

Launch these research tasks **in parallel** using the Task tool:

### 1.1 External Pattern Research (subagent_type: general-purpose)

Search for how others have implemented similar functionality:
- Search GitHub for repositories solving similar problems
- Search Stack Overflow for common patterns and pitfalls
- Look for official documentation or best practices guides

### 1.2 Codebase Exploration (subagent_type: Explore, thoroughness: very thorough)

Analyze the existing codebase:
- Search for related existing functionality using Grep and Glob
- Identify files and systems that will be affected
- Understand current patterns, conventions, and architecture

### 1.3 Slack & Discoveries Search

Search for institutional knowledge:

**Slack Messages** (use `mcp__task-manager__search_slack_messages`):
- Search for past discussions about this topic
- Look for context on why things were built a certain way

**Discoveries** (use `mcp__task-manager__search_discoveries`):
- Search for any documented database insights related to this task
- Check for table-specific notes if database work is involved

### 1.4 Data Structure Analysis (if applicable)

If the task involves database operations:
- Use MCP database tools to LIST TABLES FIRST
- Then DESCRIBE relevant tables to understand schema
- Check `mcp__task-manager__get_table_notes` for existing documentation

## Phase 2: Synthesis & Analysis

After gathering research, analyze findings:
- Requirements Extraction
- Implementation Assessment
- Risk Identification
- Alternative Approaches (2-3 options with tradeoffs)

## Phase 3: Output (TEXT ONLY - NO FILES)

Present your analysis in this conversation:

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

### Implementation Plan
#### Recommended Approach
#### Step-by-Step Plan

### Risks & Considerations
### Questions for Clarification

### Ready to Implement?
Say "implement" or "go ahead" and I will begin.
```

**STOP HERE. Wait for user approval before any implementation.**
