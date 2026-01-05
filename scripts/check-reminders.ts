#!/usr/bin/env npx tsx
/**
 * Reminder Check Script
 * Run periodically via systemd timer to send due reminders via Slack
 */

import 'dotenv/config';
import { WebClient } from '@slack/web-api';
import { initDb } from '../src/db/index.js';
import { getDueReminders, markReminderSent } from '../src/services/reminders.js';

// Initialize
initDb();

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const slackUserId = process.env.SLACK_USER_ID;

if (!process.env.SLACK_BOT_TOKEN) {
  console.error('SLACK_BOT_TOKEN not set');
  process.exit(1);
}

if (!slackUserId) {
  console.error('SLACK_USER_ID not set - needed for DM delivery');
  process.exit(1);
}

async function sendSlackDM(message: string): Promise<boolean> {
  try {
    // Open DM channel with user
    const dmResult = await slack.conversations.open({ users: slackUserId });
    if (!dmResult.channel?.id) {
      console.error('Failed to open DM channel');
      return false;
    }

    // Send message
    await slack.chat.postMessage({
      channel: dmResult.channel.id,
      text: message,
      unfurl_links: false,
    });

    return true;
  } catch (error) {
    console.error('Failed to send Slack DM:', error);
    return false;
  }
}

async function processReminders(): Promise<void> {
  const dueReminders = getDueReminders();

  if (dueReminders.length === 0) {
    console.log('No due reminders');
    return;
  }

  console.log(`Processing ${dueReminders.length} due reminder(s)`);

  for (const { reminder, taskTitle } of dueReminders) {
    let message = `⏰ *Reminder*: ${reminder.message}`;
    if (taskTitle) {
      message += `\n📋 Task: ${taskTitle}`;
    }

    const sent = await sendSlackDM(message);

    if (sent) {
      markReminderSent(reminder.id);
      console.log(`Sent reminder ${reminder.id}: ${reminder.message}`);
    } else {
      console.error(`Failed to send reminder ${reminder.id}`);
    }
  }
}

processReminders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error processing reminders:', err);
    process.exit(1);
  });
