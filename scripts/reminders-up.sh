#!/usr/bin/env bash
# Idempotently start (and health-check) the local reminder services on this Mac:
#   1. slack-handler.ts   — Socket Mode button handler (snooze/done/delete) via Jack Bot
#   2. check-reminders loop — fires due reminders every 60s (DMs from Jack Bot)
#
# Safe to run repeatedly: only starts what isn't already running, AND repairs a
# running-but-broken handler. Called by /start-day (Step 0, check #9) so reminders
# work each morning. Both processes are local and stop when the Mac is off — this
# is the "turn them back on" step.
#
# Health gate (why this is more than a pgrep): the button handler can be RUNNING
# yet dead — if JACK_SLACK_BOT_TOKEN is missing/corrupt (e.g. a duplicate .env key
# that resolves to a team id), the handler authenticates with a bad token and
# every button click fails (⚠️ in Slack) while pgrep still finds the process. So
# we verify the token with Slack auth.test and RESTART a present-but-unhealthy
# handler instead of reporting a false ✅.
#
# Logs: /tmp/sw-cortex-slack-handler.log, /tmp/sw-cortex-reminders-loop.log
set -u

ROOT="/Users/jackkief/Desktop/Projects/sw-cortex"
cd "$ROOT" || { echo "❌ cannot cd to $ROOT"; exit 1; }

started=()
already=()
repaired=()
warn=()

# --- Load .env the way the Node scripts do (dotenv: last duplicate key wins). ---
# Only pull the two vars the handler needs so we can validate them here. This
# mirrors dotenv semantics so a corrupt/duplicated key is caught, not masked.
env_get() {
  # Prints the value of the LAST matching KEY=... line in .env (dotenv precedence).
  local key="$1"
  grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | tail -n1 | cut -d= -f2-
}

BOT_TOKEN="$(env_get JACK_SLACK_BOT_TOKEN)"
APP_TOKEN="$(env_get REMINDER_APP_TOKEN)"

# Returns 0 if the bot token authenticates as a real bot user, 1 otherwise.
token_ok() {
  [ -n "$BOT_TOKEN" ] || return 1
  # xoxb tokens start with "xoxb-"; a team id (T…) or empty is the classic corruption.
  case "$BOT_TOKEN" in xoxb-*) : ;; *) return 1 ;; esac
  local resp
  resp="$(curl -s -X POST https://slack.com/api/auth.test \
    -H "Authorization: Bearer ${BOT_TOKEN}" \
    -H "Content-Type: application/x-www-form-urlencoded" 2>/dev/null)"
  # ok:true means the token is a valid bot token.
  printf '%s' "$resp" | grep -q '"ok":true'
}

HEALTHY=1
if ! token_ok; then
  HEALTHY=0
  warn+=("JACK_SLACK_BOT_TOKEN failed auth.test — check .env (a duplicate key resolving to a team id like T… is the known corruption); buttons will show ⚠️ until fixed")
fi
if [ -z "$APP_TOKEN" ]; then
  warn+=("REMINDER_APP_TOKEN not set — Socket Mode can't connect")
fi

# --- 1. Button handler (Socket Mode) ---
handler_running() { pgrep -f "slack-handler.ts" >/dev/null 2>&1; }

start_handler() {
  nohup npx tsx scripts/slack-handler.ts > /tmp/sw-cortex-slack-handler.log 2>&1 &
  disown
}

if handler_running; then
  if [ "$HEALTHY" -eq 1 ]; then
    already+=("button-handler")
  else
    # Present-but-unhealthy: the process exists but its token is bad, so it's
    # silently eating clicks. Kill it and restart so it re-reads a fixed .env.
    pkill -f "slack-handler.ts" >/dev/null 2>&1
    sleep 1
    if [ "$(env_get JACK_SLACK_BOT_TOKEN)" != "" ] && token_ok; then
      start_handler
      repaired+=("button-handler")
    else
      # Token still bad — restarting won't help; leave it down and warn loudly.
      warn+=("button-handler NOT restarted — token still invalid; fix .env then re-run reminders-up.sh")
    fi
  fi
else
  if [ "$HEALTHY" -eq 1 ]; then
    start_handler
    started+=("button-handler")
  else
    warn+=("button-handler NOT started — token invalid; fix .env then re-run reminders-up.sh")
  fi
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
if [ ${#repaired[@]} -gt 0 ]; then
  echo "♻️  repaired (restarted unhealthy): ${repaired[*]}"
fi
if [ ${#already[@]} -gt 0 ]; then
  echo "✅ already running: ${already[*]}"
fi
if [ ${#warn[@]} -gt 0 ]; then
  for w in "${warn[@]}"; do echo "⚠️  $w"; done
fi
echo "reminders services checked (handler + 60s checker loop)"
