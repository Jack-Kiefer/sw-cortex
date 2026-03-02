# Command: meeting

Save meeting notes to knowledge/meetings/ and index them in Qdrant for semantic search.

## Usage

```
/meeting [title]
[paste your meeting notes here]
```

## Examples

```
/meeting Weekly standup 2026-03-03
Attendees: Jack, Sarah, Mike
Discussed: Q1 roadmap, SERP migration timeline, Odoo upgrade status
Action items: Jack to review phase 2 by Friday
```

```
/meeting
<paste raw meeting notes without a title>
```

---

## description: Save meeting notes and index for semantic search

# Meeting Notes: $ARGUMENTS

Parse the arguments:

- First line (or `$ARGUMENTS`) may contain a meeting title and/or date
- Everything after the first line is the meeting content
- If no title given, use "meeting" as the default
- If no date given, use today's date

**Step 1: Determine filename**

Generate a filename in this format: `YYYY-MM-DD-title-slug.md`

- Use the date from the title if provided, otherwise today's date
- Slugify the title: lowercase, spaces → hyphens, remove special chars
- Example: "Weekly Standup" on 2026-03-03 → `2026-03-03-weekly-standup.md`

**Step 2: Save the file**

Write the meeting notes to `knowledge/meetings/<filename>` using the Write tool.

Format the file as clean markdown:

```markdown
# <Title>

Date: <YYYY-MM-DD>

<meeting content verbatim>
```

**Step 3: Index the notes**

Run only the meetings sync:

```bash
cd /home/jackk/sw-cortex && npm run meetings:sync
```

**Step 4: Confirm to the user**

Report:

- The filename that was saved
- How many chunks were indexed (from meetings:sync output)

Format output as:

```
## Meeting Notes Saved

**File**: `knowledge/meetings/<filename>`
**Indexed**: <N> chunks in Qdrant

Meeting notes are now searchable via `/slack-search`.
```
