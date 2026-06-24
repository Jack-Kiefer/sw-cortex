#!/usr/bin/env bash
# save-for-later-merge-hook.sh — PostToolUse(Bash) hook: auto-close the save tied to a
# just-merged PR.
#
# Wired in settings.json under hooks.PostToolUse with matcher "Bash". On every Bash tool
# call it reads the hook JSON from stdin; if the command was a successful `gh pr merge`, it
# finds the active save whose branch (or PR#) matches and moves it active/ -> closed/ — the
# same teardown a manual /close-later does. This mirrors how merging a PR closes a /go tab:
# the merge is the signal the work is done, so the saved-for-later entry retires itself.
#
# It is intentionally permissive about FAILURE: if anything is ambiguous (can't parse the
# PR ref, no matching save, gh not available) it exits 0 silently — a hook must never block
# or noise up an unrelated Bash call.

set -uo pipefail

input=$(cat 2>/dev/null || true)
[ -n "$input" ] || exit 0

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || true)
[ -n "$cmd" ] || exit 0

# Only care about `gh pr merge` invocations.
printf '%s' "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)' || exit 0

# Best-effort success check: PostToolUse fires after the tool ran. If the hook payload
# carries the result, skip on obvious failure; otherwise proceed (merge usually succeeded).
ok=$(printf '%s' "$input" | jq -r '
  (.tool_response.exit_code // .tool_response.exitCode // empty)
' 2>/dev/null || true)
if [ -n "$ok" ] && [ "$ok" != "0" ]; then exit 0; fi

HELPER="$HOME/.claude/scripts/save-for-later.sh"
[ -x "$HELPER" ] || exit 0

# Extract an explicit PR ref from the command if present: `gh pr merge 123` or `... #123`.
pr=$(printf '%s' "$cmd" | grep -oE 'gh[[:space:]]+pr[[:space:]]+merge[[:space:]]+#?[0-9]+' | grep -oE '[0-9]+$' || true)

save=""
if [ -n "$pr" ]; then
  save=$("$HELPER" find-by-pr "$pr" 2>/dev/null || true)
fi

# No explicit number (e.g. `gh pr merge` on the current branch) -> match by current branch.
if [ -z "$save" ]; then
  cwd=$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null || true)
  [ -n "$cwd" ] || cwd="$PWD"
  branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  [ -n "$branch" ] && save=$("$HELPER" find-by-branch "$branch" 2>/dev/null || true)
fi

[ -n "$save" ] && [ -e "$save" ] || exit 0

dest=$("$HELPER" close "$save" "Auto-closed: PR merged (\`$cmd\`)." 2>/dev/null || true)
[ -n "$dest" ] && echo "save-for-later: auto-closed $(basename "$save") (PR merged)." >&2
exit 0
