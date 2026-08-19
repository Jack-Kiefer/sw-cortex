#!/bin/sh
# Claude Code hook (SessionStart / UserPromptSubmit): guarantee EVERY session has a tab
# title, even if the model never calls set-tab-title.sh. Full docs: ~/.claude/scripts/TAB_TITLES.md
#
# Writes a default "🔍 <repo> · session" title keyed by session id IFF none is set yet,
# then emits it via terminalSequence. Once the model sets a real status, that file exists
# and this no-ops — so the model's richer titles always win; this is only the floor.

input=$(cat)

sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[ -n "$sid" ] || sid="$CLAUDE_CODE_SESSION_ID"
[ -n "$sid" ] || exit 0

DIR="$HOME/.claude/tab-titles"
F="$DIR/$sid"
# A title already exists → leave it (the model owns the status); just re-assert it.
if [ -f "$F" ]; then
  title=$(sed -E 's/^\[[^]]+\] //' "$F")
  # On UserPromptSubmit ONLY (caller passes "--prompt"): if the tab is currently in a
  # RESTING state — 🙋 (approve?), ❓ (blocked), or ✅ (done) — Jack just replied, so the
  # session is no longer waiting/finished: it's working again NOW. Demote the leading emoji
  # to 🔨 (working) and keep the "· label" intact, then persist it so the next re-assert keeps
  # the working state. ✅ is included because a re-prompted "done" tab must drop its checkmark
  # the instant Jack asks it something (Jack: "if I ask a question after it does checkmark it
  # should remove it"). SessionStart (no "--prompt") never demotes — it only re-asserts verbatim.
  if [ "$1" = "--prompt" ]; then
    case "$title" in
      "🙋 "*|"❓ "*|"✅ "*)
        # Rebuild as "🔨 <label>". If the title has a "· " separator, the label is what
        # follows it ("🙋 approve? · merge-quants" → "🔨 applying fix · merge-quants");
        # otherwise strip the leading status emoji and keep the description
        # ("✅ Reminders fixed" → "🔨 Reminders fixed"), so the words Jack chose survive.
        case "$title" in
          *"· "*) title="🔨 applying fix · ${title##*· }" ;;
          *) title="🔨 ${title#* }" ;;
        esac
        printf '%s' "$title" > "$F"
        # A fresh turn starts here — drop the stale done-notification marker so a later ✅
        # can toast again, matching the tab's new working→done cycle.
        rm -f "$F.notified"
        ;;
    esac
  fi
else
  # /go-launched sessions export CLAUDE_GO_TITLE (the descriptive launch name). Seed the floor
  # from it so the tab keeps that name from boot — instead of regressing to "🔍 <repo> · session"
  # (which, under the hub model, would wrongly read the repo as the status). Fall back to repo.
  if [ -n "$CLAUDE_GO_TITLE" ]; then
    title="$CLAUDE_GO_TITLE"
  else
    cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
    [ -n "$cwd" ] || cwd="$PWD"
    repo=$(basename "$cwd" 2>/dev/null)
    [ -n "$repo" ] || repo="session"
    # The sw-cortex hub is the long-lived manual session Jack keeps open — never /go-launched,
    # so it always lands on this floor. Plain "hub" with NO leading emoji (Jack: "I don't want
    # the 🎯 for hub anymore"): Herdr's own live state_icon carries the status, and the moment
    # the hub takes a task it sets its own 🔨/🔍/… over this floor anyway. "🔍 sw-cortex ·
    # session" is likewise avoided — it wrongly reads the repo as the status.
    if [ "$repo" = "sw-cortex" ]; then
      title="hub"
    else
      title="🔍 $repo · session"
    fi
  fi
  mkdir -p "$DIR"
  printf '%s' "$title" > "$F"
fi
[ -n "$title" ] || exit 0

esc=$(printf '\033]0;%s\007' "$title")
if command -v jq >/dev/null 2>&1; then
  jq -nc --arg seq "$esc" '{terminalSequence: $seq, suppressOutput: true}'
else
  enc=$(printf '%s' "$esc" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"terminalSequence":"%s","suppressOutput":true}\n' "$enc"
fi
exit 0
