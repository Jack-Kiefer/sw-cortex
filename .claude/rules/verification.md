# Verification Patterns

## Core Principle
Every significant change MUST have a verification step. This 2-3x the quality of results.

## Before Making Changes
1. Read related files first
2. Understand existing patterns
3. Check for tests that cover the area
4. Use Plan mode for complex changes

## After Making Changes

### Code Changes
- Run `npm run typecheck` - ensure no type errors
- Run `npm run lint` - ensure no lint errors
- Run `npm run test` - ensure tests pass
- Use `verify-app` subagent for end-to-end verification

### Database Schema Changes
- Run `npm run task:migrate` for local SQLite
- Test queries manually before committing
- Document schema changes in migration files

### MCP Server Changes
- Test with `/mcp` command to verify server status
- Run sample queries to verify functionality
- Check logs for errors

## Verification Commands

```bash
# Quick verification
npm run typecheck && npm run lint

# Full verification
npm run typecheck && npm run lint && npm run test

# Task system verification
npm run task:serve  # In one terminal
# Then test with MCP tools
```

## Common Verification Failures

| Failure | Fix |
|---------|-----|
| Type error | Check imports, add explicit types |
| Lint error | Run `npm run lint:fix` |
| Test failure | Read test output, fix logic |
| MCP not responding | Check server logs, restart |

## Definition of Done
- [ ] TypeScript compiles without errors
- [ ] Lint passes
- [ ] Tests pass
- [ ] Manual verification completed
- [ ] Changes committed with conventional commit message
