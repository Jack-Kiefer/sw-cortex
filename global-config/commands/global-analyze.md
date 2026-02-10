# Command: global-analyze

Deep research using agent teams (swarms).

---

description: Research using agent teams - parallel teammates with shared task list.

---

# Research Request: $ARGUMENTS

## Model Strategy

- **Lead (you)**: Opus - for coordination and synthesis
- **Teammates**: Sonnet - for cost-efficient research

---

## Step 1: Create the Team

```
Create an agent team called "research-team" to investigate: $ARGUMENTS

Use Sonnet for all teammates.
```

---

## Step 2: Spawn Research Teammates

Spawn 5 teammates to research in parallel:

1. **slack-researcher**: Search Slack history for past discussions about this topic
2. **knowledge-researcher**: Search existing discoveries for institutional knowledge
3. **code-researcher**: Explore the codebase for relevant files and patterns
4. **web-researcher**: Search the web for best practices and industry patterns
5. **db-researcher**: Analyze database schemas if relevant

Each teammate should thoroughly investigate their area and report findings.

---

## Step 3: Wait and Synthesize

Wait for all teammates to complete. Use Shift+Up/Down to check on them.

Synthesize findings into:

1. What was discovered from each angle
2. Expert recommendation on what to build
3. Implementation steps
4. Risks and open questions

---

## Step 4: Save Discoveries

Save key insights using mcp**discoveries**add_discovery:

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

## Step 5: Offer Implementation

Ask: **"Ready to implement? Say 'implement' and I'll create a team to build this."**

---

## If User Says Implement

Create a new team for implementation:

```
Create an agent team called "impl-team" to implement: $ARGUMENTS

Use Sonnet for all teammates.
```

Spawn teammates based on work needed:

- **backend-dev**: Backend/API changes
- **frontend-dev**: Frontend/UI changes
- **db-dev**: Database migrations
- **test-dev**: Tests
- **docs-dev**: Documentation

Each works in their own area (no file conflicts), requires plan approval, reports when complete.

After implementation, verify: type checks, lint, tests pass.
