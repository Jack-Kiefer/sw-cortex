/**
 * Generate the knowledge-base COLUMN MANIFEST (knowledge/COLUMN_MANIFEST.md).
 *
 * Why this exists
 * ---------------
 * DICTIONARY.md documents *semantics* — what `assigned` means, why you join on
 * `odoo_id`, that `ec_order.size` is misnamed. It deliberately does NOT carry
 * column lists. But a 7-day transcript audit (2026-08-03) found ~391
 * "Unknown column / does not exist" errors plus 77 describe-first-guard fires:
 * roughly half of ALL tooling friction is an agent guessing a column name on a
 * table whose *concepts* it already understood. Semantic search couldn't help,
 * because the answer simply wasn't in the corpus.
 *
 * This script dumps `table -> column names` for the hottest tables so the
 * knowledge MCP can answer "what columns does receiver_products have?" without
 * a live DB round-trip. It is GENERATED, never hand-edited: a hand-written
 * column list is guaranteed to drift stale, and a confidently-stale column list
 * is worse than none at all (see the plan-doc-vs-live rule in ~/CLAUDE.md).
 *
 * Each table gets its own `####` heading. That matters: knowledge-search.ts
 * chunks on EVERY heading level, so one heading per table makes each table an
 * independently retrievable chunk instead of one unsearchable blob.
 *
 * Usage:
 *   npx tsx scripts/generate-column-manifest.ts            # hot tables (default)
 *   npx tsx scripts/generate-column-manifest.ts --all      # every table, every DB
 *   npx tsx scripts/generate-column-manifest.ts --db serp_test,odoo
 *   npx tsx scripts/generate-column-manifest.ts --check    # CI: fail if stale
 *
 * Read-only against every database (DESCRIBE / information_schema only).
 */
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  describeTable,
  listTables,
  listDatabases,
  closeAllPools,
} from '../src/services/databases.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(REPO_ROOT, 'knowledge', 'COLUMN_MANIFEST.md');

/**
 * The tables worth carrying in the KB, per database.
 *
 * Chosen from evidence, not taste: every entry either (a) produced a real
 * Unknown-column error or describe-first-guard fire in the 7-day transcript
 * audit, or (b) is already load-bearing in DICTIONARY.md. Keeping this list
 * explicit (rather than dumping all ~1000 tables) keeps the embedding cost and
 * the retrieval noise down — a manifest nobody can search past is not a win.
 *
 * Add a table here when it burns you; that is the intended maintenance loop.
 */
const HOT_TABLES: Record<string, string[]> = {
  laravel_live: [
    // order domain — note there is NO bare `orders` table in laravel_live;
    // "orders" is ambiguous in SugarWish (see DICTIONARY "Orders Means Three
    // Different Things"). The real order tables are the ones listed here.
    'ec_order',
    'component_orders',
    'giftcards_card',
    'receiver_production_slips',
    // product domain
    'receiver_products',
    'buyer_products',
    'components',
    'kits',
    'component_kits',
    'product_type',
    // billing / ops
    'invoice_adjustments',
    'csv_exports',
    'locations',
    'branding_records',
    'users',
    'company_users_pivot',
  ],
  serp_test: [
    'serp_sale_order',
    'serp_sale_order_line',
    'serp_stock_move',
    'serp_stock_move_line',
    'serp_stock_picking',
    'serp_stock_quant',
    'serp_stock_valuation_layer',
    'serp_product_product',
    'serp_product_template',
    'serp_purchase_order',
    'serp_res_partner',
    'serp_res_users',
    'serp_mrp_bom',
    'serp_mrp_bom_line',
    'serp_worker_run_history',
    'serp_account_move_line',
    'odoo_sync_queue',
    '_migrations',
  ],
  serp_app: [
    'serp_draft_operations_live',
    'serpy_op_rules',
    'serp_worker_run_history',
    '_migrations',
  ],
  odoo: [
    'sale_order',
    'sale_order_line',
    'stock_move',
    'stock_move_line',
    'stock_picking',
    'stock_picking_type',
    'stock_quant',
    'stock_location',
    'stock_valuation_layer',
    'product_product',
    'product_template',
    'mrp_production',
    'mrp_bom',
    'mrp_bom_line',
    'purchase_order',
    'purchase_order_line',
    'res_partner',
    'res_users',
  ],
  wishdesk: ['orders_tickets', 'sw_billing_tickets', 'swcrm_actions', 'proposals'],
};

