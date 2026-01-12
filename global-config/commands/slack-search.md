# Command: slack-search

Search Jack's Slack message history semantically.

## Usage

```
/slack-search [query]
/slack-search [query] after [date]
/slack-search [query] between [date1] and [date2]
```

## Examples

```
/slack-search deployment issues
/slack-search budget discussion after 2025-12-01
/slack-search inventory sync between 2025-12-18 and 2026-01-08
```

---

## description: Search Slack messages with optional date filtering

# Slack Search: $ARGUMENTS

Parse the arguments to extract:

- The search query (required)
- Optional date filters: "after [date]", "before [date]", "between [date1] and [date2]"

Use these MCP tools:

1. `mcp__slack-search__search_slack_messages` - Search with query and date filters
   - `query`: The search terms
   - `afterDate`: ISO date like "2025-12-18" (optional)
   - `beforeDate`: ISO date like "2026-01-08" (optional)
   - `limit`: Number of results (default 10)

2. `mcp__slack-search__get_slack_context` - Get conversation around a message
   - Use this to show more context for interesting results

Format output as:

```
## Slack Search Results: "[query]"

### 1. [Channel] - [Date]
**[User]**: [Message text]
Score: [similarity score]

### 2. ...
```

If results look relevant, offer to show more context around specific messages.
