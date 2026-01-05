# Command: analyze

Deep analysis of a task or feature request before implementation. Researches how others solve similar problems, explores the codebase, identifies complications, and produces a comprehensive implementation plan.

**THIS IS A READ-ONLY COMMAND. NO FILES ARE CREATED OR MODIFIED.**

## Usage
```
/project:analyze [task description or feature request]
```

## Examples
```
/project:analyze "integrate payment processing system"
/project:analyze "add real-time notifications to chat"
/project:analyze "implement inventory forecasting with demand prediction"
```

---
description: READ-ONLY analysis - researches patterns, explores codebase, identifies risks. Never modifies files.
allowed-tools: Task, WebSearch, WebFetch, Grep, Glob, Read, Bash(read-only)
---

# Analysis Request: $ARGUMENTS

## ⛔ CRITICAL CONSTRAINTS - READ THESE FIRST

**YOU ARE IN READ-ONLY ANALYSIS MODE.**

- ❌ DO NOT create any files
- ❌ DO NOT modify any files  
- ❌ DO NOT write any code
- ❌ DO NOT run any commands that change state
- ❌ DO NOT fix, implement, or resolve anything
- ❌ DO NOT use Write, Edit, or file creation tools
- ✅ ONLY read, search, and analyze
- ✅ ONLY output your findings as text in this conversation

**If you feel the urge to fix something - STOP. Write it in the plan instead.**

Bash commands allowed: `ls`, `cat`, `head`, `tail`, `find`, `grep`, `git status`, `git log`, `git diff`, `tree`
Bash commands FORBIDDEN: anything that writes, creates, deletes, or modifies

---

Think hard about this analysis task. You are conducting pre-implementation research to help make informed decisions.

## Phase 1: Parallel Research (Use Subagents)

Launch these research tasks **in parallel** using the Task tool:

### 1.1 External Pattern Research (subagent_type: general-purpose)
Search for how others have implemented similar functionality:
- Search GitHub for repositories solving similar problems
- Search Stack Overflow for common patterns and pitfalls  
- Look for official documentation or best practices guides
- Find blog posts or tutorials about this type of implementation
- Note any libraries, packages, or frameworks commonly used

Focus queries on: "$ARGUMENTS"

### 1.2 Codebase Exploration (subagent_type: Explore, thoroughness: very thorough)
Analyze the existing codebase:
- Search for related existing functionality using Grep and Glob
- Identify files and systems that will be affected
- Understand current patterns, conventions, and architecture
- Find similar implementations that could serve as templates
- Map dependencies and integration points

### 1.3 Data Structure Analysis (if applicable)
If the task involves database operations:
- Use MCP database tools to LIST TABLES FIRST
- Then DESCRIBE relevant tables to understand schema
- Document field names, relationships, and constraints
- Identify any migration requirements

## Phase 2: Synthesis & Analysis

After gathering research, analyze findings:

### 2.1 Requirements Extraction
- Core objective and success criteria
- Scope boundaries (what's in vs out)
- Dependencies and prerequisites
- User-facing vs system-level changes

### 2.2 Implementation Assessment
Based on research, determine:
- Which existing patterns from the codebase to follow
- Which external patterns/approaches are most applicable
- New components, endpoints, or files required
- Database/schema changes needed
- Third-party dependencies to consider

### 2.3 Risk Identification
- Technical challenges and limitations
- Potential breaking changes
- Performance implications
- Security considerations
- Edge cases to handle
- Integration complexity

### 2.4 Alternative Approaches
List 2-3 viable implementation approaches with tradeoffs:
- Approach A: [description] — Pros/Cons
- Approach B: [description] — Pros/Cons
- Recommended approach with justification

## Phase 3: Output (TEXT ONLY - NO FILES)

Present your analysis in this conversation. Do not create any files.

```
## 📋 ANALYSIS COMPLETE: [Task Summary]

### Requirements
- **Objective**: [core goal]
- **Success Criteria**: [measurable outcomes]
- **Scope**: [boundaries]

### Research Findings

#### External Patterns Discovered
- [Key patterns, libraries, or approaches found]
- [Links to relevant resources]

#### Codebase Insights  
- **Related Files**: [list of affected files/modules]
- **Existing Patterns**: [patterns to follow]
- **Integration Points**: [systems to connect with]

#### Data Considerations
- [Schema impacts, if any]

### Implementation Plan

#### Recommended Approach
[Description of recommended approach]

#### Step-by-Step Plan
1. [First step with details]
2. [Second step with details]
...

#### Alternative Approaches Considered
- [Brief description of alternatives and why not chosen]

### ⚠️ Risks & Considerations
- [Risk 1 with mitigation strategy]
- [Risk 2 with mitigation strategy]

### 📦 Dependencies
- [External libraries needed]
- [Internal dependencies]

### ⏱️ Complexity Estimate
- **Effort**: [Low/Medium/High]
- **Risk Level**: [Low/Medium/High]
- **Suggested approach**: [incremental steps if complex]

### ❓ Questions for Clarification
- [Any ambiguities that need human input]

### 📝 Ready to Implement?
When you're ready to proceed, say "implement" or "go ahead" and I will begin.
```

---

## ⛔ FINAL REMINDER

This analysis is complete when you have OUTPUT TEXT describing the plan.

**DO NOT:**
- Create a plan file
- Create any implementation files
- Make any code changes
- "Get started" on implementation
- Fix any issues you discovered

**STOP HERE. Wait for user approval before any implementation.**