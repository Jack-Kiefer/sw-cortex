---
name: n8n-workflow
description: Generate n8n workflow JSON files for automation. Use when user wants to create a workflow, automation, data sync job, scheduled task, or integration for n8n. Produces valid JSON that can be imported directly into n8n.
---

# n8n Workflow Generator

Generate valid n8n workflow JSON files that can be imported into n8n.sugarwish.com.

## When to Use This Skill

- User asks to create an n8n workflow
- User wants to automate a task with scheduling
- User needs a data sync between databases
- User wants Slack notifications for events
- User describes an automation workflow

## Output Location

Save generated workflows to: `/Users/jackkief/Desktop/Projects/sw-cortex/workflows/n8n/[Workflow_Name].json`

Use underscores in filename, matching the workflow name with spaces replaced.

**Copy from the real templates, don't generate blind.** Nine working, imported workflows already live in that directory — they are the ground truth for node `typeVersion`s, credential IDs, param shapes, and wiring. When building anything, open the closest one and adapt it:

| Template                                                             | Demonstrates                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Daily_Operations_Message.json`                                      | schedule + manual + errorTrigger, parallel queries → merge → block-kit Slack           |
| `Operations_Slack.json`                                              | multi-source merge (`append`), big text-string Slack report                            |
| `Sync Receiver Product Inventory with Odoo.json`                     | the canonical DB-sync shape (merge-by-key → IF mismatch → update, success/error Slack) |
| `Disable_Unreserved_Products.json`                                   | inline-expression SQL, chained UPDATEs, gated Slack                                    |
| `Odoo_Order_Sync_Integrity_Monitor.json`                             | `settings.errorWorkflow`, integrity-check pattern                                      |
| `Add_Retool_Incremental_Tables.json`                                 | dynamic SQL builder in a Code node → `query: "={{ $json.sql }}"` upsert                |
| `Sheets_Export.json` / `Debug_Sheets_Read.json`                      | native Google Sheets v4.5 read/write, output-shape debugging                           |
| `Cost_Tracker_Weekly_Average.json` / `Weekly_Cost_to_Scorecard.json` | httpRequest → SERP API (`X-API-Key`) and → Google Sheets REST                          |

---

## n8n Workflow JSON Structure

Every workflow MUST have this exact structure:

```json
{
  "name": "Workflow Display Name",
  "nodes": [
    // Array of node objects (see Node Types below)
  ],
  "connections": {
    // Maps source node names to destinations (see Connections below)
  },
  "pinData": {},
  "active": false,
  "settings": {
    "executionOrder": "v1"
  },
  "versionId": "generate-uuid-here",
  "meta": {
    "instanceId": "c840a10576e00ab2533eec2b835c01b97e942057b9c92cd733ead1e724f40a56"
  },
  "id": "generate-short-id",
  "tags": []
}
```

### Required Fields

| Field             | Type    | Description                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------- |
| `name`            | string  | Display name for the workflow                                           |
| `nodes`           | array   | Array of node definitions (cannot be empty)                             |
| `connections`     | object  | Node connection graph                                                   |
| `pinData`         | object  | Usually empty `{}`                                                      |
| `active`          | boolean | Set to `false` for new workflows                                        |
| `settings`        | object  | Must include `executionOrder: "v1"`                                     |
| `versionId`       | string  | UUID (generate fresh)                                                   |
| `meta.instanceId` | string  | Use: `c840a10576e00ab2533eec2b835c01b97e942057b9c92cd733ead1e724f40a56` |
| `id`              | string  | Short alphanumeric ID                                                   |
| `tags`            | array   | Optional tags like `["odoo", "sync"]`                                   |

---

## Node Structure

Every node MUST have:

```json
{
  "id": "unique-uuid",
  "name": "1. Descriptive Name",
  "type": "n8n-nodes-base.nodeType",
  "typeVersion": 2.0,
  "position": [-12000, 200],
  "parameters": {
    // Node-specific configuration
  }
}
```

### Node Naming Convention

Numbered prefixes (`"1. Query Database"`, `"2. Transform Data"`) are **optional, not required** — many real workflows use plain descriptive names (`Fetch All SKUs`, `Odoo: Get Available Quantities`). Either is fine; be consistent within a workflow.

### Position Guidelines

Positions are **cosmetic** (they only lay out the canvas) — n8n ignores them at runtime, so any sane spread imports fine. Conventions seen in real files:

- Negative-X anchoring (`[-12400, 200]`) is **not** required — real exports also use large positive coords (X up to 13000+) or origin-centered layouts.
- Increment X by ~300–400 per stage; spread parallel branches into Y lanes ~200 apart.
- Error / secondary-trigger branches typically sit a lane or two below the main flow.

### Field conventions (real exports diverge from "ideal")

Real exported workflows differ from textbook values — know these so generated JSON matches reality and round-trips cleanly:

- **`active`** — keep `false` for a NEW generated workflow, but live/running exports are `active: true`.
- **`id` / `versionId`** — may be human-readable slugs (`debug-sheets-v1`, `costTrackerWeekly`, `trigger-001`), not only UUIDs.
- **`tags`** — in real exports this is an **array of OBJECTS**, e.g. `[{ "name": "operations" }]` (full form: `[{ "createdAt", "updatedAt", "id", "name" }]`), **not** a plain string array.
- **`meta`** — alongside `instanceId`, real exports often carry `"templateCredsSetupCompleted": true`.
- **`settings`** — beyond `executionOrder: "v1"`, may include `errorWorkflow`, `callerPolicy`, or `binaryMode` (see Error Handling).

---

## Available Node Types

### 1. Schedule Trigger

**Cron Expression (specific times):**

```json
{
  "id": "uuid-here",
  "name": "Daily at Midnight",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [-12400, 200],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 0 * * *"
        }
      ]
    }
  }
}
```

**Interval (recurring)** — note the key for a minute step is `minutesInterval`, NOT `triggerAtMinute`:

```json
{
  "parameters": {
    "rule": {
      "interval": [{ "field": "minutes", "minutesInterval": 20 }]
    }
  }
}
```

Other interval shapes: hourly = `[{ "field": "hours" }]`; hourly at minute 20 = `[{ "field": "hours", "triggerAtMinute": 20 }]`.

Common cron expressions (5-field: min hour dom mon dow):

- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 8 * * 1-5` - Weekdays at 8 AM
- `0 8 * * 1` - Mondays at 8 AM · `0 9 * * 0` - Sundays at 9 AM

