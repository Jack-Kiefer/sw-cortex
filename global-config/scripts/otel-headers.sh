#!/bin/bash
# otelHeadersHelper for Claude Code: emits the OTLP auth header as JSON.
# The secret lives only in ~/.claude/telemetry.env (chmod 600, never committed).
# Project settings can no longer enable telemetry (Claude Code 2.1.282+), so it is set at user level.
set -euo pipefail
f="$HOME/.claude/telemetry.env"
[ -r "$f" ] || { echo '{}'; exit 0; }
# shellcheck disable=SC1090
source "$f"
python3 -c 'import json,sys
h={}
for pair in sys.argv[1].split(","):
    if "=" in pair:
        k,v=pair.split("=",1); h[k.strip()]=v.strip()
print(json.dumps(h))' "${OTEL_EXPORTER_OTLP_HEADERS:-}"
