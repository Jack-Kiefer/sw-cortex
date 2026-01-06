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

Save generated workflows to: `/home/jackk/sw-cortex/workflows/n8n/[Workflow_Name].json`

Use underscores in filename, matching the workflow name with spaces replaced.

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

Use numbered prefixes for clarity: `"1. Query Database"`, `"2. Transform Data"`, `"3. Send Notification"`

### Position Guidelines

- Start at approximately `[-12400, 200]`
- Increment X by 240-300 for each subsequent node
- Use Y offset of ~200 for parallel branches
- Error branches typically at Y + 200

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

**Interval (recurring):**

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "hours",
          "triggerAtMinute": 20
        }
      ]
    }
  }
}
```

Common cron expressions:

- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 8 * * 1-5` - Weekdays at 8 AM

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

**Accessing other nodes:**

```javascript
// Get data from specific node
const odooData = $('1. Query Odoo').all();
const firstItem = $('1. Query Odoo').first().json;

// Get current input
const currentItems = $input.all();
```

**Return format (CRITICAL):**

```javascript
// Always return array of { json: {...} }
return [{ json: { field: 'value' } }];

// For multiple items
return items.map((item) => ({ json: item }));
```

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

### 6. Merge

```json
{
  "id": "uuid-here",
  "name": "Merge Inputs",
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3,
  "position": [-11200, 200],
  "parameters": {
    "mode": "combine",
    "combinationMode": "mergeByPosition",
    "options": {}
  }
}
```

**Modes:**

- `append` - Combine all items from all inputs
- `combine` - Merge items by position or key
- `chooseBranch` - Select one input based on condition

### 7. Slack Notification

**Block Kit message:**

```json
{
  "id": "uuid-here",
  "name": "5. Slack Notification",
  "type": "n8n-nodes-base.slack",
  "typeVersion": 2.3,
  "position": [-10960, 200],
  "parameters": {
    "select": "channel",
    "channelId": {
      "__rl": true,
      "value": "ops-and-tech",
      "mode": "name"
    },
    "messageType": "block",
    "blocksUi": "={{ $json.blocks }}",
    "otherOptions": {}
  },
  "credentials": {
    "slackApi": {
      "id": "IafsmXhPRCyykQMM",
      "name": "Slack account"
    }
  }
}
```

**Simple text message:**

```json
{
  "parameters": {
    "select": "channel",
    "channelId": {
      "__rl": true,
      "value": "jack-test",
      "mode": "name"
    },
    "messageType": "text",
    "text": "Message with {{ $json.variable }} interpolation",
    "otherOptions": {}
  }
}
```

**Building Slack Block Kit in Code Node:**

```javascript
const blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Notification Title',
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Bold* and `code` formatting',
    },
  },
  {
    type: 'divider',
  },
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

return [{ json: { blocks } }];
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

| Name            | ID                 | Type     | Use For               |
| --------------- | ------------------ | -------- | --------------------- |
| `Odoo_read`     | `Cj4x3zqOHw9ecZst` | postgres | Odoo database queries |
| `sw_live_creds` | `IUf07KHTTBdglTB2` | mySql    | SugarWish production  |
| `Slack account` | `IafsmXhPRCyykQMM` | slackApi | Slack notifications   |

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
- [ ] `connections` references existing node names exactly
- [ ] Credential `id` and `name` match available credentials
- [ ] `settings.executionOrder` is `"v1"`
- [ ] `active` is `false` (enable manually in n8n)
- [ ] JSON is valid (no trailing commas, proper escaping)

---

## Common Patterns

### Error Handling Branch

Add `"onError": "continueErrorOutput"` to database nodes, then connect error output:

```json
{
  "onError": "continueErrorOutput",
  ...
}
```

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

Common channels:

- `ops-and-tech` - Operations notifications
- `jack-test` - Testing/development
- `#channel-name` - Any public channel

---

## After Generation

1. Save JSON to `/home/jackk/sw-cortex/workflows/n8n/[Name].json`
2. Import into n8n.sugarwish.com via UI
3. Verify credentials are connected
4. Test with manual trigger before enabling schedule
5. Set `active: true` in n8n UI when ready
