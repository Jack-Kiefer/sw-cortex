#!/usr/bin/env bash
# Install (or reload) the macOS LaunchAgent that keeps the local /remind services
# alive on Jack's Mac.
#
# What it does: copies com.jackkief.sw-cortex-reminders.plist into
# ~/Library/LaunchAgents and (re)loads it. Once loaded, launchd runs
# reminders-up.sh at login and every 10 minutes, so the Socket Mode button
# handler + checker loop self-heal after a sleep/restart WITHOUT waiting for the
# next /start-day. reminders-up.sh is idempotent, so the 10-minute cadence is a
# cheap no-op when both processes are already healthy.
#
# ── macOS TCC caveat (why the one-time Full Disk Access grant is required) ──
# The sw-cortex repo lives under ~/Desktop, which macOS TCC protects. A
# launchd-spawned process does NOT inherit the Terminal's file-access grant, so
# by default it gets "Operation not permitted" reading anything under ~/Desktop
# — including reminders-up.sh, .env, and the .ts files it runs. The fix is a
# one-time Full Disk Access grant to /bin/bash (the program launchd runs).
# This script PROBES for the block and prints the exact steps if it's present.
#
# Safe to run repeatedly. Idempotent: it always bootout-then-bootstrap so an
# edited plist is picked up.
set -euo pipefail

LABEL="com.jackkief.sw-cortex-reminders"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/${LABEL}.plist"
DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
REPO_SCRIPT="/Users/jackkief/Desktop/Projects/sw-cortex/scripts/reminders-up.sh"

[ -f "$SRC" ] || { echo "❌ plist not found: $SRC"; exit 1; }

mkdir -p "${HOME}/Library/LaunchAgents"
cp "$SRC" "$DEST"
echo "📄 installed $DEST"

# Reload: bootout the old instance (ignore "not loaded"), then bootstrap the new.
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$DEST"
echo "🔧 loaded $LABEL (RunAtLoad + every 10 min)"

# Kick it once now so the services come up immediately, not at the next interval.
launchctl kickstart -k "$DOMAIN/$LABEL" 2>/dev/null || true
sleep 4

# ── Self-verify: did the agent actually run the script, or was it TCC-blocked? ──
# The agent's stdout/stderr go to this log. "Operation not permitted" there means
# /bin/bash lacks Full Disk Access and can't read the ~/Desktop repo.
AGENT_LOG="/tmp/sw-cortex-reminders-agent.log"
if grep -q "Operation not permitted" "$AGENT_LOG" 2>/dev/null; then
  echo ""
  echo "⚠️  BLOCKED by macOS TCC — the agent is loaded but can't read the repo under ~/Desktop."
  echo "    One-time fix: grant Full Disk Access to /bin/bash, then re-run this script."
  echo ""
  echo "    1. Open System Settings → Privacy & Security → Full Disk Access"
  echo "    2. Click + (you may need to unlock). Press Cmd+Shift+G and enter:  /bin/bash"
  echo "    3. Add it and make sure its toggle is ON."
  echo "    4. Re-run:  bash scripts/launchd/install-reminders-agent.sh"
  echo ""
  echo "    (Until then the handler still comes up via /start-day check #9 — this"
  echo "     agent just adds the automatic between-mornings self-heal.)"
  exit 2
fi

echo "✅ reminders LaunchAgent active — self-heals the handler within ~10 min of any death"
echo "   logs: $AGENT_LOG"
echo "   check: launchctl print $DOMAIN/$LABEL | grep -E 'state|pid'"
