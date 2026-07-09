# Command: logs

<!-- Vendored verbatim from Seth Finley's shared repo: github.com/sethfinley/sugarwish-claude-commands (commands/logs.md).
     Managed here via sw-cortex global-config sync (NOT via Seth's clone+symlink installer). When Seth updates his copy,
     re-pull his logs.md into this file and sync-global-config.sh push. Requires Tailscale with seths-mac-mini shared. -->

Query the centralized log pipeline (Loki on the Mac mini, reached via Tailscale) using natural language. Syntax: `/logs <env> <prompt>`.

**Hybrid flow (two engines):**
1. **Primary — the AI analyst.** POST the prompt to the **query-bot `/analyze`** service. It runs its own Anthropic tool-use loop over Loki (Sonnet 4.6), returns a markdown summary + the matching log lines + a shareable **insights page** (`results_url`). This is the "dashboard with more insights" — always surface it.
2. **Then — code-level context (you).** Take the file/line refs, routes, and error clusters from the analyst's output and cross-reference the actual codebase to propose concrete fixes (which file, which line, what change). This is the value `/logs` adds on top of the server-side analyst.

**Every** `/logs` response ends with: the analyst summary, your code-level findings, the 🤖 insights-page link, and a 📊 Grafana dashboard link.

If the query-bot is unreachable, fall back to querying Loki directly (see "Fallback: direct Loki query") so `/logs` still works.

## Argument parsing

Everything the user typed after `/logs` is the input. Split on the first whitespace:
- **First token** = environment
- **Rest** = natural-language question

### Environment values (case-insensitive)

| User says | Canonical `env` label |
|---|---|
| `desk`, `live`, `prod`, `production` | `desk` |
| `desk2`, `dev`, `development` | `desk2` |
| `desk3`, `stage`, `staging` | `desk3` |
| `localhost`, `local` | `localhost` |
| `all`, `*` | (drop the `env=` selector — query across all envs) |

If the first token is **not** one of the above, treat the entire input as the prompt and default `env=desk2`.

If the input is empty: print the syntax (`/logs <env> <prompt>`) and stop.

## Services

Both run on the Mac mini, reached via Tailscale. Honor env overrides if set.

| Service | URL | Override | Used for |
|---|---|---|---|
| **query-bot** (AI analyst) | `http://seths-mac-mini:8080` | `$QUERY_BOT_URL` | primary `/analyze` path |
| **Loki** | `http://seths-mac-mini:3100` | `$LOKI_URL` | fallback direct queries |

Health-check the query-bot first:

```bash
curl -sS --max-time 4 "${QUERY_BOT_URL:-http://seths-mac-mini:8080}/health"
```

- `200` → use the primary `/analyze` path below.
- Non-200 / unreachable → check Loki (`curl -sS --max-time 3 "${LOKI_URL:-http://seths-mac-mini:3100}/ready"`). If Loki is `ready`, use the fallback direct-query path. If neither responds: "Neither the query-bot (8080) nor Loki (3100) is reachable on `seths-mac-mini`. Is Tailscale up? Run `tailscale status`."

## Primary path — the AI analyst (`/analyze`)

POST the user's natural-language prompt to the query-bot. It does the Loki querying + analysis server-side and returns the summary, the log lines, and a shareable insights page.

```bash
QB="${QUERY_BOT_URL:-http://seths-mac-mini:8080}"
curl -sS --max-time 90 -X POST "$QB/analyze" \
  -H "Content-Type: application/json" \
  --data '{"question":"<the user prompt>","env_hint":"<desk|desk2|desk3>"}'
```

**Request fields:**
- `question` (required) — the user's prompt text, verbatim (the part after the env token). Max 2000 chars.
- `env_hint` (optional) — **only** `desk`, `desk2`, or `desk3`. Map per the env table above (`live`/`prod` → `desk`, `dev` → `desk2`, `stage` → `desk3`). For `localhost`, `all`, or no env: **omit `env_hint`** and instead name the environment inside the `question` text (e.g. "…across all environments", "…on localhost").
- `max_results` (optional, 1–500) — pass only if the user asks to cap line volume.

**Response JSON** (don't dump it raw — relay it):
- `summary_md` — the AI analysis in Markdown. **This is the headline of your reply.** Relay it faithfully; tighten only if very long. Don't rewrite its findings.
- `results` — the matching log lines (already sorted). Use for your code cross-reference.
- `queries` — the LogQL the analyst actually ran. Useful to mention / reuse for the Grafana link.
- `results_url` — e.g. `http://seths-mac-mini:8080/results/<id>`. The rendered **insights page**. Always surface it as the 🤖 link.
- `meta` — `{model, tool_calls, input_tokens, output_tokens, latency_ms, lines_returned}`.

**Errors:** `429` = rate-limited (tell the user to retry shortly); `502` = the analyst's upstream (Anthropic or Loki) is down → fall back to direct Loki query; `500` = analyze failed → fall back. Retry once on a transient timeout before falling back.

## Add code-level context (hybrid)

After you have the analyst output, add what the server-side bot can't: grounding in the actual repo. This is required when the prompt implies a fix ("what's wrong", "is there something to fix", "why is X slow", "what caused the outage").

1. **Extract pointers** from `summary_md` + `results`: stack-trace file/line refs (e.g. `server/foo.ts:42`, `dist/index.js:129393`), route paths (e.g. `/api/quiz-runtime/:key/submit`), and recurring `msg` patterns.
2. **Locate them in the codebase** (the relevant repo is usually `~/Sites/SWAC` / WishDesk — match the route or filename). Use Grep/Read to find the handler and the offending line.
3. **Propose a concrete fix**: `file:line`, the root cause, and the specific change. Cite the CLAUDE.md rules where relevant (e.g. pool `queueLimit`, slow-route thresholds, SQL binding). Don't hedge — be specific or say you couldn't locate it.
4. If the prompt is purely informational ("how many errors", "show me slow routes"), the code cross-reference is optional — the analyst summary may be enough.

## Label schema (from `promtail.yml`)

Loki streams carry these labels:
- `service` — `swac`, `query-bot`, `synthetic` (more apps later, e.g. `sugarwish-laravel`)
- `env` — `localhost`, `desk2`, `desk3`, `desk`
- `level` — `info`, `warn`, `error`

Body fields available after `| json`:
- `msg` — human-readable message
- `route` — e.g. `GET /api/health`
- `duration_ms` — request latency
- `request_id` — correlation ID across log lines
- `user_id` — sometimes set
- Other fields per app

## Fallback: direct Loki query (when the analyst is down)

Use this path **only** if the query-bot `/analyze` call failed (non-200 health, 502/500, or repeated timeout). Here you build and run the LogQL yourself, then analyze the lines directly.

### Building the LogQL query

Build the stream selector first, then add filters / parsers.

### Selector patterns

- Specific env: `{service="swac",env="<env>"}`
- All envs: `{service="swac"}`
- Errors only: append `,level="error"` to the selector

### Common templates (use as a starting point, not verbatim)

| User intent | LogQL |
|---|---|
| Recent errors | `{service="swac",env="<env>",level="error"}` |
| Slow queries / requests | `{service="swac",env="<env>"} \| json \| duration_ms > 1000` |
| Specific route | `{service="swac",env="<env>"} \| json \| route=~"/api/checkout.*"` |
| One request's chain | `{service="swac",env="<env>"} \| json \| request_id="<id>"` |
| Pool exhaustion | `{service="swac",env="<env>"} \|= "POOL" \|= "QUEUE WARNING"` |
| 5xx responses | `{service="swac",env="<env>"} \| json \| status_code >= 500` |

### Time window defaults

Infer from the prompt; fall back to these:

| Prompt phrase | Window |
|---|---|
| "now", "happening", "recent" (no qualifier) | `now-15m` |
| "last hour" / "past hour" | `now-1h` |
| "today" | start of today (local) |
| "yesterday" | start of yesterday → end of yesterday |
| "last N minutes/hours/days" | `now-Nm` / `now-Nh` / `now-Nd` |

Always set `end=now` unless the prompt names a specific end.

### Limit

Default `limit=200`. Tighten if you expect huge volume (e.g. broad selectors with no filter). Widen only if the user explicitly asks for "all" or "every".

### Running the query

Use Loki's `query_range` endpoint. Nanoseconds for `start` / `end` (unix seconds × 1,000,000,000):

```bash
LOKI_URL="${LOKI_URL:-http://seths-mac-mini:3100}"
START_NS=$(date -u -v-1H +%s)000000000   # macOS BSD date — adjust window per prompt
END_NS=$(date -u +%s)000000000

curl -sS --max-time 15 -G "$LOKI_URL/loki/api/v1/query_range" \
  --data-urlencode 'query={service="swac",env="desk",level="error"}' \
  --data-urlencode "start=$START_NS" \
  --data-urlencode "end=$END_NS" \
  --data-urlencode 'limit=200' \
  --data-urlencode 'direction=backward'
```

Notes:
- `direction=backward` returns most-recent-first.
- The host is macOS — use BSD `date -v-1H` style. Don't use GNU `date -d`.
- Response shape: `data.result[].values` is an array of `[ts_ns, line]` tuples. The `line` is the original JSON log entry.

## Always provide a Grafana link (required)

Every `/logs` response MUST end with a **📊 Grafana** section. This is non-negotiable — even when there are zero results, even on errors where you still ran a query. The link lets the user eyeball the same logs + graphs in the UI.

**Use SHORT dashboard links — never the long `/explore?panes=...` deep-link.** The Explore deep-link JSON-encodes the whole query into the URL (~600 chars), which wraps and gets cut off in the terminal. The `swac-tail` dashboard already carries env + level + a free-text search + time range as short URL params, so a ~90-char link reproduces almost any `/logs` query *and* shows the rate graphs.

- **Grafana host:** `http://seths-mac-mini:3030` (Tailscale MagicDNS — reachable by anyone on the tailnet with the mini shared to them). This is the portable default: use it in all generated links. **On the mini's home LAN only**, you may swap the host for `http://grafana.mini:3030` (LAN alias for `192.168.68.84`) for snappier live-tail — the Tailscale tunnel stalls Grafana's live-tail WebSocket, so the LAN address is faster when you're on-site. Off-LAN teammates must use the `seths-mac-mini` name; `grafana.mini`/`192.168.68.84` will not resolve or route for them.
- Grafana requires login, but the user has a browser session — the links open straight to the view. (A raw `curl` to these URLs 302-redirects to `/login`; that's expected and does NOT mean the link is broken.)

### Build the link

Pick the dashboard by intent and fill the params. All params are optional except `var-env`.

| Intent | Link template |
|---|---|
| **Default** — tail/search + rate graphs | `http://seths-mac-mini:3030/d/swac-tail/?var-env=<env>&var-level=<level>&var-search=<term>&from=<from>&to=now` |
| Errors & warnings triage (no search needed) | `http://seths-mac-mini:3030/d/swac-live/?var-env=<env>&from=<from>&to=now` |
| Overview | `http://seths-mac-mini:3030/d/swac-overview/?var-env=<env>` |
| Env picker landing page | `http://seths-mac-mini:3030/d/ffkeymbou7qioa/` |

Param rules for `swac-tail`:
- `var-env` — canonical label (`desk`, `desk2`, `desk3`, `localhost`). For `env=all`, use `var-env=$__all`.
- `var-level` — `error`, `warn`, or `info` when the query filters by level; otherwise `$__all` (or omit).
- `var-search` — a single substring/keyword from the query (e.g. `POOL`, a route fragment, a request_id). It maps to the panel's `|~ "(?i)<term>"` line filter. **Omit it if there's no clean single term** (don't try to cram a full LogQL expression in here). URL-encode spaces as `%20`.
- `from`/`to` — match the window you queried (`now-10m`, `now-1h`, `now`, …).

Default dashboard choice: prompt about errors/warnings only → `swac-live`; everything else → `swac-tail`.

### When the query is too complex for the dashboard params

For advanced LogQL the dashboard vars can't express (e.g. `duration_ms > 1000`, a `request_id` chain, multi-condition regex), still give the **short `swac-tail` link** scoped to the right env + window, and additionally show the **raw LogQL** in a code block for the user to paste into Grafana Explore. Do NOT generate the long Explore URL.

### Required response structure

Every `/logs` reply ends with these two links together:

```
🤖 **Insights page** — <results_url from /analyze>
📊 **Grafana** — [<dashboard> · <env> · <window>](<short dashboard link>)
```

Full reply shape (primary path):

```
<analyst summary_md, relayed>

**Code context:** <your file:line findings + proposed fix>   ← when the prompt implies a fix

🤖 **Insights page** — http://seths-mac-mini:8080/results/<id>
📊 **Grafana** — [swac-tail · desk2 · last 10m](http://seths-mac-mini:3030/d/swac-tail/?var-env=desk2&var-level=error&from=now-10m&to=now)
```

On the **fallback path** there's no `results_url`, so omit the 🤖 line and keep the 📊 Grafana link. One short Grafana link is enough; add a raw-LogQL code block only for the complex-query case above.

### Analyzing the results (fallback path)

When you queried Loki yourself, do not dump raw curl output:

1. **State what you queried** in one sentence: env, time window, filter, line count returned.
2. **Group and summarize**:
   - Errors → cluster by `msg` (or the top stack frame) and count.
   - Slow queries → top 10 by `duration_ms` with `route`.
   - Pool/queue warnings → list the warning lines plus the surrounding context they reference.
3. **Surface concrete pointers** — file/line refs from stack traces (e.g. `dist/index.js:129393`, `server/foo.ts:42`) verbatim. These let the user (or you, in a follow-up) jump straight to the code.
4. **Answer the actual question**. If the prompt asks "is there something we need to fix?", be specific: which file, which pattern, suggested change. Don't hedge.
5. **If truncated at `limit=200`**, say so and propose a tighter filter.
6. **If empty**, say so and propose one alternative (wider window, looser filter).
7. **Always end with the 📊 Grafana section** (one SHORT dashboard link) per "Always provide a Grafana link". Required on every response, including empty/error cases. Never emit the long `/explore?panes=...` URL.

## Edge cases

- **Loki returns HTTP 400** → almost always a malformed LogQL. Show the user the query, fix, retry once.
- **Curl times out** → say Loki is slow / loaded; suggest a narrower window.
- **`env=all`** → group your summary by env so the user sees prod vs. dev separately.
- **No env arg given** → default to `desk2` and tell the user once: "Defaulted to env=desk2. Pass `live` / `desk3` / `localhost` / `all` to change."

## Example invocations

**`/logs desk2 show me the slow queries`**
→ POST `{"question":"show me the slow queries","env_hint":"desk2"}` to `/analyze`. Relay the summary (top slow routes by latency). Cross-reference the worst route in the repo (e.g. the `/api/quiz-runtime/...` handler) for why it's slow. End with 🤖 insights page + 📊 `swac-tail` link (`var-env=desk2&from=now-1h&to=now`).

**`/logs live find error logs from the last hour and tell me if there's something we need to fix`**
→ POST `{"question":"find error logs from the last hour and tell me if there's something we need to fix","env_hint":"desk"}`. Relay the clustered-error summary, then locate each cluster's `file:line` in the repo and propose the fix. End with 🤖 insights page + 📊 `swac-live` (`var-env=desk&from=now-1h&to=now`).

**`/logs all errors in last 10 minutes`**
→ `env=all` → **omit `env_hint`**; phrase as `{"question":"errors in the last 10 minutes across all environments"}`. Relay the per-env summary. End with 🤖 insights page + 📊 `swac-live` (`var-env=$__all&from=now-10m&to=now`).

**`/logs tell me what caused the outage in the last 10 mins`** (no env → defaults to `desk2`)
→ POST `{"question":"tell me what caused the outage in the last 10 mins","env_hint":"desk2"}`. Relay the root-cause summary, cross-reference the failing route/file in the repo. End with 🤖 insights page + 📊 `swac-tail` (`var-env=desk2&var-level=error&from=now-10m&to=now`) so the rate graph shows the spike. (If `/analyze` is down, fall back to a direct Loki query.)

## Don't

- Don't dump raw `/analyze` or curl JSON to the user — relay `summary_md`, then add code context.
- Don't skip the 🤖 insights-page link (`results_url`) when the primary path succeeded — it's the "dashboard with more insights" the user wants.
- Don't relay the `links` array from the `/analyze` response — those use the raw Tailscale IP and the long `/explore?panes=...` format. Generate your own SHORT `seths-mac-mini:3030` dashboard link instead.
- Don't rewrite or second-guess the analyst's findings — add to them with code-level detail; only correct it if the repo clearly contradicts it.
- Don't invent log lines or file refs that weren't in the response / repo.
- Don't *query* through Grafana — the analyst (or the fallback) reads Loki directly. You still always *link* to Grafana for viewing.
