# Command: compact-global

Save a discovery summarizing what you did and the context, then stop.

---

## Instructions

**STOP all other work immediately.**

### Step 1: Save a Discovery

Call `mcp__discoveries__add_discovery` with:

```
{
  title: "Session: [brief 5-word description]",
  source: "manual",
  type: "insight",
  priority: 3,
  description: [Write a clear summary including]:

    ## What Was Done
    List what was accomplished this session. Be specific - files changed,
    features added, bugs fixed, decisions made.

    ## Context
    Background info needed to understand this work. Why it matters,
    related systems, constraints.

    ## Current State
    Where things stand now. What's working, what's not, what's partial.

    ## Next Steps
    What would need to happen next if resuming this work.

    ## Key Files
    Important files involved (paths).

  tags: ["session-summary"]
}
```

### Step 2: Confirm to User

```
## Session Saved

**Summary**: [one-line description]

**Discovery ID**: [id]

To find later: `mcp__discoveries__search_discoveries { query: "[keywords]" }`
```

### Step 3: Stop

Wait for new instructions.