**6-field cron (leading SECONDS field) — n8n supports it:**

```json
{ "field": "cronExpression", "expression": "0 */5 5-19 * * *" }
```

`0 */5 5-19 * * *` = second 0, every 5 min, hours 5–19. Use this for high-frequency, business-hours windows.

**⚠️ Cron gotchas (verified against this n8n instance):**

- **Timezone:** cron fires in the **n8n instance timezone**, not your local time and not implicitly UTC. SugarWish's self-hosted box runs **UTC** (if `GENERIC_TIMEZONE`/`TZ` is unset). When verifying a schedule against a UTC database, convert before concluding it "didn't fire."
- **Hour ranges are inclusive through `:59`:** `5-19` runs through **19:55**, not 19:00 — the last fire is in the 19:xx hour.
- **Schedule node display NAMES lie** — a node named "5am–7pm" can actually be a 5–19 UTC window (~11pm–1:55pm Mountain). Derive the real window from the cron fields, not the name.
- **Blind window:** outside the cron's hour range NOTHING runs, so a self-heal/data-correction job won't fix an off-hours change until the next in-window tick. State windows in UTC.
- **Forensic signal:** a `:00`/`:0x`-second timestamp on a written DB row indicates a SCHEDULED (not manual) run did the write.

### 2. PostgreSQL (Odoo)

```json
{
  "id": "uuid-here",
  "name": "1. Query Odoo",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "position": [-12160, 200],
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT id, name FROM product_product LIMIT 10",
    "options": {}
  },
  "credentials": {
    "postgres": {
      "id": "Cj4x3zqOHw9ecZst",
      "name": "Odoo_read"
    }
  }
}
```

### 3. MySQL (SugarWish)

```json
{
  "id": "uuid-here",
  "name": "2. Query SugarWish",
  "type": "n8n-nodes-base.mySql",
  "typeVersion": 2.4,
  "position": [-11920, 200],
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM orders WHERE status = 'pending' LIMIT 100",
    "options": {}
  },
  "credentials": {
    "mySql": {
      "id": "IUf07KHTTBdglTB2",
      "name": "sw_live_creds"
    }
  }
}
```

**With executeOnce (run once regardless of input items):**

```json
{
  "executeOnce": true,
  ...
}
```

Put `executeOnce: true` on **source/lookup SELECT nodes** in a multi-source workflow so they run a single time, not once per upstream item.

#### SQL writes — three real idioms (Postgres & MySQL)

**A. `update` operation (single-table write without raw SQL).** Note the `table` resource-locator uses `mode: "list"` + `cachedResultName` (mirroring the value) — distinct from the Slack channel `mode: "name"` shape:

```json
{
  "parameters": {
    "operation": "update",
    "table": {
      "__rl": true,
      "value": "odoo_inventory",
      "mode": "list",
      "cachedResultName": "odoo_inventory"
    },
    "dataMode": "defineBelow",
    "columnToMatchOn": "product_id",
    "valueToMatchOn": "={{ $json.product_id }}",
    "valuesToSend": {
      "values": [{ "column": "inventory", "value": "={{ Number($json.available_quantity ?? 0) }}" }]
    },
    "options": {}
  }
}
```

