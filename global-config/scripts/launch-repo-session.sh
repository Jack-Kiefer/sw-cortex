#!/usr/bin/env bash
# launch-repo-session.sh — request a real Claude Code or Codex session in a target repo.
# Used by the /go and /launch workflows.
#
# Usage: launch-repo-session.sh <repo-root> [--agent claude|codex] [--label <tab-label>] [--keep-original] [initial prompt...]
#
#   --keep-original   Do NOT close the tab this was launched from (used by /launch).
#                     Default (used by /go) closes the originating tab once the new one opens.
#
# Mechanism — three backends, picked automatically:
#
#   1. Herdr: when the `herdr` server is running and the caller is NOT a Claude Desktop
#      session, open the session as a Herdr tab — one Herdr WORKSPACE per repo (found by
#      label, created with the repo cwd if missing), one TAB per task. The tab is created
#      with the task-derived name, the agent runs in its root pane, and CLAUDE_GO_TITLE is
#      injected so the session's SessionStart floor adopts it. Sessions live in Herdr's
#      background server, so they persist across client detach/quit.
#
#   2. Claude Desktop: when the caller is a Desktop session (CLAUDE_CODE_ENTRYPOINT=
#      claude-desktop) or Herdr is down, and Claude.app is installed. `claude --desktop`
#      takes no prompt or name, so a named session is seeded headlessly in the repo (one
#      turn that only replies "Ready: …"), then opened in Desktop with --resume. Jack's
#      first message there starts the task. Codex has no Desktop session, so
#      `--agent codex` opens a Ghostty window running codex in the repo instead (exit 1
#      if Ghostty isn't installed).
#
#   3. VS Code fallback (legacy, claude only — no Herdr and no Claude.app): drop a
#      request file into ~/.claude/go-queue/. The "Go Launcher" VS Code extension
#      (~/.vscode/extensions/go-launcher) opens a terminal in the repo and runs claude.
#
# Session names are "<emoji> <repo>-<slug> <short task>" (see derive_title). One launch per
# invocation, so firing several /go's in a row opens several sessions.

set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "launch-repo-session: repo root '$REPO' does not exist" >&2
  exit 2
fi
shift || true

LABEL="$(basename "$REPO")"
KEEP_ORIGINAL=
AGENT=claude
# Flags (any order) precede the prompt.
while true; do
  case "${1:-}" in
    --agent)
      shift
      AGENT="${1:-}"
      case "$AGENT" in claude|codex) ;; *) echo "launch-repo-session: --agent must be claude or codex" >&2; exit 2 ;; esac
      shift || true
      ;;
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

SLUG_STOPWORDS="a an the and or but of for to in on at by as with from into about is are was be been
what whats does do did how why when where which who whom can could should would will this that these
those it its our my me we you i please just also new fix add make update change check look find see
get investigate figure out run start research analyze"

# The stable "<slug>" token: the WW id without its hyphen (WW3776) when the task names one,
# else the first 2 meaningful words joined by "-".
derive_slug() { # $1 = cleaned task text
  local ww w out="" n=0
  ww="$(printf '%s' "$1" | grep -oiE 'WW-?[0-9]+' | head -1 | tr -d '-' | tr 'a-z' 'A-Z' || true)"
  if [ -n "$ww" ]; then printf '%s' "$ww"; return; fi
  for w in $(printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9' ' '); do
    case " $(printf '%s' "$SLUG_STOPWORDS" | tr '\n' ' ') " in *" $w "*) continue ;; esac
    [ "${#w}" -gt 1 ] || continue
    out="${out:+$out-}$w"; n=$((n + 1))
    [ "$n" -ge 2 ] && break
  done
  printf '%s' "${out:-session}"
}

