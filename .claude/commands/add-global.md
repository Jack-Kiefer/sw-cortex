# Command: add-global

Add a new global command or skill that will be available in all projects.

## Usage

```
/add-global command [name]    # Create a new global slash command
/add-global skill [name]      # Create a new global skill
/add-global sync push         # Merge local changes into ~/.claude
/add-global sync pull         # Merge ~/.claude changes into repo
/add-global sync status       # Show what's in repo vs global
```

## Examples

```
/add-global command my-helper
/add-global skill code-reviewer
/add-global sync push
```

## Notes

- **Sync merges, not overwrites** - Existing commands/skills/MCP servers in ~/.claude are preserved
- MCP servers from both sources are combined
- Settings permissions are merged and deduplicated
- Only CLAUDE.md is fully replaced (it's the canonical source)

---

description: Create or sync global Claude commands and skills

---

# Add Global: $ARGUMENTS

Parse the arguments to determine action:

**If "command [name]"**:

1. Find the sw-cortex project root (look for global-config/ directory)
2. Create a new command file at `global-config/commands/[name].md`
3. Use this template:

```markdown
# Command: [name]

[Description of what this command does]

## Usage

\`\`\`
/[name] [arguments]
\`\`\`

## Examples

\`\`\`
/[name] example usage
\`\`\`

---

description: [Short description for command list]

---

# [Name] Command: $ARGUMENTS

[Instructions for Claude on how to handle this command]
```

4. Ask user what the command should do
5. After creating, remind them to run `/add-global sync push` to deploy

**If "skill [name]"**:

1. Find the sw-cortex project root
2. Create directory `global-config/skills/[name]/`
3. Create `SKILL.md` with this template:

```markdown
---
name: [name]
description: [When to use this skill]
---

# [Name] Skill

[Detailed instructions for the skill]
```

4. Ask user what the skill should do
5. After creating, remind them to run `/add-global sync push` to deploy

**If "sync push"**:

Run the sync script from the sw-cortex directory:

```bash
bash scripts/sync-global-config.sh push
```

This will:

- Add new commands to ~/.claude/commands/ (preserves existing)
- Add new skills to ~/.claude/skills/ (preserves existing)
- Merge MCP servers into ~/.mcp.json (preserves existing servers)
- Merge settings permissions (deduplicates)
- Update ~/CLAUDE.md

**If "sync pull"**:

Run:

```bash
bash scripts/sync-global-config.sh pull
```

This pulls any commands/skills/settings from ~/.claude back into the repo for version control.

**If "sync status"**:

Run:

```bash
bash scripts/sync-global-config.sh status
```

Shows what's in the repo vs what's in ~/.claude globally.
