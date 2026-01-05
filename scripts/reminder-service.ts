#!/usr/bin/env npx tsx

/**
 * Notification Service (formerly Reminder Service)
 *
 * Run this periodically (via cron or systemd timer) to:
 * 1. Check for tasks with due notifications
 * 2. Send Slack notifications
 * 3. Mark notifications as sent
 *
 * Usage:
 *   npx tsx scripts/reminder-service.ts
 *
 * Environment variables:
 *   SLACK_BOT_TOKEN - Slack bot token for sending DMs
 *   SLACK_USER_ID - Default user ID to send notifications to
 */

import { WebClient } from '@slack/web-api';
import { initDb } from '../src/db/index.js';
import { getTasksDueForNotification, markTaskNotificationSent } from '../src/services/tasks.js';

// Initialize database
initDb();

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const defaultUserId = process.env.SLACK_USER_ID;

async function sendSlackNotification(
  title: string,
  description: string | null,
  channel?: string
): Promise<boolean> {
  const targetChannel = channel || defaultUserId;

  if (!targetChannel) {
    console.error('No Slack channel or user ID configured');
    return false;
  }

  try {
    let text = `🔔 *Task Notification*\n*${title}*`;
    if (description) {
      // Truncate long descriptions
      const truncatedDesc =
        description.length > 500 ? description.substring(0, 497) + '...' : description;
      text += `\n\n${truncatedDesc}`;
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

async function processNotifications(): Promise<void> {
  const dueTasks = getTasksDueForNotification();

  console.log(`Found ${dueTasks.length} tasks with due notifications`);

  for (const task of dueTasks) {
    console.log(`Processing task ${task.id}: ${task.title}`);

    const success = await sendSlackNotification(
      task.title,
      task.description,
      task.notificationChannel ?? undefined
    );

    if (success) {
      markTaskNotificationSent(task.id);
      console.log(`✓ Notification for task ${task.id} sent successfully`);
    } else {
      console.error(`✗ Failed to send notification for task ${task.id}`);
    }
  }
}

// Run the service
processNotifications()
  .then(() => {
    console.log('Notification service completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Notification service failed:', error);
    process.exit(1);
  });