# Session name "<emoji> <repo>-<slug> <short task>", at most 60 chars. Only the emoji and
# the words change later; "<repo>-<slug>" is the stable token other sessions address.
derive_title() {
  local t emoji="🔨" repo slug words head budget
  repo="$(basename "$REPO" | tr 'A-Z' 'a-z')"
  t="$(printf '%s' "$PROMPT" | tr '\n' ' ')"
  case "$t" in /research*|/*analyze*) emoji="🔍" ;; esac
  t="$(printf '%s' "$t" | sed -E 's|^/[a-zA-Z-]+ +||')"          # drop leading "/serp-analyze " etc.
  t="$(printf '%s' "$t" | sed -E 's/\([^)]*\)/ /g; s/\[[^]]*\]/ /g')" # drop asides
  t="$(printf '%s' "$t" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
  case "$t" in
    🔍\ *|🔨\ *|🧪\ *|🙋\ *|❓\ *|📦\ *|✅\ *|📋\ *|📝\ *|⬆️\ *|🚀\ *) emoji="${t%% *}"; t="${t#* }" ;;
  esac
  if [ -z "$t" ]; then
    printf '🔍 %s-session' "$repo"
    return
  fi
  slug="$(derive_slug "$t")"
  words="$(printf '%s' "$t" | sed -E 's/[Ww][Ww]-?[0-9]+[[:space:]:,.-]*//; s/^[[:space:]:,.-]+//')"
  head="$emoji $repo-$slug"
  budget=$((60 - ${#head} - 1))
  if [ "${#words}" -gt "$budget" ]; then
    if [ "$budget" -gt 1 ]; then
      words="$(printf '%s' "${words:0:$((budget - 1))}" | sed -E 's/[[:space:]]+[^[:space:]]*$//; s/[[:space:],.;:·–—-]+$//')…"
    else
      words=""
    fi
  fi
  printf '%s%s' "$head" "${words:+ $words}"
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

  # Run the selected agent via a self-deleting temp script so the pane doesn't echo the prompt.
  # The OSC 0 seed paints the pane's terminal_title before claude boots (same as the
  # VS Code extension's launch body); claude's hooks own the title from SessionStart on.
  local ls
  ls="$(mktemp /tmp/go-launch-XXXXXX)"   # NB: BSD mktemp needs the Xs LAST — no .sh suffix
  {
    printf 'export CLAUDE_GO_TITLE=%q\n' "$desc"
    printf "printf '\\\\033]0;%%s\\\\007' %q\n" "$desc"
    printf 'clear\n'
    if [ -n "$PROMPT" ]; then
      printf '%q %q\n' "$AGENT" "$PROMPT"
    else
      printf '%q\n' "$AGENT"
    fi
  } > "$ls"
  "$HERDR_BIN" pane run "$pane_id" "source $ls ; rm -f $ls" >/dev/null 2>&1 || {
    rm -f "$ls"; return 1
  }

  echo "launch: opened a [$LABEL] $AGENT Herdr tab ($tab_id) — check the Herdr window."
  [ -n "$PROMPT" ] && echo "    It runs $AGENT with your task as the first prompt."

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

# ---------------------------------------------------------------------------
# Claude Desktop backend: used when the launch comes FROM a Desktop session, or when
# Herdr is down and Claude.app is installed. `claude --desktop` takes no prompt or name,
# so seed a named session headlessly in the repo (one cheap turn that only replies
# "Ready: …"), then hand it to Desktop with --resume. Jack's first message starts it.
# Codex has no Desktop session, so it gets a Ghostty window instead.
# ---------------------------------------------------------------------------

desktop_wanted() {
  [ "$AGENT" = claude ] && [ -d /Applications/Claude.app ] || return 1
  [ "${CLAUDE_CODE_ENTRYPOINT:-}" = "claude-desktop" ] || ! herdr_up
}

# Where the child reports back: a Desktop caller's rename-proof id, else a terminal
# caller's session name (its latest custom title), else nothing.
parent_address() {
  [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] || return 0
  if [ "${CLAUDE_CODE_ENTRYPOINT:-}" = "claude-desktop" ]; then
    printf 'local_%s' "$CLAUDE_CODE_SESSION_ID"
    return 0
  fi
  local f
  for f in "$HOME"/.claude/projects/*/"$CLAUDE_CODE_SESSION_ID".jsonl; do
    [ -f "$f" ] || continue
    grep -o '"customTitle":"[^"]*"' "$f" | tail -1 | sed -E 's/^"customTitle":"(.*)"$/\1/'
    return 0
  done
}

launch_via_desktop() {
  local desc sid seed parent report=""
  if [ -z "$PROMPT" ]; then
    (cd "$REPO" && script -q /dev/null claude --desktop </dev/null >/dev/null 2>&1) || return 1
    echo "launch: opened a new [$LABEL] session in Claude Desktop."
    return 0
  fi
  desc="$(derive_title)"
  sid="$(uuidgen | tr 'A-Z' 'a-z')"
  parent="$(parent_address)"
  case "$parent" in
    "") ;;
    local_*) report=" Report back to $parent with SendMessage." ;;
    *) report=" Report back with SendMessage to the session named \"$parent\" (re-run ListAgents for its [ref])." ;;
  esac
  seed="Opened by /go. Don't start (no tools) until Jack sends his first message; reply now with one line: Ready: <task in under 10 words>. Jack's first message, whatever it says, means start: then run the task below exactly (invoke a leading /command with the Skill tool).$report

$PROMPT"
  (cd "$REPO" && CLAUDE_GO_TITLE="$desc" claude -p --session-id "$sid" -n "$desc" "$seed" </dev/null >/dev/null 2>&1) || return 1
  (cd "$REPO" && script -q /dev/null claude --desktop --resume "$sid" </dev/null >/dev/null 2>&1) || return 1
  echo "launch: opened \"$desc\" in Claude Desktop ([$LABEL])."
  echo "    Desktop id: local_$sid"
  echo "    Name: $desc"
  [ -n "$parent" ] && echo "    Reports back to: $parent"
  echo "    It waits for Jack's first message, then starts the task."
  return 0
}

launch_codex_ghostty() {
  if [ ! -d /Applications/Ghostty.app ]; then
    echo "launch-repo-session: --agent codex needs Herdr or Ghostty here, and /Applications/Ghostty.app is not installed." >&2
    return 1
  fi
  local codex_bin ls
  codex_bin="$(command -v codex 2>/dev/null || true)"
  [ -n "$codex_bin" ] || { echo "launch-repo-session: codex is not on PATH." >&2; return 1; }
  ls="$(mktemp /tmp/go-codex-XXXXXX)"
  {
    printf 'rm -f %q\n' "$ls"
    printf 'cd %q || exit 1\n' "$REPO"
    if [ -n "$PROMPT" ]; then
      printf 'exec %q %q\n' "$codex_bin" "$PROMPT"
    else
      printf 'exec %q\n' "$codex_bin"
    fi
  } > "$ls"
  open -na Ghostty --args --working-directory="$REPO" -e /bin/bash -l "$ls" || { rm -f "$ls"; return 1; }
  echo "launch: opened a [$LABEL] codex session in a new Ghostty window."
  return 0
}

if [ "${CLAUDE_CODE_ENTRYPOINT:-}" != "claude-desktop" ] && herdr_up && launch_via_herdr; then
  exit 0
fi

if [ "$AGENT" = codex ]; then
  launch_codex_ghostty && exit 0
  exit 1
fi

if desktop_wanted && launch_via_desktop; then
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
# line 2 = "CLOSE_TTY=<tty>"; line 3 = "AGENT=claude|codex"; line 4+ = prompt.
REQ="$(mktemp "$QUEUE_DIR/req.XXXXXX")"
{ printf '%s\n' "$REPO"; printf 'CLOSE_TTY=%s\n' "$CLOSE_TTY"; printf 'AGENT=%s\n' "$AGENT"; printf '%s' "$PROMPT"; } > "$REQ"

echo "launch: opening a [$LABEL] $AGENT session — a new terminal tab will appear automatically."
if [ -n "$PROMPT" ]; then
  echo "    It runs $AGENT with your task as the first prompt."
fi
if [ -n "$KEEP_ORIGINAL" ]; then
  echo "    (--keep-original: this tab stays open.)"
fi
