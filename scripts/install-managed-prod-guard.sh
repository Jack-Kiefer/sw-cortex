#!/usr/bin/env bash
# install-managed-prod-guard.sh — install prod-guard as a MANAGED (root-owned) Claude Code policy.
#
# Jack runs this once, himself, in a terminal:
#   sudo bash /Users/jackkief/Desktop/Projects/sw-cortex/scripts/install-managed-prod-guard.sh
# Re-run it after prod_guard.py changes to refresh the root-owned copy.
#
# Why managed: ~/.claude/settings.json and ~/.claude/scripts (a symlink into the hub checkout)
# are writable by any Claude session running as jackkief, so a misfiring session could edit or
# unregister the user-level guard. Managed settings live in a root-owned system directory that
# a session cannot write (sudo needs Jack's password), user/project `disableAllHooks` cannot
# turn managed hooks off, and `disableBypassPermissionsMode` set here cannot be loosened lower down.
#
# What it writes (nothing else is touched):
#   /Library/Application Support/ClaudeCode/prod-guard/{prod-guard.sh,prod_guard.py}   root:wheel
#   /Library/Application Support/ClaudeCode/managed-settings.d/50-prod-guard.json       root:wheel 0644
# Uninstall: sudo rm -rf "/Library/Application Support/ClaudeCode/prod-guard" \
#              "/Library/Application Support/ClaudeCode/managed-settings.d/50-prod-guard.json"

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../global-config/scripts" && pwd -P)"
SYS="/Library/Application Support/ClaudeCode"
DEST="$SYS/prod-guard"
DROPIN="$SYS/managed-settings.d/50-prod-guard.json"

for f in prod-guard.sh prod_guard.py; do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }
done

install -d -o root -g wheel -m 0755 "$SYS" "$DEST" "$SYS/managed-settings.d"
install -o root -g wheel -m 0755 "$SRC/prod-guard.sh" "$DEST/prod-guard.sh"
install -o root -g wheel -m 0644 "$SRC/prod_guard.py" "$DEST/prod_guard.py"

MATCHER='Bash|mcp__db__query_database|mcp__db__query_database_from_file|mcp__serp-orm__serp_sql|mcp__serp-orm__serp_unlink|mcp__serp-api__api_call|mcp__serpy__serpy_approve|mcp__serpy__serpy_reject|mcp__serpy-dev__serpy_approve|mcp__serpy-dev__serpy_reject|mcp__python__run_python'

tmp="$(mktemp)"
/usr/bin/python3 -I - "$tmp" "$DEST/prod-guard.sh" "$MATCHER" <<'PY'
import json, sys
out, hook, matcher = sys.argv[1:4]
policy = {
    "permissions": {
        "disableBypassPermissionsMode": "disable",
        "deny": [
            "Bash(kubectl delete namespace *)",
            "Bash(kubectl delete ns *)",
            "Bash(k3s-uninstall.sh*)",
            "Bash(k3s-killall.sh*)",
        ],
    },
    "hooks": {
        "PreToolUse": [
            {"matcher": matcher,
             "hooks": [{"type": "command", "command": "'%s'" % hook, "timeout": 30, "onFailure": "block"}]}
        ]
    },
}
with open(out, "w") as fh:
    json.dump(policy, fh, indent=2)
    fh.write("\n")
PY
install -o root -g wheel -m 0644 "$tmp" "$DROPIN"
rm -f "$tmp"

# Smoke test the installed copy (JSON on stdin only; nothing is executed).
probe='{"tool_name":"Bash","tool_input":{"command":"ssh jack@5.161.95.56 kubectl delete namespace serp"},"cwd":"/tmp"}'
if printf '%s' "$probe" | sudo -u "${SUDO_USER:-nobody}" "$DEST/prod-guard.sh" | grep -q '"deny"'; then
  echo "✅ prod-guard installed as managed policy:"
  echo "   $DEST"
  echo "   $DROPIN"
  echo "   Restart Claude Code / Desktop sessions to load it. Check with /status (managed settings source)."
else
  echo "❌ installed, but the smoke test did not return deny — check $DEST" >&2
  exit 1
fi
