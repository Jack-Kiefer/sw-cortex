#!/usr/bin/env bash
# askuserquestion-guard.sh — PreToolUse guard: AskUserQuestion is for INTAKE only.
#
# Jack answers mid-task questions in prose and rejects the popup (memory
# askuserquestion-jack-answers-in-text). The prose rule kept losing, so this denies the
# popup once the session is past intake: more than MAX_PRIOR tool calls already made.

set -euo pipefail

MAX_PRIOR=8

input="$(cat)"
transcript="$(printf '%s' "$input" | jq -r '.transcript_path // ""')"
[ -n "$transcript" ] && [ -f "$transcript" ] || exit 0

prior="$(python3 -I - "$transcript" <<'PY'
import json, sys
n = 0
with open(sys.argv[1]) as f:
    for line in f:
        try:
            o = json.loads(line)
        except ValueError:
            continue
        if o.get('type') != 'assistant':
            continue
        for c in (o.get('message') or {}).get('content') or []:
            if isinstance(c, dict) and c.get('type') == 'tool_use':
                n += 1
print(n)
PY
)"

if [ "${prior:-0}" -gt "$MAX_PRIOR" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"AskUserQuestion is intake-only for Jack. Mid-task, ask in prose: 1-2 numbered questions at the end of the turn, then stop. Do not offer a build option he did not ask for; if he asked to audit or explain, audit and explain."}}'
fi
exit 0
