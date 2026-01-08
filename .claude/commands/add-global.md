# Command: add-global

Add a new global command or skill that will be available in all projects.

## Usage

```
/add-global command [name]    # Create a new global slash command
/add-global skill [name]      # Create a new global skill
/add-global sync push         # Push local changes to ~/.claude
/add-global sync pull         # Pull ~/.claude changes to repo
/add-global sync status       # Show diff between repo and global
```

## Examples

```
/add-global command my-helper
/add-global skill code-reviewer
/add-global sync push
```

---

## description: Create or sync global Claude commands and skills

# Add Global: $ARGUMENTS

Parse the arguments:

**If "command [name]"**:

1. Create a new command file at `/home/jackk/sw-cortex/global-config/commands/[name].md`
2. Use this template:

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

## description: [Short description for command list]

# [Name] Command: $ARGUMENTS

[Instructions for Claude on how to handle this command]
```

3. Ask user what the command should do
4. After creating, remind them to run `/add-global sync push` to deploy

**If "skill [name]"**:

1. Create directory `/home/jackk/sw-cortex/global-config/skills/[name]/`
2. Create `SKILL.md` with this template:

```markdown
---
name: [name]
description: [When to use this skill]
---

# [Name] Skill

[Detailed instructions for the skill]
```

3. Ask user what the skill should do
4. After creating, remind them to run `/add-global sync push` to deploy

**If "sync push"**:
Run: `bash /home/jackk/sw-cortex/scripts/sync-global-config.sh push`

**If "sync pull"**:
Run: `bash /home/jackk/sw-cortex/scripts/sync-global-config.sh pull`

**If "sync status"**:
Run: `bash /home/jackk/sw-cortex/scripts/sync-global-config.sh status`
