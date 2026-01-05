#!/bin/bash
# Install sw-cortex systemd services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMD_DIR="$SCRIPT_DIR/systemd"

echo "Installing sw-cortex services..."

# Copy all service files
sudo cp "$SYSTEMD_DIR/sw-cortex-reminders.service" /etc/systemd/system/
sudo cp "$SYSTEMD_DIR/sw-cortex-reminders.timer" /etc/systemd/system/
sudo cp "$SYSTEMD_DIR/sw-cortex-web.service" /etc/systemd/system/
sudo cp "$SYSTEMD_DIR/sw-cortex-slack.service" /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start reminder timer
echo "Enabling reminder timer..."
sudo systemctl enable sw-cortex-reminders.timer
sudo systemctl start sw-cortex-reminders.timer

# Enable and start web UI
echo "Enabling web UI..."
sudo systemctl enable sw-cortex-web.service
sudo systemctl start sw-cortex-web.service

# Enable and start Slack handler
echo "Enabling Slack handler..."
sudo systemctl enable sw-cortex-slack.service
sudo systemctl start sw-cortex-slack.service

echo ""
echo "Done! Status:"
echo ""
echo "Reminders:"
systemctl status sw-cortex-reminders.timer --no-pager || true
echo ""
echo "Web UI:"
systemctl status sw-cortex-web.service --no-pager || true
echo ""
echo "Slack Handler:"
systemctl status sw-cortex-slack.service --no-pager || true
echo ""
echo "Web UI available at: http://localhost:4000"
echo ""
echo "Commands:"
echo "  View web logs: journalctl -u sw-cortex-web.service -f"
echo "  View reminder logs: journalctl -u sw-cortex-reminders.service -f"
echo "  View Slack logs: journalctl -u sw-cortex-slack.service -f"
echo "  Restart web: sudo systemctl restart sw-cortex-web.service"
echo "  Restart Slack: sudo systemctl restart sw-cortex-slack.service"
