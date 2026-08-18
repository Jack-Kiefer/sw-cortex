#!/usr/bin/env bash
# launch-repo-session.sh — request a real Claude Code session in a target repo.
# Used by the /go and /launch slash commands.
#
# Usage: launch-repo-session.sh <repo-root> [--label <tab-label>] [--keep-original] [initial prompt...]
#
#   --keep-original   Do NOT close the tab this was launched from (used by /launch).
#                     Default (used by /go) closes the originating tab once the new one opens.
#
# Mechanism — two backends, picked automatically:
#
#   1. Herdr (primary): when the `herdr` server is running, open the session as a Herdr
#      tab — one Herdr WORKSPACE per repo (found by label, created with the repo cwd if
#      missing), one TAB per task. The tab is created with the task-derived label, claude
#      runs in its root pane, and CLAUDE_GO_TITLE is injected so the session's
#      SessionStart floor adopts the descriptive name. Sessions live in Herdr's
#      background server, so they persist across client detach/quit.
#
#   2. VS Code fallback (no Herdr server): drop a request file into ~/.claude/go-queue/.
#      The "Go Launcher" VS Code extension (~/.vscode/extensions/go-launcher) watches that
#      dir and opens a new integrated terminal cd'd into the repo, names the tab, and runs
#      claude with the prompt.
#
# One launch per invocation either way, so firing several /go's in a row opens several
# tabs (none clobber each other).

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "launch-repo-session: repo root '$REPO' does not exist" >&2
  exit 2
fi
shift || true

LABEL="$(basename "$REPO")"
KEEP_ORIGINAL=
# Flags (any order) precede the prompt.
while true; do
  case "${1:-}" in
    --label)         shift; LABEL="${1:-$LABEL}"; shift || true ;;
    --keep-original) KEEP_ORIGINAL=1; shift || true ;;
    *)               break ;;
  esac
done
PROMPT="$*"

# ---------------------------------------------------------------------------
# Herdr backend
# ---------------------------------------------------------------------------

HERDR_BIN="$(command -v herdr 2>/dev/null || true)"
[ -n "$HERDR_BIN" ] || { [ -x "$HOME/.local/bin/herdr" ] && HERDR_BIN="$HOME/.local/bin/herdr"; } || true

herdr_up() {
  [ -n "$HERDR_BIN" ] && [ -S "$HOME/.config/herdr/herdr.sock" ] \
    && "$HERDR_BIN" status >/dev/null 2>&1
}

# Shell port of the go-launcher extension's taskSlug + normalizeTitle: turn the prompt
# into a descriptive "<status-emoji> <label>" tab name (or the repo-anchored floor when
# there's no task text).
derive_title() {
  local t="$PROMPT"
  t="$(printf '%s' "$t" | tr '\n' ' ')"
  t="$(printf '%s' "$t" | sed -E 's|^/[a-zA-Z-]+ +||')"          # drop leading "/serp-analyze " etc.
  t="$(printf '%s' "$t" | sed -E 's/\([^)]*\)/ /g; s/\[[^]]*\]/ /g')" # drop asides
  t="$(printf '%s' "$t" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
  if [ -z "$t" ]; then
    printf '🔍 %s · session' "$(basename "$REPO")"
    return
  fi
  if [ "${#t}" -gt 48 ]; then
    t="$(printf '%.48s' "$t" | sed -E 's/[[:space:]]+[^[:space:]]*$//; s/[[:space:],.;:·–—-]+$//')…"
  fi
  case "$t" in
    🔍*|🔨*|🧪*|🙋*|❓*|📦*|✅*|📋*|📝*|⬆️*|🚀*) printf '%s' "$t" ;;
    *) printf '🔨 %s' "$t" ;;
  esac
}

