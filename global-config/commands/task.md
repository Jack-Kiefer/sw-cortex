# Command: task

Manage tasks in Jack's global task system.

## Usage

```
/task add [title]           # Add a new task
/task list                  # List all pending tasks
/task list [project]        # List tasks for a project
/task done [id]             # Mark a task as complete
/task snooze [id] [duration] # Snooze a task
/task move [id] [project]   # Move task to a project
```

## Examples

```
/task add Fix the login bug in WishDesk
/task list
/task list serp
/task done 5
/task snooze 3 2h
/task move 7 wishdesk
```

---

## description: Manage tasks - add, list, complete, snooze, move

# Task Command: $ARGUMENTS

Parse the arguments to determine the action:

- If starts with "add": Create a new task with the remaining text as title
- If "list" alone: Show all pending tasks
- If "list [project]": Show tasks for that project
- If "done [id]": Mark task as completed
- If "snooze [id] [duration]": Snooze task (parse duration like 1h, 2d, 30m)
- If "move [id] [project]": Move task to project

Use the task-manager MCP server tools:

- `mcp__task-manager__add_task` - Add new task
- `mcp__task-manager__list_tasks` - List tasks
- `mcp__task-manager__update_task` - Update task status
- `mcp__task-manager__move_task` - Move to project

Format output as a clean table or list. Include:

- Task ID
- Title
- Status
- Project (if any)
- Due date (if set)

For "add" commands, confirm the task was added and show the task ID.
For "done" commands, congratulate completion and show next pending task.
For "list" commands, show tasks grouped by status (in_progress first, then pending).
