#!/usr/bin/env bash
# Idempotently start the local reminder services on this Mac:
#   1. slack-handler.ts   — Socket Mode button handler (snooze/done/delete) via Jack Bot
#   2. check-reminders loop — fires due reminders every 60s (DMs from Jack Bot)
#
# Safe to run repeatedly: only starts what isn't already running. Called by
# /start-day (Step 0, check #9) so reminders work each morning. Both processes
# are local and stop when the Mac is off — this is the "turn them back on" step.
#
# Logs: /tmp/sw-cortex-slack-handler.log, /tmp/sw-cortex-reminders-loop.log
set -u

ROOT="/Users/jackkief/Desktop/Projects/sw-cortex"
cd "$ROOT" || { echo "❌ cannot cd to $ROOT"; exit 1; }

started=()
already=()

# --- 1. Button handler (Socket Mode) ---
if pgrep -f "slack-handler.ts" >/dev/null 2>&1; then
  already+=("button-handler")
else
  nohup npx tsx scripts/slack-handler.ts > /tmp/sw-cortex-slack-handler.log 2>&1 &
  disown
  started+=("button-handler")
fi

# --- 2. Every-minute checker loop ---
# Guard on the loop marker so we don't stack multiple loops.
if pgrep -f "reminders-loop" >/dev/null 2>&1; then
  already+=("checker-loop")
else
  # A named bash loop: run check-reminders every 60s. The "reminders-loop"
  # string in the arg is the pgrep marker above.
  nohup bash -c 'while true; do npx tsx scripts/check-reminders.ts >> /tmp/sw-cortex-reminders-loop.log 2>&1; sleep 60; done # reminders-loop' \
    > /tmp/sw-cortex-reminders-loop.log 2>&1 &
  disown
  started+=("checker-loop")
fi

# --- Report ---
if [ ${#started[@]} -gt 0 ]; then
  echo "🔧 started: ${started[*]}"
fi
if [ ${#already[@]} -gt 0 ]; then
  echo "✅ already running: ${already[*]}"
fi
echo "reminders services up (handler + 60s checker loop)"