interface Args {
  all: boolean;
  check: boolean;
  dbs: string[] | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, check: false, dbs: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--check') args.check = true;
    else if (a === '--db') {
      const v = argv[++i];
      if (!v) throw new Error('--db requires a comma-separated list of database keys');
      args.dbs = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return args;
}

/**
 * Which (database, tables) pairs to document.
 *
 * `--all` asks the server for the real table list; otherwise we use HOT_TABLES.
 * Unknown database keys are reported and skipped rather than thrown, so one
 * retired key (the serp_prod_replica situation) can't take down the whole run.
 */
async function resolveTargets(args: Args): Promise<Array<[string, string[]]>> {
  const available = new Set(listDatabases());
  const wanted = args.dbs ?? Object.keys(HOT_TABLES);

  const targets: Array<[string, string[]]> = [];
  for (const db of wanted) {
    if (!available.has(db)) {
      console.error(`[manifest] skipping unknown database key: ${db}`);
      continue;
    }
    if (args.all) {
      targets.push([db, await listTables(db)]);
    } else {
      targets.push([db, HOT_TABLES[db] ?? []]);
    }
  }
  return targets;
}

function renderTable(
  db: string,
  table: string,
  cols: Array<{ column: string; type: string }>
): string {
  // One heading per table => one retrievable chunk per table.
  // The column list is rendered as a single comma-joined line: it embeds well
  // and reads fast, and the agent overwhelmingly needs the NAMES, not the types.
  const names = cols.map((c) => c.column).join(', ');
  const types = cols.map((c) => `${c.column} ${c.type}`).join(' · ');
  return [
    `#### ${db}.${table}`,
    '',
    `**Columns (${cols.length}):** ${names}`,
    '',
    `<details><summary>with types</summary>`,
    '',
    types,
    '',
    `</details>`,
    '',
  ].join('\n');
}

function renderDoc(
  sections: Array<{ db: string; tables: Array<{ table: string; body: string }> }>,
  failures: string[]
): string {
  const head = [
    '# Column Manifest (GENERATED — do not hand-edit)',
    '',
    'Exact column names for the tables that agents query most. Regenerate with',
    '`npm run kb:columns`. Hand edits are overwritten and, worse, silently rot —',
    'a stale column list is more dangerous than a missing one.',
    '',
    "This file answers ONE question: *what are this table's real column names?*",
    'For what the columns MEAN, which database is authoritative, and the join',
    'invariants, read `DICTIONARY.md` — that is still the source of truth for',
    'semantics. Nothing here overrides it.',
    '',
    '> Generated from the live schema. If a column here disagrees with live, live',
    '> wins and this file is stale — rerun the generator.',
    '',
  ];

  const body: string[] = [];
  for (const s of sections) {
    if (!s.tables.length) continue;
    body.push(`## ${s.db}`, '');
    for (const t of s.tables) body.push(t.body);
  }

  const tail: string[] = [];
  if (failures.length) {
    tail.push(
      '## Tables that could not be read',
      '',
      'These were requested but failed (missing table, permissions, or an',
      'unreachable host at generation time). Their absence here is NOT evidence',
      'that the table does not exist — verify against live before concluding that.',
      '',
      ...failures.map((f) => `- ${f}`),
      ''
    );
  }

  return (
    [...head, ...body, ...tail]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const targets = await resolveTargets(args);

  const sections: Array<{ db: string; tables: Array<{ table: string; body: string }> }> = [];
  const failures: string[] = [];
  let tableCount = 0;

  for (const [db, tables] of targets) {
    const rendered: Array<{ table: string; body: string }> = [];
    for (const table of [...tables].sort()) {
      try {
        const cols = await describeTable(db, table);
        if (!cols.length) {
          failures.push(`${db}.${table} — described with zero columns`);
          continue;
        }
        rendered.push({ table, body: renderTable(db, table, cols) });
        tableCount++;
      } catch (err) {
        // One bad table (or one cold host) must not abort the whole manifest.
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${db}.${table} — ${msg.split('\n')[0].slice(0, 160)}`);
      }
    }
    sections.push({ db, tables: rendered });
  }

  const doc = renderDoc(sections, failures);

  if (args.check) {
    const existing = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8') : '';
    if (existing !== doc) {
      console.error('[manifest] STALE — knowledge/COLUMN_MANIFEST.md does not match live schema.');
      console.error('[manifest] Run: npm run kb:columns');
      process.exitCode = 1;
      return;
    }
    console.error(`[manifest] up to date (${tableCount} tables).`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, doc);
  console.error(
    `[manifest] wrote ${path.relative(REPO_ROOT, OUT_PATH)} — ${tableCount} tables across ${sections.length} databases` +
      (failures.length ? `, ${failures.length} unreadable` : '')
  );
  for (const f of failures) console.error(`[manifest]   ! ${f}`);
}

main()
  .catch((err) => {
    console.error('[manifest] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllPools();
  });
