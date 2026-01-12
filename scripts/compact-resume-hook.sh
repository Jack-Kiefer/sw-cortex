#!/bin/bash
# Hook script for SessionStart - checks for compact resume file and injects context

RESUME_FILE="$HOME/.claude/.compact-resume.json"

# Only proceed if resume file exists
if [[ ! -f "$RESUME_FILE" ]]; then
    exit 0
fi

# Read the resume data
DISCOVERY_ID=$(jq -r '.discoveryId' "$RESUME_FILE" 2>/dev/null)
TASK=$(jq -r '.task' "$RESUME_FILE" 2>/dev/null)
PROMPT=$(jq -r '.prompt' "$RESUME_FILE" 2>/dev/null)

if [[ -z "$PROMPT" || "$PROMPT" == "null" ]]; then
    rm -f "$RESUME_FILE"
    exit 0
fi

# Output instruction for Claude (this gets added to context)
cat << EOF
<session-resume>
IMPORTANT: This session was resumed from a /compact-global command.

The user ran /clear after saving context. You MUST immediately:
1. Search for discovery ID: $DISCOVERY_ID
2. Read the saved context
3. Begin the analysis

Task to resume: $TASK

Run this command NOW:
mcp__task-manager__get_discovery { id: "$DISCOVERY_ID" }

Then run /global-analyze on the task described in that discovery.

Do NOT ask the user what to do. Act immediately.
</session-resume>
EOF

# Clean up the resume file
rm -f "$RESUME_FILE"

exit 0
