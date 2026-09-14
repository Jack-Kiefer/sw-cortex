---
name: go
description: Route /go requests to a fresh Codex session in the correct Sugarwish repository.
---

# Go

Use this skill whenever Jack types `/go`, says to open or launch a new go, or asks for a
fresh session in another repository.

Resolve the writable target from the task: SERP at `/Users/jackkief/Desktop/Projects/SERP`,
SWAC at `/Users/jackkief/Desktop/Projects/SWAC`, or sw-cortex at
`/Users/jackkief/Desktop/Projects/sw-cortex`. A bare repo name opens that repo without a
prompt. Route work concerning a read-only repository to the writable repository that owns
the requested change. If ownership is genuinely ambiguous, ask instead of guessing.

For a task, pass Jack's request as a direct Codex prompt. Prefix actionable work with:
`Implement this task, following AGENTS.md and repository-native verification and PR rules:`.
Prefix a pure question with: `Research this question, following AGENTS.md; do not edit:`.

Launch exactly once with:

```bash
~/.claude/scripts/launch-repo-session.sh <absolute-repo-root> --agent codex "<prompt>"
```

Do not start implementing in the originating session. The launcher closes the originating
tab by default after opening the replacement. If Jack explicitly says to keep going here or
to keep this tab open, add `--keep-original` and continue the current task.
