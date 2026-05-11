#!/bin/bash
# Sync global Claude config between sw-cortex and ~/.claude
# Merges configurations rather than overwriting
# Supports both macOS and Linux with cross-platform path handling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
GLOBAL_CONFIG="$REPO_DIR/global-config"

# Path to the sw-cortex repo (used to expand {{SW_CORTEX}} in mcp.json.template).
# Defaults to the repo containing this script — override with SW_CORTEX_PATH env var
# if you need to template a different location (e.g. building config for another machine).
SW_CORTEX="${SW_CORTEX_PATH:-$REPO_DIR}"

usage() {
    echo "Usage: $0 [push|pull|status]"
    echo ""
    echo "Commands:"
    echo "  push    Merge sw-cortex/global-config into ~/.claude (deploy)"
    echo "  pull    Merge ~/.claude into sw-cortex/global-config (backup)"
    echo "  status  Show diff between repo and global config"
    echo ""
    echo "Note: push/pull MERGE configs, they don't overwrite."
    echo "      Existing commands/skills/servers are preserved."
    exit 1
}

# Merge two JSON files, combining mcpServers objects
merge_mcp_json() {
    local source="$1"
    local target="$2"

    if [ ! -f "$target" ]; then
        cp "$source" "$target"
        return
    fi

    # Use node to merge JSON (jq alternative that's more likely to be installed)
    node -e "
        const fs = require('fs');
        const source = JSON.parse(fs.readFileSync('$source', 'utf8'));
        const target = JSON.parse(fs.readFileSync('$target', 'utf8'));

        // Merge mcpServers (source takes precedence for conflicts)
        const merged = {
            ...target,
            mcpServers: {
                ...(target.mcpServers || {}),
                ...(source.mcpServers || {})
            }
        };

        fs.writeFileSync('$target', JSON.stringify(merged, null, 2));
        console.log('  Merged MCP servers: ' + Object.keys(merged.mcpServers).join(', '));
    "
}

# Merge settings.json, combining allow lists
merge_settings_json() {
    local source="$1"
    local target="$2"

    if [ ! -f "$target" ]; then
        cp "$source" "$target"
        return
    fi

    node -e "
        const fs = require('fs');
        const source = JSON.parse(fs.readFileSync('$source', 'utf8'));
        const target = JSON.parse(fs.readFileSync('$target', 'utf8'));

        // Merge permissions.allow (deduplicate)
        const sourceAllow = source.permissions?.allow || [];
        const targetAllow = target.permissions?.allow || [];
        const mergedAllow = [...new Set([...targetAllow, ...sourceAllow])];

        // Merge hooks (source overwrites)
        const merged = {
            ...target,
            ...source,
            permissions: {
                ...target.permissions,
                ...source.permissions,
                allow: mergedAllow
            }
        };

        fs.writeFileSync('$target', JSON.stringify(merged, null, 2));
        console.log('  Merged ' + mergedAllow.length + ' permission entries');
    "
}