**B. Inline expressions INSIDE a SQL `query` string** (the `query` param has **no** leading `=`; the `{{ }}` is embedded raw):

```
UPDATE receiver_products SET status = 'disabled' WHERE product_id = {{ $json.product_id }};
SELECT {{ $json.product_id }} AS product_id;
```

- Multiple statements in one `query` are allowed (semicolon-separated), often ending in a `SELECT` so downstream nodes get rows back.
- Build a SQL `IN`-list from an array with `.join()`: `WHERE sw_id IN ({{ $json.sw_ids.join(', ') }})`.
- An UPDATE via `executeQuery` exposes `$json.affectedRows` downstream (guard with `|| 0`).
- To run several UPDATEs in order, **chain them linearly** (node → node); don't parallelize writes.

**C. Build dynamic SQL in a Code node, execute in a downstream DB node** (the canonical Retool write-back). The Code node returns `[{ json: { sql, count } }]`; the DB node runs `"query": "={{ $json.sql }}"`. Manual escaping helper (used instead of parameterized queries):

```javascript
const escape = (str) => (str == null ? 'NULL' : "'" + String(str).replace(/'/g, "''") + "'");
// → bulk upsert: INSERT INTO t (...) VALUES (...),(...) ON CONFLICT (key) DO UPDATE SET ..., updated_at = NOW();
```

> **Credential routing (critical):** Postgres **writes** go through the `Retool` credential, NEVER `Odoo_read` (read-only). MySQL reads+writes use `sw_live_creds`. See Credentials Reference.

### 4. Code Node (JavaScript)

```json
{
  "id": "uuid-here",
  "name": "3. Transform Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-11680, 200],
  "parameters": {
    "jsCode": "// Get all input items\nconst items = $input.all();\n\n// Process data\nconst results = items.map(item => ({\n  id: item.json.id,\n  processed: true\n}));\n\n// Return as n8n format\nreturn results.map(r => ({ json: r }));"
  }
}
```

**Accessing input & other nodes (all valid forms):**

```javascript
// Current input
const items = $input.all(); // every input item
const first = $input.first().json; // first item
const cur = $input.item.json; // SINGULAR — the current item (per-item mode)

// Read a node that is NOT your direct input (e.g. a parallel branch).
// Guard with optional chaining + try/catch for first-run safety.
const odoo = $('1. Query Odoo').all();
const prev = $('Prev State').first()?.json; // ?. — may be absent on first run

// Execution metadata (optional-chain it — not always present)
const eid = $execution?.id;
const wfName = $execution?.workflow?.name;

console.log(`Parsed ${items.length} rows`); // console.log IS available for logging
```

**Cross-DB join / type-coercion (real footguns):**

```javascript
// Postgres returns IDs as STRINGS, MySQL as numbers — coerce before Map keys/lookups
const byId = new Map(rowsA.map((r) => [Number(r.id), r]));
const match = byId.get(Number(rowB.id)); // mismatched types silently miss

// Demux an `append`-merged stream (no source tag) by which keys exist:
for (const it of $input.all()) {
  const d = it.json;
  if (d.size_rule_type !== undefined) {
    /* sizeGroups */
  } else if (d.alert_threshold !== undefined) {
    /* alerts */
  }
}
```

**Return format (CRITICAL):**

```javascript
// Always return array of { json: {...} }
return [{ json: { field: 'value' } }];

// For multiple items
return items.map((item) => ({ json: item }));

// Empty-result SENTINEL — return a flagged item, NOT [] (an empty array stops the
// branch; a sentinel lets a downstream IF route it to the false branch):
return [{ json: { no_changes: true } }];
```

> **Timestamps:** code nodes use plain JS — `new Date().toISOString()`, or `new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }) + ' MT'`. n8n's `$now`/`$today` are for node params, not code nodes.

### 5. Conditional (IF)

