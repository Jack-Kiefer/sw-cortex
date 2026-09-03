# Claude Code Settings Configuration

## Settings File Hierarchy

| File                          | Scope      | Purpose                            |
| ----------------------------- | ---------- | ---------------------------------- |
| `~/.claude/settings.json`     | User-level | Global defaults for all projects   |
| `.claude/settings.json`       | Project    | Project-specific, committed to git |
| `.claude/settings.local.json` | Local      | Personal overrides, gitignored     |

Settings merge in order: user → project → local (local wins).

## MCP Tool Permissions

**IMPORTANT**: MCP permissions do NOT support wildcards.

```json
// CORRECT - approves ALL tools from the server
"mcp__task-manager"
"mcp__db"
"mcp__github"

// WRONG - wildcards don't work for MCP
"mcp__task-manager__*"
"mcp__*"
```

To approve all tools from an MCP server, use just the server name: `mcp__server-name`

## Bash Command Permissions

Bash permissions DO support wildcards with `:*` suffix:

```json
// Wildcard patterns (recommended)
"Bash(npm:*)"        // All npm commands
"Bash(git:*)"        // All git commands
"Bash(python:*)"     // All python commands

// Specific commands
"Bash(pwd)"          // Exact match only
"Bash(npm run test)" // Exact match only

// Prefix matching with :*
"Bash(npm run db:*)" // npm run db:status, npm run db:migrate, etc.
```

## Recommended Project Settings Structure

```json
{
  "hooks": {
    "PostToolUse": [...],
    "Stop": [...],
    "Notification": [...]
  },
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      // MCP servers (no wildcards)
      "mcp__task-manager",
      "mcp__db",
      "mcp__github",

      // Web tools
      "WebSearch",

      // Bash wildcards
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(git:*)",
      "Bash(python:*)"
    ],
    "deny": []
  },
  "enableAllProjectMcpServers": true
}
```

## Permission Modes

| Mode                | Behavior                                        |
| ------------------- | ----------------------------------------------- |
| `acceptEdits`       | Auto-approve file edits, prompt for other tools |
| `bypassPermissions` | Auto-approve everything (use with caution)      |

With proper `allow` list, `acceptEdits` is sufficient - no need for `bypassPermissions`.

## Local Settings (`.claude/settings.local.json`)

Keep minimal - only personal overrides:

```json
{
  "permissions": {
    "allow": [],
    "deny": [],
    "ask": []
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["db", "playwright", "jira-ticket"]
}
```

## Common Mistakes

| Mistake                             | Fix                                    |
| ----------------------------------- | -------------------------------------- |
| `mcp__server__*`                    | Use `mcp__server` (no `__*`)           |
| `Bash(npm run test*)`               | Use `Bash(npm run test:*)` (need `:*`) |
| Old schema `permissions.bash.allow` | Use new `permissions.allow` array      |
| `Read(**/.env*)` in deny            | Not supported, remove                  |
| `Read(secret.txt)` in deny          | Use the absolute path (see below)      |

## `Read()` deny rules must use ABSOLUTE paths

A bare-name or `./`-relative `Read()` deny pattern makes Claude Code prompt on **unrelated**
read-only Bash commands. The Bash permission checker treats `grep`/`cat`/`head` as reads and
matches their paths against the `Read()` deny list — but a relative path after a `cd` cannot be
statically resolved, so the checker can't prove it isn't the denied file and falls back to asking:

> `grep` on 'global-config/commands/go.md' after a `cd` would search a directory that cannot be
> determined here, and a `Read()` deny rule is configured; running it anyway.

Every `cd X && grep … relative/path` in the repo then costs an approval prompt. Deny the file by
its **absolute** path only:

```json
// GOOD - resolves unambiguously, no spurious prompts
"deny": ["Read(//Users/jackkief/Desktop/Projects/sw-cortex/secret.txt)"]

// BAD - shadows every unresolvable relative read path
"deny": ["Read(secret.txt)", "Read(./secret.txt)"]
```

(Bash calls should use absolute paths anyway, per `~/CLAUDE.md` — this rule removes the penalty
for the times they don't.)

## Debugging

Run `/doctor` in Claude Code to check for invalid settings files.

Settings accumulate from "Yes, don't ask again" prompts - periodically clean up cruft by condensing to wildcard patterns.
