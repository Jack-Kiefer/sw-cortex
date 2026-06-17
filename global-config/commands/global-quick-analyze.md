# Command: quick-analyze

Quick assessment of a task without deep external research. Use for smaller changes where codebase context is sufficient.

## Usage

```
/quick-analyze [task description]
```

---

description: Quick codebase-focused analysis for smaller tasks
allowed-tools: Task, Grep, Glob, Read, Bash, mcp

---

# Quick Analysis: $ARGUMENTS

Think about this task and provide a focused assessment. **DO NOT make any code changes.**

## Step 0: Options-first intake (ALWAYS, before assessing)

**Don't make Jack type an open-ended task.** Before the scan, use the **`AskUserQuestion`** tool to turn `$ARGUMENTS` into a few pickable options — even when he wrote a full sentence. A quick Explore/KB glance first keeps the options concrete.

Ask 1–2 questions covering **SCOPE** (the specific area/page/file/table) and **APPROACH** (distinct candidate angles). First option is your recommended one, suffixed " (Recommended)"; options must be specific to THIS task, not boilerplate; "Other" is the free-text escape hatch. Skip only if the task is already fully specified and single-approach — but default to asking. Fold the picks into `$ARGUMENTS`.

## Quick Assessment Process

### 1. Codebase Scan (use Explore subagent, thoroughness: medium)

- Find related files and existing patterns
- Identify integration points
- Note conventions to follow

### 2. If Database Involved

- List relevant tables using MCP tools
- Check schema constraints

### 3. Rapid Assessment Output

```
## QUICK ANALYSIS: [Task]

### Affected Areas
- Files: [list]
- Dependencies: [list]

### Implementation Approach
[2-3 sentence description]

### Key Steps
1. [step]
2. [step]
3. [step]

### Watch Out For
- [potential issue]

### Questions
- [if any clarification needed]
```

**No document saved** - this is for quick reference only.