```json
{
  "id": "uuid-here",
  "name": "4. Has Results?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [-11440, 200],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "loose",
        "version": 2
      },
      "conditions": [
        {
          "id": "condition-uuid",
          "leftValue": "={{ $json.count }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

**Operators:**

- Number: `gt`, `lt`, `gte`, `lte`, `equals`
- String: `equals`, `contains`, `startsWith`, `endsWith`, `regex`
- Boolean: `true`, `false`
- Existence: `exists`, `notExists`

**`typeValidation` — `strict` vs `loose`:** real IF nodes use both (≈9 strict / 7 loose). Prefer **`strict`** for numeric comparisons (so string `'0'` doesn't loosely equal `0`) and cast with `.toNumber()`. Caveat: `strict` can itself cause a silent no-match when the two operands differ in type. Some older (tv 2) IF nodes omit `"version": 2` and pair with `conditions.options.version: 1`. IF `typeVersion` is usually `2.2` but integer `2` also appears — both work.

**Boolean "is true" condition** (wrap a full JS comparison in `leftValue`) — a valid alternative to the typed two-operand form. `singleValue: true` is REQUIRED for single-operand boolean operators:

```json
{
  "leftValue": "={{ ($json.available_quantity.toNumber() !== $json.inventory) === true }}",
  "rightValue": "",
  "operator": { "type": "boolean", "operation": "true", "singleValue": true }
}
```

**Gate on whether upstream returned any rows** (the "has results?" guard):

```json
{
  "leftValue": "={{ $input.all().length }}",
  "rightValue": 0,
  "operator": { "type": "number", "operation": "gt" }
}
```

A condition's `id` can be a human-readable slug (`"has-products-check"`), not a UUID.

> **⚠️ Expression null-safety:** never call a coercion method on a possibly-absent field bare — `={{ $json.x.toNumber() }}` **throws** on any item where `x` is undefined (exactly what a merge-unmatched row or NULL column produces). Guard with `Number($json.x ?? 0)`, or place the coercion after a filter that guarantees the field.

### 6. Merge

> **⚠️ `combinationMode` / `mergeByPosition` are LEGACY v2 keys and are INVALID at typeVersion 3** (the version this skill ships). They silently fail to join / import as an unconfigured merge. Use one of the three real v3 shapes below. **The two upstream sources must connect to merge inputs `index: 0` and `index: 1`** (the connection's `index` field selects the input port).

**A. UNION (`append`)** — concatenate all items from all inputs (the most common form):

```json
{
  "name": "Merge Inputs",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3,
  "position": [-11200, 200],
  "parameters": { "mode": "append" }
}
```

**B. Wait-for-all BARRIER (bare `{}`)** — empty params is valid; it synchronizes branches (waits for every input) before continuing. Real files use this:

```json
{ "type": "n8n-nodes-base.merge", "typeVersion": 3, "parameters": {} }
```

**C. JOIN BY KEY (`combine`)** — inner-join two inputs on a shared field. Each `field1`/`field2` is a `=field` expression (NOT `={{ }}`):

```json
{
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3,
  "parameters": {
    "mode": "combine",
    "advanced": true,
    "mergeByFields": { "values": [{ "field1": "=product_id", "field2": "=product_id" }] },
    "options": {}
  }
}
```

> **⚠️ `combine` mode is an INNER JOIN — unmatched rows are silently DROPPED** before they reach the IF/write. This is the #1 "why didn't my row sync" bug: a row filtered out of source B's query (e.g. by a `WHERE archive = 0`) has no partner, so it never reaches the update. If you need ALL of source A regardless of B, use `append` (or combine + keep-non-matches), **not** plain `combine`. A `combine` join can also emit rows missing a field → see the expression null-safety warning in the IF section.

### 7. Slack Notification

> **The DEFAULT pattern is plain TEXT, not Block Kit.** A Code node builds the whole message as one mrkdwn STRING, then the Slack node sends `text: "={{ $json.text }}"`. Block Kit is the minority. **typeVersion is style-correlated: text nodes are `2.2`, block-kit nodes are `2.3`** — don't hardcode 2.3 for everything.

**A. Text message (default)** — note: `messageType` is OMITTED (presence of `text` is enough on 2.2), and `text` is an EXPRESSION (leading `=`):

```json
{
  "name": "Send Report",
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.2,
  "position": [-10960, 200],
  "parameters": {
    "select": "channel",
    "channelId": { "__rl": true, "value": "C084Z9EKDSL", "mode": "id" },
    "text": "={{ $json.text }}",
    "otherOptions": {}
  },
  "credentials": { "slackApi": { "id": "IafsmXhPRCyykQMM", "name": "Slack account" } }
}
```

The paired Code node builds the string:

```javascript
const text =
  `:white_check_mark: *Inventory Sync Complete*\n` +
  `• Updated: ${n} products\n` +
  `• <@U022BUNHE1Z> review: <https://retool.../dash|dashboard>\n` +
  `_${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} MT_`;
