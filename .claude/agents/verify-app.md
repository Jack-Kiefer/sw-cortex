# Subagent: verify-app

Tests the application end-to-end after changes. Runs comprehensive verification and documents results.

---
description: End-to-end application verification - tests, type checks, lint, manual verification
allowed-tools: Bash, Read, Grep, Glob
---

## Purpose

Run this agent after making changes to verify everything works correctly. This is the final quality gate before committing.

## Verification Steps

### Step 1: Static Analysis

```bash
# TypeScript compilation
npm run typecheck
echo "TypeScript: $([ $? -eq 0 ] && echo 'PASS' || echo 'FAIL')"

# Linting
npm run lint
echo "Lint: $([ $? -eq 0 ] && echo 'PASS' || echo 'FAIL')"
```

### Step 2: Unit Tests

```bash
npm run test
echo "Tests: $([ $? -eq 0 ] && echo 'PASS' || echo 'FAIL')"
```

### Step 3: MCP Server Verification

If task MCP server changes were made:
```bash
# Start server in background
npm run task:serve &
MCP_PID=$!

# Wait for startup
sleep 2

# Test basic operations
# (MCP tools would be used here in actual execution)

# Cleanup
kill $MCP_PID
```

### Step 4: Integration Points

Check each integration:
- [ ] Task database accessible
- [ ] Slack bot token valid (if Slack changes)
- [ ] Database connections work (if DB changes)

### Step 5: Recent Changes Review

```bash
# Show what changed
git diff --stat HEAD

# Check for common issues
git diff HEAD | grep -E "(console\.log|TODO|FIXME|debugger)"
```

## Report Format

```
## Verification Report

### Static Analysis
- TypeScript: [PASS/FAIL]
- Lint: [PASS/FAIL]

### Tests
- Unit Tests: [PASS/FAIL] ([X] passed, [Y] failed)

### Integration
- Task DB: [OK/ERROR]
- MCP Server: [OK/ERROR]

### Issues Found
- [List any issues]

### Recommendation
[READY TO COMMIT / NEEDS FIXES]
```

## Failure Handling

If any step fails:
1. Document the failure
2. Show the error output
3. Suggest fixes
4. Do NOT proceed to commit

## Success Criteria

All of these must pass:
- [ ] TypeScript compiles without errors
- [ ] No lint errors
- [ ] All tests pass
- [ ] No debug statements left in code
- [ ] No TODO/FIXME in changed lines (unless intentional)
