#!/usr/bin/env bash
# repo-write-guard.sh — PreToolUse guard enforcing the orchestrator write-allowlist.
#
# sw-cortex is the single Claude Code hub. From it, /serp-analyze may EDIT/COMMIT/PUSH in
# ONLY these repos. Everything else is read-only (diagnose + hand off, never write).
#
# Reads the PreToolUse hook JSON on stdin. Emits a deny decision (and exits 0) when a
# write/commit/push/PR resolves to a repo outside the allowlist; otherwise prints
# nothing (allow). Reads are never inspected.
#
# Resolution: a repo's identity is its git-common-dir (so worktrees map to their owner,
# e.g. serp-hotfix-mo-grounding -> SERP). Fail-closed: if a commit/push/PR command names
# ANY path token resolving to a non-writable repo, deny.

set -euo pipefail

# --- Allowlist: absolute repo roots that may be written ---
WRITABLE_ROOTS=(
  "/Users/jackkief/Desktop/Projects/SERP"
  "/Users/jackkief/Desktop/Projects/SWAC"
  "/Users/jackkief/Desktop/Projects/sw-cortex"
  "/Users/jackkief/Desktop/Projects/sugarwish-infrastructure"
)

# --- Worktree-only repos: TRACKED files in the MAIN CLONE are read-only ---
# All work in these repos goes in a worktree (CLAUDE.md: "NEVER git checkout a branch in the
# hub working copy"; SERP/SWAC edits belong in a worktree, not the main clone). Edits still
# land normally inside any linked worktree of the same repo, and untracked/gitignored files
# (.env, scratch/, node_modules) stay editable in the clone so local setup still works.
WORKTREE_ONLY_ROOTS=(
  "/Users/jackkief/Desktop/Projects/SERP"
  "/Users/jackkief/Desktop/Projects/SWAC"
  "/Users/jackkief/Desktop/Projects/sw-cortex"
)

input="$(cat)"
tool_name="$(printf '%s' "$input" | jq -r '.tool_name // ""')"