push_config() {
    echo "Pushing global config from sw-cortex to ~/.claude (merge mode)..."
    echo ""

    mkdir -p ~/.claude/commands ~/.claude/skills

    # Copy commands (add new, don't remove existing)
    echo "Commands:"
    for cmd in "$GLOBAL_CONFIG/commands/"*.md; do
        if [ -f "$cmd" ]; then
            name=$(basename "$cmd")
            cp "$cmd" ~/.claude/commands/
            echo "  + $name"
        fi
    done

    # Copy skills (add new, don't remove existing)
    echo ""
    echo "Skills:"
    for skill in "$GLOBAL_CONFIG/skills/"*/; do
        if [ -d "$skill" ]; then
            name=$(basename "$skill")
            cp -r "$skill" ~/.claude/skills/
            echo "  + $name"
        fi
    done

    # Expand and merge MCP config template
    echo ""
    echo "MCP Config:"
    if [ -f "$GLOBAL_CONFIG/mcp.json.template" ]; then
        echo "  sw-cortex path: $SW_CORTEX"

        # Expand template with this machine's repo path, then expand ${VAR}
        # placeholders from the repo's .env (e.g. SLACK_BOT_TOKEN). Tokens never
        # live in the template — they come from .env at push time.
        TEMP_MCP=$(mktemp)
        sed "s|{{SW_CORTEX}}|$SW_CORTEX|g" "$GLOBAL_CONFIG/mcp.json.template" > "$TEMP_MCP"

        if [ -f "$SW_CORTEX/.env" ]; then
            EXPANDED=$(mktemp)
            # Only export the specific vars the template references — avoids
            # sourcing the whole .env (which breaks on unquoted special chars
            # in values like passwords).
            NEEDED=$(grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' "$TEMP_MCP" | tr -d '${}' | sort -u)
            (
                for var in $NEEDED; do
                    value=$(grep -E "^${var}=" "$SW_CORTEX/.env" | head -1 | cut -d= -f2-)
                    export "$var"="$value"
                done
                envsubst < "$TEMP_MCP" > "$EXPANDED"
            )
            mv "$EXPANDED" "$TEMP_MCP"
        fi

        # Merge with existing config
        merge_mcp_json "$TEMP_MCP" ~/.mcp.json
        rm "$TEMP_MCP"
    elif [ -f "$GLOBAL_CONFIG/mcp.json" ]; then
        # Fallback to static file if template doesn't exist
        merge_mcp_json "$GLOBAL_CONFIG/mcp.json" ~/.mcp.json
    fi

    # Copy global CLAUDE.md (this one we do overwrite - it's the canonical source)
    echo ""
    echo "CLAUDE.md:"
    if [ -f "$GLOBAL_CONFIG/CLAUDE.md" ]; then
        cp "$GLOBAL_CONFIG/CLAUDE.md" ~/CLAUDE.md
        echo "  Updated ~/CLAUDE.md"
    fi

    # Merge settings.json
    echo ""
    echo "Settings:"
    if [ -f "$GLOBAL_CONFIG/settings.json" ]; then
        merge_settings_json "$GLOBAL_CONFIG/settings.json" ~/.claude/settings.json
    fi

    echo ""
    echo "Done! Restart Claude Code to pick up changes."
}

pull_config() {
    echo "Pulling global config from ~/.claude to sw-cortex (merge mode)..."
    echo ""

    mkdir -p "$GLOBAL_CONFIG/commands" "$GLOBAL_CONFIG/skills"

    # Copy commands
    echo "Commands:"
    for cmd in ~/.claude/commands/*.md; do
        if [ -f "$cmd" ]; then
            name=$(basename "$cmd")
            cp "$cmd" "$GLOBAL_CONFIG/commands/"
            echo "  + $name"
        fi
    done 2>/dev/null || echo "  (none found)"

    # Copy skills
    echo ""
    echo "Skills:"
    for skill in ~/.claude/skills/*/; do
        if [ -d "$skill" ]; then
            name=$(basename "$skill")
            cp -r "$skill" "$GLOBAL_CONFIG/skills/"
            echo "  + $name"
        fi
    done 2>/dev/null || echo "  (none found)"

    # MCP Config - template is source of truth, don't pull
    echo ""
    echo "MCP Config:"
    echo "  (skipped - mcp.json.template is source of truth)"
    echo "  Template uses {{SW_CORTEX}} placeholder, expanded on push"

    # Copy global CLAUDE.md
    echo ""
    echo "CLAUDE.md:"
    if [ -f ~/CLAUDE.md ]; then
        cp ~/CLAUDE.md "$GLOBAL_CONFIG/CLAUDE.md"
        echo "  Backed up ~/CLAUDE.md"
    fi

    # Merge settings.json
    echo ""
    echo "Settings:"
    if [ -f ~/.claude/settings.json ]; then
        merge_settings_json ~/.claude/settings.json "$GLOBAL_CONFIG/settings.json"
    fi

    echo ""
    echo "Done! Don't forget to commit changes."
}

show_status() {
    echo "Global config status:"
    echo ""

    echo "=== Commands ==="
    if [ -d ~/.claude/commands ]; then
        echo "In repo:"
        ls -1 "$GLOBAL_CONFIG/commands/"*.md 2>/dev/null | xargs -I{} basename {} | sed 's/^/  /'
        echo "In ~/.claude:"
        ls -1 ~/.claude/commands/*.md 2>/dev/null | xargs -I{} basename {} | sed 's/^/  /'
    fi

    echo ""
    echo "=== Skills ==="
    if [ -d ~/.claude/skills ]; then
        echo "In repo:"
        ls -1d "$GLOBAL_CONFIG/skills/"*/ 2>/dev/null | xargs -I{} basename {} | sed 's/^/  /'
        echo "In ~/.claude:"
        ls -1d ~/.claude/skills/*/ 2>/dev/null | xargs -I{} basename {} | sed 's/^/  /'
    fi

    echo ""
    echo "=== MCP Servers ==="
    echo "Template (mcp.json.template):"
    if [ -f "$GLOBAL_CONFIG/mcp.json.template" ]; then
        node -e "const j=JSON.parse(require('fs').readFileSync('$GLOBAL_CONFIG/mcp.json.template','utf8')); console.log(Object.keys(j.mcpServers||{}).map(k=>'  '+k).join('\n'))" 2>/dev/null || echo "  (parse error)"
        echo "  ({{SW_CORTEX}} expands to $SW_CORTEX on this machine)"
    else
        echo "  (template not found)"
    fi
    echo ""
    echo "Deployed (~/.mcp.json):"
    if [ -f ~/.mcp.json ]; then
        node -e "const j=require(process.env.HOME+'/.mcp.json'); console.log(Object.keys(j.mcpServers||{}).map(k=>'  '+k).join('\n'))" 2>/dev/null || echo "  (none)"
    else
        echo "  (not deployed)"
    fi

    echo ""
    echo "=== File Diffs ==="
    diff -q "$GLOBAL_CONFIG/CLAUDE.md" ~/CLAUDE.md 2>/dev/null && echo "CLAUDE.md: identical" || echo "CLAUDE.md: differs"
    diff -q "$GLOBAL_CONFIG/settings.json" ~/.claude/settings.json 2>/dev/null && echo "settings.json: identical" || echo "settings.json: differs"
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
