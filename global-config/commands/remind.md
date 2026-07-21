# Command: remind

Set a Slack reminder for yourself. Parses natural language ("remind me to X in 30 minutes" / "ping Seth tomorrow at 3pm"), stores it, and the every-minute job DMs you when it's due — with **snooze** and **delete** buttons right on the Slack message.

## Usage

```
/remind <what> <when>          # set a reminder
/remind list                   # show pending reminders
/remind delete <id>            # delete a pending reminder before it fires
```

`<when>` accepts a duration (`30m`, `2h`, `1d`), natural language (`tomorrow at 3pm`, `in 2 hours`, `next monday at 9am`), or an ISO date.

## Examples

```
/remind ping seth about the deploy in 30 minutes
/remind call the vendor tomorrow at 10am
/remind follow up on the PO in 2h
/remind list
/remind delete 4
```

---

**Input:** $ARGUMENTS

## What to do

You are running in the **sw-cortex hub**. The reminders live in the local SQLite DB (`tasks/tasks.db`); the every-minute `check-reminders` systemd job (on Hetzner) sends them to Slack as a DM with buttons.

### 1. Figure out the sub-action

- **`list`** (input is exactly `list`) → run:
  ```bash
  npx tsx scripts/manage-reminders.ts list
  ```
  Print the returned list. Done.

- **`delete <id>`** (input starts with `delete` followed by a number) → run:
  ```bash
  npx tsx scripts/manage-reminders.ts delete <id>
  ```
  Confirm what was deleted. If they said "delete" with no id, run `list` first, show the reminders, and ask which id.

- **Otherwise it's a new reminder** → go to step 2.

### 2. Split the input into a message and a time

Parse `$ARGUMENTS` into:
- **`<what>`** — the thing to be reminded about (strip a leading "remind me to", "remind me", "to", etc. if present).
- **`<when>`** — the time phrase. Look for a trailing `in <duration>`, `at <time>`, `tomorrow…`, `next <day>…`, a bare duration like `30m`/`2h`/`1d`, or an ISO date. Keep the natural phrase intact (e.g. pass `tomorrow at 3pm`, not a converted timestamp) — the script's parser handles it.

If you genuinely can't find a time, ask Jack for one in a single short line (don't guess a default).

### 3. Create the reminder

```bash
npx tsx scripts/add-reminder.ts "<what>" "<when>"
```

The script prints the parsed fire time (e.g. `✅ Reminder #7 set for Tomorrow at 3:00 PM`). Relay that confirmation. If the script exits non-zero (unparseable time), show its error and ask Jack to rephrase the time.

### 4. Note on delivery

The reminder is stored immediately. It's **delivered** by the `sw-cortex-slack.service` (Socket Mode button handler) + the `sw-cortex-reminders.timer` (every-minute check) running on Hetzner — so those services must be up for the DM + snooze/delete buttons to fire. The DM itself carries the snooze (15m / 1h / 4h / Tomorrow) and 🗑️ Delete buttons; nothing else is needed to snooze or delete once it arrives.
