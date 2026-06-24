#!/usr/bin/env bash
# save-for-later.sh — helpers for the save-for-later session system.
#
# One saved session = one markdown file under ~/.claude/save-for-later/{active,closed}/
# named YYYY-MM-DD-HHMM-<slug>.md with YAML frontmatter (repo, branch, cwd, session_id,
# status, pr, created, updated) + a rich body (summary, what-it-did, files, next steps…).
#
# The Claude slash commands (/save-for-later, /resume-later, /close-later) write the file
# BODIES with the Write tool — this script only does the mechanical bits they shouldn't
# hand-roll: resolving the current session's repo/branch/sid, allocating a stamped
# filename, listing/finding saves, and closing one (active/ -> closed/). It is also called
# by the PostToolUse `gh pr merge` hook to auto-close the save tied to a merged branch/PR.
#
# Subcommands:
#   dir [active|closed]            print the storage dir (default: root), mkdir -p'ing it
#   newpath <slug>                 print a fresh active/ filepath: <root>/active/<stamp>-<slug>.md
#   context                        print KEY=VALUE lines for THIS session (repo, branch, sid, cwd)
#   list [active|closed|all]       print one TSV row per save: file<TAB>title<TAB>repo<TAB>branch<TAB>pr<TAB>updated<TAB>nextstep
#   find-by-branch <branch>        print the active save file matching that branch (frontmatter), or nothing
#   find-by-pr <num>               print the active save file whose pr: matches, or nothing
#   close <file> [note]            move <file> active/ -> closed/, stamp status: closed + closed:<date> (+ optional note)
#
# All paths printed are absolute. Frontmatter is parsed with a tiny awk reader (the files
# are written by us, so the format is known/stable: `key: value` lines between two `---`).

set -euo pipefail

ROOT="$HOME/.claude/save-for-later"

_stamp() { date +%Y-%m-%d-%H%M; }
_today() { date +%Y-%m-%d; }

# Read one frontmatter value (first match) from a save file. $1=file $2=key
_fm() {
  awk -v k="$2" '
    BEGIN{infm=0}
    /^---[[:space:]]*$/{infm++; if(infm==2) exit; next}
    infm==1 {
      line=$0
      idx=index(line,":")
      if(idx>0){
        key=substr(line,1,idx-1); val=substr(line,idx+1)
        gsub(/^[[:space:]]+|[[:space:]]+$/,"",key)
        gsub(/^[[:space:]]+|[[:space:]]+$/,"",val)
        gsub(/^"|"$/,"",val)
        if(key==k){print val; exit}
      }
    }
  ' "$1" 2>/dev/null
}

# Walk up the process tree to the claude process (holds the real tty), and from its cwd
# resolve repo root + branch. When run as a Bash tool call the immediate shell is detached,
# so the claude ancestor's working dir is the session's real cwd.
_session_cwd() {
  local pid=$$ t cwd
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
    t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ -n "$t" ] && [ "$t" != "??" ]; then
      # lsof gives the cwd of that pid
      cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
      [ -n "$cwd" ] && { printf '%s\n' "$cwd"; return; }
    fi
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
  pwd
}

cmd="${1:-}"; shift || true

case "$cmd" in
  dir)
    sub="${1:-}"
    d="$ROOT"; [ -n "$sub" ] && d="$ROOT/$sub"
    mkdir -p "$d"
    printf '%s\n' "$d"
    ;;

  newpath)
    slug="${1:-session}"
    slug=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')
    [ -n "$slug" ] || slug="session"
    mkdir -p "$ROOT/active"
    printf '%s/active/%s-%s.md\n' "$ROOT" "$(_stamp)" "$slug"
    ;;

  context)
    cwd="$(_session_cwd)"
    repo_root="$cwd"
    if git -C "$cwd" rev-parse --show-toplevel >/dev/null 2>&1; then
      repo_root="$(git -C "$cwd" rev-parse --show-toplevel)"
    fi
    branch=""
    git -C "$repo_root" rev-parse --abbrev-ref HEAD >/dev/null 2>&1 && \
      branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD)"
    printf 'CWD=%s\n' "$cwd"
    printf 'REPO=%s\n' "$repo_root"
    printf 'REPO_NAME=%s\n' "$(basename "$repo_root")"
    printf 'BRANCH=%s\n' "$branch"
    printf 'SESSION_ID=%s\n' "${CLAUDE_CODE_SESSION_ID:-}"
    printf 'DATE=%s\n' "$(_today)"
    printf 'STAMP=%s\n' "$(_stamp)"
    ;;

  list)
    scope="${1:-active}"
    case "$scope" in
      all) dirs=("$ROOT/active" "$ROOT/closed") ;;
      closed) dirs=("$ROOT/closed") ;;
      *) dirs=("$ROOT/active") ;;
    esac
    for d in "${dirs[@]}"; do
      [ -d "$d" ] || continue
      for f in "$d"/*.md; do
        [ -e "$f" ] || continue
        title=$(_fm "$f" title); [ -n "$title" ] || title=$(basename "$f" .md)
        repo=$(_fm "$f" repo)
        branch=$(_fm "$f" branch)
        pr=$(_fm "$f" pr)
        updated=$(_fm "$f" updated); [ -n "$updated" ] || updated=$(_fm "$f" created)
        nextstep=$(_fm "$f" next)
        printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$f" "$title" "$repo" "$branch" "$pr" "$updated" "$nextstep"
      done
    done
    ;;

  find-by-branch)
    want="${1:-}"; [ -n "$want" ] || exit 0
    for f in "$ROOT/active"/*.md; do
      [ -e "$f" ] || continue
      [ "$(_fm "$f" branch)" = "$want" ] && { printf '%s\n' "$f"; exit 0; }
    done
    ;;

  find-by-pr)
    want="${1:-}"; [ -n "$want" ] || exit 0
    want="${want#\#}"
    for f in "$ROOT/active"/*.md; do
      [ -e "$f" ] || continue
      pr=$(_fm "$f" pr); pr="${pr#\#}"
      [ -n "$pr" ] && [ "$pr" = "$want" ] && { printf '%s\n' "$f"; exit 0; }
    done
    ;;

  close)
    f="${1:-}"; shift || true
    note="${*:-}"
    [ -n "$f" ] && [ -e "$f" ] || { echo "save-for-later close: no such file: $f" >&2; exit 1; }
    mkdir -p "$ROOT/closed"
    base=$(basename "$f")
    dest="$ROOT/closed/$base"
    # Stamp status/closed/updated in the frontmatter, append optional closing note to body.
    today="$(_today)"
    tmp="$(mktemp)"
    awk -v today="$today" '
      BEGIN{infm=0; donestatus=0}
      /^---[[:space:]]*$/{
        infm++
        if(infm==2 && donestatus==0){print "closed: " today}
        print; next
      }
      infm==1 {
        if($0 ~ /^status:/){print "status: closed"; donestatus=1; next}
        if($0 ~ /^updated:/){print "updated: " today; next}
        if($0 ~ /^closed:/){next}
      }
      {print}
    ' "$f" > "$tmp"
    if [ -n "$note" ]; then
      { printf '\n## Closed (%s)\n\n%s\n' "$today" "$note"; } >> "$tmp"
    fi
    mv "$tmp" "$dest"
    [ "$dest" = "$f" ] || rm -f "$f"
    printf '%s\n' "$dest"
    ;;

  *)
    echo "save-for-later.sh: unknown subcommand '${cmd}'" >&2
    echo "usage: save-for-later.sh {dir|newpath|context|list|find-by-branch|find-by-pr|close} ..." >&2
    exit 2
    ;;
esac
