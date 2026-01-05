#!/usr/bin/env npx tsx
/**
 * Slack Socket Mode Handler
 * Listens for button interactions on reminder messages
 * Runs as a long-lived process via systemd
 */

import 'dotenv/config';
import pkg from '@slack/bolt';
const { App } = pkg;
import type { BlockAction, ButtonAction } from '@slack/bolt';
import { initDb } from '../src/db/index.js';
import {
  getReminder,
  snoozeReminder,
  cancelReminder,
  markReminderInteracted,
} from '../src/services/reminders.js';
import { createLogger } from '../src/services/logger.js';

const log = createLogger('slack-handler');

// Initialize database
initDb();

// Validate required env vars
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    log.error(`${envVar} not set`);
    process.exit(1);
  }
}

// Initialize Bolt app with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Helper to extract action details from body
function getActionDetails(body: BlockAction) {
  const action = body.actions[0] as ButtonAction;
  return {
    reminderId: parseInt(action.value, 10),
    channelId: body.channel?.id ?? '',
    messageTs: body.message?.ts ?? '',
    userId: body.user?.id ?? 'unknown',
  };
}

// Helper to update message after action
async function updateMessageWithResult(
  client: typeof app.client,
  channelId: string,
  messageTs: string,
  resultText: string
) {
  if (!channelId || !messageTs) {
    log.error('Missing channelId or messageTs for message update', { channelId, messageTs });
    return;
  }

  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    text: resultText,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: resultText,
        },
      },
    ],
  });
}

// Handle "Done" button
app.action('reminder_done', async ({ ack, body, client }) => {
  await ack();

  try {
    const { reminderId, channelId, messageTs, userId } = getActionDetails(body as BlockAction);
    log.info('Button clicked: Done', { userId, reminderId });

    const reminder = getReminder(reminderId);
    if (!reminder) {
      log.error(`Reminder not found`, { reminderId });
      return;
    }

    // Mark as interacted and cancelled (done = completed)
    markReminderInteracted(reminderId);
    cancelReminder(reminderId);

    // Update the message
    await updateMessageWithResult(client, channelId, messageTs, `✅ *Done!* _${reminder.message}_`);
    log.info('Reminder marked done', { reminderId, message: reminder.message });
  } catch (error) {
    log.error('Error handling reminder_done', error as Error, { action: 'reminder_done' });
  }
});

// Handle "Delete" button
app.action('reminder_delete', async ({ ack, body, client }) => {
  await ack();

  try {
    const { reminderId, channelId, messageTs, userId } = getActionDetails(body as BlockAction);
    log.info('Button clicked: Delete', { userId, reminderId });

    const reminder = getReminder(reminderId);
    if (!reminder) {
      log.error('Reminder not found', { reminderId });
      return;
    }

    // Mark as interacted and cancelled
    markReminderInteracted(reminderId);
    cancelReminder(reminderId);

    // Update the message
    await updateMessageWithResult(
      client,
      channelId,
      messageTs,
      `🗑️ *Deleted* _${reminder.message}_`
    );
    log.info('Reminder deleted', { reminderId, message: reminder.message });
  } catch (error) {
    log.error('Error handling reminder_delete', error as Error, { action: 'reminder_delete' });
  }
});

// Snooze duration mapping
const snoozeDurations: Record<string, string> = {
  reminder_snooze_15m: '15m',
  reminder_snooze_1h: '1h',
  reminder_snooze_4h: '4h',
  reminder_snooze_tomorrow: '24h',
};

// Handle snooze buttons
for (const [actionId, duration] of Object.entries(snoozeDurations)) {
  app.action(actionId, async ({ ack, body, client }) => {
    await ack();

    try {
      const { reminderId, channelId, messageTs, userId } = getActionDetails(body as BlockAction);
      log.info(`Button clicked: ${actionId}`, { userId, reminderId, duration });

      const reminder = getReminder(reminderId);
      if (!reminder) {
        log.error('Reminder not found', { reminderId, action: actionId });
        return;
      }

      // Mark as interacted and snooze
      markReminderInteracted(reminderId);
      const updated = snoozeReminder(reminderId, duration);

      // Calculate snooze until time for display
      const snoozeUntil = updated.snoozedUntil
        ? new Date(updated.snoozedUntil).toLocaleString('en-US', {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'later';

      // Update the message
      await updateMessageWithResult(
        client,
        channelId,
        messageTs,
        `⏰ *Snoozed until ${snoozeUntil}*\n_${reminder.message}_`
      );
      log.info('Reminder snoozed', {
        reminderId,
        duration,
        snoozeUntil,
        message: reminder.message,
      });
    } catch (error) {
      log.error(`Error handling ${actionId}`, error as Error, { action: actionId });
    }
  });
}

// Start the app
(async () => {
  await app.start();
  log.info('Slack handler started in Socket Mode');
})();
