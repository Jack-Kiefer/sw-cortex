#!/bin/bash
# Run a command with keychain://<item>/<KEY> references in an .env resolved from the macOS Keychain.
#   vault-run.sh [--env-file <path>]... -- <command> [args...]
# Defaults to ./.env. Keeps the caller's working directory.
CORTEX="${SW_CORTEX:-$HOME/Desktop/Projects/sw-cortex}"
exec node --import "$CORTEX/node_modules/tsx/dist/loader.mjs" "$CORTEX/src/mcp-servers/vault/run.ts" "$@"
