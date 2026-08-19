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

# The "label" part of the stored BASE title (what follows "· ", else the title minus its lead
# emoji) — computed before the done-trail is folded in, so the question override reads clean.
case "$title" in
  *"· "*) label=${title##*· } ;;
  *) label=${title#* } ;;
esac

# --- Done-trail → "<title> — <last-two-dids>" (persisted; set-tab-title.sh --did writes it) ---
# set-tab-title.sh --did records what the session has finished in <sid>.did (newest-first, one
# phrase per line; the full timestamped history lives in <sid>.log). Re-assert that breadcrumb
# on the title here so a Stop/Notification/prompt re-paint keeps showing it — same rendering the
# setter used. This is NOT transient: it's part of the persisted status, appended before any
# transient activity/question layer below. `titled` = base title + done-trail.
titled="$title"
DIDF="$F.did"
if [ -s "$DIDF" ]; then
  dtail=$(awk 'NR>1{printf ", "}{printf "%s",$0}' "$DIDF")
  if [ -n "$dtail" ]; then
    dlen=$(printf '%s' "$dtail" | wc -c | tr -d ' ')
    [ "$dlen" -gt 44 ] && dtail=$(printf '%s' "$dtail" | cut -c1-44)…
    titled="$title — $dtail"
  fi
fi

# `out` is what we actually emit this invocation — starts as the persisted title+trail and may
# be transiently overridden below (question popup) or extended (live activity). $F is never touched.
out="$titled"

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
is_testing=0   # set when THIS tool call looks like testing/verifying → live status picks 🧪 not 🔨
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
      # Does the command look like a test/verify/lint/typecheck run? If so the live-status
      # block below shows 🧪 (testing) rather than 🔨 (building). Match the whole command
      # (not just the first word) so "npm run test:e2e", "npx vitest", "pytest -q" all count.
      case " $(printf '%s' "$cmd" | tr '\n' ' ') " in
        *" test"*|*" vitest"*|*"jest"*|*"pytest"*|*" tsc"*|*"typecheck"*|*" lint"*|*"eslint"*|*" verify"*|*"npm run test"*|*"npm test"*)
          is_testing=1 ;;
      esac
      ;;
    Grep|Glob) act="searching" ;;
    Task)
      act="delegating"
      # A verify/review subagent is a testing activity → 🧪.
      sa=$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // .tool_input.description // empty' 2>/dev/null)
      case "$sa" in
        *verify-app*|*code-review*|*security-review*|*verify*) is_testing=1 ;;
      esac
      ;;
    WebFetch|WebSearch) act="web" ;;
    "") act="" ;;
    *) act="$tool" ;;  # MCP/other tools: show the tool name
  esac
  # Cap the activity so the suffix never blows out the tab width. Appends to the composed
  # title+trail ($titled) so the live "· <activity>" rides after the done-breadcrumb.
  if [ -n "$act" ]; then
    act=$(printf '%s' "$act" | cut -c1-24)
    out="$titled · $act"
  fi
fi

# --- Working NOW → force 🔨/🧪 so a busy tab can never show a checkmark (transient) --------
# The whole point: the leading status emoji must reflect what the agent is ACTUALLY doing right
# now, not a self-report the model froze earlier. The reliable "working right now" signal is the
# hook EVENT itself, not Herdr's screen-scraped agent_status (which reads "idle" even mid-turn):
# PostToolUse (--activity) fires only WHILE a turn is active — a tool just ran and the turn
# hasn't stopped — so on --activity the agent is, by definition, working. When working, a
# ✅/🔍/🙋 leading emoji is a lie; force it to 🔨 (building) or 🧪 (testing) so a busy tab can
# NEVER show a checkmark (Jack: "if it is working on something don't do the check mark"). This
# fires on EVERY tool call, so the emoji flips within one tool call of work starting — including
# the moment a re-prompted ✅ tab starts working again.
#
# NON-working repaints (--bell = Stop/Notification, plain SubagentStop) are left alone: idle/done
# keeps the session's own ✅/🔍, and a waiting/blocked pane is carried by Herdr's own live dot in
# the sidebar (no emoji forced — Jack: "for waiting don't have anything because herdr has a dot").
# This override is TRANSIENT — it rewrites $out only, never $F. Skipped when $out already leads ❓
# (a live question popup override must win).
if [ "$1" = "--activity" ]; then
  case "$out" in
    "❓ "*) : ;;  # question popup override active — don't touch it
    *)
      # Pick the forced emoji: the live tool wins (test/verify/lint/review → 🧪); else keep the
      # model's own 🔨/🧪 if it chose one; else default to 🔨 (building).
      if [ "$is_testing" = 1 ]; then
        femoji="🧪"
      else
        case "$out" in
          "🧪 "*) femoji="🧪" ;;
          *)      femoji="🔨" ;;
        esac
      fi
      # Strip whatever status emoji currently leads $out (any of the known set), then prepend
      # the forced one — keeping the description, "· activity" suffix, and "— trail" intact.
      rest="$out"
      for e in "🔨" "🧪" "🔍" "📋" "🙋" "❓" "📦" "✅" "📝" "⬆️" "🚀" "🎯" "❌"; do
        case "$rest" in "$e "*) rest="${rest#"$e" }"; break ;; esac
      done
      out="$femoji $rest"
      ;;
  esac
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
