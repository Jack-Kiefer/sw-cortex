#!/usr/bin/env npx tsx

/**
 * Reminder Service
 *
 * Run this periodically (via cron or systemd timer) to:
 * 1. Check for due reminders
 * 2. Send Slack notifications
 * 3. Mark reminders as sent
 *
 * Usage:
 *   npx tsx scripts/reminder-service.ts
 *
 * Environment variables:
 *   SLACK_BOT_TOKEN - Slack bot token for sending DMs
 *   SLACK_USER_ID - Default user ID to send reminders to
 */

import { WebClient } from '@slack/web-api';
import { initDb } from '../src/db/index.js';
import { getDueReminders, markReminderSent } from '../src/services/reminders.js';

// Initialize database
initDb();

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const defaultUserId = process.env.SLACK_USER_ID;

async function sendSlackReminder(
  message: string,
  taskTitle?: string,
  channel?: string
): Promise<boolean> {
  const targetChannel = channel || defaultUserId;

  if (!targetChannel) {
    console.error('No Slack channel or user ID configured');
    return false;
  }

  try {
    let text = `🔔 *Reminder*\n${message}`;
    if (taskTitle) {
      text += `\n\n📋 Related task: ${taskTitle}`;
    }

    await slack.chat.postMessage({
      channel: targetChannel,
      text,
      mrkdwn: true,
    });

    return true;
  } catch (error) {
    console.error('Failed to send Slack message:', error);
    return false;
  }
}

async function processReminders(): Promise<void> {
  const dueReminders = getDueReminders();

  console.log(`Found ${dueReminders.length} due reminders`);

  for (const { reminder, taskTitle } of dueReminders) {
    console.log(`Processing reminder ${reminder.id}: ${reminder.message}`);

    const success = await sendSlackReminder(
      reminder.message,
      taskTitle,
      reminder.slackChannel ?? undefined
    );

    if (success) {
      markReminderSent(reminder.id);
      console.log(`✓ Reminder ${reminder.id} sent successfully`);
    } else {
      console.error(`✗ Failed to send reminder ${reminder.id}`);
    }
  }
}

// Run the service
processReminders()
  .then(() => {
    console.log('Reminder service completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Reminder service failed:', error);
    process.exit(1);
  });
