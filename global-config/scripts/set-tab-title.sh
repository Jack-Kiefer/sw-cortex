#!/bin/sh
# Set (or clear) a sticky custom name for this Claude Code session's terminal tab,
# and optionally record what the session has DONE so the tab carries a running
# breadcrumb + a full on-disk summary.
# Full docs: ~/.claude/scripts/TAB_TITLES.md
#
# Usage:
#   set-tab-title.sh "🔍 researching · slug"              set the base status title
#   set-tab-title.sh "🔨 fixing cap" --did "raised cap"   set title AND log a done-step
#   set-tab-title.sh --did "added regression test"        log a done-step, keep current title
#   set-tab-title.sh --clear                              clear title + done-trail + log
#
# --did "<phrase>" appends a short "what I just did" phrase to this session's done-trail.
# The tab then reads "<title> — <last-two-dids>" (capped), so a glance shows both the current
# step AND the last couple of things finished. The FULL history accrues to a per-session log
# (<sid>.log) that the session (or Jack) can read for the complete summary of what was done.
#
# State is keyed by SESSION ID (~/.claude/tab-titles/<session_id>*) — stable for the session's
# life and immune to tty reuse. tab-title-hook.sh re-asserts the composed title on every
# Stop/Notification/UserPromptSubmit/SubagentStop via the terminalSequence hook output; that
# hook path (OSC 0 through CC) is what actually paints the tab. The direct /dev/tty stamp below
# ONLY works when this setter runs in a genuine interactive shell with a controlling terminal —
# when the model invokes it as a Bash tool call the shell is detached (tty "??") and the stamp
# is silently swallowed, so it is best-effort only.

DIR="$HOME/.claude/tab-titles"
mkdir -p "$DIR"

# The session id: set for any process under `claude` (the setter, hooks, child shells).
sid="$CLAUDE_CODE_SESSION_ID"

# How many recent done-phrases to show inline in the tab, and the cap on the whole
# "— trail" tail so it never blows out the sidebar width.
DID_SHOW=2
DID_TAIL_CAP=44

# --- parse args: an optional positional TITLE, and an optional --did "<phrase>" ------------
TITLE=""
DID=""
have_title=0
while [ $# -gt 0 ]; do
  case "$1" in
    --clear)
      if [ -n "$sid" ]; then
        rm -f "$DIR/$sid" "$DIR/$sid.did" "$DIR/$sid.log" "$DIR/$sid.notified"
      fi
      echo "cleared custom title + done-trail — automatic titles resume on the next update"
      exit 0
      ;;
    --did)
      shift
      DID="$1"
      ;;
    --did=*)
      DID="${1#--did=}"
      ;;
    -*)
      echo "usage: set-tab-title.sh \"name\" [--did \"what I did\"] | --did \"...\" | --clear" >&2
      exit 1
      ;;
    *)
      if [ "$have_title" = 0 ]; then TITLE="$1"; have_title=1; fi
      ;;
  esac
  shift
done

if [ "$have_title" = 0 ] && [ -z "$DID" ]; then
  echo "usage: set-tab-title.sh \"name\" [--did \"what I did\"] | --did \"...\" | --clear" >&2
  exit 1
fi

if [ -z "$sid" ]; then
  echo "error: CLAUDE_CODE_SESSION_ID unset — not in a Claude Code session?" >&2
  exit 1
fi

F="$DIR/$sid"
DIDF="$DIR/$sid.did"
LOGF="$DIR/$sid.log"

# If a title was given, persist it as the base (the hook reads this back). If only --did was
# given, keep whatever base title is already stored (fall back to a neutral one if none yet).
if [ "$have_title" = 1 ]; then
  printf '%s' "$TITLE" > "$F"
else
  TITLE=$(cat "$F" 2>/dev/null)
  [ -n "$TITLE" ] || TITLE="🔨 working"
fi

# --- record a done-step -------------------------------------------------------------------
# .did holds the trail newest-first (one phrase per line); .log is the full append-only record
# with timestamps. compose_title() (shared with the hook via the .did file) renders the last
# DID_SHOW phrases as a "— a, b" tail on the title.
if [ -n "$DID" ]; then
  # Squash newlines/extra spaces so one phrase is one clean line.
  clean=$(printf '%s' "$DID" | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
  if [ -n "$clean" ]; then
    # Prepend to the trail (newest-first), keep only the most recent DID_SHOW lines.
    { printf '%s\n' "$clean"; [ -f "$DIDF" ] && cat "$DIDF"; } | head -n "$DID_SHOW" > "$DIDF.tmp" && mv "$DIDF.tmp" "$DIDF"
    # Full history: append-only, timestamped, oldest-first — the complete "what it did" summary.
    printf '%s  %s\n' "$(date '+%H:%M:%S')" "$clean" >> "$LOGF"
  fi
fi

# --- compose the tab title = base "— <last DID_SHOW dids>" (capped) ------------------------
# Same rendering the hook applies when it re-asserts; keeping it here means the /dev/tty stamp
# and Herdr rename below show the same composed string immediately.
compose() {
  base="$1"
  if [ -s "$DIDF" ]; then
    # Join the (newest-first) trail lines with ", "; cap the tail so it fits the sidebar.
    tail=$(awk 'NR>1{printf ", "}{printf "%s",$0}' "$DIDF")
    if [ -n "$tail" ]; then
      # Truncate tail to DID_TAIL_CAP chars, adding an ellipsis if we cut it.
      tlen=$(printf '%s' "$tail" | wc -c | tr -d ' ')
      if [ "$tlen" -gt "$DID_TAIL_CAP" ]; then
        tail=$(printf '%s' "$tail" | cut -c1-"$DID_TAIL_CAP")…
      fi
      printf '%s — %s' "$base" "$tail"
      return
    fi
  fi
  printf '%s' "$base"
}
COMPOSED=$(compose "$TITLE")

# Stamp the live tab now via OSC 0, written to this shell's controlling terminal.
# The interactive shell HAS a tty (unlike hooks); fall back silently if it doesn't.
{ printf '\033]0;%s\007' "$COMPOSED" > /dev/tty; } 2>/dev/null

# Herdr session: the OSC above (and the hooks' terminalSequence) drive the PANE's
# terminal_title; the TAB bar shows the tab LABEL, a separate value — mirror the composed
# status onto it so the Herdr tab reads the same as a VS Code tab would. Best-effort.
if [ -n "$HERDR_TAB_ID" ]; then
  HERDR_BIN=$(command -v herdr 2>/dev/null)
  [ -n "$HERDR_BIN" ] || HERDR_BIN="$HOME/.local/bin/herdr"
  [ -x "$HERDR_BIN" ] && "$HERDR_BIN" tab rename "$HERDR_TAB_ID" "$COMPOSED" >/dev/null 2>&1
fi

echo "tab titled: $COMPOSED"
[ -n "$DID" ] && echo "logged: $clean  (full summary → $LOGF)"
exit 0