return [{ json: { text } }];
```

Text idioms: emoji shortcodes (`:white_check_mark:`, `:wrench:`) or unicode, mrkdwn (`*bold*`, `•` bullets), user mentions `<@U022BUNHE1Z>` (Jack), links `<url|label>`, and `{{ }}` math (`{{ Math.round((a / b) * 100) }}%`).

**Channel by ID vs name.** Prod ops workflows resolve by `mode: "id"` (robust — survives renames, works for private channels). Known prod channel IDs:

| Channel ID    | Purpose                      |
| ------------- | ---------------------------- |
| `C084Z9EKDSL` | daily inventory / ops report |
| `C088M68FD47` | inventory-sync success       |
| `C07GY977AEM` | error / alert handler        |
| `C083M27KU8L` | sheets-export alerts         |
| `C4086K801`   | promo alerts                 |

`mode: "name"` (e.g. `ops-and-tech`, `jack-test`) is the alternative, used mostly by block-kit 2.3 nodes. ⚠️ A few real block-kit nodes carry a stray leading `=` on the literal ID (`"value": "=C088M68FD47"`) — an expression-mode artifact that still imports; emit a clean ID without the `=`.

**B. Block Kit message** — `messageType: "block"` + `blocksUi`. ⚠️ **`blocksUi` must match the paired Code node's return shape exactly:** use `={{ $json }}` if the code returns `[{ json: { blocks } }]` (the current convention), or `={{ $json.blocks }}` only if blocks is nested one deeper. Mismatching is a silent footgun.

```json
{
  "name": "5. Slack Notification",
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.3,
  "parameters": {
    "select": "channel",
    "channelId": { "__rl": true, "value": "ops-and-tech", "mode": "name" },
    "messageType": "block",
    "blocksUi": "={{ $json }}",
    "otherOptions": {}
  },
  "credentials": { "slackApi": { "id": "IafsmXhPRCyykQMM", "name": "Slack account" } }
}
```

**Building Block Kit in a Code Node** (return `[{ json: { blocks } }]`, pair with `blocksUi: "={{ $json }}"`):

```javascript
const blocks = [
  { type: 'header', text: { type: 'plain_text', text: 'Notification Title', emoji: true } },
  { type: 'section', text: { type: 'mrkdwn', text: '*Bold* and `code` formatting' } },
  { type: 'divider' },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} MT`,
      },
    ],
  },
];
return [{ json: { blocks } }]; // chunk long lists ~30 lines per section (Slack limits)
```

> **Footer gotcha:** n8n auto-appends an `_Automated with this <…|n8n workflow>_` attribution footer to delivered Slack messages (text and block). Suppress it via the node's `otherOptions` if a clean message is wanted.
>
> **Webhook ID:** real Slack nodes carry an optional top-level `webhookId` (auto-generated UUID, e.g. `4ff75667-d0e4-41c3-8832-13ff4b125f33`); cosmetic/for tracking.

### 8. HTTP Request

