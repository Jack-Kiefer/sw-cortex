#!/usr/bin/env bash
# prod-guard.sh — PreToolUse guard against destructive actions on production.
#
# Thin shim: the logic lives in prod_guard.py next to this file (shlex parsing, recursive
# unwrapping of ssh / bash -c / eval / sudo / heredocs). See that file's header and
# docs/prod-guardrails-handoff.md. Registered with "onFailure": "block", so a crash or
# timeout blocks the call instead of letting it through.
#
# Tests: scripts/test-prod-guard.sh (feeds JSON on stdin; never executes a command).

set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec /usr/bin/python3 -I "$here/prod_guard.py"