deny() {
  # $1 = reason
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

# Resolve the owning repo root for a path. Echoes the realpath'd repo root, or
# empty if the path is not inside a git repo. Walks up to the first EXISTING ancestor
# dir, so a not-yet-created file (new-file write) still resolves to its target repo.
repo_root_for_dir() {
  local dir="$1"
  # Climb to the nearest existing ancestor directory.
  while [ -n "$dir" ] && [ "$dir" != "/" ] && [ ! -d "$dir" ]; do
    dir="$(dirname "$dir")"
  done
  [ -d "$dir" ] || return 0
  local common
  # --path-format=absolute is required: a bare --git-common-dir emits a PHYSICAL-cwd-relative
  # path (e.g. ../../../.git), which mis-resolves when $dir crosses a symlink — SERP worktrees
  # symlink backend/venv to the main clone, so a venv token resolved to the worktree itself
  # and denied it as a "read-only repo" (2026-07-02).
  common="$(cd "$dir" 2>/dev/null && git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 0
  [ -n "$common" ] || return 0
  # Defensive: older git without --path-format still emits relative — resolve against $dir.
  case "$common" in
    /*) : ;;
    *) common="$dir/$common" ;;
  esac
  local root
  root="$(cd "$(dirname "$common")" 2>/dev/null && pwd -P)" || return 0
  printf '%s' "$root"
}

is_writable_root() {
  local root="$1" w
  for w in "${WRITABLE_ROOTS[@]}"; do
    [ "$root" = "$(cd "$w" 2>/dev/null && pwd -P)" ] && return 0
  done
  return 1
}

is_worktree_only_root() {
  local root="$1" w
  for w in "${WORKTREE_ONLY_ROOTS[@]}"; do
    [ "$root" = "$(cd "$w" 2>/dev/null && pwd -P)" ] && return 0
  done
  return 1
}

# True when $1 is inside the MAIN working tree of its repo (not a linked worktree).
# Discriminator: in a main clone git-dir == git-common-dir; in a linked worktree the
# git-dir is <common>/worktrees/<name>, so they differ.
in_main_working_tree() {
  local dir="$1" gd gcd
  while [ -n "$dir" ] && [ "$dir" != "/" ] && [ ! -d "$dir" ]; do
    dir="$(dirname "$dir")"
  done
  [ -d "$dir" ] || return 1
  gd="$(cd "$dir" 2>/dev/null && git rev-parse --path-format=absolute --git-dir 2>/dev/null)" || return 1
  gcd="$(cd "$dir" 2>/dev/null && git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
  [ -n "$gd" ] && [ -n "$gcd" ] || return 1
  [ "$gd" = "$gcd" ]
}

# True when $1 is TRACKED by git. Untracked and gitignored files are exempt from the
# main-clone block, so .env / scratch/ / node_modules stay editable in the clone.
is_tracked_file() {
  local fp="$1" dir
  dir="$(dirname "$fp")"
  while [ -n "$dir" ] && [ "$dir" != "/" ] && [ ! -d "$dir" ]; do
    dir="$(dirname "$dir")"
  done
  [ -d "$dir" ] || return 1
  (cd "$dir" 2>/dev/null && git ls-files --error-unmatch -- "$fp" >/dev/null 2>&1)
}

readonly_name() {
  # Friendly owner hint for the deny message, keyed by repo basename.
  case "$(basename "$1")" in
    sugarwish-laravel|laravel) echo "sugarwish-laravel (owner: Seth / Manish)";;
    livery) echo "livery (owner: Cris Sloan)";;
    sw-design) echo "sw-design (owner: Jason / Clare)";;
    swirl) echo "swirl (owner: Jason; board: Anna)";;
    sugarwish-infrastructure) echo "sugarwish-infrastructure (owner: Munyr)";;
    *) basename "$1";;
  esac
}

case "$tool_name" in
  Edit|Write|NotebookEdit)
    fp="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
    [ -n "$fp" ] || exit 0
    root="$(repo_root_for_dir "$fp")"
    # No git repo (e.g. /tmp, ~/.claude) → not a tracked spoke; allow.
    [ -n "$root" ] || exit 0
    if ! is_writable_root "$root"; then
      deny "Blocked write to read-only repo $(readonly_name "$root"). Only SERP, SWAC, and sw-cortex are writable from the hub. Diagnose freely, but produce a hand-off note (what's wrong + file/line + the owner to ask) instead of editing. (repo-write-guard)"
    fi
    # Writable repo, but a TRACKED file in the MAIN CLONE → must go in a worktree.
    if is_worktree_only_root "$root" && in_main_working_tree "$fp" && is_tracked_file "$fp"; then
      name="$(basename "$root")"
      deny "Blocked edit to a TRACKED file in the $name MAIN CLONE ($root). All work in $name goes in a worktree, never the main clone — it is a long-lived pinned checkout and edits/branch-switches there disrupt the running session. Create one and edit there instead:

  git -C $root worktree add --force -B <branch> /tmp/<name>-<desc> origin/<base>
  # then Edit/Write under /tmp/<name>-<desc>/... and commit with: git -C /tmp/<name>-<desc> ...

Untracked and gitignored files (.env, scratch/) are still editable in the clone. (repo-write-guard)"
    fi
    ;;

  Bash)
    cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"
    [ -n "$cmd" ] || exit 0
    # Only gate publishing/mutating VCS verbs. Reads (status/log/diff/show/cat/grep/ls) pass.
    # Two independent, easy-to-reason checks (fail-closed): the command invokes git/gh AND
    # contains a mutating verb. `git -C <path> commit` etc. is caught because both hold.
    is_git_cmd=0; is_mutating=0
    printf '%s' "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])(git|gh)([[:space:]]|$)' && is_git_cmd=1
    printf '%s' "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])(commit|push|merge|rebase|reset|worktree[[:space:]]+(add|remove|prune)|pr[[:space:]]+create)([[:space:]]|$)' && is_mutating=1
    if [ "$is_git_cmd" = 1 ] && [ "$is_mutating" = 1 ]; then
      # Fail-closed: scan every path-ish token; if ANY resolves to a non-writable repo, deny.
      # Tokens considered: the value after `-C`, and any token containing a slash.
      checked_any=0
      # Extract -C <dir> targets and slash-bearing tokens.
      while IFS= read -r tok; do
        [ -n "$tok" ] || continue
        root="$(repo_root_for_dir "$tok")"
        [ -n "$root" ] || continue
        checked_any=1
        if ! is_writable_root "$root"; then
          deny "Blocked git/gh write targeting read-only repo $(readonly_name "$root"). Only SERP, SWAC, sw-cortex are writable from the hub — produce a hand-off note to the owner instead. (repo-write-guard)"
        fi
      done < <(
        # -C <dir> arguments
        printf '%s' "$cmd" | grep -oE -- '-C[[:space:]]+[^[:space:]]+' | sed -E 's/^-C[[:space:]]+//' || true
        # any token containing a slash (paths) — split on whitespace
        printf '%s' "$cmd" | tr ' \t' '\n\n' | grep '/' || true
      )
      # If the command names NO resolvable path (e.g. a bare `git commit` run from cwd),
      # cwd is sw-cortex (the hub) → writable, so allow. The Edit/Write guard catches the
      # actual file writes regardless.
    fi
    ;;
esac

exit 0
