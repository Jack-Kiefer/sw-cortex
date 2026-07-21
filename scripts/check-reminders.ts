#!/usr/bin/env npx tsx
/**
 * Reminder Check Script
 * Run periodically via systemd timer to send due reminders via Slack
 * Includes interactive buttons for snooze/done actions
 */

import 'dotenv/config';
import { WebClient } from '@slack/web-api';
import { initDb } from '../src/db/index.js';
import {
  getDueReminders,
  getRemindersNeedingRereminder,
  markReminderSent,
  updateReminderSlackTs,
} from '../src/services/reminders.js';
import { createLogger } from '../src/services/logger.js';

const log = createLogger('reminders');

// Initialize
initDb();

// The reminder bot is Jack Bot (its own Socket-Mode Slack app), NOT SERPY.
// REMINDER_BOT_TOKEN wins if set; otherwise fall back to JACK_SLACK_BOT_TOKEN.
const reminderBotToken = process.env.REMINDER_BOT_TOKEN || process.env.JACK_SLACK_BOT_TOKEN;
const slack = new WebClient(reminderBotToken);
const slackUserId = process.env.SLACK_USER_ID;

if (!reminderBotToken) {
  log.error('REMINDER_BOT_TOKEN / JACK_SLACK_BOT_TOKEN not set');
  process.exit(1);
}

if (!slackUserId) {
  log.error('SLACK_USER_ID not set - needed for DM delivery');
  process.exit(1);
}

// Build Block Kit message with buttons
function buildReminderBlocks(reminderId: number, message: string, taskTitle?: string) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏰ *Reminder*\n${message}${taskTitle ? `\n📋 _Task: ${taskTitle}_` : ''}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Done', emoji: true },
          style: 'primary',
          action_id: 'reminder_done',
          value: String(reminderId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '15m', emoji: true },
          action_id: 'reminder_snooze_15m',
          value: String(reminderId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '1h', emoji: true },
          action_id: 'reminder_snooze_1h',
          value: String(reminderId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '4h', emoji: true },
          action_id: 'reminder_snooze_4h',
          value: String(reminderId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Tomorrow', emoji: true },
          action_id: 'reminder_snooze_tomorrow',
          value: String(reminderId),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🗑️ Delete', emoji: true },
          style: 'danger',
          action_id: 'reminder_delete',
          value: String(reminderId),
        },
      ],
    },
  ];

  return blocks;
}

async function sendReminderWithButtons(
  reminderId: number,
  message: string,
  taskTitle?: string
): Promise<string | null> {
  try {
    // Open DM channel with user
    const dmResult = await slack.conversations.open({ users: slackUserId });
    if (!dmResult.channel?.id) {
      log.error('Failed to open DM channel', { reminderId });
      return null;
    }

    // Send message with buttons
    const result = await slack.chat.postMessage({
      channel: dmResult.channel.id,
      text: `⏰ Reminder: ${message}`, // Fallback text
      blocks: buildReminderBlocks(reminderId, message, taskTitle),
      unfurl_links: false,
    });

    return result.ts ?? null;
  } catch (error) {
    log.error('Failed to send Slack DM', error as Error, { reminderId, message });
    return null;
  }
}

async function processReminders(): Promise<void> {
  // Get new due reminders
  const dueReminders = getDueReminders();
  // Get reminders that need re-reminding (sent > 24h ago, no interaction)
  const rereminders = getRemindersNeedingRereminder();

  const total = dueReminders.length + rereminders.length;

  if (total === 0) {
    log.info('No reminders to process');
    return;
  }

  log.info('Processing reminders', { due: dueReminders.length, rereminders: rereminders.length });

  // Process new due reminders
  for (const { reminder, taskTitle } of dueReminders) {
    const messageTs = await sendReminderWithButtons(reminder.id, reminder.message, taskTitle);

    if (messageTs) {
      markReminderSent(reminder.id, messageTs);
      log.info('Sent reminder', { reminderId: reminder.id, message: reminder.message, messageTs });
    } else {
      log.error('Failed to send reminder', { reminderId: reminder.id, message: reminder.message });
    }
  }

  // Process re-reminders (reminders that were sent but not interacted with)
  for (const { reminder, taskTitle } of rereminders) {
    const messageTs = await sendReminderWithButtons(
      reminder.id,
      `🔁 *Re-reminder*: ${reminder.message}`,
      taskTitle
    );

    if (messageTs) {
      updateReminderSlackTs(reminder.id, messageTs);
      log.info('Re-reminded', { reminderId: reminder.id, message: reminder.message, messageTs });
    } else {
      log.error('Failed to re-remind', { reminderId: reminder.id, message: reminder.message });
    }
  }
}

processReminders()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error('Error processing reminders', err as Error);
    process.exit(1);
  });
