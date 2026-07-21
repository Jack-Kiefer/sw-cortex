#!/usr/bin/env npx tsx
/**
 * Add Reminder Script
 * Inserts a reminder into the local DB. The check-reminders job (systemd timer,
 * every minute) then DMs it via Slack with snooze/done buttons when it's due.
 *
 * Usage:
 *   npx tsx scripts/add-reminder.ts "<message>" "<when>"
 *
 * <when> accepts:
 *   - a duration:   30m, 2h, 1d
 *   - natural time: "tomorrow at 3pm", "in 2 hours", "next monday at 9am"
 *   - an ISO date:  2026-08-01T14:00
 *
 * Examples:
 *   npx tsx scripts/add-reminder.ts "ping seth about the deploy" 30m
 *   npx tsx scripts/add-reminder.ts "call the vendor" "tomorrow at 10am"
 */

import 'dotenv/config';
import { initDb } from '../src/db/index.js';
import { addReminder } from '../src/services/reminders.js';
import { formatDate } from '../src/services/date-parser.js';

const [, , message, when] = process.argv;

if (!message || !when) {
  console.error('Usage: npx tsx scripts/add-reminder.ts "<message>" "<when>"');
  console.error('Example: npx tsx scripts/add-reminder.ts "ping seth" 30m');
  process.exit(1);
}

initDb();

try {
  const reminder = addReminder({ message, remindAt: when });
  const nice = formatDate(new Date(reminder.remindAt));
  console.log(`✅ Reminder #${reminder.id} set for ${nice}`);
  console.log(`   "${reminder.message}"`);
  process.exit(0);
} catch (err) {
  console.error(`❌ Could not set reminder: ${(err as Error).message}`);
  process.exit(1);
}
