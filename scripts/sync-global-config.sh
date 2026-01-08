#!/bin/bash
# Sync global Claude config between sw-cortex and ~/.claude

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
GLOBAL_CONFIG="$REPO_DIR/global-config"

usage() {
    echo "Usage: $0 [push|pull|status]"
    echo ""
    echo "Commands:"
    echo "  push    Copy from sw-cortex/global-config to ~/.claude (deploy)"
    echo "  pull    Copy from ~/.claude to sw-cortex/global-config (backup)"
    echo "  status  Show diff between repo and global config"
    exit 1
}

push_config() {
    echo "Pushing global config from sw-cortex to ~/.claude..."

    mkdir -p ~/.claude/commands ~/.claude/skills

    # Copy commands
    cp "$GLOBAL_CONFIG/commands/"*.md ~/.claude/commands/
    echo "  ✓ Commands synced"

    # Copy skills
    cp -r "$GLOBAL_CONFIG/skills/"* ~/.claude/skills/
    echo "  ✓ Skills synced"

    # Copy MCP config
    cp "$GLOBAL_CONFIG/mcp.json" ~/.mcp.json
    echo "  ✓ MCP config synced"

    # Copy global CLAUDE.md
    cp "$GLOBAL_CONFIG/CLAUDE.md" ~/CLAUDE.md
    echo "  ✓ CLAUDE.md synced"

    echo ""
    echo "Done! Restart Claude Code to pick up changes."
}

pull_config() {
    echo "Pulling global config from ~/.claude to sw-cortex..."

    # Copy commands
    cp ~/.claude/commands/*.md "$GLOBAL_CONFIG/commands/" 2>/dev/null || true
    echo "  ✓ Commands backed up"

    # Copy skills
    cp -r ~/.claude/skills/* "$GLOBAL_CONFIG/skills/" 2>/dev/null || true
    echo "  ✓ Skills backed up"

    # Copy MCP config
    cp ~/.mcp.json "$GLOBAL_CONFIG/mcp.json" 2>/dev/null || true
    echo "  ✓ MCP config backed up"

    # Copy global CLAUDE.md
    cp ~/CLAUDE.md "$GLOBAL_CONFIG/CLAUDE.md" 2>/dev/null || true
    echo "  ✓ CLAUDE.md backed up"

    echo ""
    echo "Done! Don't forget to commit changes."
}

show_status() {
    echo "Global config status:"
    echo ""

    echo "=== Commands ==="
    diff -rq "$GLOBAL_CONFIG/commands" ~/.claude/commands 2>/dev/null || echo "(differences found)"

    echo ""
    echo "=== Skills ==="
    diff -rq "$GLOBAL_CONFIG/skills" ~/.claude/skills 2>/dev/null || echo "(differences found)"

    echo ""
    echo "=== MCP Config ==="
    diff -q "$GLOBAL_CONFIG/mcp.json" ~/.mcp.json 2>/dev/null || echo "(differences found)"

    echo ""
    echo "=== CLAUDE.md ==="
    diff -q "$GLOBAL_CONFIG/CLAUDE.md" ~/CLAUDE.md 2>/dev/null || echo "(differences found)"
}

case "${1:-}" in
    push)
        push_config
        ;;
    pull)
        pull_config
        ;;
    status)
        show_status
        ;;
    *)
        usage
        ;;
esac
