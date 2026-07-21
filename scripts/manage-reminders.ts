#!/usr/bin/env npx tsx
/**
 * Manage Reminders Script
 * List pending reminders, or delete (cancel) one by id.
 *
 * Usage:
 *   npx tsx scripts/manage-reminders.ts list
 *   npx tsx scripts/manage-reminders.ts delete <id>
 */

import 'dotenv/config';
import { initDb } from '../src/db/index.js';
import { listReminders, cancelReminder, getReminder } from '../src/services/reminders.js';
import { formatDate } from '../src/services/date-parser.js';

const [, , action, arg] = process.argv;

initDb();

try {
  if (action === 'list') {
    const pending = listReminders({ status: 'pending', limit: 50 });
    const snoozed = listReminders({ status: 'snoozed', limit: 50 });
    const all = [...pending, ...snoozed].sort(
      (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
    );
    if (all.length === 0) {
      console.log('No pending reminders.');
    } else {
      console.log(`${all.length} pending reminder(s):`);
      for (const r of all) {
        const when = r.status === 'snoozed' && r.snoozedUntil ? r.snoozedUntil : r.remindAt;
        console.log(`  #${r.id}  ${formatDate(new Date(when))}  —  "${r.message}"`);
      }
    }
    process.exit(0);
  }

  if (action === 'delete') {
    const id = parseInt(arg ?? '', 10);
    if (!Number.isInteger(id)) {
      console.error('Usage: npx tsx scripts/manage-reminders.ts delete <id>');
      process.exit(1);
    }
    const existing = getReminder(id);
    if (!existing) {
      console.error(`❌ No reminder #${id} found.`);
      process.exit(1);
    }
    cancelReminder(id);
    console.log(`🗑️  Deleted reminder #${id} — "${existing.message}"`);
    process.exit(0);
  }

  console.error('Usage: npx tsx scripts/manage-reminders.ts list | delete <id>');
  process.exit(1);
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
}
