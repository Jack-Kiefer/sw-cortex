# Command: sync-meetings

Pull Jack's Google Drive meeting notes (the Gemini-generated "… - Notes by Gemini" Docs) into
the Qdrant vector database so they're semantically searchable via `/slack-search` — exactly the
way `npm run slack:sync` keeps Slack messages searchable, but for meeting notes.

```
/sync-meetings              # sync any Drive meeting notes not already indexed (incremental)
/sync-meetings all          # re-sync ALL meeting notes (re-fetch + re-index every Doc)
/sync-meetings since=YYYY-MM-DD   # only Docs modified on/after this date
```

`$ARGUMENTS` may contain `all` and/or `since=YYYY-MM-DD`. Anything else is ignored.

---

## Why this is a Claude-driven command (not a headless `npm` script)

The Slack sync is a standalone script because it uses a raw Slack **API token**. The meeting
notes live in **Google Drive**, and the only Drive access this setup has is the
`mcp__claude_ai_Google_Drive__*` **MCP tools — which only work inside a Claude session**, not
from a `npx tsx` script. So the fetch step must run here (Claude drives the MCP calls); the
embed/encrypt/upsert step reuses the **existing** `npm run meetings:sync` pipeline unchanged.

The flow is: **Claude fetches the Docs from Drive (MCP) → writes each as a markdown file in
`knowledge/meetings/` → runs `npm run meetings:sync -- --meetings-only`**, which chunks, embeds,
encrypts (AES-256-GCM), and upserts them into the `slack_messages_encrypted` collection. That
pipeline is already **idempotent** (point IDs are a deterministic MD5 of `meeting:<file>:chunk:<i>`),
so re-running **overwrites** the same points — it never stores a meeting twice.

---

## What you (Claude) must do

Set the tab title at the start: `~/.claude/scripts/set-tab-title.sh "🔨 syncing · meeting-notes"`.

### Step 1 — List the meeting-note Docs in Drive

Load the Drive MCP tools if they're deferred:

```
ToolSearch { query: "select:mcp__claude_ai_Google_Drive__search_files,mcp__claude_ai_Google_Drive__read_file_content" }
```

