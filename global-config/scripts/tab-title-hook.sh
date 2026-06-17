#!/bin/sh
# Claude Code hook: keeps this session's terminal-tab title asserted.
# Full docs: ~/.claude/scripts/TAB_TITLES.md
#
#   --bell   also request the terminal bell (Stop/Notification use this;
#            PostToolUse/UserPromptSubmit omit it so work doesn't ding constantly)
#
# Hooks run with NO controlling terminal (Claude Code v2.1.139+), so we cannot write
# the title escape to /dev/tty ourselves. Instead we return it in the hook's JSON via
# `terminalSequence`; Claude Code emits it on our behalf, race-free and tmux-safe.
#
# Title state is keyed by SESSION ID (stable for the session's life; survives tty reuse).
# set-tab-title.sh writes ~/.claude/tab-titles/<session_id>; this hook reads it back.

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

# OSC 0 sets the tab/window title. All sequences below are on Claude Code's
# terminalSequence allowlist; CC emits them on our behalf (hooks have no tty).
esc=$(printf '\033]0;%s\007' "$title")

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
