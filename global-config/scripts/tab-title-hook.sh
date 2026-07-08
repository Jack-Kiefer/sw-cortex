#!/bin/sh
# Claude Code hook: keeps this session's terminal-tab title asserted.
# Full docs: ~/.claude/scripts/TAB_TITLES.md
#
#   --bell       also request the terminal bell (Stop/Notification use this;
#                PostToolUse/UserPromptSubmit omit it so work doesn't ding constantly)
#   --activity   PostToolUse: append a live "· <activity>" suffix derived from the tool
#                call (e.g. "· editing extension.js") to the emitted title, so the tab
#                updates on every tool call between the model's own set-tab-title.sh calls.
#
# Hooks run with NO controlling terminal (Claude Code v2.1.139+), so we cannot write
# the title escape to /dev/tty ourselves. Instead we return it in the hook's JSON via
# `terminalSequence`; Claude Code emits it on our behalf, race-free and tmux-safe.
#
# Title state is keyed by SESSION ID (stable for the session's life; survives tty reuse).
# set-tab-title.sh writes ~/.claude/tab-titles/<session_id>; this hook reads it back.
#
# IMPORTANT: the --bell question-override and the --activity suffix are TRANSIENT — they
# change only what THIS invocation emits, never the persisted $F. So the model's semantic
# status (🔍/🔨/🧪…) is preserved; the next re-assert (or the model's own update) restores
# the clean title, and a question popup / live activity is layered on top only while relevant.

input=$(cat)

# Prefer the session id from the hook payload; fall back to the inherited env var.
sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$sid" ] || sid="$CLAUDE_CODE_SESSION_ID"
[ -n "$sid" ] || exit 0

F="$HOME/.claude/tab-titles/$sid"
[ -f "$F" ] || exit 0

# Strip a legacy "[repo] " prefix so old repo-prefixed state self-heals.
title=$(sed -E 's/^\[[^]]+\] //' "$F")
[ -n "$title" ] || exit 0

# `out` is what we actually emit this invocation — starts as the persisted title and may be
# transiently overridden below (question popup) or extended (live activity). $F is never touched.
out="$title"
# The "label" part of the stored title (what follows "· ", else the title minus its lead emoji).
case "$title" in
  *"· "*) label=${title##*· } ;;
  *) label=${title#* } ;;
esac

# --- Question popup → "❓ question · <label>" (Notification hook, transient) --------------
# Claude Code fires Notification with a notification_type discriminator. When it's a prompt
# that needs Jack (a permission/tool-approval popup, an MCP elicitation dialog, or a
# background session asking for input) the tab should SAY there's a question — automatically,
# without the model having to set 🙋 itself. Idle (idle_prompt) is NOT a question: it just
# means "your turn", so we leave the model's status alone there (bell only). This override is
# transient: when Jack answers, UserPromptSubmit → tab-title-default.sh --prompt demotes the
# lead emoji back to 🔨 and the persisted model label (untouched in $F) carries on.
if [ "$1" = "--bell" ]; then
  ntype=$(printf '%s' "$input" | jq -r '.notification_type // empty' 2>/dev/null)
  case "$ntype" in
    permission_prompt|elicitation_dialog|agent_needs_input)
      out="❓ question · ${label:-session}"
      ;;
  esac
fi

# --- Live tool activity → "<title> · <activity>" (PostToolUse hook, transient) -----------
# So the tab moves on EVERY tool call, not just when the model calls set-tab-title.sh. Derive
# a tiny activity phrase from the tool + its input; append it as a "· <activity>" suffix to the
# CURRENT emitted title. Persisted $F is untouched, so the model's semantic status still wins
# and the suffix simply reflects "what it's doing right now" between the model's own updates.
if [ "$1" = "--activity" ]; then
  tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
  act=""
  case "$tool" in
    Edit|Write|Read|NotebookEdit)
      fp=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
      [ -n "$fp" ] && fp=$(basename "$fp")
      case "$tool" in
        Read) [ -n "$fp" ] && act="reading $fp" ;;
        *)    [ -n "$fp" ] && act="editing $fp" ;;
      esac
      ;;
    Bash)
      cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
      # First bare word of the command (skip leading VAR=val assignments), capped.
      verb=$(printf '%s' "$cmd" | tr '\n' ' ' | awk '{for(i=1;i<=NF;i++){if($i!~/=/){print $i;exit}}}')
      [ -n "$verb" ] && act="running $verb"
      ;;
    Grep|Glob) act="searching" ;;
    Task) act="delegating" ;;
    WebFetch|WebSearch) act="web" ;;
    "") act="" ;;
    *) act="$tool" ;;  # MCP/other tools: show the tool name
  esac
  # Cap the activity so the suffix never blows out the tab width.
  if [ -n "$act" ]; then
    act=$(printf '%s' "$act" | cut -c1-24)
    out="$title · $act"
  fi
fi

# OSC 0 sets the tab/window title. All sequences below are on Claude Code's
# terminalSequence allowlist; CC emits them on our behalf (hooks have no tty).
esc=$(printf '\033]0;%s\007' "$out")

# Bell + done-notification only on idle events (Stop/Notification pass --bell).
if [ "$1" = "--bell" ]; then
  esc="$esc$(printf '\007')" # attention bell drives VS Code's tab attention-dot
  # When the session has finished (✅ as the LEADING status token, not just anywhere in the
  # label), raise a real desktop notification. VS Code's integrated terminal does NOT render
  # OSC 9 as an OS notification (it's swallowed), so we shell out to osascript — which talks
  # to WindowServer, not a terminal, so it works even though the hook has no tty.
  case "${title%% *}" in
    ✅)
      # De-dupe: Stop AND Notification both pass --bell and the ✅ state file persists until
      # SessionEnd, so without this a single "done" could toast repeatedly. Fire osascript only
      # when this exact ✅ title hasn't been notified yet (tracked in a per-session marker).
      NF="$F.notified"
      if [ "$(cat "$NF" 2>/dev/null)" != "$title" ]; then
        printf '%s' "$title" > "$NF"
        # Notification body = the label. If the title has a "· " separator, take what's
        # after it; otherwise drop just the leading emoji. (Portable: no GNU-only sed.)
        case "$title" in
          *"· "*) label=${title##*· } ;;
          *) label=${title#* } ;;
        esac
        if command -v osascript >/dev/null 2>&1; then
          osascript -e "display notification \"${label:-session} done\" with title \"Claude Code\"" >/dev/null 2>&1 &
        fi
      fi
      ;;
  esac
fi

# Emit the escape for Claude Code to write to the session PTY. Prefer jq for safe JSON
# encoding; if jq is unavailable, hand-encode (esc contains only ESC/BEL/printable, no quotes
# or backslashes in practice, but escape them defensively) so a missing jq never blanks the tab.
if command -v jq >/dev/null 2>&1; then
  jq -nc --arg seq "$esc" '{terminalSequence: $seq, suppressOutput: true}'
else
  enc=$(printf '%s' "$esc" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"terminalSequence":"%s","suppressOutput":true}\n' "$enc"
fi
exit 0