Call external/internal REST APIs (SERP's own API, or the Google Sheets v4 REST API). typeVersion **4.2**.

**GET with a custom API-key header (SERP API pattern):**

```json
{
  "parameters": {
    "method": "GET",
    "url": "https://serp.sugarwish.com/api/forecast/cost-tracker/current-week-average",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [{ "name": "X-API-Key", "value": "<SERP_EXTERNAL_API_KEY>" }]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

- SERP endpoints authenticate with a static **`X-API-Key`** header (NOT Bearer/OAuth). `sendHeaders` MUST be `true`. **Don't hardcode the key** — copy the real value from an existing SERP httpRequest node (`Cost_Tracker_Weekly_Average.json` / `Weekly_Cost_to_Scorecard.json`); it's SERP's `SERP_EXTERNAL_API_KEY`. SERP cost-tracker endpoints are rate-limited to **~30 req/min/IP**.
- Calling SERP's API can replace a direct DB query when SERP already computes the value.

### 9. Google Sheets

Two distinct mechanisms — pick by whether you read a whole sheet or hit a specific cell. Both use the `Google Sheets account` credential (`YY0aKH375lw428rC`).

**A. Native `googleSheets` node — typeVersion 4.5 (read/write whole sheets):**

```json
{
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "17J0Uqqd0dkaS6-3TCCB_TtP1eZg6xbdC0IWThrOH5FM",
      "mode": "id"
    },
    "sheetName": { "__rl": true, "value": "Mix Prediction", "mode": "name" },
    "options": {}
  },
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "credentials": {
    "googleSheetsOAuth2Api": { "id": "YY0aKH375lw428rC", "name": "Google Sheets account" }
  }
}
```

`documentId` uses `mode: "id"` (raw spreadsheet ID); `sheetName` uses `mode: "name"` (tab name). `operation: "read"` may be omitted (read is default).

**B. Raw httpRequest to Sheets v4 REST API (targeted single-cell read/write):**

```json
// Write a single cell (PUT):
{
  "parameters": {
    "method": "PUT",
    "url": "https://sheets.googleapis.com/v4/spreadsheets/{ID}/values/Scorecard26!F34?valueInputOption=USER_ENTERED",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googleSheetsOAuth2Api",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ values: [[ $('2. Format Cost Value').item.json.formattedCost ]] }) }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "credentials": {
    "googleSheetsOAuth2Api": { "id": "YY0aKH375lw428rC", "name": "Google Sheets account" }
  }
}
```

- Read a cell: `method: GET`, url `.../values/Sheet!A1`. Multi-cell write: `method: POST` to `.../values:batchUpdate` with `jsonBody = ={{ JSON.stringify({ valueInputOption: 'USER_ENTERED', data: rows.map(u => ({ range: 'Sheet!F'+u.row, values: [[u.value]] })) }) }}`. The A1 range goes in the URL path; the body needs a `values` 2D array.
- ⚠️ **Read-output shapes DIFFER (a real failure mode — `Debug_Sheets_Read.json` exists for this):** the native node returns ONE item per ROW keyed by header-row column names (unnamed columns → `col_N`); the HTTP read returns a single item with a raw `.values` 2D array (`$json.values[0][0]`). Pick the read method to match how downstream code/IF nodes access the data.

### 10. Manual Trigger & Error Trigger

**Manual Trigger** (typeVersion 1, empty params) — pair with EVERY scheduleTrigger so the workflow can run on demand. Both triggers fan out to the SAME first node(s):

```json
{
  "parameters": {},
  "name": "Manual Trigger",
  "type": "n8n-nodes-base.manualTrigger",
  "typeVersion": 1,
  "position": [-12400, 400]
}
```

**Error Trigger** (typeVersion 1, empty params) — a workflow-level catch. When ANY node fails, n8n fires this trigger; wire it to a Slack "Error Handler" node. Standalone entrypoint, separate from per-node `onError`:

```json
{
  "parameters": {},
  "name": "On Error",
  "type": "n8n-nodes-base.errorTrigger",
  "typeVersion": 1,
  "position": [-12400, 800]
}
```

---

## Connections Structure

The `connections` object maps node outputs to inputs:

```json
"connections": {
  "Source Node Name": {
    "main": [
      [
        {
          "node": "Destination Node Name",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

### Single Output to Single Input

```json
"1. Query Database": {
  "main": [
    [
      { "node": "2. Transform Data", "type": "main", "index": 0 }
    ]
  ]
}
```

### Conditional Branches (IF node)

The IF node has two outputs: `main[0]` (true) and `main[1]` (false):

```json
"4. Has Results?": {
  "main": [
    [
      { "node": "5. Process Results", "type": "main", "index": 0 }
    ],
    [
      { "node": "6. Handle Empty", "type": "main", "index": 0 }
    ]
  ]
}
```

### Error Handling

Nodes with `"onError": "continueErrorOutput"` have error output at `main[1]`:

```json
"5. Database Update": {
  "main": [
    [
      { "node": "6. Success Path", "type": "main", "index": 0 }
    ],
    [
      { "node": "Error Handler", "type": "main", "index": 0 }
    ]
  ]
}
```

---

## Credentials Reference

### Available Credentials

| Name                    | ID                 | Type                  | Use For                                                                            |
| ----------------------- | ------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| `Odoo_read`             | `Cj4x3zqOHw9ecZst` | postgres              | **READ-ONLY** Odoo prod SELECTs — NEVER use for any Postgres write (2 uses)        |
| `Retool`                | `CSslwJXmoUQ1dbIi` | postgres              | **WRITABLE** Retool analytics Postgres — all INSERT/UPDATE/DELETE/upsert (20 uses) |
| `sw_live_creds`         | `IUf07KHTTBdglTB2` | mySql                 | SugarWish production MySQL — reads AND writes (19 uses)                            |
| `Slack account`         | `IafsmXhPRCyykQMM` | slackApi              | Slack notifications                                                                |
| `Google Sheets account` | `YY0aKH375lw428rC` | googleSheetsOAuth2Api | Google Sheets read/write (native node, or httpRequest `nodeCredentialType`)        |

**⚠️ Routing rule (critical):** any workflow that WRITES to a Postgres DB (Retool analytics tables) MUST use **`Retool`**, NOT `Odoo_read` (read-only, Odoo box only). MySQL writes go through `sw_live_creds`. Across the 9 real workflows, `Retool` and `sw_live_creds` dominate; `Odoo_read` is only for read-only Odoo SELECTs.

**Jack's Slack user ID for @-mentions:** `U022BUNHE1Z` (used as `<@U022BUNHE1Z>` in alert messages).

**IMPORTANT**: Credentials contain names and IDs only. Secrets are stored separately in n8n and are NOT exported.

---

## Complete Workflow Example

```json
{
  "name": "Daily Order Summary",
  "nodes": [
    {
      "id": "trigger-001",
      "name": "Daily at 8 AM",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [-12400, 200],
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 8 * * *" }]
        }
      }
    },
    {
      "id": "query-001",
      "name": "1. Get Yesterday Orders",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [-12160, 200],
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT COUNT(*) as order_count, SUM(total) as revenue FROM orders WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY",
        "options": {}
      },
      "credentials": {
        "mySql": { "id": "IUf07KHTTBdglTB2", "name": "sw_live_creds" }
      }
    },
    {
      "id": "format-001",
      "name": "2. Format Message",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-11920, 200],
      "parameters": {
        "jsCode": "const data = $input.first().json;\nconst blocks = [\n  { type: 'header', text: { type: 'plain_text', text: 'Daily Order Summary', emoji: true } },\n  { type: 'section', text: { type: 'mrkdwn', text: `*Orders:* ${data.order_count}\\n*Revenue:* $${data.revenue}` } }\n];\nreturn [{ json: { blocks } }];"
      }
    },
    {
      "id": "slack-001",
      "name": "3. Send to Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2.3,
      "position": [-11680, 200],
      "parameters": {
        "select": "channel",
        "channelId": { "__rl": true, "value": "ops-and-tech", "mode": "name" },
        "messageType": "block",
        "blocksUi": "={{ $json.blocks }}",
        "otherOptions": {}
      },
      "credentials": {
        "slackApi": { "id": "IafsmXhPRCyykQMM", "name": "Slack account" }
      }
    }
  ],
  "connections": {
    "Daily at 8 AM": {
      "main": [[{ "node": "1. Get Yesterday Orders", "type": "main", "index": 0 }]]
    },
    "1. Get Yesterday Orders": {
      "main": [[{ "node": "2. Format Message", "type": "main", "index": 0 }]]
    },
    "2. Format Message": {
      "main": [[{ "node": "3. Send to Slack", "type": "main", "index": 0 }]]
    }
  },
  "pinData": {},
  "active": false,
  "settings": { "executionOrder": "v1" },
  "versionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "meta": { "instanceId": "c840a10576e00ab2533eec2b835c01b97e942057b9c92cd733ead1e724f40a56" },
  "id": "newWorkflow01",
  "tags": ["daily", "summary"]
}
```

---

## Validation Checklist

Before saving workflow JSON, verify:

- [ ] `name` is set and descriptive
- [ ] `nodes` array is not empty
- [ ] Every node has unique `id`
- [ ] Every node has `name`, `type`, `typeVersion`, `position`, `parameters`
- [ ] **`typeVersion` matches the real corpus** — postgres `2.5`, mySql `2.4`, code `2`, if `2.2`, merge `3`, scheduleTrigger `1.2`, slack `2.2` (text) / `2.3` (block), httpRequest `4.2`, googleSheets `4.5`, manual/error trigger `1`
- [ ] **Postgres WRITE nodes use the `Retool` credential, not `Odoo_read`** (read-only)
- [ ] Merge nodes use a valid v3 shape (`append`, bare `{}`, or `combine`+`mergeByFields`) — NOT legacy `combinationMode`/`mergeByPosition`
- [ ] Slack `blocksUi` matches its Code node's return shape (`={{ $json }}` vs `={{ $json.blocks }}`)
- [ ] Expressions are null-safe — no bare `.toNumber()` on a possibly-absent (merge-unmatched) field
- [ ] `connections` references existing node names exactly; merge join-inputs wired to `index: 0` / `index: 1`
- [ ] Credential `id` and `name` match available credentials
- [ ] `settings.executionOrder` is `"v1"`
- [ ] `active` is `false` (enable manually in n8n)
- [ ] `tags` is an array of OBJECTS (`[{ "name": "daily" }]`), not bare strings, if tags are used
- [ ] JSON is valid (no trailing commas, proper escaping)

---

## Common Patterns

### DB-Sync workflow shape (default for cross-DB sync)

Default a DB-sync workflow to **[trigger fan-out → parallel source queries → Merge-by-key → IF "mismatch?" → write node]**, NOT `query → update-all`. Always insert a change-detection IF before any write so the job is **idempotent** and re-running is harmless (it turns a 938-row source into a handful of writes per tick).

- Put `executeOnce: true` on the source SELECT/lookup nodes (run once, not per item).
- Join the two source result sets with a Merge in `combine` mode + `mergeByFields` on the key (see Merge §6). Sources connect to merge inputs `index: 0` and `index: 1`.
- The IF compares the two values, e.g. `={{ ($json.available_quantity.toNumber() !== $json.inventory) === true }}` — only the TRUE branch reaches the UPDATE.
- ⚠️ `combine` = INNER JOIN: a row filtered out of source B (e.g. `WHERE archive = 0`) silently never reaches the write. Mismatched WHERE filters between the two queries are the #1 "row didn't sync" cause.
- ⚠️ Null-safety: a `combine` join can emit rows missing a field — never call `.toNumber()` on a bare possibly-absent field. Guard with `Number($json.x ?? 0)`.
- **Leave the IF FALSE branch UNCONNECTED** so an empty/no-change run is a silent no-op. Gate every Slack/write behind a "has results?" IF and never post a "no changes" message on a sub-hourly cron (avoids spam).

### Error handling (three mechanisms)

**1. Inline `onError: "continueErrorOutput"`** on a write node (top-level node key, sibling of `parameters`) → wire `main[0]` (success) to a "Build Slack Success" Code → Slack, and `main[1]` (error) to a "Build Slack Error" Code → Slack:

```json
{ "onError": "continueErrorOutput", ... }
```

The error Code node should: (1) @-mention Jack via `<@U022BUNHE1Z>`, (2) include BOTH a workflow link `https://n8n.sugarwish.com/workflow/${workflowId}` and an execution link `https://n8n.sugarwish.com/execution/${$execution?.id}`, (3) state business impact (e.g. "Products may have stale inventory until the next run"), and (4) try/catch-pull the failed node's error text (`$('<write node>').all()[0]?.json?.error`).

**2. `errorTrigger` node** ("On Error", tv 1, empty params) → Slack — a workflow-global catch (see Node Types §10).

**3. `settings.errorWorkflow`** pointing at a shared error-handler workflow (`"6UFLDPu9MwwP9Yn5"`), often with `settings.callerPolicy: "workflowsFromSameOwner"` — a one-line failure alert for new workflows:

```json
"settings": { "executionOrder": "v1", "errorWorkflow": "6UFLDPu9MwwP9Yn5", "callerPolicy": "workflowsFromSameOwner" }
```

### Troubleshooting: a failing MANUAL run does NOT mean the workflow is broken

- **"Lost connection to the server" / "Problem running workflow" on a manual "Execute Workflow" run is NOT a node/expression error** — it's the editor's push (websocket/SSE) channel dropping (commonly a reverse-proxy not forwarding websocket-upgrade headers). Real node errors render as a RED node with a message. Scheduled/cron runs are unaffected (they run server-side, no editor channel).
- Manual runs also surface per-item expression errors the scheduler may tolerate differently (e.g. `undefined.toNumber()` on a merge-unmatched row, which with `typeValidation: strict` fails the whole manual execution).
- **The authoritative result is the n8n Executions tab**, not the editor banner and not sw-cortex logs. Verify there before concluding the generated JSON is wrong.

### Odoo inventory-query footgun (when a Postgres source feeds a sync)

Read inventory only from NUMBERED/internal locations — `l.sugarwish_id IS NOT NULL` (≥ 1) and `usage = 'internal'`. An unfiltered `SUM(quantity - reserved_quantity)` silently pulls in virtual/production/adjustment locations and yields wrong (often wildly negative) values; a too-broad/too-narrow location filter can also drop a SKU's only real row. The location predicate determines which rows are even visible. (Also honor the SugarWish perf rule: positive `stock_move` state lists, never negated — see the knowledge base.)

### Execute Once

For nodes that should run once regardless of input count:

```json
{
  "executeOnce": true,
  ...
}
```

### Webhook ID for Slack

Add unique webhook ID for better tracking:

```json
{
  "webhookId": "descriptive-webhook-id",
  ...
}
```

---

## Slack Channels

Prod ops workflows resolve channels by **ID** (`mode: "id"`) — more robust than name. Known IDs:

| ID            | Name / Purpose               |
| ------------- | ---------------------------- |
| `C084Z9EKDSL` | daily inventory / ops report |
| `C088M68FD47` | inventory-sync success       |
| `C07GY977AEM` | error / alert handler        |
| `C083M27KU8L` | sheets-export alerts         |
| `C4086K801`   | promo alerts                 |

By **name** (`mode: "name"`), mostly block-kit nodes:

- `ops-and-tech` - Operations notifications
- `jack-test` - Testing/development
- `#channel-name` - Any public channel

---

## After Generation

1. Save JSON to `/Users/jackkief/Desktop/Projects/sw-cortex/workflows/n8n/[Name].json`
2. Import into n8n.sugarwish.com via UI
3. Verify credentials are connected (the right one per the Credentials routing rule — `Retool` for Postgres writes, never `Odoo_read`)
4. Test with manual trigger before enabling schedule — but a failing manual run may just be the editor push channel dropping; check the **Executions** tab, not the editor banner (see Troubleshooting)
5. Set `active: true` in n8n UI when ready
