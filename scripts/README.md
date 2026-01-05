# sw-cortex Scripts

## Reminder Service

The reminder service checks for due reminders and sends Slack notifications.

### Manual Run

```bash
npx tsx scripts/reminder-service.ts
```

### Systemd Setup (Recommended)

1. Copy the service files to systemd:
```bash
sudo cp scripts/systemd/sw-cortex-reminders.service /etc/systemd/system/
sudo cp scripts/systemd/sw-cortex-reminders.timer /etc/systemd/system/
```

2. Create the environment file with your credentials:
```bash
cp .env.example .env.local
# Edit .env.local with your SLACK_BOT_TOKEN and SLACK_USER_ID
```

3. Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sw-cortex-reminders.timer
sudo systemctl start sw-cortex-reminders.timer
```

4. Check timer status:
```bash
systemctl status sw-cortex-reminders.timer
systemctl list-timers | grep sw-cortex
```

5. View logs:
```bash
journalctl -u sw-cortex-reminders.service -f
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Slack bot token (xoxb-...) |
| `SLACK_USER_ID` | Your Slack user ID for DM reminders |

### Frequency

The timer runs every 5 minutes by default. Modify `OnUnitActiveSec` in the timer file to change frequency.
