#!/bin/bash
# Install sw-cortex systemd services
# Generates service files from templates with the current user's paths

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$SCRIPT_DIR/systemd"

# Detect Node.js path
NODE_BIN_PATH=$(dirname "$(which node)")
if [ -z "$NODE_BIN_PATH" ]; then
    echo "Error: Node.js not found in PATH"
    echo "Please ensure Node.js is installed and available"
    exit 1
fi

# Current user
CURRENT_USER=$(whoami)

echo "Installing sw-cortex services..."
echo ""
echo "Configuration:"
echo "  Project root: $PROJECT_ROOT"
echo "  Node path:    $NODE_BIN_PATH"
echo "  User:         $CURRENT_USER"
echo ""

# Generate service files from templates
generate_service() {
    local template="$1"
    local service_name=$(basename "$template" .template)
    local output="/tmp/$service_name"

    sed -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
        -e "s|{{NODE_BIN_PATH}}|$NODE_BIN_PATH|g" \
        -e "s|{{USER}}|$CURRENT_USER|g" \
        "$template" > "$output"

    sudo cp "$output" /etc/systemd/system/
    rm "$output"
    echo "  Generated $service_name"
}

echo "Generating service files from templates..."
for template in "$SYSTEMD_DIR"/*.service.template; do
    if [ -f "$template" ]; then
        generate_service "$template"
    fi
done

# Copy timer file if it exists (not templated)
if [ -f "$SYSTEMD_DIR/sw-cortex-reminders.timer" ]; then
    sudo cp "$SYSTEMD_DIR/sw-cortex-reminders.timer" /etc/systemd/system/
    echo "  Copied sw-cortex-reminders.timer"
fi

# Reload systemd
echo ""
echo "Reloading systemd..."
sudo systemctl daemon-reload

# Enable and start reminder timer
if [ -f /etc/systemd/system/sw-cortex-reminders.timer ]; then
    echo "Enabling reminder timer..."
    sudo systemctl enable sw-cortex-reminders.timer
    sudo systemctl start sw-cortex-reminders.timer
fi

# Enable and start web UI
if [ -f /etc/systemd/system/sw-cortex-web.service ]; then
    echo "Enabling web UI..."
    sudo systemctl enable sw-cortex-web.service
    sudo systemctl start sw-cortex-web.service
fi

# Enable and start Slack handler
if [ -f /etc/systemd/system/sw-cortex-slack.service ]; then
    echo "Enabling Slack handler..."
    sudo systemctl enable sw-cortex-slack.service
    sudo systemctl start sw-cortex-slack.service
fi

echo ""
echo "Done! Status:"
echo ""

if systemctl is-active --quiet sw-cortex-reminders.timer 2>/dev/null; then
    echo "Reminders:"
    systemctl status sw-cortex-reminders.timer --no-pager || true
    echo ""
fi

if systemctl is-active --quiet sw-cortex-web.service 2>/dev/null; then
    echo "Web UI:"
    systemctl status sw-cortex-web.service --no-pager || true
    echo ""
fi

if systemctl is-active --quiet sw-cortex-slack.service 2>/dev/null; then
    echo "Slack Handler:"
    systemctl status sw-cortex-slack.service --no-pager || true
    echo ""
fi

echo "Web UI available at: http://localhost:4000"
echo ""
echo "Commands:"
echo "  View web logs: journalctl -u sw-cortex-web.service -f"
echo "  View reminder logs: journalctl -u sw-cortex-reminders.service -f"
echo "  View Slack logs: journalctl -u sw-cortex-slack.service -f"
echo "  Restart web: sudo systemctl restart sw-cortex-web.service"
echo "  Restart Slack: sudo systemctl restart sw-cortex-slack.service"
