# Command: remind

Set reminders that will be delivered via Slack DM.

## Usage
```
/remind [message] in [duration]
/remind [message] at [time]
/remind list
/remind cancel [id]
```

## Duration Examples
- `in 30m` or `in 30 minutes`
- `in 2h` or `in 2 hours`
- `in 1d` or `in 1 day`
- `at 3pm`
- `at 15:00`
- `tomorrow at 9am`

## Examples
```
/remind Check on the deployment in 2h
/remind Follow up with Sarah about the bug at 3pm
/remind Review PR before standup tomorrow at 9am
/remind list
/remind cancel 5
```

---
description: Set Slack reminders with natural language durations
---

# Reminder Command: $ARGUMENTS

Parse the arguments to determine the action:

**If "list"**: Show all pending reminders with their IDs and scheduled times.

**If "cancel [id]"**: Cancel the reminder with that ID.

**Otherwise**: Parse as a new reminder:
1. Find the time indicator ("in" or "at")
2. Extract the message (everything before the time indicator)
3. Parse the duration/time (everything after)
4. Calculate the exact reminder time

Duration parsing:
- `30m`, `30min`, `30 minutes` → 30 minutes from now
- `2h`, `2hr`, `2 hours` → 2 hours from now
- `1d`, `1 day` → 24 hours from now
- `3pm`, `15:00` → Next occurrence of that time
- `tomorrow at 9am` → 9 AM tomorrow

Use the task-manager MCP server tools:
- `mcp__task-manager__add_reminder` - Create reminder
- `mcp__task-manager__list_reminders` - List pending reminders
- `mcp__task-manager__cancel_reminder` - Cancel a reminder

After creating a reminder:
1. Confirm the reminder was set
2. Show the exact time it will fire (in user's timezone)
3. Show the reminder ID for future reference

Example output:
```
Reminder set!
ID: 12
Message: Check on the deployment
Time: Today at 4:30 PM (in 2 hours)
Delivery: Slack DM
```