# Extract a JSON string field from herdr's single-line JSON output (jq if present).
json_field() { # $1=json $2=field
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r "[.. | objects | .$2 // empty] | first // empty" 2>/dev/null
  else
    printf '%s' "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | sed -E 's/.*:"([^"]*)"/\1/'
  fi
}

launch_via_herdr() {
  local desc ws_json ws_id tab_json tab_id pane_id
  desc="$(derive_title)"

  # Find the repo's workspace by label; create it (cwd'd at the repo) if missing.
  ws_id="$("$HERDR_BIN" workspace list 2>/dev/null | {
    if command -v jq >/dev/null 2>&1; then
      jq -r --arg l "$LABEL" '.result.workspaces[] | select(.label == $l) | .workspace_id' 2>/dev/null | head -1
    else
      cat >/dev/null; echo ""
    fi
  })"
  tab_id="" pane_id=""
  if [ -z "$ws_id" ]; then
    ws_json="$("$HERDR_BIN" workspace create --cwd "$REPO" --label "$LABEL" \
      --env "CLAUDE_GO_TITLE=$desc" --no-focus 2>/dev/null)" || return 1
    ws_id="$(json_field "$ws_json" workspace_id)"
    tab_id="$(json_field "$ws_json" tab_id)"
    pane_id="$(json_field "$ws_json" pane_id)"
  else
    tab_json="$("$HERDR_BIN" tab create --workspace "$ws_id" --cwd "$REPO" \
      --env "CLAUDE_GO_TITLE=$desc" --no-focus 2>/dev/null)" || return 1
    tab_id="$(json_field "$tab_json" tab_id)"
    pane_id="$(json_field "$tab_json" pane_id)"
  fi
  [ -n "$pane_id" ] || return 1

  # Name the tab after the task (the running session re-labels it via set-tab-title.sh).
  [ -n "$tab_id" ] && "$HERDR_BIN" tab rename "$tab_id" "$desc" >/dev/null 2>&1 || true

  # Run claude via a self-deleting temp script so the pane doesn't echo the whole prompt.
  # The OSC 0 seed paints the pane's terminal_title before claude boots (same as the
  # VS Code extension's launch body); claude's hooks own the title from SessionStart on.
  local ls
  ls="$(mktemp /tmp/go-launch-XXXXXX)"   # NB: BSD mktemp needs the Xs LAST — no .sh suffix
  {
    printf 'export CLAUDE_GO_TITLE=%q\n' "$desc"
    printf "printf '\\\\033]0;%%s\\\\007' %q\n" "$desc"
    printf 'clear\n'
    if [ -n "$PROMPT" ]; then
      printf 'claude %q\n' "$PROMPT"
    else
      printf 'claude\n'
    fi
  } > "$ls"
  "$HERDR_BIN" pane run "$pane_id" "source $ls ; rm -f $ls" >/dev/null 2>&1 || {
    rm -f "$ls"; return 1
  }

  echo "launch: opened a [$LABEL] Herdr tab ($tab_id) — check the Herdr window."
  [ -n "$PROMPT" ] && echo "    It runs claude with your task as the first prompt."

  # Close the tab this /go was fired from (default /go behavior; --keep-original skips).
  # Herdr-origin: close our own Herdr tab. VS Code-origin (mixed mode — hub still in
  # VS Code while launches target Herdr): drop a close-only request so the Go Launcher
  # extension closes the originating VS Code tab, same as the fallback path would.
  if [ -z "$KEEP_ORIGINAL" ]; then
    if [ -n "${HERDR_TAB_ID:-}" ] && [ "${HERDR_TAB_ID:-}" != "$tab_id" ]; then
      "$HERDR_BIN" tab close "$HERDR_TAB_ID" >/dev/null 2>&1 || true
    else
      local ct="" cpid=$$
      while [ -n "$cpid" ] && [ "$cpid" -gt 1 ] 2>/dev/null; do
        local tt
        tt=$(ps -o tty= -p "$cpid" 2>/dev/null | tr -d ' ')
        if [ -n "$tt" ] && [ "$tt" != "??" ]; then ct="$tt"; break; fi
        cpid=$(ps -o ppid= -p "$cpid" 2>/dev/null | tr -d ' ')
      done
      if [ -n "$ct" ]; then
        mkdir -p "$HOME/.claude/go-queue"
        local creq
        creq="$(mktemp "$HOME/.claude/go-queue/close.XXXXXX")"
        { printf '__CLOSE__\n'; printf 'CLOSE_TTY=%s\n' "$ct"; } > "$creq"
      fi
    fi
  fi
  return 0
}

if herdr_up && launch_via_herdr; then
  exit 0
fi

# ---------------------------------------------------------------------------
# VS Code fallback (Go Launcher extension + ~/.claude/go-queue)
# ---------------------------------------------------------------------------

QUEUE_DIR="$HOME/.claude/go-queue"
mkdir -p "$QUEUE_DIR"

# Resolve the tty of the tab this /go was launched FROM, so the extension can close that
# exact tab once the new one opens (Jack: "any tab I run /go in closes after launch").
# Walk up the process tree to the claude process — it holds the tab's tty (the bash-tool
# shell running this script is detached and reports "??"). Same walk as set-tab-title.sh.
# With --keep-original (/launch) we skip this entirely so CLOSE_TTY stays empty and the
# extension leaves the originating tab open.
CLOSE_TTY=
if [ -z "$KEEP_ORIGINAL" ]; then
  pid=$$
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
    t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ -n "$t" ] && [ "$t" != "??" ]; then CLOSE_TTY="$t"; break; fi
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
fi

# Unique per-request file (so concurrent /go's don't overwrite). Line 1 = repo root;
# line 2 = "CLOSE_TTY=<tty>" control line (empty value if unresolved); line 3+ = prompt.
REQ="$(mktemp "$QUEUE_DIR/req.XXXXXX")"
{ printf '%s\n' "$REPO"; printf 'CLOSE_TTY=%s\n' "$CLOSE_TTY"; printf '%s' "$PROMPT"; } > "$REQ"

echo "launch: opening a [$LABEL] session — a new terminal tab will appear automatically."
if [ -n "$PROMPT" ]; then
  echo "    It runs claude with your task as the first prompt."
fi
if [ -n "$KEEP_ORIGINAL" ]; then
  echo "    (--keep-original: this tab stays open.)"
fi