Then search Drive for the Gemini meeting-note Docs. These are Google Docs whose title ends in
**"Notes by Gemini"** (auto-created by Google Meet's Gemini note-taker). Use a query that catches
them, honoring the `since=` filter if given:

```
mcp__claude_ai_Google_Drive__search_files {
  query: "title contains 'Notes by Gemini' and mimeType = 'application/vnd.google-apps.document'",
  pageSize: 100,
  excludeContentSnippets: true
}
```

- If `since=YYYY-MM-DD` was passed, add `and modifiedTime >= '<since>T00:00:00Z'` to the query.
- The result may be large — if the tool result is saved to a file (it exceeds the token cap),
  extract just `title`, `id`, and `modifiedTime` with `jq`:
  `jq -r '.files[] | select(.mimeType=="application/vnd.google-apps.document") | "\(.modifiedTime[0:10])\t\(.title)\t\(.id)"' <saved-file> | sort -r`
- Paginate with `nextPageToken` if present so no Docs are missed.

> Some meeting notes may **not** have the "Notes by Gemini" suffix (manually-titled docs like
> "Purchasing Notes", "SERP Database Demonstration"). If Jack asks for those too, widen the query
> — but by default this command targets the Gemini auto-notes, which is the recurring stream.

### Step 2 — Figure out which Docs still need syncing (incremental by default)

For the plain `/sync-meetings` (no `all`), only sync Docs that aren't already indexed **at their
current version**. Check what's already in `knowledge/meetings/`:

```bash
ls -1 ~/Desktop/Projects/sw-cortex/knowledge/meetings/ 2>/dev/null
```

The saved markdown filename for a Doc is `YYYY-MM-DD-<slug>.md` (see Step 3). A Doc is
**already synced** if a file with its date + slug exists AND the Doc hasn't been modified since
that file was written. Simplest reliable rule:

- **`/sync-meetings` (default):** skip a Doc if its target filename already exists **and** the
  Doc's `modifiedTime` is not newer than the file's mtime. Re-fetch (and thus re-index) any Doc
  that is new or was edited since last sync.
- **`/sync-meetings all`:** re-fetch and re-write **every** Doc (forces a full re-index).
- **`/sync-meetings since=…`:** the Drive query already filtered by date; sync all it returned.

If nothing needs syncing, say so (`✅ Meeting notes already up to date — N Docs, all indexed`)
and stop before running the pipeline.

### Step 3 — Fetch each Doc's content and write it as markdown

For each Doc to sync, read its full text:

```
mcp__claude_ai_Google_Drive__read_file_content { fileId: "<id>" }
```

- The result is `{fileContent: string}`. It may exceed the token cap and be **saved to a file** —
  if so, extract the text with `jq -r '.fileContent' <saved-file>` rather than reading it inline,
  to keep it out of context. (The notes have a large "Details" section; you don't need to read it
  yourself — you're just piping it to disk for the sync pipeline to chunk.)
- **Build the filename** the sync parser expects — `YYYY-MM-DD-<slug>.md`:
  - Date = the Doc's `modifiedTime` date (`YYYY-MM-DD`). (The Gemini title also embeds a date/time;
    the modifiedTime is close enough and always present.)
  - Slug = the title with the trailing `" - YYYY/MM/DD HH:MM TZ - Notes by Gemini"` stripped, then
    lowercased, spaces → hyphens, non-alphanumerics removed. E.g.
    `"Weekly Dev Standup - 2026/07/02 06:00 MST - Notes by Gemini"` →
    `2026-07-02-weekly-dev-standup.md`.
  - Keep it deterministic: the **same Doc must always map to the same filename** so re-syncs
    overwrite (both the file and, downstream, the Qdrant points) instead of duplicating.
- **Write the file** to `~/Desktop/Projects/sw-cortex/knowledge/meetings/<filename>` as clean
  markdown, embedding the Doc id so future runs can match it:

  ```markdown
  # <Title without the Gemini suffix>

  Date: <YYYY-MM-DD>
  Drive-Id: <fileId>

  <full Doc text verbatim>
  ```

  (The `Drive-Id` line is a stable back-reference; the sync pipeline just treats it as content.)

`knowledge/meetings/` may not exist yet — `mkdir -p ~/Desktop/Projects/sw-cortex/knowledge/meetings`
before writing.

### Step 4 — Run the existing sync pipeline (embed + encrypt + upsert)

Once the files are written, run the meetings-only sync — this is the **same** code that already
handles chunking, embeddings, encryption, and idempotent upsert into Qdrant:

```bash
cd ~/Desktop/Projects/sw-cortex && npm run meetings:sync -- --meetings-only
```

Capture the "Indexed N chunks" line from its output. If it errors on the encryption key, tell Jack
`ENCRYPTION_KEY` is missing/invalid in `.env` (same key Slack sync uses). Because point IDs are a
deterministic hash of `meeting:<file>:chunk:<i>`, re-running is safe — it overwrites, never
duplicates.

> **Orphan-chunk note (only matters when re-syncing an EDITED Doc):** point IDs include the
> chunk index, so if a Doc was edited and now produces **fewer** chunks than before, the old
> high-index points are overwritten for the chunks that still exist but the surplus old chunks
> are left behind as orphans. This is harmless for append-only notes (the Gemini stream), but to
> keep it exact when you re-sync a Doc that shrank, delete that file's points first, keyed on the
> plain `threadTs` (which the sync stores as the encrypted filename) — or simplest: after a full
> `all` re-sync, there are no orphans for files that grew or stayed the same, and for the rare
> shrunk Doc you can drop-and-reindex by removing its points via the Qdrant client filtered on its
> `messageId` prefix (`meeting:<filename>:`). For the normal incremental path this never triggers.

### Step 5 — Confirm

Report tightly:

```
## 📝 Meeting Notes Synced

- **Fetched from Drive**: <N> Docs (<M> new/updated, <K> already current — skipped)
- **Indexed**: <C> chunks into Qdrant (slack_messages_encrypted)

Searchable now via `/slack-search` (e.g. "what did we decide about sleeve forecasting").
```

Set the tab to `✅ done · meeting-notes` before ending the turn.

## Notes

- **Idempotent.** Re-runs overwrite the same Qdrant points (deterministic point IDs) — a meeting
  is never stored twice, no matter how many times this runs. This is the same guarantee the Slack
  sync has.
- **Same collection, same search.** Meeting notes go into `slack_messages_encrypted` (the sync
  script's `ENCRYPTED_COLLECTION`), so `/slack-search` and the `slack-search` MCP already return
  them — no separate collection or search path needed.
- **MCP-only Drive access.** The fetch must run inside a Claude session (the Drive MCP tools
  aren't available to a headless script). `/start-day` invokes this same logic as an orchestrator
  (main-thread) step for the daily catch-up.
- This command lives in `global-config/commands/`. After editing it, sync with
  `bash scripts/sync-global-config.sh push` so `~/.claude/commands/sync-meetings.md` updates.
