# Command: draft-slack

Improve a Slack message before sending. Adds context, timelines, and specifics based on Jack's communication patterns.

## Usage

```
/draft-slack [your rough message or situation]
```

## Examples

```
/draft-slack ok I'll do it
/draft-slack thanks for the fix
/draft-slack [paste google doc link]
/draft-slack need to tell seth the deploy is done
```

---

description: Draft better Slack messages with context and specifics
allowed-tools: none

---

# Draft Slack Message

**Input:** $ARGUMENTS

## Your Communication Tendencies (to counteract)

1. **Too terse** - "ok", "ya", "idk" leave people without context
2. **Links without explanation** - Recipients don't know what they're clicking
3. **Yes without timeline** - "Yeah I can" doesn't set expectations
4. **Brief thanks** - "Thanks!" is fine but specifics are better

## Improve This Message

Take the input and rewrite it following these rules:

### If it's a **confirmation/acknowledgment**:

- Add WHAT you understood
- Add WHEN you'll do it
- Add any BLOCKERS or dependencies

### If it's a **link share**:

- Add a TITLE describing what it is
- Add WHY you're sharing it / what action is needed
- Format as `[Title](link)` or add context above

### If it's a **thank you**:

- Add WHAT specifically was helpful
- Add the IMPACT it had
- Consider if this should be PUBLIC (in a channel) vs DM

### If it's a **status update**:

- Lead with the RESULT (done/blocked/in progress)
- Add NEXT STEPS if any
- Tag relevant people

## Output Format

```
## Suggested Message

[Your improved message here]

---

**Changes made:**
- [what was added/improved]
```

## Quick Reference

| Instead of   | Try                                                                  |
| ------------ | -------------------------------------------------------------------- |
| "ok"         | "Got it - I'll have this done by [time]"                             |
| "yeah I can" | "Yeah I can - targeting [day/time], will update you"                 |
| "thanks!"    | "Thanks! This [specific impact]"                                     |
| "idk"        | "Not sure yet - let me check [source] and get back to you by [time]" |
| [bare link]  | "[Description of what this is](link) - [what to do with it]"         |

**Remember:** If someone reads this 6 months from now with no context, will they understand?
