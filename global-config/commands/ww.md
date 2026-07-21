# Command: ww

## Auto-Update (Run FIRST — before anything else)

Before doing anything, check if the `/ww` command file is up to date. Run this Python heredoc (pure Python — does NOT shell-out to curl, so it works under strict secret-pattern hooks that would block a `curl -H "Authorization: token $SWIRL_GITHUB_TOKEN" ...` pattern):

```bash
python3 << 'PYEOF'
import os, sys, json, base64, urllib.request, urllib.error

token = os.environ.get("SWIRL_GITHUB_TOKEN")
if not token:
    print("SKIP")
    sys.exit(0)

url = "https://api.github.com/repos/jasonbkiefer/SWIRL/contents/wishworks/_config/claude-commands/ww.md?ref=main"
req = urllib.request.Request(url, headers={"Authorization": f"token {token}"})
try:
    with urllib.request.urlopen(req) as r:
        remote = base64.b64decode(json.load(r)["content"]).decode()
except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError):
    print("SKIP")
    sys.exit(0)

if not remote or not remote.splitlines()[0].startswith("# Command: ww"):
    print("SKIP")
    sys.exit(0)

local_path = os.path.expanduser("~/.claude/commands/ww.md")
try:
    with open(local_path) as f:
        local = f.read()
except (OSError, IOError):
    local = ""

if remote == local:
    print("CURRENT")
    sys.exit(0)

try:
    with open(local_path, "w") as f:
        f.write(remote)
    with open(local_path) as f:
        check = f.read()
    if check == remote:
        print("UPDATED")
    else:
        print("UPDATE_WRITE_FAILED")
except (OSError, IOError):
    print("UPDATE_WRITE_FAILED")
PYEOF
```

**If the output is "UPDATED":** The local command file was just updated to the latest version. The instructions already loaded in this conversation are now outdated. To proceed correctly:

1. Use the Read tool to read `~/.claude/commands/ww.md` in full — this is the updated version. If the Read tool returns an error that the file is too large (e.g., "exceeds maximum allowed tokens"), read it in chunks using the `offset` and `limit` parameters, starting from line 1 and continuing until every line of the file has been read. Do NOT skip this step or proceed with partial content — you MUST read the entire updated file before moving on, even if it takes multiple Read calls.
2. Tell the user: "The /ww command was just updated to the latest version. Using the new instructions now."
3. Follow the **newly-read** instructions (not the ones already in this conversation) to handle the user's original request.

> ⚠️ **DO NOT REMOVE, SHORTEN, OR "SIMPLIFY" THE THREE-STEP RE-READ HANDLER DIRECTLY ABOVE.** It is load-bearing. It forces the session to re-read and follow the freshly-downloaded command instead of the stale instructions already in context. If it is replaced with a "just continue normally" shortcut, the **first** session after every `/ww` update silently runs OLD instructions — which is exactly what happened when T-163 removed it on 2026-05-21: the n8n archive prompt was skipped and a ticket got archived without it (2026-06-01). Any future edit to this auto-update section MUST preserve the "Read the whole updated file and follow it" behavior. If you are an AI assistant editing `/ww`, treat this as a hard constraint.

**If the output is "UPDATE_WRITE_FAILED":** The remote had a newer version of `/ww` but writing to `~/.claude/commands/ww.md` failed silently — most likely a file permissions or ownership issue on the user's machine. Do NOT proceed with the user's `/ww` request. Tell the user:

> "The /ww command tried to update but couldn't write to `~/.claude/commands/ww.md` on your machine (likely a permissions issue). Please run this in a regular terminal (not inside Claude Code), then fully quit Claude Code with cmd+Q and start a new session:
>
> ```
> TMP=$(mktemp) && curl -sH "Authorization: token $SWIRL_GITHUB_TOKEN" "https://api.github.com/repos/jasonbkiefer/SWIRL/contents/wishworks/_config/claude-commands/ww.md?ref=main" | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode(), end='')" > "$TMP" && head -1 "$TMP" | grep -q "^# Command: ww" && mkdir -p ~/.claude/commands && mv "$TMP" ~/.claude/commands/ww.md && echo OK || { rm -f "$TMP"; echo FAILED; }
> ```
>
> If that still prints FAILED, check that `SWIRL_GITHUB_TOKEN` is set in your shell and that you own `~/.claude/commands/ww.md` (`ls -la ~/.claude/commands/ww.md`)."

**If the output is "CURRENT" or "SKIP":** Continue normally.

> **NOTE:** The `/ww-dev` command (the sandbox version) has a similar auto-update block. If you are editing the auto-update section in `/ww` (this file), the `/ww-dev` version should be kept in sync separately — `/ww-dev` uses "UPDATED_WW" and "UPDATE_WRITE_FAILED_WW" (the `_WW` suffix) as its output strings to distinguish from this file's output.

---

WishWorks ticket management — manage WishWorks tickets via natural language.

**Talk naturally** — just describe what you want to do after running `/ww`. Examples:

- "show my tickets"
- "move WW-003 to in progress"
- "I want to create a new bug for Wishdesk"
- "set the estimate on WW-002 to M"
- "assign WW-003 to Bilal"
- "archive WW-003 because it's no longer needed"
- "create a child ticket for WW-003"
- "what's the status of WW-001?"
- "add a comment to WW-003: deployed the fix to blue, please retest"
- "attach ~/Downloads/screenshot.png to WW-003"
- "add these files to WW-003: ~/Desktop/img1.png ~/Desktop/img2.png"
- "create a bug for Wishdesk — proposal page is broken. Attach: ~/Downloads/bug-screenshot.png"

## Arguments

- `$ARGUMENTS` — optional natural language request. If no arguments, print the ready message and a fun fact. Say "show my tickets" (or a filter like "show all Wishdesk bugs") to see your assigned list.

## GitHub API Details

- **Repo:** `jasonbkiefer/SWIRL`
- **Branch:** `main` — **ALL reads and writes MUST target the `main` branch**
- **Token:** read from `SWIRL_GITHUB_TOKEN` env var. Every Python heredoc that makes API calls already reads it via `os.environ["SWIRL_GITHUB_TOKEN"]` (raises `KeyError` immediately if unset) or `os.environ.get(...)` (returns None → prints SKIP). **Do NOT add a pre-API verification step via shell** (`echo $SWIRL_GITHUB_TOKEN`, `[ -n "$SWIRL_GITHUB_TOKEN" ]`, etc.) — those patterns get blocked by strict secret-pattern hooks on some developer machines and trigger a ~30-second fallback per call. The auto-update block at the top of this command already runs first and prints SKIP if the token is missing. If the user reports SKIP, tell them to add `export SWIRL_GITHUB_TOKEN="..."` to `~/.zshrc` and start a new session. Never echo, print, log, or hardcode the token value.
- **Use python3** with heredoc format (`python3 << 'PYEOF'` ... `PYEOF`) for all API calls. Use `urllib.request`, `json`, and `base64` modules.
- **Read:** GET `https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{path}?ref=main` — returns JSON with `sha`, `content` (base64), and `download_url`
- **Write:** PUT same URL — send JSON with `message`, `content` (base64-encoded), `sha`, and `"branch": "main"`
- **Delete:** DELETE same URL — send JSON with `message`, `sha`, and `"branch": "main"`
- **Timestamps:** Always use Mountain Time (`America/Denver`) via `zoneinfo.ZoneInfo("America/Denver")`
- **Config files MUST be fetched from GitHub, not local.** When reading config files like `team.md`, `TICKET_FORMAT_GUIDE.md`, `component-matrix.json`, or `ticket-schema.md`, always use the GitHub API (`GET https://api.github.com/repos/jasonbkiefer/SWIRL/contents/wishworks/_config/{filename}?ref=main`). Never read these from the local filesystem — local copies may be out of date.

## Standard Ticket Helpers

**CRITICAL:** When writing a Python heredoc that modifies a ticket file, you MUST include these helper functions at the top of your script and use them for ALL modifications. NEVER write your own section-finding or insertion logic — that causes corruption (entries landing in wrong sections).

Copy everything between `# --- START HELPERS ---` and `# --- END HELPERS ---` into the top of your Python heredoc (after your imports).

```python
# --- START HELPERS ---
import re

def sanitize_yaml_value(value):
    """Clean up user-provided text so it produces valid YAML.
    Fixes common typos: stray backslash-escapes, em dashes, curly quotes.
    IMPORTANT: Process double-backslash FIRST to avoid partial consumption."""
    if not isinstance(value, str):
        return value
    value = value.replace('\\\\', '\\') # double-backslash -> single (MUST be first)
    value = value.replace("\\'", "'")   # backslash-apostrophe -> apostrophe
    value = value.replace('\\"', '"')   # backslash-quote -> quote
    value = value.replace('\u2014', '-') # em dash -> hyphen
    value = value.replace('\u2013', '-') # en dash -> hyphen
    value = value.replace('\u2018', "'").replace('\u2019', "'") # curly single quotes
    value = value.replace('\u201c', '"').replace('\u201d', '"') # curly double quotes
    return value

def update_frontmatter(content, updates):
    """Update YAML frontmatter fields. updates is a dict of field->value."""
    if not content.startswith('---'):
        return content
    end = content.index('---', 3)
    fm_text = content[3:end]
    for field, value in updates.items():
        if isinstance(value, bool):
            formatted = str(value).lower()
        elif isinstance(value, str):
            value = sanitize_yaml_value(value)
            if '"' in value or ':' in value or '\\' in value or value == '' or value.startswith(' '):
                escaped = value.replace('\\', '\\\\').replace('"', '\\"') # backslash MUST be first
                formatted = f'"{escaped}"'
            else:
                formatted = value
        else:
            formatted = str(value)
        pattern = re.compile(r'^(' + re.escape(field) + r'):\s*.*$', re.MULTILINE)
        if pattern.search(fm_text):
            replacement = f'{field}: {formatted}'
            fm_text = pattern.sub(lambda m, r=replacement: r, fm_text) # lambda avoids backref interpretation
        else:
            fm_text = fm_text.rstrip() + f'\n{field}: {formatted}\n'
    return content[:3] + fm_text + content[end:]

def read_link_entries(content, field):
    """Read the current entries of a link field (`linked_tickets` / `linked_work_items`)
    as a list of {type, ticket_id|work_item_id} dicts. Normalizes "", null, [], or an
    absent field to []. Pure string/regex (no yaml round-trip) — matches the rest of the
    helpers and tolerates a field that was previously written in a slightly off shape."""
    if not content.startswith('---'):
        return []
    end = content.index('---', 3)
    fm = content[3:end]
    # field line + its block value: following lines that are indented OR a `- ` sequence
    # item at column 0 (yaml.dump emits sequences flush-left, so older files may be in
    # that shape — match both so existing entries are never silently dropped on rewrite).
    m = re.search(r'^' + re.escape(field) + r':.*(?:\n(?:[ \t]+.*|-[ \t].*))*', fm, re.MULTILINE)
    if not m:
        return []
    entries = []
    for item in re.split(r'\n[ \t]*-\s', m.group(0)):  # first chunk is the field: line itself -> skipped
        tm = re.search(r'type:\s*(\S+)', item)
        im = re.search(r'(ticket_id|work_item_id):\s*(\S+)', item)
        if tm and im:
            entries.append({'type': tm.group(1), im.group(1): im.group(2)})
    return entries

def write_link_entries(content, field, entries):
    """Replace the ENTIRE `field:` block in frontmatter with valid YAML.
    Empty -> `field: []`. Non-empty -> proper block list. String-surgical: rewrites ONLY
    this field's lines, so created_at and every other field stay byte-for-byte unchanged
    (no global yaml.safe_load/dump, so timestamps are never reformatted). Correctly
    replaces the field whether it is currently "", [], a block list, or absent — so it
    never leaves a `field: ""` scalar with dangling list items (invalid YAML)."""
    if not content.startswith('---'):
        return content
    end = content.index('---', 3)
    fm = content[3:end]
    if entries:
        lines = [f'{field}:']
        for e in entries:
            idkey = 'ticket_id' if 'ticket_id' in e else 'work_item_id'
            lines.append(f'  - type: {e["type"]}')
            lines.append(f'    {idkey}: {e[idkey]}')
        block = '\n'.join(lines)
    else:
        block = f'{field}: []'
    # match the whole existing block (indented OR flush-left `- ` items) so the
    # replacement leaves no dangling sequence lines behind.
    pattern = re.compile(r'^' + re.escape(field) + r':.*(?:\n(?:[ \t]+.*|-[ \t].*))*', re.MULTILINE)
    if pattern.search(fm):
        fm = pattern.sub(lambda m, b=block: b, fm, count=1)  # lambda avoids backref interpretation
    else:
        fm = fm.rstrip('\n') + '\n' + block + '\n'
    return content[:3] + fm + content[end:]

def _link_key(e):
    return (e.get('type'), e.get('ticket_id', e.get('work_item_id')))

def add_link_entry(content, field, entry):
    """Idempotently add a link entry and rewrite the field as valid YAML.
    entry = {'type': T, 'ticket_id'|'work_item_id': ID}."""
    entries = read_link_entries(content, field)
    if _link_key(entry) not in [_link_key(e) for e in entries]:
        entries.append(entry)
    return write_link_entries(content, field, entries)

def remove_link_entry(content, field, ref_type, ref_id):
    """Remove the entry matching (ref_type, ref_id) and rewrite the field. No-op if absent."""
    entries = [e for e in read_link_entries(content, field)
               if (e.get('type'), e.get('ticket_id', e.get('work_item_id'))) != (ref_type, ref_id)]
    return write_link_entries(content, field, entries)

def append_history(content, entry):
    """Append an entry to ## History. Finds the last '- ' line and inserts after it."""
    if '## History' not in content:
        return content.rstrip() + f'\n\n## History\n{entry}\n'
    idx = content.index('## History')
    before = content[:idx]
    after = content[idx:]
    lines = after.split('\n')
    last_entry_idx = -1
    for i in range(1, len(lines)):
        if lines[i].startswith('## '):
            break
        if lines[i].startswith('- '):
            last_entry_idx = i
    if last_entry_idx == -1:
        insert_idx = 1
        while insert_idx < len(lines) and lines[insert_idx].strip() == '':
            insert_idx += 1
        lines.insert(insert_idx, entry)
    else:
        lines.insert(last_entry_idx + 1, entry)
    return before + '\n'.join(lines)

def _find_section_heading(content, heading):
    """Line-anchored heading search (mirrors SWAC conversation-writer's findSectionHeading).
    Returns the char index of the heading start, or -1. Line-anchored so user-authored
    text quoting a heading (e.g. '## Conversation' inside a comment body) can't match."""
    m = re.search(r'(?:^|\n)(' + re.escape(heading) + r')[ \t]*(?:\n|$)', content)
    return m.start(1) if m else -1

def append_conversation(content, author_name, body, source="Claude CLI"):
    """Append a comment to the ## Conversation section, byte-matching the WishWorks UI
    writer (SWAC wishworks/services/conversation-writer.ts). The UI parser silently
    DROPS any line in that section that isn't an entry header or a blockquote line —
    format drift means the comment disappears from the viewer. NEVER hand-roll this.

    Entry format:
        **Name** — YYYY-MM-DD HH:MM:SS (via Claude CLI)
        > body line (blank body lines become a bare ">")
    Header separator is an EM DASH; timestamp is Mountain, 24h, WITH seconds (unlike
    the minute-precision timestamps used elsewhere in this command).
    Section placement when missing: before ## Release Actions, else before ## History,
    else end of file. Adds do NOT write a ## History breadcrumb (matches the UI —
    only comment deletes are logged to History).
    Raises ValueError if the updated file would exceed the UI's 1 MB capacity cap
    (past the cap the UI can no longer parse the file at all)."""
    from datetime import datetime as _dt
    from zoneinfo import ZoneInfo as _zi
    safe_name = re.sub(r'[:#\n\r`|>*_]', '', author_name).strip() or 'Unknown'
    quoted = '\n'.join(('> ' + ln) if ln.strip() else '>' for ln in body.split('\n'))
    ts = _dt.now(_zi("America/Denver")).strftime("%Y-%m-%d %H:%M:%S")
    entry = f"**{safe_name}** — {ts} (via {source})\n{quoted}"
    conv_idx = _find_section_heading(content, '## Conversation')
    if conv_idx != -1:
        after_heading = conv_idx + len('## Conversation')
        m = re.search(r'\n#{1,6} ', content[after_heading:])
        section_end = (after_heading + m.start()) if m else len(content)
        updated = content[:section_end].rstrip() + '\n\n' + entry + '\n' + content[section_end:]
    else:
        block = f"## Conversation\n\n{entry}\n\n"
        insert_idx = _find_section_heading(content, '## Release Actions')
        if insert_idx == -1:
            insert_idx = _find_section_heading(content, '## History')
        if insert_idx != -1:
            updated = content[:insert_idx] + block + content[insert_idx:]
        else:
            updated = content.rstrip() + '\n\n' + block.rstrip() + '\n'
    if len(updated.encode('utf-8')) > 1_048_576:
        raise ValueError("Ticket is at capacity — delete an older comment in the WishWorks UI before adding a new one.")
    return updated

def time_log_row(content, action, developer=None, date=None, hours=None, description=None,
                 match_hours=None, match_description=None):
    """Manage ## Time Log table. action: 'add', 'edit', or 'delete'.

    Each time log is its own row — 'add' always appends a new row, never merges.

    For 'edit' and 'delete', matching is by developer + date, breaking on the first match.
    When multiple rows may exist for the same developer + date, callers MUST pass
    match_hours + match_description to disambiguate (matches on all four fields).
    """
    TABLE_HEADER = "| Date | Developer | Hours | Description |\n|------|-----------|-------|-------------|"
    if action == 'add' and '## Time Log' not in content:
        new_section = f"## Time Log\n\n{TABLE_HEADER}\n| {date} | {developer} | {hours} | {description} |"
        if '## History' in content:
            idx = content.index('## History')
            return content[:idx].rstrip() + '\n\n' + new_section + '\n\n' + content[idx:]
        else:
            return content.rstrip() + f'\n\n{new_section}\n'
    if '## Time Log' not in content:
        return content
    idx = content.index('## Time Log')
    before = content[:idx]
    after = content[idx:]
    lines = after.split('\n')
    data_rows = []
    section_end = len(lines)
    for i in range(1, len(lines)):
        line = lines[i]
        if line.startswith('## '):
            section_end = i
            break
        if line.startswith('|') and not line.startswith('|--') and not ('Date' in line and 'Developer' in line and 'Hours' in line):
            data_rows.append(i)
    def _row_matches(cells):
        if len(cells) < 2 or cells[0] != date or cells[1] != developer:
            return False
        if match_hours is not None and match_description is not None:
            if len(cells) < 4 or cells[2] != match_hours or cells[3] != match_description:
                return False
        return True
    if action == 'add':
        new_row = f"| {date} | {developer} | {hours} | {description} |"
        if data_rows:
            lines.insert(data_rows[-1] + 1, new_row)
        else:
            for i in range(1, section_end):
                if lines[i].startswith('|--'):
                    lines.insert(i + 1, new_row)
                    break
            else:
                lines.insert(1, f"\n{TABLE_HEADER}\n{new_row}")
    elif action == 'edit':
        for row_idx in data_rows:
            cells = [c.strip() for c in lines[row_idx].split('|')[1:-1]]
            if _row_matches(cells):
                lines[row_idx] = f"| {date} | {developer} | {hours} | {description} |"
                break
    elif action == 'delete':
        for row_idx in data_rows:
            cells = [c.strip() for c in lines[row_idx].split('|')[1:-1]]
            if _row_matches(cells):
                lines.pop(row_idx)
                break
        remaining_data = []
        new_section_end = len(lines)
        for i in range(1, len(lines)):
            if lines[i].startswith('## '):
                new_section_end = i
                break
            if lines[i].startswith('|') and not lines[i].startswith('|--') and not ('Date' in lines[i] and 'Developer' in lines[i]):
                remaining_data.append(i)
        if not remaining_data:
            rest = '\n'.join(lines[new_section_end:]) if new_section_end < len(lines) else ''
            return before.rstrip() + '\n\n' + rest.lstrip('\n') if rest.strip() else before.rstrip() + '\n'
    return before + '\n'.join(lines)

def update_release_actions(content, updates):
    """Update Release Actions checkboxes. updates: [{"action": "Route(s)", "checked": True, "detail": "..."}]
    If section is missing, creates it before ## History. If section exists but has no checkboxes, rebuilds the standard checklist."""
    STANDARD_CHECKLIST = [
        '- [ ] No actions needed', '- [ ] CMS update(s)', '- [ ] Env variable(s)',
        '- [ ] Package(s)', '- [ ] Queue(s)', '- [ ] Retool app(s) or workflow(s)',
        '- [ ] Route(s)', '- [ ] Scheduled action(s) (ie. cron, scheduler, or LF)',
        '- [ ] Seeder(s)', '- [ ] SQL querie(s)']
    if '## Release Actions' not in content:
        checklist = '\n'.join(STANDARD_CHECKLIST)
        if '## History' in content:
            idx = content.index('## History')
            content = content[:idx].rstrip() + '\n\n## Release Actions\n' + checklist + '\n\n' + content[idx:]
        else:
            content = content.rstrip() + '\n\n## Release Actions\n' + checklist + '\n'
    idx = content.index('## Release Actions')
    before = content[:idx]
    after = content[idx:]
    lines = after.split('\n')
    section_end = len(lines)
    for i in range(1, len(lines)):
        if lines[i].startswith('## '):
            section_end = i
            break
    has_checkboxes = any(('- [ ]' in lines[i] or '- [x]' in lines[i]) for i in range(1, section_end))
    if not has_checkboxes:
        insert_at = 1
        for item in STANDARD_CHECKLIST:
            lines.insert(insert_at, item)
            insert_at += 1
        section_end += len(STANDARD_CHECKLIST)
    for update in updates:
        action_name = update['action']
        checked = update.get('checked', False)
        detail = update.get('detail', None)
        for i in range(section_end):
            if action_name in lines[i] and ('- [ ]' in lines[i] or '- [x]' in lines[i]):
                if checked:
                    lines[i] = lines[i].replace('- [ ]', '- [x]')
                else:
                    lines[i] = lines[i].replace('- [x]', '- [ ]')
                has_detail = (i + 1 < section_end and lines[i + 1].startswith('  ') and not lines[i + 1].strip().startswith('- ['))
                if detail and checked:
                    if has_detail:
                        lines[i + 1] = f'  {detail}'
                    else:
                        lines.insert(i + 1, f'  {detail}')
                        section_end += 1
                elif not checked and has_detail:
                    lines.pop(i + 1)
                    section_end -= 1
                break
        if action_name == "No actions needed" and checked:
            for i in range(section_end):
                if '- [x]' in lines[i] and 'No actions needed' not in lines[i]:
                    lines[i] = lines[i].replace('- [x]', '- [ ]')
                    if (i + 1 < section_end and lines[i + 1].startswith('  ') and not lines[i + 1].strip().startswith('- [')):
                        lines.pop(i + 1)
                        section_end -= 1
    return before + '\n'.join(lines)

def validate_yaml_frontmatter(content):
    """Validate YAML frontmatter parses correctly. Fix double-escaping if not.
    Call this on the final content string BEFORE writing to GitHub."""
    try:
        import yaml
    except ImportError:
        return content  # PyYAML not installed — skip validation
    if not content.startswith('---'):
        return content
    end = content.index('---', 3)
    fm_text = content[3:end]
    try:
        yaml.safe_load(fm_text)
        return content  # Valid — no changes needed
    except yaml.YAMLError:
        # Try fixing double-escaped quotes: \\" → "
        fm_text = fm_text.replace('\\\\"', '"')
        fm_text = fm_text.replace("\\\\'", "'")
        try:
            yaml.safe_load(fm_text)
            return content[:3] + fm_text + content[end:]
        except yaml.YAMLError:
            return content  # Can't auto-fix — return as-is

def fetch_active_tickets_parallel(branch, token, max_workers=20):
    """Fetch all active ticket .md files from wishworks/dev-requests/active/
    in parallel. Returns dict of {filename: content_str}. Raises on any
    fetch failure — do NOT silently drop, would corrupt filter results.

    Uses api.github.com with Accept: application/vnd.github.raw (NOT the
    download_url field). download_url is a signed raw.githubusercontent.com
    URL with a short-lived token (~5 min) that expires mid-fetch against
    large active/ directories — verified in T-163 Chunk 1, 36/207 files
    404'd against the tail of a sequential fetch using download_url."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    listing_url = (
        f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/"
        f"wishworks/dev-requests/active?ref={branch}"
    )
    req = urllib.request.Request(
        listing_url, headers={"Authorization": f"token {token}"}
    )
    with urllib.request.urlopen(req) as r:
        listing = json.load(r)
    md_files = [
        f for f in listing
        if f.get("type") == "file" and f["name"].endswith(".md")
    ]

    def _fetch_one(meta):
        url = (
            f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/"
            f"{meta['path']}?ref={branch}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.raw",
            },
        )
        with urllib.request.urlopen(req) as r:
            return meta["name"], r.read().decode()

    tickets = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(_fetch_one, f) for f in md_files]
        for future in as_completed(futures):
            name, content = future.result()  # raises on per-fetch error
            tickets[name] = content
    return tickets

# === Archive helper + its internal fetch/put (from T-163 Chunk 8) ===
# archive_ticket() is used by the T-087 Chunk 7 archive flow; _fetch_ticket_file /
# _put_ticket_file are its internal deps. T-163's update_ticket() and
# log_time_to_ticket() were REMOVED 2026-06-01 as dead code — their wire-in was
# reverted (multi-bash-call overhead) and nothing called them. Do not re-add without callers.

import time as _time_mod
import datetime as _datetime_mod
import base64 as _base64_mod

def _fetch_ticket_file(path, branch, token):
    """Internal: fetch a ticket file. Returns (content_str, sha). Raises on HTTP error."""
    url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{path}?ref={branch}"
    req = urllib.request.Request(url, headers={"Authorization": f"token {token}"})
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    return _base64_mod.b64decode(data["content"]).decode(), data["sha"]

def _put_ticket_file(path, content, sha, branch, token, message):
    """Internal: PUT a ticket file. sha=None for new file. Returns response dict."""
    url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{path}?ref={branch}"
    payload = {
        "message": message,
        "content": _base64_mod.b64encode(content.encode()).decode(),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method="PUT",
        headers={"Authorization": f"token {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def archive_ticket(ticket_id, archive_reason, archived_by, branch, token, extra_fm=None, body_section=None):
    """Archive a ticket: update frontmatter (status=archived, archive_reason=...) + history
    → PUT to archive/<year>-q<quarter>/ → DELETE from active/.
    Note: archiving NEVER adds a `bucket` field (board-task concept, not in the ticket schema)
    and NEVER changes `priority` — those are weekly-board archive behaviors, not ticket ones.
    PUT to archive FIRST (ticket never absent from both places).

    Args:
        ticket_id:      "WW-085" or "WW-123"
        archive_reason: one-line reason text
        archived_by:    canonical Name (e.g., "Anna Kifer")
        extra_fm:       optional dict of additional frontmatter scalars to set in the SAME
                        archive write — e.g. {"real_issue": "yes", "n8n_candidate": "alert",
                        "n8n_candidate_notes": ""}. Used by the n8n archive prompt (Chunk 7).
                        Note: n8n_prompts_sent is intentionally NOT passed (stays unchanged).
        body_section:   optional markdown block inserted immediately before "## History" —
                        e.g. the "## n8n Workflow Spec" section. None = no body change.
    Returns:
        {"ok": True, "archive_path": ...} on success
        {"ok": True, "warning": "archive PUT ok but active DELETE failed"} on partial success
        {"error": "..."} on failure"""
    active_path = f"wishworks/dev-requests/active/{ticket_id}.md"
    try:
        content, active_sha = _fetch_ticket_file(active_path, branch, token)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"error": f"{ticket_id} not found in active/ (already archived?)"}
        return {"error": f"Fetch failed: HTTP {e.code}"}
    now = _datetime_mod.datetime.now()
    year, quarter = now.strftime("%Y"), (now.month - 1) // 3 + 1
    archive_path = f"wishworks/dev-requests/archive/{year}-q{quarter}/{ticket_id}.md"
    now_ts = now.strftime("%Y-%m-%d %H:%M")
    fm_updates = {
        "status": "archived",
        "archive_reason": archive_reason,
    }
    if extra_fm:
        fm_updates.update(extra_fm)
    new_content = update_frontmatter(content, fm_updates)
    if body_section:
        # Insert the body section immediately before the "## History" heading (or append
        # to the end if there is no History section). Used for the "## n8n Workflow Spec"
        # section written by the Chunk 7 n8n archive prompt.
        block = body_section.strip() + "\n\n"
        hist_idx = new_content.find("\n## History")
        if hist_idx != -1:
            new_content = new_content[:hist_idx + 1] + block + new_content[hist_idx + 1:]
        else:
            new_content = new_content.rstrip() + "\n\n" + block
    new_content = append_history(new_content, f"- {now_ts} — Archived by {archived_by} via Claude CLI (reason: {archive_reason})")
    new_content = validate_yaml_frontmatter(new_content)
    archive_sha = None
    try:
        _existing, archive_sha = _fetch_ticket_file(archive_path, branch, token)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            return {"error": f"Archive path check failed: HTTP {e.code}"}
    try:
        _put_ticket_file(archive_path, new_content, archive_sha, branch, token,
                         f"Archive {ticket_id} ({archive_reason})")
    except urllib.error.HTTPError as e:
        return {"error": f"Archive PUT failed: HTTP {e.code}"}
    url_del = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{active_path}?ref={branch}"
    payload_del = json.dumps({"message": f"Move {ticket_id} to archive", "sha": active_sha, "branch": branch}).encode()
    req_del = urllib.request.Request(url_del, data=payload_del, method="DELETE",
        headers={"Authorization": f"token {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req_del) as r:
            json.load(r)
    except urllib.error.HTTPError as e:
        return {"ok": True, "archive_path": archive_path,
                "warning": f"Archive PUT succeeded but active DELETE failed (HTTP {e.code}). Ticket exists in both places — manual cleanup needed."}
    return {"ok": True, "archive_path": archive_path}
# --- END HELPERS ---
```

### How to use the helpers

**Updating ticket fields** (status, priority, assignee, environment, etc.):

```python
content = update_frontmatter(content, {"status": "in_progress", "environment": "blue"})
```

**Adding a history entry** (every ticket change needs this):

```python
content = append_history(content, f"- {now} — Status changed to in_progress (by {actor} via Claude CLI)")
```

**Adding a comment (Conversation entry):**

```python
content = append_conversation(content, "Anna Kifer", "Deployed the fix to blue — please retest.")
```

Do NOT pair this with `append_history()` — comment adds intentionally skip the History breadcrumb (matches the WishWorks UI). Author name must be the canonical full Name from team.md. Full flow (mention check, author resolution, confirmation note): see "If asking to add a comment to a ticket".

**Adding a time log row:**

```python
content = time_log_row(content, "add", developer="Bilal Ahmed", date="2026-03-31", hours="3.0", description="Tax calc fix")
```

**Editing a time log row:**

```python
content = time_log_row(content, "edit", developer="Bilal Ahmed", date="2026-03-31", hours="4.5", description="Updated description")
```

**Editing when multiple rows exist for the same developer + date** (pass `match_hours` + `match_description` to target a specific row):

```python
content = time_log_row(content, "edit", developer="Bilal Ahmed", date="2026-03-31",
                       hours="4.5", description="Updated description",
                       match_hours="1.5", match_description="Fixed the bug")
```

**Deleting a time log row:**

```python
content = time_log_row(content, "delete", developer="Bilal Ahmed", date="2026-03-31")
```

**Deleting when multiple rows exist for the same developer + date** (pass `match_hours` + `match_description` to target a specific row):

```python
content = time_log_row(content, "delete", developer="Bilal Ahmed", date="2026-03-31",
                       match_hours="1.5", match_description="Fixed the bug")
```

**Updating release actions:**

```python
content = update_release_actions(content, [{"action": "Route(s)", "checked": True, "detail": "Update nginx conf"}])
```

**Validating YAML before writing to GitHub** (REQUIRED for ticket creation and any multi-field update):

```python
content = validate_yaml_frontmatter(content)
```

Call this as the LAST step before writing `content` to GitHub via the API. It catches double-escaping bugs that can break the entire ticket in Wishdesk.

**Parallel-fetching all active tickets** (use any time you'd otherwise loop-fetch every active ticket — e.g. duplicate detection, "show my tickets" filter, ad-hoc cross-ticket queries):

```python
tickets = fetch_active_tickets_parallel("main", token, max_workers=20)
# tickets is {filename: content_str}; parse YAML frontmatter for each
```

~5–10s instead of ~3 min on a 200-ticket active/ directory. Raises on ANY single-fetch failure (never silently drops a ticket — that would corrupt filter results). If it raises, surface a "couldn't fetch all tickets — retry?" prompt rather than continuing with a partial set. Uses `api.github.com/.../contents/{path}?ref={branch}` with `Accept: application/vnd.github.raw` so there's no signed-URL expiration window (the `download_url` field of the contents endpoint expires after ~5 min and 404s mid-fetch on large directories — don't use it).

**NEVER do any of the following** — these patterns caused the corruption bug:

- `re.search(r'\n## ', after_section)` to find section boundaries
- Manual string slicing to insert into sections
- Writing your own logic to find where History or Time Log entries go

## Attachment Support

The `/ww` command supports attaching files to tickets. Files are uploaded to S3 (same bucket as WishBot) and linked in the ticket's `## Attachments` section.

**Attachments section rule — ALWAYS follow:** The `## Attachments` section contains ONLY bare link lines in the form `- [filename](url)` — nothing else, ever. No captions, no descriptions, no prose — not on the same line as the link, and not on a separate line below it.

When the user writes text around an image reference (e.g. `add this image [Image #1] this is showing the bug`, or prose before/after a pasted image), the image itself goes into `## Attachments` as a bare link — but the surrounding text is **ticket body content, not attachment metadata**. Route it to the appropriate section:

- **New ticket (during create):** fold the prose into `## Description`.
- **Existing ticket (attach to WW-###):** add the prose as a `## Conversation` comment (use `append_conversation()` — see "If asking to add a comment to a ticket") or an item in `## History`, whichever fits the intent.

Never dump the surrounding prose into `## Attachments` under any circumstance.

**Note:** For /ww, always use branch = "main" in the ticket update helper.

### Attachment Config

- **Max file size:** 10MB (10,485,760 bytes)
- **Blocked extensions:** `.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`, `.msi`, `.dll`, `.com`, `.scr`, `.vbs`, `.wsf`
- **S3 env vars required:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `AWS_REGION` (defaults to `us-east-1`)
- **S3 key format:** `{ticketId}/{sanitized-filename}`
- **S3 ACL:** `public-read`
- **URL format:** `https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{ticketId}/{filename}`

### Detecting Images in the Conversation

When processing a `/ww` request, check if images were included in the conversation:

1. Look for `[Image #N]` references in the recent conversation context
2. If found, check for corresponding cached files at `~/.claude/image-cache/` — these are files Claude Code creates when images are dropped or pasted
3. If cached files exist and are readable, offer to attach them: "I see you included an image. Want me to attach it to this ticket?"
4. This is a **bonus feature** — if the cache path doesn't exist or isn't readable, silently fall back to file-path-only mode

### Resolving File Paths

When a user provides a file path (e.g., `~/Downloads/screenshot.png`):

1. Expand `~` to the home directory
2. Resolve relative paths against the current working directory
3. Verify the file exists and is readable

### Attachment Python Helper

Use this Python heredoc to validate and upload a file. Replace `{FILE_PATH}`, `{TICKET_ID}`, and `{FILENAME}` with actual values:

```bash
python3 << 'PYEOF'
import os, sys, re, json

file_path = os.path.expanduser("{FILE_PATH}")
ticket_id = "{TICKET_ID}"
original_filename = os.path.basename(file_path)

# --- Validate ---
if not os.path.isfile(file_path):
    print(json.dumps({"error": f"File not found: {file_path}"}))
    sys.exit(0)

size = os.path.getsize(file_path)
if size > 10_485_760:
    size_mb = round(size / 1_048_576, 1)
    print(json.dumps({"error": f"File is {size_mb}MB — max is 10MB. Try a smaller file or compress it."}))
    sys.exit(0)

ext = os.path.splitext(original_filename)[1].lower()
blocked = {".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".com", ".scr", ".vbs", ".wsf"}
if ext in blocked:
    print(json.dumps({"error": f"{ext} files can't be attached for security reasons."}))
    sys.exit(0)

# --- Sanitize filename ---
safe_name = re.sub(r'\s+', '-', original_filename)
safe_name = re.sub(r'[^a-zA-Z0-9._-]', '', safe_name)
if not safe_name:
    safe_name = "attachment"

# --- Check S3 config ---
aws_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
aws_secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
bucket = os.environ.get("S3_BUCKET_NAME", "")
region = os.environ.get("AWS_REGION", "us-east-1")

if not all([aws_key, aws_secret, bucket]):
    print(json.dumps({"error": "Image attachments require AWS credentials. Add these lines to your ~/.zshrc (ask Anna for the AWS key and secret):\n\nexport AWS_ACCESS_KEY_ID=\"ask-anna\"\nexport AWS_SECRET_ACCESS_KEY=\"ask-anna\"\nexport S3_BUCKET_NAME=\"sugarwish-wishworks-attachments\"\nexport AWS_REGION=\"us-east-1\"\n\nThen restart your terminal or run: source ~/.zshrc"}))
    sys.exit(0)

# --- Upload to S3 ---
try:
    import boto3
except ImportError:
    print(json.dumps({"error": "boto3 is not installed. Run: pip install boto3"}))
    sys.exit(0)

try:
    s3 = boto3.client("s3", region_name=region,
                       aws_access_key_id=aws_key,
                       aws_secret_access_key=aws_secret)
    s3_key = f"{ticket_id}/{safe_name}"

    # Guess content type
    import mimetypes
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    with open(file_path, "rb") as f:
        s3.put_object(Bucket=bucket, Key=s3_key, Body=f.read(),
                      ContentType=content_type, ACL="public-read")

    s3_url = f"https://{bucket}.s3.{region}.amazonaws.com/{s3_key}"
    print(json.dumps({"ok": True, "filename": safe_name, "s3_url": s3_url, "size_bytes": size}))
except Exception as e:
    print(json.dumps({"error": f"S3 upload failed: {str(e)}"}))
PYEOF
```

Parse the JSON output. If `error`, show the error message to the user. If `ok`, proceed to update the ticket markdown.

### Updating Ticket Markdown with Attachments

After a successful S3 upload, update the ticket's markdown to include the attachment link.

Use this Python heredoc to add the attachment to the ticket. Replace `{TICKET_ID}`, `{FILENAME}`, `{S3_URL}`, and `{ACTOR}` with actual values:

```bash
python3 << 'PYEOF'
import urllib.request, json, base64, os, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo

token = os.environ["SWIRL_GITHUB_TOKEN"]
ticket_id = "{TICKET_ID}"
filename = "{FILENAME}"
s3_url = "{S3_URL}"
branch = "main"
actor = "{ACTOR}"  # from git config user.name

headers = {"Authorization": f"token {token}", "Content-Type": "application/json"}

# --- Find the ticket file ---
found_path = None

for folder in ["wishworks/dev-requests/active"]:
    url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{folder}?ref={branch}"
    try:
        req = urllib.request.Request(url, headers=headers)
        files = json.loads(urllib.request.urlopen(req).read())
        for f in files:
            if f["name"] == f"{ticket_id}.md":
                found_path = f["path"]
                break
    except:
        pass
    if found_path:
        break

if not found_path:
    archive_url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/wishworks/dev-requests/archive?ref={branch}"
    try:
        req = urllib.request.Request(archive_url, headers=headers)
        subdirs = json.loads(urllib.request.urlopen(req).read())
        for subdir in subdirs:
            if subdir["type"] == "dir":
                sub_url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{subdir['path']}?ref={branch}"
                try:
                    req2 = urllib.request.Request(sub_url, headers=headers)
                    files = json.loads(urllib.request.urlopen(req2).read())
                    for f in files:
                        if f["name"] == f"{ticket_id}.md":
                            found_path = f["path"]
                            break
                except:
                    pass
            if found_path:
                break
    except:
        pass

if not found_path:
    print(json.dumps({"error": f"Ticket {ticket_id} not found"}))
    sys.exit(0)

# --- Fetch ticket content ---
content_url = f"https://api.github.com/repos/jasonbkiefer/SWIRL/contents/{found_path}?ref={branch}"
req = urllib.request.Request(content_url, headers=headers)
resp = json.loads(urllib.request.urlopen(req).read())
sha = resp["sha"]
raw = base64.b64decode(resp["content"]).decode()

# --- Insert or append to ## Attachments section ---
attachment_line = f"- [{filename}]({s3_url})"

if "## Attachments" in raw:
    att_idx = raw.index("## Attachments")
    after_att = raw[att_idx:]
    next_heading = re.search(r'\n## (?!Attachments)', after_att)
    if next_heading:
        insert_pos = att_idx + next_heading.start()
        updated = raw[:insert_pos].rstrip() + "\n" + attachment_line + "\n\n" + raw[insert_pos:].lstrip()
    else:
        updated = raw.rstrip() + "\n" + attachment_line + "\n"
else:
    history_marker = "## History"
    if history_marker in raw:
        idx = raw.index(history_marker)
        attachments_section = f"## Attachments\n\n{attachment_line}\n\n"
        updated = raw[:idx] + attachments_section + raw[idx:]
    else:
        updated = raw.rstrip() + f"\n\n## Attachments\n\n{attachment_line}\n"

# --- Add history entry (using Standard Ticket Helper) ---
now = datetime.now(ZoneInfo("America/Denver")).strftime("%Y-%m-%d %H:%M")
history_entry = f"- {now} — Attached {filename} (by {actor} via Claude CLI)"
# --- START HELPERS (append_history only) ---
def append_history(content, entry):
    if '## History' not in content:
        return content.rstrip() + f'\n\n## History\n{entry}\n'
    idx = content.index('## History')
    before = content[:idx]
    after = content[idx:]
    lines = after.split('\n')
    last_entry_idx = -1
    for i in range(1, len(lines)):
        if lines[i].startswith('## '):
            break
        if lines[i].startswith('- '):
            last_entry_idx = i
    if last_entry_idx == -1:
        insert_idx = 1
        while insert_idx < len(lines) and lines[insert_idx].strip() == '':
            insert_idx += 1
        lines.insert(insert_idx, entry)
    else:
        lines.insert(last_entry_idx + 1, entry)
    return before + '\n'.join(lines)
# --- END HELPERS ---
updated = append_history(updated, history_entry)

# --- Write back with SHA conflict retry ---
for attempt in range(3):
    try:
        put_data = json.dumps({
            "message": f"WishWorks: attach {filename} to {ticket_id}",
            "content": base64.b64encode(updated.encode()).decode(),
            "sha": sha,
            "branch": branch
        }).encode()
        put_req = urllib.request.Request(content_url, data=put_data, headers=headers, method="PUT")
        urllib.request.urlopen(put_req)
        print(json.dumps({"ok": True, "ticket_id": ticket_id, "filename": filename, "s3_url": s3_url}))
        sys.exit(0)
    except urllib.error.HTTPError as e:
        if e.code == 409 and attempt < 2:
            req = urllib.request.Request(content_url, headers=headers)
            resp = json.loads(urllib.request.urlopen(req).read())
            sha = resp["sha"]
            continue
        print(json.dumps({"error": f"Failed to update ticket: HTTP {e.code} — {e.read().decode()[:200]}"}))
        sys.exit(0)
PYEOF
```

Parse the JSON output. If `error`, tell the user: "The file was uploaded to S3 but I couldn't update the ticket. You can try again with `/ww attach {path} to {ticket_id}`." If `ok`, confirm: "Attached {filename} to {ticket_id}."

## Ticket Format Guide

**Source of truth for ticket structure:** `wishworks/_config/TICKET_FORMAT_GUIDE.md` in the Swirl repo.

When creating or modifying tickets, always follow the format guide. Key rules:

- **All fields must be present** in every ticket, even if blank (use `""`)
- Different tracks and types have different required fields and starting statuses
- **Laravel, React Receiver, and Shipping Labels tickets** include a Release Actions checklist section (different items per track — see Release Actions Gate)
- **Wishdesk tickets** should have `component` set from `wishworks/_config/component-matrix.json` → `wishdesk` section
- **Laravel tickets** should have `component` set from `wishworks/_config/component-matrix.json` → `laravel` section
- **React Receiver and Shipping Labels tickets** have no component taxonomy — leave `component` and `sub_component` blank

## Instructions

### If no arguments: Print ready message

The default no-args path is intentionally minimal — no team.md fetch, no developer resolution, no ticket fetching, no smart prompts, no fun-fact generation. See T-163 for rationale.

**Step 1: Auto-update check** — already done at the top of the command (the auto-update block runs first).

**Step 2: Print the ready message**

> "WishWorks is active for this session. You can ask me to do anything — create tickets or work items, link items together, change status, set priority, estimate, assign, archive, log time, or create child tickets. Say 'show my tickets' to see your assigned list, or 'fun fact' if you want one. Just tell me what you need in plain English."

That's the entire default flow. ~1–3 seconds on the developer's machine. Nothing else runs unless they ask for it.

### If asking for a fun fact

The developer can opt into a fun fact, interesting piece of trivia, or positive thought at any time. Trigger phrases (interpret natural language): "fun fact", "give me a fun fact", "tell me something interesting", "positive thought", etc.

**Step 1 — Read recent history (per-machine dedup across sessions).**

Each developer has a local history file at `~/.claude/ww-fun-fact-history.md` recording the last facts they've seen. Read the last 50 entries:

```bash
python3 << 'PYEOF'
import os
p = os.path.expanduser("~/.claude/ww-fun-fact-history.md")
if os.path.exists(p):
    with open(p) as f:
        lines = f.read().splitlines()
    print("\n".join(lines[-50:]))
PYEOF
```

If output is empty, there's no history yet — pick any fact freely. If output has entries, you'll use them in Step 2.

**Step 2 — Pick the fact (internally — do NOT show it to the developer yet), following these rules — these are hard requirements, not suggestions:**

- **Never invent or fabricate facts.** Only share fun facts you are confident are true and verifiable from general world knowledge (science, history, geography, language, etc.). If you're not sure something is true, do not say it — pick a different fact, or default to a positive thought / encouragement instead.
- **Never share fun facts about Sugarwish, its products, brand, branding choices, history, founders, customers, or competitors.** You do not have authoritative knowledge of internal Sugarwish details, and inventing them risks misinforming the team. (The CEO previously received a fabricated claim about the brand-color rationale — that exact failure mode is what this rule exists to prevent.)
- **Avoid any subject that appears in the Step 1 history.** Soft semantic matching, not strict string compare — if a recent entry was about octopuses, don't pick another sea-creature-anatomy fact; switch categories entirely (language, history, space, food science, music, etc.). Look at the last ~10–15 entries especially closely.
- Generate something fresh and varied each time — don't repeat within the current conversation either.

**Step 3 — Log the fact to history (BEFORE showing it).**

This step MUST happen — without it Step 1 can't dedupe future sessions. Use the first sentence of the fact (keeps the file compact):

```bash
python3 << 'PYEOF'
import os, datetime
path = os.path.expanduser("~/.claude/ww-fun-fact-history.md")
fact = """FIRST_SENTENCE_OF_THE_FACT_YOU_PICKED"""
ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "a") as f:
    f.write(f"- {ts} | {fact}\n")
PYEOF
```

Replace `FIRST_SENTENCE_OF_THE_FACT_YOU_PICKED` with the literal first sentence (no surrounding quotes inside the heredoc).

**Step 4 — Show the fact, as the LAST thing in your response.**

Display the full fact only AFTER the Step 3 logging call has run, so it is the final content on the developer's screen. **Do not print the fact before a tool call** — Claude Code's TUI collapses tool output, and any text printed before a tool call scrolls up and gets visually buried behind it; the developer ends up seeing only whatever you say after the last tool call. (This exact miss happened on 2026-06-04 — the fact was shown, then the logging call ran, then a "Logged it" line printed; the developer only saw "Logged it" and never the fact.) Order is always: read history → pick → log → show. Nothing after the fact except, optionally, one short line offering another.

### If asking to see tickets

Trigger phrases (examples — interpret natural language): "show my tickets", "show me my tickets", "what's on my plate", "show all Wishdesk bugs", "show critical bugs", "what tickets need release actions", "show all my Laravel tickets", "show all tickets", etc.

**Step 1: Determine filters from the developer's request**

Parse the natural-language request into the filter variables (set at the top of the consolidated heredoc in Step 2). Each filter is either None (don't apply) or a specific value:

- `MY_TICKETS_ONLY` — True by default. False if developer said "all" with no possessive (e.g., "show all Wishdesk bugs" means EVERYONE's Wishdesk bugs).
- `STATUS_FILTER` — e.g., `"in_progress"`, `"deploy_ready"`, `"backlog"`. None if no status mentioned.
- `TRACK_FILTER` — e.g., `"wishdesk"`, `"laravel"`, `"shipping-labels"`, `"react-receiver"`, `"wishbot"`, `"retool"`, `"swirl-bot"`. None if not mentioned.
- `TYPE_FILTER` — `"bug"`, `"story"`, `"task"`. None if not mentioned.
- `PRIORITY_FILTER` — `"critical"`, `"high"`, `"medium"`, `"low"`. None if not mentioned.
- `INCLUDE_RELEASED` — True if developer said "all" or "including released"; False by default.
- `INCLUDE_ARCHIVED` — True if developer said "including archived" or "show all archived"; False by default. When True, also implies `INCLUDE_RELEASED=True`.
- `NEEDS_RELEASE_ACTIONS_ONLY` — True if developer asked "what tickets need release actions"; False by default.

**Step 2: Run the consolidated Python heredoc (everything in one call)**

This single heredoc does EVERYTHING — git user lookup, team.md parse, canonical-name resolution, parallel ticket fetch, YAML frontmatter parse, filter, compute needs_release_actions, compute estimate gate, sort, and render the final display string. **One bash call total.** All the work happens in Python; the AI never reads team.md contents or individual ticket bodies. That's what keeps the command fast — without this, the AI would scan team.md (~75 rows) AND scan 207 ticket bodies in its own context (~30+s of unnecessary LLM work).

Set the six filter variables at the top of the heredoc from Step 1, then run it. Output is the formatted ticket list ready to display.

```bash
python3 << 'PYEOF'
import os, json, sys, subprocess
import urllib.request
import yaml
from concurrent.futures import ThreadPoolExecutor, as_completed

# === SET THESE FROM STEP 1 ===
MY_TICKETS_ONLY = True                  # False if developer said "all" without possessive
STATUS_FILTER = None                    # or "in_progress", "deploy_ready", "backlog", etc.
TRACK_FILTER = None                     # or "wishdesk", "laravel", etc.
TYPE_FILTER = None                      # or "bug", "story", "task"
PRIORITY_FILTER = None                  # or "critical", "high", "medium", "low"
INCLUDE_RELEASED = False                # True if developer said "all" or "including released"
INCLUDE_ARCHIVED = False                # True if developer said "including archived"; implies INCLUDE_RELEASED
NEEDS_RELEASE_ACTIONS_ONLY = False      # True if developer asked specifically for these
# ==============================
if INCLUDE_ARCHIVED:
    INCLUDE_RELEASED = True             # "include archived" implies released too

BRANCH = "main"
TOKEN = os.environ["SWIRL_GITHUB_TOKEN"]
REPO = "jasonbkiefer/SWIRL"

# Resolve the developer's canonical full Name (only fetch team.md if we actually need it).
ASSIGNEE_FILTER = None
if MY_TICKETS_ONLY:
    try:
        git_name = subprocess.check_output(
            ["git", "config", "user.name"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except subprocess.CalledProcessError:
        git_name = ""

    team_url = f"https://api.github.com/repos/{REPO}/contents/wishworks/_config/team.md?ref={BRANCH}"
    team_req = urllib.request.Request(team_url, headers={"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github.raw"})
    with urllib.request.urlopen(team_req) as r:
        team_md = r.read().decode()

    # Parse Dev Team table rows. Columns: Name | Slack ID | GitHub Username | Department | Role | ...
    # git config user.name might be the canonical "Anna Kifer" OR the GitHub username "anna-kifer"
    # depending on how the user configured git. Match against either column.
    dev_rows = []  # list of (name, github_username)
    in_dev_team = False
    for line in team_md.splitlines():
        if line.strip().startswith("## Dev Team"):
            in_dev_team = True
            continue
        if in_dev_team and line.strip().startswith("## "):
            break
        if in_dev_team and line.startswith("|") and not line.startswith("|--"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 3 and cells[0] != "Name":
                dev_rows.append((cells[0], cells[2]))  # (canonical Name, GitHub Username)

    # Try matching strategies in order
    git_first = git_name.split()[0].lower() if git_name else ""
    # (1) exact match on canonical Name
    for name, gh in dev_rows:
        if name == git_name:
            ASSIGNEE_FILTER = name
            break
    # (2) exact match on GitHub Username
    if not ASSIGNEE_FILTER:
        for name, gh in dev_rows:
            if gh and gh == git_name:
                ASSIGNEE_FILTER = name
                break
    # (3) first-name match (case-insensitive) against canonical Name's first token
    if not ASSIGNEE_FILTER and git_first:
        for name, gh in dev_rows:
            if name.split()[0].lower() == git_first:
                ASSIGNEE_FILTER = name
                break
    # (4) fall back to git_name as-is — likely won't match any ticket assignee
    if not ASSIGNEE_FILTER:
        ASSIGNEE_FILTER = git_name

def fetch_active_tickets_parallel(branch, token, max_workers=20):
    listing_url = f"https://api.github.com/repos/{REPO}/contents/wishworks/dev-requests/active?ref={branch}"
    req = urllib.request.Request(listing_url, headers={"Authorization": f"token {token}"})
    with urllib.request.urlopen(req) as r:
        listing = json.load(r)
    md_files = [f for f in listing if f.get("type") == "file" and f["name"].endswith(".md")]
    def _fetch_one(meta):
        url = f"https://api.github.com/repos/{REPO}/contents/{meta['path']}?ref={branch}"
        req = urllib.request.Request(url, headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.raw"})
        with urllib.request.urlopen(req) as r:
            return meta["name"], r.read().decode()
    out = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for fut in as_completed([pool.submit(_fetch_one, f) for f in md_files]):
            name, content = fut.result()
            out[name] = content
    return out


def fetch_archived_tickets_parallel(branch, token, max_workers=20):
    """Fetch every .md ticket under wishworks/dev-requests/archive/<subdir>/.
    Archive is partitioned by quarter (e.g. 2026-q1, 2026-q2). Walks the
    parent dir, lists each quarter subdir in parallel, then parallel-fetches
    every .md file. Returns {filename: content_str}."""
    parent_url = f"https://api.github.com/repos/{REPO}/contents/wishworks/dev-requests/archive?ref={branch}"
    req = urllib.request.Request(parent_url, headers={"Authorization": f"token {token}"})
    try:
        with urllib.request.urlopen(req) as r:
            parent_listing = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {}  # no archive folder yet
        raise
    subdirs = [s for s in parent_listing if s.get("type") == "dir"]

    def _list_subdir(subdir):
        sub_url = f"https://api.github.com/repos/{REPO}/contents/{subdir['path']}?ref={branch}"
        req = urllib.request.Request(sub_url, headers={"Authorization": f"token {token}"})
        with urllib.request.urlopen(req) as r:
            return json.load(r)

    all_files = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for fut in as_completed([pool.submit(_list_subdir, s) for s in subdirs]):
            listing = fut.result()
            all_files.extend([f for f in listing if f.get("type") == "file" and f["name"].endswith(".md")])

    def _fetch_one(meta):
        url = f"https://api.github.com/repos/{REPO}/contents/{meta['path']}?ref={branch}"
        req = urllib.request.Request(url, headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.raw"})
        with urllib.request.urlopen(req) as r:
            return meta["name"], r.read().decode()

    out = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for fut in as_completed([pool.submit(_fetch_one, f) for f in all_files]):
            name, content = fut.result()
            out[name] = content
    return out

try:
    tickets = fetch_active_tickets_parallel(BRANCH, TOKEN)
    if INCLUDE_ARCHIVED:
        tickets.update(fetch_archived_tickets_parallel(BRANCH, TOKEN))
except Exception as e:
    print(json.dumps({"error": f"Fetch failed: {e}"}))
    sys.exit(0)

PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "": 4, None: 4}
RELEASE_TRACKS_PRE_ENVS = {
    "laravel": ("development", "blue"),
    "react-receiver": ("development", "blue"),
    "shipping-labels": ("development",),
}

rows = []
for filename, content in tickets.items():
    if not content.startswith("---"):
        continue
    try:
        end = content.index("---", 3)
    except ValueError:
        continue
    try:
        fm = yaml.safe_load(content[3:end]) or {}
    except yaml.YAMLError:
        continue

    status = (fm.get("status") or "").lower()
    track = (fm.get("track") or "").lower()
    type_ = (fm.get("type") or "").lower()
    priority = (fm.get("priority") or "").lower()
    env = (fm.get("environment") or "").lower()
    assignee = fm.get("assignee") or ""

    # Filters
    if ASSIGNEE_FILTER and assignee != ASSIGNEE_FILTER:
        continue
    if STATUS_FILTER and status != STATUS_FILTER.lower():
        continue
    if TRACK_FILTER and track != TRACK_FILTER.lower():
        continue
    if TYPE_FILTER and type_ != TYPE_FILTER.lower():
        continue
    if PRIORITY_FILTER and priority != PRIORITY_FILTER.lower():
        continue
    if not INCLUDE_RELEASED and status == "released":
        continue
    if not INCLUDE_ARCHIVED and status == "archived":
        continue

    # needs_release_actions: track has a pre-release env and Release Actions section incomplete
    needs_ra = False
    if track in RELEASE_TRACKS_PRE_ENVS and env in RELEASE_TRACKS_PRE_ENVS[track]:
        ra_split = content.split("## Release Actions", 1)
        if len(ra_split) == 2:
            ra_section = ra_split[1].split("\n## ", 1)[0]
            # Incomplete if any unchecked box remains
            if "- [ ]" in ra_section:
                needs_ra = True

    if NEEDS_RELEASE_ACTIONS_ONLY and not needs_ra:
        continue

    # Estimate gate: story/task/bug on Laravel/RR/SL in backlog with no estimate
    needs_estimate = False
    if track in ("laravel", "react-receiver", "shipping-labels"):
        if type_ in ("story", "task", "bug") and status == "backlog":
            if not (fm.get("estimate") or "").strip():
                needs_estimate = True

    rows.append({
        "id": filename.replace(".md", ""),
        "title": fm.get("title") or "",
        "type": type_,
        "track": track,
        "status": status,
        "priority": priority,
        "environment": env,
        "needs_release_actions": needs_ra,
        "needs_estimate": needs_estimate,
        "created_at": str(fm.get("created_at") or ""),  # str() — yaml.safe_load may parse as datetime
        "archive_reason": fm.get("archive_reason") or "",
    })

# Sort: needs_release_actions first, then priority, then created_at oldest first
rows.sort(key=lambda r: (
    not r["needs_release_actions"],
    PRIORITY_ORDER.get(r["priority"], 4),
    r["created_at"] or "9999",
))

# === Build the final display string in Python (NOT in the AI) ===
# This eliminates LLM column-alignment errors and saves ~30s of LLM formatting work.

# Build filter description for empty-results message
filter_desc_parts = []
if ASSIGNEE_FILTER:
    filter_desc_parts.append(f"assigned to {ASSIGNEE_FILTER}")
if STATUS_FILTER:
    filter_desc_parts.append(STATUS_FILTER.replace("_", " "))
if TRACK_FILTER:
    filter_desc_parts.append(TRACK_FILTER.capitalize())
if TYPE_FILTER:
    filter_desc_parts.append(TYPE_FILTER + "s")
if PRIORITY_FILTER:
    filter_desc_parts.append(PRIORITY_FILTER.capitalize() + " priority")
if NEEDS_RELEASE_ACTIONS_ONLY:
    filter_desc_parts.append("needing release actions")
filter_desc = " ".join(filter_desc_parts) if filter_desc_parts else "active"

if not rows:
    print(f"You have no {filter_desc} WishWorks tickets.")
    sys.exit(0)

def trunc(s, n=30):
    """Truncate to n chars, pad with spaces to n if shorter."""
    s = (s or "").replace("\n", " ")
    if len(s) > n:
        return s[:n-1] + "…"
    return s.ljust(n)

def fmt_row(row, fifth_col_field):
    """Format ONE row. fifth_col_field is either 'status' or 'environment' (for NEEDS RELEASE ACTIONS section)."""
    id_col = row["id"].ljust(11)
    title_col = trunc(row["title"], 30)
    type_col = (row["type"] or "").capitalize().ljust(6)
    track_col = (row["track"] or "").capitalize().ljust(9)
    fifth = (row[fifth_col_field] or "").ljust(15)
    priority = (row["priority"] or "—").capitalize() if row["priority"] else "—"
    return f"  {id_col} {title_col}  {type_col} {track_col} {fifth} {priority}"

# Group rows by section
nra_rows = [r for r in rows if r["needs_release_actions"]]
backlog_rows = [r for r in rows if not r["needs_release_actions"] and r["status"] == "backlog"]
in_progress_rows = [r for r in rows if not r["needs_release_actions"] and r["status"] == "in_progress"]
deploy_ready_rows = [r for r in rows if not r["needs_release_actions"] and r["status"] == "deploy_ready"]
released_rows = [r for r in rows if not r["needs_release_actions"] and r["status"] == "released"]
archived_rows = [r for r in rows if not r["needs_release_actions"] and r["status"] == "archived"]
# Catch-all for any other statuses (e.g., "blocked")
seen_in_groups = {id(r) for r in nra_rows + backlog_rows + in_progress_rows + deploy_ready_rows + released_rows + archived_rows}
other_rows = [r for r in rows if id(r) not in seen_in_groups]

lines = [f"Your WishWorks Tickets — SANDBOX ({len(rows)} total)", ""]

def add_section(label, section_rows, fifth_field):
    if not section_rows:
        return
    lines.append(f"{label}:")
    for r in section_rows:
        lines.append(fmt_row(r, fifth_field))
        if r["needs_estimate"]:
            lines.append("  ⚠️  Needs estimate before moving to in progress")
    lines.append("")

def add_archive_section(section_rows):
    """ARCHIVED has a different fifth column: archive_reason instead of status (which is always 'archived' here)."""
    if not section_rows:
        return
    lines.append("ARCHIVED:")
    for r in section_rows:
        id_col = r["id"].ljust(11)
        title_col = trunc(r["title"], 30)
        type_col = (r["type"] or "").capitalize().ljust(6)
        track_col = (r["track"] or "").capitalize().ljust(9)
        reason = trunc(r["archive_reason"] or "—", 30)
        lines.append(f"  {id_col} {title_col}  {type_col} {track_col} {reason}")
    lines.append("")

add_section("NEEDS RELEASE ACTIONS", nra_rows, "environment")
add_section("BACKLOG", backlog_rows, "status")
add_section("IN PROGRESS", in_progress_rows, "status")
add_section("DEPLOY READY", deploy_ready_rows, "status")
if INCLUDE_RELEASED:
    add_section("RELEASED", released_rows, "status")
if INCLUDE_ARCHIVED:
    add_archive_section(archived_rows)
if other_rows:
    add_section("OTHER", other_rows, "status")

print("\n".join(lines).rstrip())
PYEOF
```

**Step 4: Print the output verbatim — EVERY row, no exceptions**

**CRITICAL — the user does NOT see the bash output by default.** Claude Code's TUI collapses bash results behind a "ctrl+o to expand" prompt. The user only sees the summary line + "+N lines (ctrl+o to expand)". Your re-print of the formatted rows IS what the user sees inline without expanding.

**If you summarize instead of re-printing, the user does not see their tickets** — they'd have to ctrl+o expand the bash output every time, which is the friction this command was designed to eliminate.

**Required behavior:** print every single line from the Python heredoc's output verbatim. 43 rows = 43 rows in your response. 100 rows = 100 rows. **Count does not matter. Length does not matter. Print everything.**

The Python heredoc above does ALL the formatting work (section headers, column alignment, title truncation with `…`, estimate-gate warnings, the totals header line). **Output it verbatim — do NOT re-format, re-align, re-truncate, or paraphrase any line.** Adding column alignment manually has caused title-truncation bugs in the past (rows like "WW-076 WishBot Not Resishworks in_progress" — the AI mid-word-truncating and merging into the track column).

After printing every row verbatim, you MAY add ONE short follow-up line (e.g., "Want me to drill into any of these, or filter further?"). Otherwise, nothing else.

**Forbidden behaviors (every one of these has happened before — DO NOT do any of them):**

- **Summarizing instead of listing.** Phrases like "All 43 active Wishdesk bugs — heavy concentration in BACKLOG (36)…" are FORBIDDEN. The user cannot see the rows from a summary.
- **Skipping rows because there are many.** 24 rows, 43 rows, 100 rows — print them all. No exception for "this seems like a lot".
- **Replacing ticket titles with paraphrases** like "lots of test tickets" or "various T-### chunks". Every row must show the actual title (truncated by Python).
- **Re-running the Python heredoc** multiple times. Once is enough.
- **Adding commentary inside the table**.

If you find yourself thinking "this is a lot of rows, I should summarize" — STOP. Print every single row instead. The user explicitly wants this.

### If asking to create a ticket: Ticket Creation Flow

When a developer wants to create a new ticket, gather all required information before creating it. Ask questions conversationally — don't dump a form.

> **Ticket vs. work item:** this flow is for **development tickets** (`WW-###` — code work on a track). If the developer wants to track **non-dev department work** (a `DW-###` work item — e.g. an FAQ update, a copy refresh, an ops process change), use the **Work Item Creation Flow** section instead.

**Pre-flight (MANDATORY — re-fetch config FRESH before every ticket creation):**

At the START of every ticket-creation flow, re-fetch these four config files fresh from GitHub via the API — **even if you already fetched one or more of them earlier in this same Claude session.** Never reuse content read earlier in the conversation:

- `wishworks/_config/TICKET_FORMAT_GUIDE.md`
- `wishworks/_config/team.md`
- `wishworks/_config/component-matrix.json`
- `wishworks/_config/ticket-schema.md`

**Why this is mandatory:** config can change mid-session (e.g., a same-session hotfix to the format guide or schema). If you reuse the copy you fetched earlier in the conversation, you'll build the ticket against a stale template and the change won't take effect until a brand-new session. This caused a real bad-ticket incident — a ticket was created against a stale TICKET_FORMAT_GUIDE.md right after that guide had been hotfixed in the same session. Re-fetching per flow guarantees the ticket is always built against current config. (This is in addition to the existing "fetch from GitHub, not local" rule in GitHub API Details — that rule is about local-vs-remote; this one is about not caching the remote copy across the session.)

**Step 1: Determine type and track**

Ask what they want to create if not clear from their message:

- **Type:** Story (new feature/enhancement), Bug (something broken), or Task (technical/infrastructure work)
- **Track:** Laravel, Wishdesk, Retool, WishBot, React Receiver, Shipping Labels, or Swirl Bot

**Track-type compatibility:** Not every track supports every type. Validate the type+track combination against `ticket_types_by_track` in `wishworks/_config/enums.json`. In particular:

- **Retool** and **Shipping Labels** do NOT support Stories (only Bug and Task)
- If the developer asks for a Story on Retool or Shipping Labels, reject: "{Track} doesn't support Stories — only Bugs and Tasks. Did you mean to create a Task?" — wait for them to pick Bug, Task, or cancel before proceeding.

**Step 2: Collect required fields**

Based on the type and track, collect these fields conversationally. Ask for the most important ones first, and batch related questions together.

**All types need:**

- `title` — short descriptive title
- `description` — what and why (for bugs: what's broken, what should happen instead)
- `requestor` — auto-detect by running `gh api user --jq .login` to get the developer's GitHub username, then look up the canonical `Name` in team.md (Dev Team table → match the `GitHub Username` column → use the `Name` column). If the GitHub username matches no row (e.g., new dev not in team.md, or empty `GitHub Username` column for that member), fall back to `git config user.name` and run that through the **Name resolution** algorithm (Assign Rules section below) against the Dev Team table.
  - **Override path (filing on behalf of someone else):** if the developer says "the requestor is X" (or otherwise overrides the auto-detected value), the override input MUST resolve to a real team member in team.md before the ticket is created. **Validation rule:** resolve the input through Name resolution against (a) the Dev Team table's `Name` column, then (b) the All Staff table's `Name` column. **Exactly one match** → store the canonical full `Name` from that table. **Multiple matches** → list candidates and ask the developer to pick. **Zero matches** → **HARD STOP. Do not create the ticket.** Respond: _"I couldn't find '{input}' in team.md (Dev Team or All Staff). The requestor field MUST be a real team member — no placeholders, no department names, no 'unknown'. Please find out who specifically requested this (check the Slack thread, ask in the relevant department channel, etc.) and re-run /ww with their actual name. Possible options based on department context: {list 3-5 nearest fuzzy matches in team.md All Staff filtered by relevant department, if any}."_
  - **NEVER store** a department name, team name, role title, or any placeholder string (including "unknown", "TBD", "—") in `requestor`. The field must always resolve to a real person from team.md. If the developer truly cannot identify the requestor, the ticket should not be created yet — they need to track down who actually asked for the work first.
  - **Cron-generated tickets** (e.g. `WishBot (recurring)`) are exempt — those are written by automation, not by `/ww`.
- `department` — ask if not obvious (valid: Customer Support, Account Management, Finance/Billing, Operations, Marketing, HR, Platform)
- `source` — ask if there's a Slack link to the original conversation
- `assignee` — **ALWAYS ask** who should be assigned — the question itself is mandatory and must never be skipped, but an ANSWER is not required. Ask something like: "Who should be assigned? (Say 'skip' if you don't know — the team lead will assign later.)" If the developer names someone, validate and resolve the input via the **Name resolution** steps in the `Assign Rules` section below — accept short names like "Bilal" and resolve them to the canonical full `Name` before storing. If they say "skip" / "I don't know" / "no one yet" (or similar), leave `assignee: ""` and proceed — never block ticket creation on a missing assignee. Optional answer ≠ optional question: do NOT silently default to blank without asking.

**Bugs also need:**

- `requestor_urgency` — Critical, High, Medium, Low, or "I'm not sure"
- `priority` — **required for every bug, on every track. ALWAYS ASK — this is a mandatory question that must never be auto-filled, assumed, or skipped, even though a default is offered.** Bug priority uses a **Critical / High / Medium** scale (bugs have no `Low` — Medium is the floor). Never write a bug with an empty `priority`, and never silently set it from urgency and move on — you MUST put the question to the creator and **WAIT for their reply** before continuing to the duplicate check or the "Ready to create" summary. Compute a suggested default from the urgency they just gave, present it, and let them accept or override:

  | `requestor_urgency`    | suggested `priority` |
  | ---------------------- | -------------------- |
  | Critical               | Critical             |
  | High                   | High                 |
  | Medium                 | Medium               |
  | Low                    | Medium               |
  | "I'm not sure" / blank | Medium               |

  Ask it as its own distinct step and then STOP, e.g. _"Urgency is High — what priority should this bug be? I'd suggest **High**. Reply Critical / High / Medium, or say 'yes'/'that's fine' to take the suggestion."_ Do not show the ticket preview until they answer. Store exactly what the creator chooses (one of Critical/High/Medium) — only treat the suggested default as the value once they explicitly accept it. This applies to Wishdesk, Laravel, and all other bug tracks — see the Laravel/React/Shipping note below so you don't prompt twice.

- `who_affected` — optional: Specific Customer/Order, General System Issue, or Me
- Steps to Reproduce (as a body section) — recommended but not required

**Glitch channel announcement (`no_announce`) — bugs are QUIET by default, opt-in AFTER creation (Anna, 2026-07-01):**

- **Bugs (any track) are created with `no_announce: true` — they do NOT auto-post to the #glitches channel.** This is the default now: a CLI-filed bug is already known/being worked, so it stays quiet unless the creator opts in. Set `no_announce: true` in the Step 5 frontmatter for every bug (overriding the template's `false` default).
- **Do NOT ask a yes/no question during creation.** Instead, AFTER the ticket is created, show the opt-in callout in **Step 8: Post-creation** and let the creator say "announce it" if they want it posted. Silence = stays quiet, no action needed — that's the whole point (no reply required).
- **Do NOT mention the #glitches decision in the Step 6 create-confirmation summary.** The post/don't-post choice is communicated in EXACTLY ONE place: the Step 8 callout. A terse "won't post to #glitches" line in the Ready-to-create summary muddies it and isn't the actual offer — leave it out of Step 6 entirely.
- **Proactive opt-in during creation:** if the creator explicitly says up front that they DO want it announced (e.g. "post this to #glitches", "announce this one"), build the bug with `no_announce: false` instead, and in Step 8 confirm "Will be announced in #glitches (appears in ~2–3 min)" — do NOT show the opt-in callout for that bug.
- **Retool tasks are UNCHANGED — still announce by default (passive opt-out, T-191).** For a `type: task` + `track: retool` ticket, only set `no_announce: true` if the creator explicitly asks to skip the announcement (any phrasing — "don't post this", "skip the announcement"). Never prompt about it, and never show the bugs-only callout.
- Stories and non-retool tasks never announce — the flag is a no-op there; leave it at the template default and don't show the callout.
- The flag only controls WishBot's automatic channel announcement; the ticket is created normally and shows up in WishWorks regardless. WishBot's own Slack intake (organic glitch reports) is unaffected — those still announce.

**Tasks also need:**

- `justification` — why this work is needed
- `estimate` — hours (e.g., `4h`, `8h`). Max 8 hours per ticket — if work exceeds 8h, it must be broken into child tickets.

**Laravel, React Receiver, and Shipping Labels tickets (all types) — collected at creation:**

- `estimate` — hours (e.g., `4h`, `8h`). Max 8h per ticket — if over 8h, must be broken into child tickets. Required for stories, tasks, AND bugs on these three tracks.
- `priority` — Critical, High, Medium, or Low. Required for **stories and tasks** on these tracks. (**Bugs** collect priority via the "Bugs also need" rule above — bug scale Critical/High/Medium, defaulted from urgency — so don't prompt for priority twice on a Laravel/React/Shipping bug.)
- `component` — **Laravel only, REQUIRED — never blank, on every type (bug/story/task).** Ask the developer to describe the work area for their ticket (e.g., "cart / checkout", "buyer flow", "PCS2", "gift card management") — point them to the component matrix at https://desk2.sugarwish.com/component-matrix/ if they want to browse it. `wishworks/_config/component-matrix.json`'s `laravel` section is **two-level**: a **category name** (e.g. "Buyer Flows & Checkout", "Receivers", "Technology") containing an array of entries, where each entry's `component` field is the real **leaf value** (e.g. "cart / checkout", "PCS2"). Match their answer against the **leaf values** — never the category names.
  - **Write ONLY the matched leaf value to the ticket's `component` field. Never write a category name to `component`** — a category is a grouping header, not a real value. (This exact swap — category into `component`, leaf into `sub_component` — is a known production bug; 8 tickets had to be corrected on 2026-07-13.) **`sub_component` is unused — always leave it `""`, never populate it,** no matter what matches.
  - Clear single match → confirm and use it. Multiple plausible leaves → list them and ask the developer to pick, don't guess.
  - **Never surface a `Technology`-category leaf as a candidate for something a customer directly sees or experiences** (email/SMS wording, content, or timing; UI text; pricing display; etc.) **unless the developer's own description contains actual infrastructure/deliverability symptoms** (spam folder, sender reputation, SPF/DKIM/DMARC, bounce/mass-bounce, provider errors like SES/Twilio, queueing/delivery-confirmation failures). Read each candidate's own `description` field before offering it — several `Technology` entries explicitly state what they are NOT (e.g. "Email & Communication Systems" is infrastructure/deliverability only and explicitly excludes "a specific transactional email template," which lives under its own client-facing Laravel component instead, like "buyer order emails" or "recipient emails"). A candidate whose description rules out the reported scenario must not be offered at all — not even as a second option. This isn't just about picking the right leaf: a client-facing issue mis-filed under `Technology` would also silently skip Ellen's UAT review (T-250), since Technology is entirely No-review there.
  - **Genuine no-match: do NOT leave blank** (required field, no exceptions). Offer the named fallback **"Other Dev Support"** (under the "Technology" category) and have them explicitly accept it first: _"That doesn't match a specific area — should I file this under 'Other Dev Support'?"_ Never auto-pick this fallback silently.
  - **React Receiver and Shipping Labels have no component taxonomy — skip this question entirely and leave both `component` and `sub_component` blank** (unchanged for these two tracks).

**Step 3: Auto-detect component**

- **Wishdesk:** Fetch `wishworks/_config/component-matrix.json` and try to match the description/title to a Wishdesk component (including `WishWorks` for work on the WishWorks UI at `/admin/wishworks`). If a match is found, set `component` and tell the developer. If no match, leave blank for now — **`component` is REQUIRED on Wishdesk, never blank on creation** (added 2026-07-16, after Wishdesk components joined the UAT-review trigger list), but resolving a miss happens at Step 6's confirmation, not here — see Step 6.
- **Laravel:** Already collected in Step 2 as a required field — the developer's work-area answer is matched against the `laravel` section's **leaf values** (never category names), with "Other Dev Support" as the explicit accept-only fallback on no match. Skip this step for Laravel — nothing left to auto-detect.
- **WishBot / Retool:** Fetch `wishworks/_config/component-matrix.json` → respective track section. Each currently has a single entry (`wishbot` → `component: "WishBot"`, `retool` → `component: "Retool"`) — auto-fill `component` from that entry, leave `sub_component` blank. The single-component placeholder is conceptually redundant (component name = track name) — see T-084 which will expand the wishbot section into multiple meaningful components like Intake, PR Events, etc.; same data-model concern applies to retool.
- **React Receiver / Shipping Labels:** No matrix entries for these tracks — leave `component` and `sub_component` blank.
- **Swirl Bot:** No component matrix entries. Leave `component` and `sub_component` blank.

**Step 4: Set starting status and folder**

All tickets (every track) start at `backlog` in `active/`. Laravel, React Receiver, and Shipping Labels tickets still collect estimate and priority at creation (Laravel also **requires** component — never blank, see Step 2) — set those fields in frontmatter from the values collected in Step 2. **Every bug ticket (any track) also has `priority` set at creation** from the bug-priority rule in Step 2 — never write a bug with an empty `priority`.

**Step 5: Build the ticket file**

Follow the exact template for this track+type from the ticket format guide (`wishworks/_config/TICKET_FORMAT_GUIDE.md`). Include ALL frontmatter fields — set required ones from the collected info, set everything else to the default value shown in the template (`""`, `false`, or `0`). For enum fields you weren't explicitly asked about, leave empty (`""`) — never auto-pick a "sensible" enum value.

**Use canonical enum values for `type` and `track`:** Read the canonical strings from `wishworks/_config/enums.json` and write the EXACT value to frontmatter. The user may say "Story" or "Shipping Labels" or "React Receiver" in chat — always look up and write the canonical form. The two multi-word tracks use **hyphens, not underscores or spaces**:

- `react-receiver` (NOT `react_receiver`, `reactreceiver`, or `react receiver`)
- `shipping-labels` (NOT `shipping_labels`, `shippinglabels`, or `shipping labels`)

If the user provides a track name that doesn't match anything in `enums.json` `tracks` (e.g., a brand-new track not yet added), write it lowercased with hyphens for any spaces (matches the existing convention) — don't reject. The reconciliation cron flags unknown tracks downstream for cleanup.

Body sections:

- `## Description` — always
- `## Steps to Reproduce` — for bugs (if provided)
- `## Release Actions` — **Laravel, React Receiver, and Shipping Labels** — include the full unchecked checklist for the ticket's track (see the Release Actions Gate section for each track's checklist items)
- `## History` — always, with creation entry: `- YYYY-MM-DD HH:mm — Created via Claude CLI by Name (Department)`

**Step 5.5: Check for duplicates**

Before creating the ticket, check for potential duplicates:

1. Fetch all active tickets from `wishworks/dev-requests/active/` via the `fetch_active_tickets_parallel("main", token)` helper (defined in the Helpers block). Returns dict of `{filename: content_str}`. Parse YAML frontmatter for each.
2. Filter to the same type as the new ticket (bug→bug, story→story, task→task)
3. Take the 30 most recent by `created_at`
4. Compare the new ticket's title + description against those 30 tickets — reason about semantic similarity (you are the AI, no separate API call needed)
5. If potential duplicates found, show them grouped by confidence:

```
Possible duplicates found:

HIGH confidence:
  WW-042 — "Gift card checkout fails on mobile"
  Why similar: Both describe gift card checkout failures

MEDIUM confidence:
  WW-038 — "Checkout page timeout errors"
  Why similar: Related checkout issue, but different root cause

Is this the same issue as any of these? (yes/no)
```

6. If yes → cancel creation, point developer to the existing ticket
7. If no → proceed to counter fetch and creation
8. If no duplicates found → proceed silently (don't mention it)

**Step 6: Confirm with the developer**

**Wishdesk component gate (added 2026-07-16) — resolved HERE, not as a separate upfront question.** `component` is a hard requirement on every Wishdesk ticket (bug/story/task), same as Laravel — but to avoid slowing Wishdesk developers down with an extra question on every ticket, it's enforced inline in this confirmation step instead of its own dedicated prompt: if Step 3's auto-detect already found a match, show it in the summary below as normal — no extra step, no added friction. If Step 3 left `component` blank, do NOT show "Ready to create" yet — first ask the developer to describe the work area (same style as Laravel's Step 2 question: e.g. "cart / checkout"-style phrasing but matched against the `wishdesk` section's flat component list), match against the leaf `subCategory` values, and offer **"Other Dev Support"** as the explicit accept-only fallback on a genuine no-match (same pattern as Laravel's Step 2 fallback — never auto-pick it silently). Only once `component` is resolved does the summary below get shown. Never create a Wishdesk ticket with `component` blank.

Show a summary of the ticket before creating. Do NOT fetch the counter yet — the ticket number is not known at this point. Use "WW-???" as a placeholder.

For Laravel tickets:

```
Ready to create:
  WW-??? (Laravel Story) — "Add checkout tax calculation"
  Requestor: Bilal (Platform) | Priority: High | Estimate: M
  Component: Checkout | Assignee: Bilal | Status: backlog

Create this ticket? (y/n)
```

For non-Laravel tickets:

```
Ready to create:
  WW-??? (Wishdesk Bug) — "Proposal page not loading for guest users"
  Requestor: Bilal (Platform) | Urgency: High | Priority: High
  Component: Proposals | Assignee: Bilal | Status: backlog

Create this ticket? (y/n)
```

**Step 7: Get the next ticket number (ONLY after user confirms)**

**CRITICAL — do NOT fetch the counter until the user says "yes".** The user may take minutes or hours to respond. If you fetch the counter before confirmation, another session or WishBot could take that number in the meantime, causing a duplicate.

**Increment the counter FIRST, then write the ticket file — in that order (T-257 counter-drift fix).** After the user confirms:

1. Fetch `wishworks/_config/counter.txt` fresh from GitHub — read the integer `N` (+ its `sha`).
2. **PUT `counter.txt` = `N+1` first** (SHA-guarded — on a `409` conflict, re-fetch and retry). This reserves the number `N`.
3. **Only after the counter write succeeds**, write the ticket file as `WW-N.md`.

**Why this order:** if the file were written first and the counter increment then failed (or the session was interrupted), the counter would be left BEHIND the ticket just created — and the next creation would reuse `N` and **overwrite the real ticket**. This happened on 2026-06-22 (WW-1427 created, counter stuck at 1427, manual bump required). Counter-first means any failure leaves a harmless gap (counter ahead of the last file) instead of an overwrite. This matches how WishBot's automated intake already works.

**Step 7.5: Process attachments (if any)**

After the ticket is created successfully, check if there are files to attach:

1. **File paths mentioned in the original create request** — if the developer included paths like "Attach: ~/Downloads/screenshot.png" in their create message, process them now
2. **Images in the conversation** — if images were dropped/pasted before the create command, ask: "I see you included an image. Want me to attach it to {new_ticket_id}?"

For each file: run the Attachment Python Helper to upload, then run the Updating Ticket Markdown helper to add the link. Report results per file.

If uploads fail, the ticket is still created — tell the developer: "Ticket {ticket_id} was created. {filename} couldn't be attached: {error}. You can try again with `/ww attach {path} to {ticket_id}`."

**Step 8: Post-creation**

- Tell the developer the ticket was created with its ID.
- **For BUGS created quiet (the default — `no_announce: true`), you MUST output the #glitches opt-in callout below — VERBATIM.** After the ticket-ID confirmation, print the box EXACTLY as written, character for character. **Do NOT paraphrase it, summarize it, replace it with a one-line note (e.g. "no #glitches post" / "won't be posted"), or skip it.** This box is the ONLY thing that tells the creator they can _choose_ to announce it — dropping it or reducing it to prose hides the choice and makes it look like the tool decided for them. Output it ONLY for a bug created quiet — NOT for stories, non-retool tasks, retool tasks, or a bug where the creator already opted IN during creation (for that one, instead confirm "Will be announced in #glitches — appears in ~2–3 min").

  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📢  THIS BUG IS QUIET — not posted to #glitches
      Want the team to see it? Just say
      "announce it" and I'll post it.
      Not needed? You're all set — no reply needed.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```

  - This is a callout, NOT a question. The creator does not need to reply. Silence = the bug stays quiet, and that's the end of it.
  - If they later say "announce it" (or "announce WW-###", "post it to #glitches", etc.), handle it via the **"If asking to announce a ticket to #glitches"** action below.

### If asking to announce a ticket to #glitches

Trigger phrases (interpret natural language): "announce it", "announce WW-123", "post it to #glitches", "post this to the glitches channel", "yes announce it", etc. This flips a quiet bug ticket so WishBot's cron posts it to the #glitches channel. (`/ww` does NOT post to Slack itself — it only sets the flag; WishBot's announce cron owns the actual post.)

**Which ticket:** If they name a ticket ID, use it. If they just say "announce it" right after creating a bug, use that just-created ticket. If it's genuinely ambiguous (no recent ticket in context and no ID given), ask which ticket ID they mean.

**Step 1 — Fetch the ticket** from `wishworks/dev-requests/active/{ID}.md` on `main` (content + `sha`, fresh). If it's not in `active/`, tell them you can only announce active tickets and stop.

**Step 2 — Validate:**

- Must be `type: bug`. If not, say: _"Only bug tickets get posted to #glitches. {ID} is a {type}, so there's nothing to announce."_ and stop.
- If `no_announce` is already `false`/absent, it's already set to announce: _"{ID} is already set to post to #glitches — nothing to change."_ and stop.

**Step 3 — Flip the flag** using the Standard Ticket Helpers, then PUT the file back to `main` (SHA-guarded; on `409`, re-fetch and retry). `now` = Mountain Time. `actor` = the developer's **canonical full name** — resolve it the SAME way the creation flow resolves `requestor` (`gh api user --jq .login` → team.md Dev Team `GitHub Username` column → `Name` column; fall back to `git config user.name` only if unresolved). Do NOT write the bare GitHub login — history lines use canonical names everywhere else:

```python
content = update_frontmatter(content, {"no_announce": False})
content = append_history(content, f"- {now} — Marked for #glitches announcement (no_announce → false) by {actor} via Claude CLI")
content = validate_yaml_frontmatter(content)
```

**Step 4 — Confirm, WITH the timing caveats:**

- Normal case: _"Done — {ID} will appear in #glitches in ~2–3 min (WishBot posts it on its next cron pass)."_
- **24-hour caveat (check the ticket's `created_at`):** WishBot only announces tickets within ~24h of creation (it suppresses stale stragglers). If the ticket was created more than a day ago, the flip will NOT post it — tell them: _"Heads up — {ID} was created more than 24 hours ago, so WishBot won't auto-post it now. If it still needs to go to #glitches, post it there manually or flag it to the team."_

### If asking to create a work item: Work Item Creation Flow

**Routing — ticket vs. work item.** A **Work Item** (`DW-###`) is non-development work a department owns and wants to track (e.g. "Support needs to update an FAQ", "Marketing copy refresh", "Ops shipping-process change") — NOT code work. Route here when the developer says any of: "create a work item", "new work item", "track this as a work item", "make a DW for…", "log a work item for…". If it's clearly development work (a feature/bug/task on a code track) route to the **Ticket Creation Flow** instead. If genuinely ambiguous, ask: "Is this a development ticket (code work) or a work item (non-dev department work)?"

Work Items are simpler than tickets — **no track, type, component, or estimate.** Gather information conversationally, don't dump a form. The full field model is in `wishworks/_config/work-item-schema.md` (source of truth) and mirrors the Wishdesk UI's `createWorkItem` (SWAC `wishworks/services/work-item-writer.ts`).

**Pre-flight (MANDATORY):** re-fetch `wishworks/_config/team.md` fresh from GitHub at the start of the flow (needed for requestor/assignee resolution) — even if fetched earlier this session.

**Step 1: Collect required fields** (always)

- `title` — short descriptive title, **≤100 chars** (hard limit — reject and ask to shorten if longer).
- `description` — what the work is and why.
- `department` — **the team that does the work** (e.g. Customer Support, Account Management, Finance/Billing, Operations, Marketing, HR, Platform). Ask if not obvious. If an assignee is given and resolves to a team member, you may suggest their department as the default, but confirm it.
- `requestor` — auto-detect the creator: run `gh api user --jq .login` → look up the canonical `Name` in team.md (Dev Team table, `GitHub Username` column → `Name`). If no match, fall back to `git config user.name` run through **Name resolution** (Assign Rules section). The result **MUST resolve to a real person in team.md** — **HARD STOP if it doesn't** (same rule as tickets: never store a department/placeholder/"unknown"). Override path: if the developer says "the requestor is X", resolve X through Name resolution against team.md (Dev Team then All Staff); exactly one match → store canonical Name; zero matches → hard stop.

**Step 2: Always ask `assignee`** (the question is mandatory; an answer is not)

- Ask: "Who should be assigned? (Say 'skip' if no one yet.)" If they name someone, validate + resolve via **Name resolution** to the canonical full Name. If they skip, leave it unset. Never block creation on a missing assignee.

**Step 3: Ask the optional fields together, in ONE message — none required** (Anna, 2026-06-22)
Ask a single catch-all: _"Anything else? (optional) — priority (Critical/High/Medium/Low), due date (YYYY-MM-DD), source link, or a parent work item (DW-###)."_ Capture only what they provide; skip any they don't mention. Do **not** prompt for them one at a time.

- `priority` — Critical / High / Medium / Low. **Default blank** (forces intentional selection — never auto-pick).
- `due_date` — YYYY-MM-DD (date only).
- `source` — Slack permalink or other URL where the ask originated.
- `parent_work_item` — an existing `DW-###`. If given, **validate** before creating: parent must exist (find via `work-items/active/` → `work-items/archive/{quarter}/`), must NOT be archived, and must NOT itself have a `parent_work_item` (flat hierarchy — one level only). If the parent has a `project` or `promoted_from`, **inherit** those onto the new child. Reject with a clear message if any rule fails.

**Step 4: Duplicate scan** (always — Anna, 2026-06-22)
Fetch all active work items from `wishworks/work-items/active/` in parallel — same approach as `fetch_active_tickets_parallel` but pointed at the `work-items/active` directory (one listing call + parallel raw GETs; **never** a per-file loop). Take the 30 most recent by `created_at`, compare the new title + description for semantic similarity (you're the AI — no extra API call), and if any look like dupes, show them grouped HIGH/MEDIUM confidence and ask "Is this the same as any of these? (yes/no)". Yes → cancel, point to the existing `DW-###`. No / none found → proceed (silently if none found).

**Step 5: Confirm** — show a summary, do NOT fetch the counter yet (use `DW-???` as placeholder):

```
Ready to create:
  DW-??? (Work Item) — "Refresh holiday FAQ copy"
  Department: Customer Support | Requestor: Anna Kifer
  Assignee: Madison Meilinger | Priority: — | Due: — | Parent: —

Create this work item? (y/n)
```

**Step 6: Create (ONLY after the developer confirms "yes")**

- **Counter (DW, separate from the WW ticket counter) — increment FIRST, then write the file (T-257 counter-drift fix):**
  1. Fetch `wishworks/_config/work-item-counter.txt` fresh — read the integer `n` (+ its `sha`).
  2. **PUT the counter file = `n+1` first** (SHA-guarded). On a `409`/`422` (collision/concurrent writer), re-fetch the counter and retry — up to **5 attempts**.
  3. **Only after the counter write succeeds**, write the DW file using `DW-` + `n` zero-padded to 3 digits as the id (e.g. `28` → `DW-028`).
  - Same rationale as ticket Step 7: counter-first means a failure leaves a harmless gap (counter ahead) instead of overwriting an existing work item. Never write the file before reserving the number.
- **Frontmatter** — write **only** these fields (omit any optional that's blank — mirror the UI writer exactly so the viewer round-trips):
  ```yaml
  ---
  title: <title>
  status: not_started
  department: <department>
  requestor: <canonical Name>
  created_at: <ISO 8601 Mountain time WITH offset, milliseconds, e.g. 2026-06-22T12:30:00.000-06:00> # Mountain wall-clock + explicit offset (-06:00 MDT / -07:00 MST). Generate via zoneinfo America/Denver, isoformat with ms. The offset is REQUIRED (a bare "2026-06-22 12:30:00" parses as server-local and is ambiguous). Viewer sorts created_at via new Date().getTime(), so the offset form is safe and shows Mountain wall-clock.
  assignee: <Name> # only if provided
  due_date: <YYYY-MM-DD> # only if provided
  priority: <Critical|High|Medium|Low> # only if provided
  source: <url> # only if provided
  parent_work_item: <DW-###> # only if provided
  project: <PRJ-###> # only if inherited from the parent
  promoted_from: <IDEA-###> # only if inherited from the parent
  ---
  ```
  Do **NOT** write `linked_work_items`, `linked_tickets`, `followers`, `completed_at`, `blocked_reason`, or `archive_reason` at creation — the UI omits them and the linking flow / status changes add them when needed.
  - **YAML safety:** run user-provided values (`title`, `department`, `source`) through the `sanitize_yaml_value` helper and quote any value containing `:` or quotes — exactly as the ticket creation flow does. Build the frontmatter with `yaml.safe_dump` (or the same quoting the helpers use); never hand-concatenate an unescaped title into the YAML.
- **Body** (exact section order, matching the UI's `buildWorkItemBody`):

  ```
  ## Description

  <description>

  ## Conversation


  ## Attachments


  ## History
  - <same created_at ISO timestamp> — Created by <requestor Name>
  ```

  Note the History "Created by" line uses the **work-item format** (`— Created by {Name}`) and the same `created_at` ISO timestamp — NOT the ticket "Created via Claude CLI by Name (Dept)" form.

- Write the file to `wishworks/work-items/active/{DW-###}.md` via PUT.
- If a `parent_work_item` was set, append a history line to the **parent**: `- {ts} — Child work item {DW-###} created: "{title}" (by {actor} via Claude CLI)`.

**Step 7: NO Slack announce** (Anna, 2026-06-16) — work items have no intake channel; there is no announcement step. Just tell the developer the work item was created with its `DW-###` id.

### If any other action: Parse and perform

Understand the developer's intent from their natural language and perform the action following the rules below. **"Link"/"unlink" requests** (between any combination of `WW-###` tickets and `DW-###` work items) → follow the **Linking Tickets & Work Items** section. If a ticket ID is not provided, use the most recently referenced ticket in the conversation. If no ticket has been referenced, ask which ticket.

**Routing exceptions:**

- **"show tickets" style requests** — any request that asks for a list of tickets ("show my tickets", "show all Wishdesk bugs", "what tickets need release actions", "show critical bugs", etc.) is NOT a single-ticket action — route those to the **If asking to see tickets** section above (which parallel-fetches the active list).
- **Fun fact / positive thought requests** — "fun fact", "give me a fun fact", "tell me something interesting", "positive thought", etc. → route to the **If asking for a fun fact** section above.
- **Comment requests** — "add a comment to WW-###: …", "comment on WW-###…", "leave a note on WW-###…" → route to the **If asking to add a comment to a ticket** section below (mention check + exact Conversation format are mandatory there).

This section is for single-ticket modifications (status change, time log, attachment, archive, child creation, etc.) and for queries about a specific ticket.

**IMPORTANT:** For ALL ticket modifications, include the Standard Ticket Helpers (from the section above) in your Python heredoc. Use `update_frontmatter()` for field changes, `append_history()` for history entries, `time_log_row()` for time log changes, and `update_release_actions()` for release action changes. Never write your own section-insertion logic.

---

### If attaching files to a ticket

When a developer says something like "attach ~/Downloads/screenshot.png to WW-042" or "add this image to WW-042":

**Step 1: Resolve the file(s)**

Collect all files to attach. Sources:

1. **File paths in the message** — expand `~`, resolve relative paths, verify each exists
2. **Images in the conversation** — if the developer dropped/pasted an image into Claude Code before running this command, check for cached files at `~/.claude/image-cache/`. If found and readable, ask: "I see you included an image. Want me to attach it to {ticket_id}?" If the cache isn't available, skip silently.

**Step 2: Identify the ticket**

If a ticket ID was provided, use it. If not, use the most recently referenced ticket in the conversation. If none, ask: "Which ticket should I attach this to?"

**Step 3: Validate and upload each file**

For each file, run the Attachment Python Helper (see Attachment Support section above). If validation fails, show the error and skip that file. Continue with remaining files.

**Step 4: Update the ticket**

For each successful upload, run the Updating Ticket Markdown helper to add the link to the ticket's `## Attachments` section and add a history entry.

**Step 5: Report results**

For each file:

- Success: "Attached {filename} to {ticket_id} — {s3_url}"
- Upload failed: "{filename} couldn't be uploaded: {error}. You can try again with `/ww attach {path} to {ticket_id}`."
- Ticket update failed: "{filename} was uploaded to S3 but the ticket couldn't be updated. Try again with `/ww attach {path} to {ticket_id}`."

If multiple files, summarize: "Attached 3 of 4 files to {ticket_id}. 1 file failed (see above)."

---

### If asking to add a comment to a ticket

When a developer says something like "add a comment to WW-042: deployed the fix to blue" or "comment on WW-042 that QA can retest now" or "leave a note on WW-042: …".

Comments are stored in the ticket's `## Conversation` section — the same section the WishWorks UI uses — so they render in the viewer with a "(via Claude CLI)" tag, and the author can edit or delete them later in the UI.

**Step 1: Identify the ticket and the comment text**

If a ticket ID was provided, use it. If not, use the most recently referenced ticket in the conversation. If none, ask: "Which ticket should I add the comment to?" The comment body is the developer's text as typed (may be multi-line). Don't rewrite or summarize it.

**Step 2: Mention check (BEFORE posting — important limitation)**

Tagging does NOT work from this command. The WishWorks UI notifies people in Slack when they're @tagged in a comment; comments added here are written straight to the ticket file — **nobody is tagged or notified, ever**.

Scan the comment body for tag candidates:

- An `@` followed by a word is a CANDIDATE only if the `@` is NOT part of an email address — skip it when the `@` is directly preceded by a non-space character (e.g. `anna@sugarwish.com`).
- A candidate counts as a REAL tag only if the word(s) after the `@` match a team member in `wishworks/_config/team.md` (first name or full name, case-insensitive). Things like `@reboot`, `@3pm`, `@here` are NOT tags — never warn on those. (team.md is needed in Step 3 anyway for the author name — fetch it ONCE here and reuse it; never fetch it twice in this flow.)
- Legacy Slack syntax `<@U...>` ALWAYS counts as a tag.

If there are NO real tags, proceed to Step 3.

If real tags were found, STOP and warn — do not post yet:

> "Heads up — tagging doesn't work from this command, so @{Name} will NOT be notified. If you post the comment anyway, I'll remove the tag (it becomes plain text "{Name}"). To actually tag and notify {Name}, add the comment in the WishWorks UI instead. Post it here anyway?"

Wait for the developer's answer. If they cancel, stop (offer to keep the draft handy). If they say post anyway, strip every tag first:

- `@Jaypee` → `Jaypee` (drop the `@`, keep the name so the sentence still reads naturally)
- `<@U...>` → the member's name from team.md, or remove it entirely if it doesn't resolve

**Step 3: Resolve the author's canonical name**

Get `git config user.name` and resolve it to the canonical full Name via the team.md Dev Team table (match against the Name or GitHub Username columns — same logic as the show-tickets heredoc). Use the canonical Name (e.g. "Anna Kifer" — never "anna-kifer" or "Anna"). The UI's edit/delete permission matches on the stored author name, so the canonical Name is what lets the developer manage their comment in the viewer later. If nothing in team.md matches, use the git name as-is.

**Step 4: Post the comment (one Python heredoc)**

Include the Standard Ticket Helpers and use `append_conversation()` — NEVER hand-roll the entry format (the UI parser silently drops malformed lines, making the comment invisible in the viewer). In one heredoc:

1. Find the ticket file — `wishworks/dev-requests/active/` first, then the `archive/` subfolders (same lookup as attachments).
2. Fetch content + SHA.
3. `content = append_conversation(content, "{Canonical Name}", BODY)` — assign the comment body to a variable with a triple-quoted string (`BODY = """…"""`) so multi-line text and quotes can't break the heredoc; if the body itself contains `"""`, use `'''…'''` instead. If `append_conversation` raises the capacity ValueError, show that message to the developer and stop.
4. PUT back with the standard 3-attempt retry on HTTP 409 (re-fetch SHA between attempts). Commit message: `Add conversation to {ticket_id} (by {Canonical Name})`.

Do NOT add a `## History` entry and do NOT touch frontmatter — comment adds intentionally skip the history breadcrumb (matches the UI; only comment deletes are logged to History).

**Step 5: Confirm — ALWAYS include the limitation note**

> "Comment added to {ticket_id}. Note: comments added here can't tag or notify anyone in Slack — to tag someone, comment on the ticket in the WishWorks UI instead: https://desk.sugarwish.com/admin/wishworks/tickets/{ticket_id}"

If a tag was removed in Step 2, also say what changed (e.g. "Removed the @ from "Jaypee" as discussed — it reads as plain text.").

---

## Ticket ID Format

**Sandbox tickets use the `WW-###` prefix** (e.g., `WW-001`, `WW-012`). This keeps them completely separate from live ticket numbers (`WW-###`). The sandbox has its own counter file (`counter.txt`) that is independent of the live counter.

Real tickets from main (`WW-###`) will also appear on the sandbox branch — these can be viewed and modified for testing, but new tickets always use the `WW-###` prefix.

## Ticket Locations

- `wishworks/dev-requests/active/WW-###.md` — active tickets
- `wishworks/dev-requests/archive/{year}-q{quarter}/WW-###.md` — released/archived tickets
- `wishworks/work-items/active/DW-###.md` — active work items
- `wishworks/work-items/archive/{year}-q{quarter}/DW-###.md` — done/archived work items
- `wishworks/_config/team.md` — team member list
- `wishworks/_config/counter.txt` — next ticket ID number
- `wishworks/_config/work-item-counter.txt` — next work-item ID number (DW)
- `wishworks/_config/work-item-schema.md` — work-item field/status/section reference
- `wishworks/_config/TICKET_FORMAT_GUIDE.md` — full ticket format reference
- `wishworks/_config/component-matrix.json` — component → developer mapping
- `wishworks/_reports/time-log-YYYY-MM.md` — monthly time tracking ledger

When looking up a ticket, try `active/` first, then `archive/` subdirectories.

## Folder Moves

- **Moving to `released` or `archived`**: move from `active/` to `archive/{year}-q{quarter}/`
- **Moving backward from `released`**: move from `archive/` back to `active/`

To move via API: PUT file at new path, then DELETE from old path using its sha.

**Post-move verification (REQUIRED):** After every archive or release move, immediately verify:

1. GET the new path (archive/) — confirm the file exists
2. GET the old path (active/) — confirm the file is gone (expect 404)
3. If the old path still returns a file (not 404), delete it again using the fresh sha from the GET response
4. Report the verification result: "Verified: WW-### is in archive and removed from active." or flag if there's an issue.

**Quarter calculation:** Sugarwish quarters start 15 days behind standard. Use Mountain Time.

- Q1: Jan 1 – Mar 31
- Q2: Apr 1 – Jun 30
- Q3: Jul 1 – Sep 30
- Q4: Oct 1 – Dec 31

## Valid Status Flows

**All Tracks, All Types:**
`backlog` → `in_progress` → `deploy_ready` → `released` → `archived`

## Status Change Rules

### Forward movement

A ticket can move to the next status in its sequence (one step forward). All statuses are accessible to all users.

**Estimate gate:** When moving a story, task, or bug on Laravel, React Receiver, or Shipping Labels from `backlog` to `in_progress`, check if `estimate` is set. If not, block the transition: "This ticket needs an estimate before it can be moved to in progress. What's the estimate in hours? (e.g., 4h, 8h — max 8h per ticket)"

**Released date (all tracks):** When moving a ticket to `released`, set `released_date` to the current Mountain Time timestamp in `YYYY-MM-DD HH:mm` format (e.g., `2026-04-01 14:30`). Use `update_frontmatter(content, {"released_date": now})` where `now` is formatted as `YYYY-MM-DD HH:mm`.

**Environment on release (all tracks):** When moving a ticket to `released`, also set the `environment` field based on the ticket's track:

- **Laravel:** set `environment` to `live`
- **React Receiver:** set `environment` to `live`
- **Shipping Labels:** set `environment` to `live`
- **Swirl Bot:** set `environment` to `live`
- **Wishdesk:** set `environment` to `live`
- **Other tracks (Retool, WishBot):** leave `environment` unchanged

### Backward movement

Free backward movement between `backlog` ↔ `in_progress` ↔ `deploy_ready` for all tracks.

### Moving backward from Released (all tracks)

1. Ask: "Is this code currently live in production?"
2. **If yes** → Reject: "This ticket's code is live in production and cannot be moved from Released. If there's an issue, please create a new bug ticket."
3. **If no** → Ask which environment based on the ticket's track:
   - **Laravel:** "What environment is this code currently on? (development, blue, live, or other)" — apply the Laravel Environment Value Rules (see Environment Change Rules section below).
   - **Wishdesk:** "What environment is this code currently on? (development or staging)"
   - **React Receiver:** "What environment is this code currently on? (development, blue, live, or other)" — same options and rules as Laravel.
   - **Shipping Labels:** "What environment is this code currently on? (development or other)" — no blue step on this track. Valid values: `development` or a custom test environment saved verbatim.
   - **Swirl Bot:** No environment question needed — single-stage track. Environment can be left at `live` or cleared.
4. Ask for a reason why it's being moved back
5. Move to `in_progress`, update `environment` field, move file from `archive/` to `active/`

### Moving to Archived

Always requires a reason. Set `archive_reason` in frontmatter (underscore — WishWorks **ticket** frontmatter uses underscores; the hyphen convention is for weekly-board task files only and does NOT apply to tickets. The schema, the SWAC viewer, and WishBot all read `archive_reason` underscore). **For `type: bug` tickets on the `laravel` or `wishdesk` track, also run the n8n-candidate archive prompt** — see the "n8n-candidate archive prompt" subsection under `## Archive Rules`.

### Estimate gate

When a developer tries to move a story, task, or bug on Laravel, React Receiver, or Shipping Labels from `backlog` to `in_progress`, check if `estimate` is set. If not, block the transition and ask: "This ticket needs an estimate before it can be moved to in progress. What's the estimate in hours? (e.g., 4h, 8h — max 8h per ticket)"

Tracks NOT subject to the estimate gate: Wishdesk, Retool, WishBot, Swirl Bot.

## Track Change Rules

When a developer changes a ticket's track (e.g., from Wishdesk to Laravel):

**Always do these on any track change:**

1. **Clear assignee** — set to `""` (developer lists differ by track)
2. **Clear component** — set to `""` (component taxonomies differ by track)
3. **Add history entries** for all three changes:
   - `Track changed from {old} to {new} (by {name} via Claude CLI)`
   - `Component cleared (track change) (by {name} via Claude CLI)`
   - `Assignee cleared (track change) (by {name} via Claude CLI)`
4. **Confirm with the developer first** — before making the change, warn them: "Changing track from {old} to {new} will also clear the assignee and component. Proceed? (y/n)"

**When changing TO Laravel, React Receiver, or Shipping Labels:**
Add the `## Release Actions` section with the full unchecked checklist for the NEW track (if not already present), placed before `## History`. The checklist differs per track:

**Laravel:**

```
## Release Actions
- [ ] No actions needed
- [ ] CMS update(s)
- [ ] Env variable(s)
- [ ] Package(s)
- [ ] Queue(s)
- [ ] Retool app(s) or workflow(s)
- [ ] Route(s)
- [ ] Scheduled action(s) (ie. cron, scheduler, or LF)
- [ ] Seeder(s)
- [ ] SQL querie(s)
```

**React Receiver:**

```
## Release Actions
- [ ] No actions needed
- [ ] Env variable(s)
- [ ] Co-Deploy with Laravel
```

**Shipping Labels:**

```
## Release Actions
- [ ] No actions needed
- [ ] Env variable(s)
- [ ] Package(s)
- [ ] Queue(s)
- [ ] Scheduled action(s) (ie. cron, scheduler, or LF)
- [ ] Other
```

Also add `release_by: ""` to frontmatter if not already present.

**When changing AWAY from Laravel, React Receiver, or Shipping Labels to a track without Release Actions** (Wishdesk, Retool, WishBot, Swirl Bot): remove the `## Release Actions` section from the body.

## Environment Change Rules

### Environment Value Rules (Laravel, React Receiver, Shipping Labels, Swirl Bot)

When a developer asks to change `environment` on a Laravel, React Receiver, Shipping Labels, or Swirl Bot ticket, the valid options depend on the track:

**Laravel and React Receiver** (same flow: development → blue → live):

- `development`
- `blue`
- `live`
- `other` — any custom test environment name, saved verbatim

**Shipping Labels** (no blue step):

- `development`
- `live`
- `other` — any custom test environment name, saved verbatim

**Swirl Bot** (single-stage — live only):

- `live` — the only standard value for this track
- If a developer requests any environment other than `live` on a Swirl Bot ticket, confirm first: "Swirl Bot is a single-stage track — the only standard environment is `live`. Did you mean `live`, or should I save '{value}' as a custom test environment?"

**How to handle the value the developer provides (case-insensitive matching):**

1. If the value is a standard for this track (see lists above) → save as-is (lowercase)
2. If the value is `manage` on Laravel → save as `development` and tell the developer: "Saving as 'development' — that's the canonical name for what dev sometimes calls 'manage'."
3. If a developer picks `blue` on a Shipping Labels ticket → reject: "Shipping Labels doesn't use a blue step — only `development` and `live`. Did you mean `development`?"
4. If the value is anything else → confirm first: "That's not a standard {track} environment. Options are {list standards for this track}, or 'other' for a custom test environment. Did you mean one of the standards, or should I save '{value}' as a custom test environment?" — only save after the developer confirms.

**When the developer didn't specify a value** (e.g., you're prompting them as part of another flow like backward-from-released):

- Laravel / React Receiver: "What environment is it on? (development, blue, live, or other)"
- Shipping Labels: "What environment is it on? (development, live, or other)"
- Swirl Bot: Environment is `live` — no question needed. If prompting is required, confirm: "Environment will be set to `live` (the only standard environment for Swirl Bot). Proceed? (y/n)"
- If they pick `other`, follow up: "What's the environment name?" — save their response verbatim
- Apply the same aliasing rules above (manage → development on Laravel)

This applies to **any** action that changes the environment field on these four tracks.

### Release Actions Gate (Laravel, React Receiver, Shipping Labels)

When a developer sets the `environment` field to a **pre-release environment** (see below) on one of these three tracks, check the Release Actions section **before** making the change.

**Pre-release environment per track:**

- Laravel: `development` or `blue`
- React Receiver: `development` or `blue`
- Shipping Labels: `development` (no blue step)

**Release Actions are complete if:**

- "No actions needed" is checked (no detail text required), OR
- One or more specific actions are checked AND each has detail text underneath it

**If Release Actions are incomplete:**

1. Block the environment change — do NOT update the `environment` field yet
2. Tell the developer: "Before I can move this to {environment}, you need to fill out your Release Actions. Let's do that now."
3. Show them the Release Actions checklist options **for the ticket's track**:

   **Laravel:**
   - No actions needed
   - CMS update(s)
   - Env variable(s)
   - Package(s)
   - Queue(s)
   - Retool app(s) or workflow(s)
   - Route(s)
   - Scheduled action(s) (cron, scheduler, or Laravel Forge)
   - Seeder(s)
   - SQL query(ies)

   **React Receiver:**
   - No actions needed
   - Env variable(s)
   - Co-Deploy with Laravel

   **Shipping Labels:**
   - No actions needed
   - Env variable(s)
   - Package(s)
   - Queue(s)
   - Scheduled action(s) (cron, scheduler, or Laravel Forge)
   - Other

4. Ask: "Which of these apply? (or 'none' if no actions are needed)"
5. If they pick specific actions, ask for detail text for each one (e.g., "What env variable is needed?"). For `Co-Deploy with Laravel` (React Receiver) and `Other` (Shipping Labels), ask a track-appropriate detail prompt: "What's the Laravel ticket/PR this needs to ship with?" and "What's the action?" respectively.
6. If they pick "none", check "No actions needed"
7. Update the ticket's Release Actions section using `update_release_actions()` from the Standard Ticket Helpers
8. **Then** proceed with the environment change
9. Add history entries for both: the Release Actions update and the environment change

**If Release Actions are already complete:** proceed with the environment change normally.

This rule applies to **any** action that sets environment to a pre-release environment on these three tracks — whether the developer explicitly asks to change the environment, or it happens as part of another action.

**Other tracks (Wishdesk, Retool, WishBot, Swirl Bot):** no Release Actions gate — environment changes proceed normally.

## Priority Rules

**Valid values:** `Critical`, `High`, `Medium`, `Low` (all ticket types, all tracks)

**Bugs:** `Critical` / `High` / `Medium` only — no `Low` (Medium is the floor). Priority is **required at creation for every bug** and is defaulted from `requestor_urgency` (Critical→Critical, High→High, Medium→Medium, Low→Medium, "I'm not sure"/blank→Medium), with the creator confirming or changing it. See the bug-priority rule in the create flow ("Bugs also need").

**Cascading:** When priority is set on a parent ticket, cascade to all children. Skip setting `Low` on child bugs.

## Estimate Rules

- **Required for stories and tasks.** Optional for bugs (allowed but not enforced — no gate, no prompt during creation).
- **Valid values:** Hours only (e.g., `4h`, `8h`, `2.5h`). T-shirt sizes (S, M, L, XL) are no longer accepted.
- **Must be in 0.25h increments** (same as time logging) — valid values are 0.25h, 0.5h, 0.75h, 1h, 1.25h, etc. If the developer enters a non-standard value (e.g., `3.3h`), round to the nearest 0.25h and tell them: "Rounded 3.3h to 3.25h (estimates use 15-minute increments)."
- **8-hour cap:** No single ticket can be estimated over 8 hours. If work exceeds 8h, tell the developer: "Tickets can't exceed 8 hours. Break this into child tickets with smaller estimates." Offer to help create the children.
- Cannot estimate archived or released tickets
- If already estimated, warn and ask to confirm overwrite

## Assign Rules

- Validate name against the team list fetched from `wishworks/_config/team.md` — do NOT use a hardcoded list. The team file is the source of truth for valid assignees.
- **Name resolution (try in order):**
  1. **Exact match** (case-insensitive) against the `Name` column in the Dev Team table.
  2. If no exact match → **first-name match**: split each Dev Team `Name` on whitespace and compare the first token case-insensitively to the developer's input.
     - **Exactly one first-name match** → resolve to that team member's full canonical `Name`.
     - **Multiple first-name matches** → list all matching full names and ask the developer to pick one. Do NOT pick automatically.
     - **Zero matches** → reject: `"{input} is not on the team. Valid assignees: {comma-separated list of Dev Team Names}."`
  3. **Always store the canonical full `Name`** in the ticket's `assignee` field — never the short input the developer typed.
- Cannot assign archived or released tickets

## Archive Rules

- Requires a reason (always). **If the developer didn't provide a reason in their message, ask for one before proceeding. Do NOT archive without a reason.**
- **Block on active children (flat-hierarchy aware):** before archiving, fetch every ticket whose `parent_ticket` equals this ticket's ID. If any direct child is in `backlog`, `in_progress`, or `deploy_ready`, **block the archive**. Error: _"WW-### has N active children: WW-A, WW-B, WW-C. Archive those first, or use 'Archive parent + all children'."_ List every active child by its ticket ID.
- **Released/archived children don't block** — if all children are `released` or `archived`, proceed with the archive normally (no cascade; released children stay in their archive folder, already-archived children stay where they are).
- **Explicit cascade opt-in:** if the developer's request clearly opts into cascading ("archive WW-### and all children", "archive WW-### and its children", "archive with children", etc.), cascade-archive all non-released children with auto-reason `"Parent WW-### archived: {reason}"`. This is the only path that cascades — never cascade by default.
- Set `status: archived` and `archive_reason: {reason}` on the parent (underscore — WishWorks ticket field; not the board's hyphen convention).
- Move file to `archive/{quarter}/`.
- **n8n-candidate prompt (bug tickets on the `laravel` or `wishdesk` track ONLY):** before the archive write, run the n8n-candidate archive prompt below. For every other type/track combination, skip it entirely and archive normally.

### n8n-candidate archive prompt (T-087 Chunk 7)

**This is the canonical contract. The SWAC archive-modal path (T-101 Chunk F) mirrors it exactly — same question wording, same writes, same Retool-task creation. Do not diverge without updating both.**

**GATE — when this prompt fires:** ALL of the following must be true. If any fails, do NOT fire — archive proceeds normally with no n8n questions.

- `type: bug` AND `track ∈ {laravel, wishdesk}` (any other type — story, task — or any other track — retool, wishbot, react-receiver, shipping-labels, swirl-bot — skips).
- `n8n_candidate` is currently **empty**. If it's already set (e.g. a PR-time determination from T-101 Chunk D already wrote the value and the `## n8n Workflow Spec` section), do NOT re-ask — archive as-is. The determination was already made; re-prompting would duplicate the spec section and waste the dev's time.
- This is the **directly-archived** ticket, NOT a cascade-archived child. During a cascade ("archive {ID} and all children"), children are bulk-archived with their auto-reason and SKIP the interactive prompt — only the ticket the dev explicitly named gets prompted (if it otherwise qualifies).

Run the gate AFTER the archive reason is collected and the active-children check has passed, and BEFORE the `archive_ticket(...)` write.

**Sequence:**

**Q1** — ask:

> "You're archiving {ID}. Before I move it, a couple of questions so we can capture whether n8n could help with this in the future.
>
> Q1. Was this a real issue where you had to make changes in the database or elsewhere to fix it?
> [1] Yes [2] No [3] Unsure"

- **[2] No** → set `real_issue: "no"`. No Q2. Go straight to the archive write (no body section, no Retool task).
- **[3] Unsure** → set `real_issue: "unsure"`. No Q2 (sign-off A — don't ask about automating something we're not sure was real). Archive write (no body section, no Retool task).
- **[1] Yes** → set `real_issue: "yes"`. Continue to Q2.

**Q2** — ask:

> "Q2. Could we monitor or auto-fix this with n8n?
> [A] Monitor and alert only (n8n detects, notifies us in Slack)
> [B] Auto-fix (n8n detects + fixes, notifies us in #api-autofix)
> [C] A mix (n8n detects, fixes part, notifies manual parts in Slack)
> [D] No — can't automate alerts or auto-fix
> [E] Unsure — help me decide"

- **[D] None** → ask an optional one-line reason note, then set `n8n_candidate: "none"`. No body section. No Retool task.
- **[A] Alert** → go to Q3-alert.
- **[B] Auto-fix** → go to Q3-autofix.
- **[C] Both** → go to Q3-both.
- **[E] Unsure** → go to the helper flow (Q2a).

**Helper flow (Q2=E only):**

**Q2a** — ask:

> "Can we DETECT this happening? (Is there a query, log pattern, or API response we could watch?)
> [1] Yes [2] No [3] Unsure"

- **[2] No** → `n8n_candidate: "none"` (nothing to detect, nothing to do). No body section, no Retool task.
- **[3] Unsure** → enter the AI-assisted conversation (below).
- **[1] Yes** → continue to Q2b.

**Q2b** — ask:

> "Can we AUTO-FIX it once detected? (Is there a deterministic update we can run, no judgment call needed?)
> [1] Yes [2] No [3] Unsure"

- **[1] Yes** → Q3-autofix (auto-fix path).
- **[2] No** → Q3-alert (alert path).
- **[3] Unsure** → AI-assisted conversation.

**AI-assisted conversation (any helper-flow "Unsure"):** walk through symptoms / what they'd look at / whether the data is even visible. Be intelligent — if the dev's answers already settle a downstream question, skip it. Outcomes:

- Resolves to one of A/B/C/D → take that Q3 path (or `none` for D).
- Still genuinely unsure → `n8n_candidate: "unsure"`, write a body section with only a `### Triage context` subheading (symptoms, fix applied, why marked unsure). No Retool task (this lands on the T-101 Chunk H triage page).

**Q3 (asked as a SINGLE numbered-list message, answered in one reply):**

- **Q3-alert** (`n8n_candidate: alert`):
  1. Which fields / data should we monitor?
  2. What's the identifying scenario or query? (SELECT snippet ideal)
  3. When the alert fires, what should the recipient know? (what it means + what to do)
- **Q3-autofix** (`n8n_candidate: auto-fix`):
  1. Which fields / data should we monitor?
  2. What's the identifying scenario or query? (SELECT snippet ideal)
  3. What updates fix the issue? (UPDATE query ideal)
- **Q3-both** (`n8n_candidate: both`):
  1. Which fields / data should we monitor?
  2. What's the identifying scenario or query? (SELECT snippet ideal)
  3. What updates fix the issue (auto-fix portion)?
  4. Which parts are auto-fixable vs. need manual handling? (be specific so the workflow author knows where to split)

**The writes (pass to `archive_ticket(...)` via `extra_fm` + `body_section` — single atomic archive write):**

`extra_fm` always carries `real_issue`. When an `n8n_candidate` was determined, it also carries `n8n_candidate` and `n8n_candidate_notes: ""` (content lives in the body, not this scalar). **Never pass `n8n_prompts_sent`** — it stays unchanged (archive is a forced single prompt; counting it would muddy the "no response" triage signal).

Build the `body_section` ONLY for outcomes alert / auto-fix / both / unsure (never for no / unsure-skip / none):

```
## n8n Workflow Spec

### Detection
<Q3 answers 1 + 2>

### Fix
<Q3 answer 3 — auto-fix and both only>

### Alert message
<Q3 answer 3 — alert only>

### Manual parts
<Q3 answer 4 — both only>

### Triage context
<symptoms / fix applied / why unsure — unsure only>
```

Include only the subheadings that apply to the outcome (alert → Detection + Alert message; auto-fix → Detection + Fix; both → Detection + Fix + Manual parts; unsure → Triage context).

Then call:

```python
archive_ticket(ID, reason, archiver_name, BRANCH, TOKEN, extra_fm=extra_fm, body_section=body_section)
```

(`body_section=None` when there is no section.) `BRANCH` is `main` for `/ww`. `archiver_name` is the canonical full Name of whoever is archiving (resolve the same way `requestor` is resolved in the creation flow).

**Retool task auto-creation (ONLY when `n8n_candidate ∈ {alert, auto-fix, both}`):**

After the archive write succeeds, auto-create a Retool task — no extra prompting (the dev already answered everything). Build it via the normal Ticket Creation Flow machinery but skip the duplicate-check and the confirmation step. Field values:

- `type: task`, `track: retool`, `status: backlog`
- `title: "n8n: <short summary derived from the archived bug's title>"`
- `requestor:` the archiver's canonical Name
- `assignee:` **config-driven** — fetch `wishworks/_config/component-matrix.json` fresh, read the Retool component's `primaryDev`; if null/empty use `backupDev`; if both empty leave `assignee: ""`. (Do NOT hardcode a name.)
- `component: "Retool"`, `sub_component: ""`
- `department:` inherit from the archived bug's `department` (fallback `Platform`)
- `justification:` derived, e.g. `"Auto-created from archived glitch {ID} — n8n {n8n_candidate} workflow opportunity captured at archive time."`
- Body: a `## Description` linking back to the archived bug {ID} (and its glitch Slack thread if `glitch_channel_id` + `glitch_thread_ts` are set), followed by a full copy of the `## n8n Workflow Spec` section written to the bug.
- Get the next number from `counter.txt` and increment it (Step 7 of the creation flow). History line: `- {ts} — Created via Claude CLI by {archiver} (n8n archive flow from {ID})`.

If Retool-task creation fails, the bug is already safely archived with its spec — tell the dev the archive succeeded but the Retool task wasn't created and they can create it manually; never silently drop it.

**Report to the dev:** confirm the archive (and the verification step), the `n8n_candidate` outcome written, and the Retool task ID if one was created.

## Child Ticket Rules

- **No nesting (flat hierarchy)** — tickets are one level deep. A ticket can be a parent OR a child, but not both. **Before creating a child, fetch the proposed parent's ticket file and check its `parent_ticket` field.** If the proposed parent already has a `parent_ticket` value set (i.e. it's already a child of some other ticket), reject: _"WW-500 is already a child of WW-490. Tickets can only be children OR parents, not both. Unparent WW-500 first if you want to give it children."_ (Replace with the actual IDs.) This rule is type-agnostic — applies to bugs, stories, and tasks.
- **Parent must be far enough along:** `backlog` or later (all tracks).
- Parent cannot be archived
- Child inherits parent's `requestor`, `department`, `assignee`, and `promoted_from`
- **Glitch thread inheritance** — if the parent has any glitch Slack details set (`glitch_channel_id`, `glitch_thread_ts`, or `glitch_status_bucket`), copy all three fields from parent to child at creation. Add a history entry on the child: `- YYYY-MM-DD HH:mm — Glitch thread inherited from parent WW-### (by {actor} via Claude CLI)`.
- Child type defaults to the same type as the parent unless the developer specifies otherwise
- Child starts at `backlog` (all tracks), placed in `active/`
- **Build the child ticket using the full template** from the ticket format guide for the child's track+type — include ALL frontmatter fields (blank if not set)
- Collect required fields for the child's type (e.g., `requestor_urgency` for bugs, `department_priority` for stories, `justification` + `estimate` for tasks) — inherit what makes sense from parent, ask for the rest. **Child bugs still need a non-empty `priority`** (Critical/High/Medium): cascade it from the parent when the parent has a priority set (per the Cascading rule — but never cascade `Low` onto a bug; use Medium instead), otherwise apply the bug-priority rule above (default from `requestor_urgency`, creator confirms).
- **Laravel children** must include the Release Actions checklist section
- Increment `counter.txt` after creating
- Update parent's history

## Linking Tickets & Work Items

Tickets and Work Items can be linked to each other with a typed, **bidirectional**
relationship. Links work across **all** combinations:

- **ticket ↔ ticket** (the original behavior)
- **ticket ↔ work item** (cross-type)
- **work item ↔ work item**

This mirrors the Wishdesk UI's shared bidirectional link-writer (T-216 / SWAC
`wishworks/services/link-writer.ts`). Each link is stored as a frontmatter array
entry. **Which array a link lands in is decided by the type of the entity it
POINTS AT:**

- a reference **to a ticket** lands in `linked_tickets` as `{ type, ticket_id }`
- a reference **to a work item** lands in `linked_work_items` as `{ type, work_item_id }`

```yaml
linked_tickets:
  - type: blocked_by
    ticket_id: WW-100
linked_work_items:
  - type: caused_by
    work_item_id: DW-012
```

**Entity ID formats:**

- **Tickets:** `WW-###` (regex `^WW-(DEV-)?\d{1,6}$`)
- **Work items:** `DW-###` (regex `^DW-(DEV-)?\d{1,6}$`)

**Board links (T-###) are OUT of scope** — those are managed entirely in Wishboard; never touch them here.

### Relationship types and inverses

Every link is written on **BOTH** entities — the forward type on the entity you
name first (the **source**), and its inverse on the other entity (the **target**):

| Forward (on the source) | Inverse (on the target)  |
| ----------------------- | ------------------------ |
| `blocked_by`            | `blocking`               |
| `blocking`              | `blocked_by`             |
| `caused_by`             | `causes`                 |
| `causes`                | `caused_by`              |
| `related_to`            | `related_to` (symmetric) |

Map the developer's natural language to the forward type. `A` and `B` can each be
a **ticket OR a work item**, in any combination:

- "A is blocked by B" / "A needs B first" → on A: `blocked_by` B
- "A is blocking B" / "A blocks B" → on A: `blocking` B
- "A was caused by B" → on A: `caused_by` B
- "A caused B" / "A causes B" → on A: `causes` B
- "A is related to B" → on A: `related_to` B

**If no relationship is specified, always ask before writing — never guess or
default.** When the request clearly names a relationship (via the map above),
use it directly. Otherwise — e.g. "link WW-50 to DW-012" — reply: "What's the
relationship? blocked_by, blocking, caused_by, causes, or related_to?" and wait
for the answer before writing either side.

### Which frontmatter field each side gets (the cross-type rule)

Because the field is chosen by the **referenced** entity's type, a cross-type
link stores **different-shaped refs on each side** — this is correct; each file
records the other end in the field that matches the other end's type:

- **Forward entry (on the source A):** lands in the field matching the **target
  B's** type — `linked_tickets` if B is a ticket, `linked_work_items` if B is a
  work item. Ref shape: `{ type: T, ticket_id: B }` or `{ type: T, work_item_id: B }`.
- **Inverse entry (on the target B):** lands in the field matching the **source
  A's** type. Ref shape keyed off A's type the same way.

Worked example — ticket `WW-123` `blocked_by` work item `DW-456`:

- On `WW-123` (target is a work item): `linked_work_items: [{ type: blocked_by, work_item_id: DW-456 }]`
- On `DW-456` (source is a ticket): `linked_tickets: [{ type: blocking, ticket_id: WW-123 }]`

Same-type links keep their natural field (ticket↔ticket → both sides
`linked_tickets`; work item↔work item → both sides `linked_work_items`).

### Finding the files

- **Ticket** (`WW-###`): search `dev-requests/active/` →
  `dev-requests/submitted/` → `dev-requests/archive/{quarter}/`.
- **Work item** (`DW-###`): search `work-items/active/` →
  `work-items/archive/{quarter}/`.

If either file is missing, stop and tell the developer — do not write a one-sided link.

### Adding a link (source A —T→ target B, inverse I)

1. Reject self-links (A and B are the same entity — same id **and** same type).
2. Find both files (per "Finding the files" above). If either is missing, stop
   and tell the developer — do not write a one-sided link.
3. **Write A (the source):** add the forward ref to A's **target-typed** field
   (`linked_tickets` if B is a ticket, else `linked_work_items`) — ref
   `{ type: T, ticket_id: B }` or `{ type: T, work_item_id: B }` per B's type.
   Idempotent — skip if an entry with the same `(type, referenced-id)` already
   exists in that field.
4. **Write B (the target):** add the inverse ref `{ type: I, <id-field>: A }` to
   B's **source-typed** field, where `<id-field>` is `ticket_id` if A is a ticket
   else `work_item_id` (same idempotency rule).
5. Append a history line to each file (see History below).
6. Write A first, then B — two separate PUTs, re-fetching each file's `sha`
   immediately before its PUT. If the second write fails, tell the developer
   that A was updated but B was not so they can retry; the two sides must never
   be left diverged.

**CRITICAL — how to write the field (use the Standard Ticket Helpers; never
hand-roll the YAML):** mutate the link field with **`add_link_entry()`** (and
`remove_link_entry()` for unlink) from the helpers block — never insert list
lines by hand. The field on an existing ticket is frequently the seeded scalar
`linked_tickets: ""` / `linked_work_items: ""` (WishBot's auto-fix writes the
empty **string**, not `[]`). Appending list items under that scalar by hand
produces **invalid YAML** (`field: ""` followed by dangling `- ` items), which
`yaml.safe_load` cannot parse — the reconciliation cron then drops the ticket and
the viewer can't render it. `add_link_entry()` normalizes `""` / `[]` / a block
list / an absent field into one valid list and is string-surgical, so it also
leaves `created_at` and every other field byte-for-byte unchanged (no full
frontmatter re-dump → timestamps are never reformatted). Use `append_history()`
for the history line. Example for one side:

```python
content = add_link_entry(content, field, {"type": T, id_field: B})   # add
content = append_history(content, f"- {ts} — Linked {T} {B} (by {actor} via Claude CLI)")
```

**History lines (use `append_history()`):**

- On A (forward): `- {ts} — Linked {T} {B} (by {actor} via Claude CLI)`
- On B (inverse): `- {ts} — Linked {I} {A} (by {actor} via Claude CLI)`
- For removals use `Unlinked` in place of `Linked`.
- `{actor}` = `git config user.name` resolved to the canonical full Name via team.md (same resolution as elsewhere).
- Example cross-type pair: `Linked blocked_by DW-456 (by Jaypee Lalucis via Claude CLI)` on `WW-123`, and `Linked blocking WW-123 (by Jaypee Lalucis via Claude CLI)` on `DW-456`.

### Removing a link

Same flow, but remove the matching `(type, referenced-id)` entry from A's
target-typed field and the `(inverse, A)` entry from B's source-typed field
using **`remove_link_entry(content, field, type, id)`** from the helpers (which
rewrites the field as a valid list — `field: []` when the last entry is removed —
and leaves all other fields, including `created_at`, untouched). Removing a link
that isn't present is a no-op.

### Preserve frontmatter on every write

Any other write (status, assignee, priority, archive, etc.) must round-trip
`linked_tickets`, `linked_work_items`, and all other existing frontmatter fields
unchanged. Never rebuild frontmatter from a template that drops them. (Applies to
both tickets and work items.)

## Parent Status Derivation

When a child's status changes, check if parent should update:

- Any child `in_progress` → parent should be `in_progress`
- All children at `deploy_ready` or later → parent should be `deploy_ready`
- All children `released` → parent should be `released`
- Only move parent **forward**, never backward

## History

**Always use `append_history()` from the Standard Ticket Helpers** to add history entries. Never write your own section-finding logic.

Every change appends to `## History`. Format:

```
- YYYY-MM-DD HH:mm — {event} (by {actor from git config} via Claude CLI)
```

Examples:

- `- 2026-03-01 10:00 — Status changed to in_progress (by Bilal via Claude CLI)`
- `- 2026-03-01 10:00 — Moved back from released to in_progress: needs rework. Environment: blue (by Parish via Claude CLI)`
- `- 2026-03-02 14:00 — Estimate set: M (by Bilal via Claude CLI)`
- `- 2026-03-03 09:00 — Priority set: High (by Anna via Claude CLI)`
- `- 2026-03-03 09:00 — Priority cascaded: High from parent WW-001`
- `- 2026-03-04 11:00 — Assigned to Bilal (by Anna via Claude CLI)`
- `- 2026-03-04 11:00 — Assignee changed from Manish to Bilal (by Anna via Claude CLI)`
- `- 2026-03-10 09:00 — Archived: no longer needed (by Anna via Claude CLI)`
- `- 2026-03-10 09:00 — Child ticket WW-005 created: "Fix login validation" (by Bilal via Claude CLI)`
- `- 2026-06-03 10:00 — Linked blocked_by WW-100 (by Jaypee via Claude CLI)`
- `- 2026-06-03 10:00 — Linked blocking WW-050 (by Jaypee via Claude CLI)` (inverse line on the other ticket)
- `- 2026-06-03 10:00 — Unlinked related_to WW-100 (by Jaypee via Claude CLI)`

## Commits and Pull Requests

When WishWorks is active for the session and a ticket has been discussed, **always include the ticket ID** in commit messages and PR titles when the developer commits code or creates a PR.

- **Commit messages:** Start with the ticket ID, e.g., `WW-048: Fix proposal size dropdown`
- **PR titles:** Start with the ticket ID, e.g., `WW-048: Fix proposal size dropdown`
- If multiple tickets are relevant, include all IDs: `WW-048, WW-052: Fix dropdown and validation`
- If the developer hasn't mentioned a specific ticket in the session, ask: "Is this related to a WishWorks ticket? If so, which one?"

## Time Tracking

### Time Tracking — Team Config

The `Time Tracking` column in `wishworks/_config/team.md` determines which developers are required to track time. Check by Slack ID — if ANY row for a developer's Slack ID has `yes` in the Time Tracking column, they are required to track time.

### Logging Time

When a developer says something like "log 3 hours on WW-003" or "log 2h on WW-042 for yesterday":

**Step 1: Parse the request**

- Ticket ID (required — can be WW-### or WW-###)
- Hours (required, decimal — e.g., 3.0, 1.5, 0.25)
- Date (optional — defaults to today in Mountain Time)
- Description (optional — see Step 3)

**Step 2: Validate**

1. Fetch the ticket and verify it exists and is not `archived`
2. Resolve BOTH `git config user.name` AND the ticket's `assignee` field through the `Assign Rules` resolution algorithm to their canonical full `Name`s. **This is no longer a gate on logging** — any developer can log time on any non-archived ticket regardless of who (if anyone) it's assigned to; other developers legitimately help out on tickets they don't own. You need both resolved names further down (Step 4/5) to decide whether to auto-assign or offer a reassignment. Resolving both sides now also absorbs the case where `assignee` is still in old first-name form (assignee frontmatter has not yet been backfilled — see T-131 fallout checklist).
3. Hours: minimum 0.25h, maximum 24h per entry. **Must be in 15-minute (0.25h) increments** — valid values are 0.25, 0.5, 0.75, 1.0, 1.25, etc. If the developer enters a non-standard value (e.g., 0.67h), **round up** to the nearest 0.25h increment and tell them: "Rounded 0.67h up to 0.75h (time is tracked in 15-minute increments)." If below 0.25h, round up to 0.25h and tell them: "Rounded up to 0.25h (15 min minimum)." Always proceed with the rounded value — don't block or ask for confirmation.
4. If hours > 8 in a single entry: ask "That's over 8 hours — did you mean to split this across multiple days?"
5. **Date restrictions:**
   - Must be within the current month, OR
   - Grace period: first 3 business days (Mon-Fri, no holidays) of a new month → previous month entries still allowed
   - Past dates only (no future dates)
6. Check the developer's daily total across all tickets for the target date (read from the monthly ledger on `main` branch). If adding this entry would exceed 10h total, show a confirmation: "This would bring your total for [date] to [X]h. Continue?"

**Step 3: Get description**

- If Claude has session context about work on this ticket (e.g., just made code changes, discussed the ticket): propose an auto-generated description and ask the developer to confirm or edit it
- If no context: ask "What did you work on?"
- Keep descriptions concise (one sentence)

**Step 4: Dual-write**

Write to the ticket FIRST (source of truth — has the context and description), then to the monthly ledger (fast-query mirror for reporting). Both writes target `main` branch.

**Each log is its own row** — never merge, consolidate, or edit an existing row when adding new time. If the same developer logs multiple times on the same date, each log gets its own row on both the ticket and the ledger. Separate rows preserve the audit trail, keep descriptions clean, and make individual sessions editable/deletable.

**Auto-assign is folded into this same ticket write when the ticket is unassigned — never a separate API call:**

- If the ticket's `assignee` (resolved in Step 2) is **blank**: before writing, also apply `content = update_frontmatter(content, {"assignee": developer})` and add the auto-assignment history line (below), so the assignment and the time log land in the same PUT.
- If `assignee` is set to **someone else**: do NOT touch it here. Write only the time log in this step — a possible reassignment is a separate, later write, only after the developer answers the Step 5 follow-up question (you don't yet know the answer).
- If `assignee` already matches the logger: no assignment handling needed at all.

**IMPORTANT:** Use the Standard Ticket Helpers for ALL ticket writes. Include the helpers in your Python heredoc and use:

- `content = time_log_row(content, "add", developer=..., date=..., hours=..., description=...)` to append a new time log row (always appends, never merges)
- `content = append_history(content, f"- {now} — Logged {hours}h (by {developer} via Claude CLI)")` to add the history entry
- **Only if auto-assigning (blank-assignee case):** also call `content = append_history(content, f"- {now} — Auto-assigned to {developer} (logged time on unassigned ticket) (via Claude CLI)")` — add this line BEFORE the "Logged {hours}h" line (so History reads top-to-bottom as "assigned, then logged"), and apply the `update_frontmatter()` assignee change above in the same `content` before the PUT.

**The `developer` argument MUST be the canonical full `Name` from team.md** (e.g., `"Bilal Ahmed"`, `"Anna Kifer"`) — NOT the first-name truncation (`"Bilal"`, `"Anna"`). This is the value resolved in Step 1 (or re-resolved here if you don't have it). Writing the first-name form here breaks the daily reconciliation diff key and forces a follow-up auto-fix run to rewrite the cell. See T-133 for why.

**Ticket write** — append a new row to the ticket's `## Time Log` section using `time_log_row()` with the `"add"` action.

The helper handles both cases: creating the section if it doesn't exist, or appending a new row if it does.

**SHA conflict retry:** If the PUT fails with a 409 (SHA mismatch), fetch the file again for a fresh SHA and retry. Up to 3 attempts.

**If the ticket write fails after all retries:** STOP. Tell the developer: "Failed to log time on {ticket_id}. Nothing was saved. Please try again." Do NOT proceed to the ledger write.

**Ledger write** (only if ticket write succeeded) — file: `wishworks/_reports/time-log-YYYY-MM.md` (use the target date's month)

If the file doesn't exist yet (404), create it with this header:

```markdown
# Time Log — {Month Name} {Year}

| Date | Developer | Ticket | Type | Track | Hours | Description |
| ---- | --------- | ------ | ---- | ----- | ----- | ----------- |
```

Then append a new row:

```
| {date} | {developer} | {ticket_id} | {type} | {track} | {hours} | {description} |
```

- `type` and `track` come from the ticket's frontmatter (both must be lowercase)
- New entries are always appended to the bottom (never reorder, never merge with an existing row — avoids SHA conflicts and preserves audit trail)

**SHA conflict retry:** Same as ticket — up to 3 attempts.

**Error handling for partial success:** If the ticket write succeeded but the ledger write fails after all retries, tell the developer: "Logged {hours}h on {ticket_id} for {date}. The ticket is updated but the monthly report didn't sync — the daily reconciliation will fix this automatically."

**Step 5: Handle assignment, then confirm**

Behavior depends on the `assignee` state resolved in Step 2:

- **Assignee was blank** (already auto-assigned + logged together in Step 4 — single write, no extra API call): confirm both in one line: `Logged {hours}h on {ticket_id} for {date}. Assigned to you (was unassigned).`
- **Assignee is set to someone else:** confirm the log first — it already succeeded and is never blocked by this: `Logged {hours}h on {ticket_id} for {date}.` Then, as a **separate follow-up question**, ask: `{ticket_id} is currently assigned to {other_name} — want me to reassign it to you?`
  - **Yes** → fetch the ticket fresh (new SHA from the Step 4 write), apply `content = update_frontmatter(content, {"assignee": developer})`, add the history line `- {now} — Reassigned from {other_name} to {developer} (via Claude CLI)`, then PUT (same SHA-conflict retry pattern, up to 3 attempts). Confirm: `Reassigned {ticket_id} to you.`
  - **No** → no further write. The earlier log confirmation already covered it — nothing more to say.
- **Assignee already matches the logger:** no assignment step at all — just the standard confirmation: `Logged {hours}h on {ticket_id} for {date}. Updated ticket and monthly report.`

### Editing a Time Entry

Use `time_log_row(content, "edit", ...)` and `append_history()` from the Standard Ticket Helpers.

When a developer says "edit my time on WW-003 for March 17 to 4 hours":

1. Fetch the ticket's Time Log section
2. Find all matching entries for this developer on this date
3. If zero matches: "No time entry found for you on {ticket} for {date}."
4. **If multiple matches (because each log is now its own row):** list them numbered with hours + description so the developer can pick:
   ```
   You have multiple entries on {ticket} for {date}. Which one should I edit?
     1. 2.0h — Initial investigation
     2. 1.5h — Fixed the bug
     3. 0.5h — Wrote tests
   ```
   Wait for them to pick a number. Use that row as the target.
5. If exactly one match: proceed with it directly.
6. Show the target entry and ask to confirm: "Change {ticket} on {date} from {old}h to {new}h?"
7. Same date restrictions as logging (current month + grace period)
8. Dual-write the update (ticket first, then ledger) — update the matching row in both files. For the ledger match, use the same hours + description as additional disambiguation keys since developer+date may also match multiple ledger rows. If the ticket write fails, stop and tell the developer. If the ticket write succeeds but the ledger write fails, tell the developer: "Time entry updated on the ticket but the monthly report didn't sync — the daily reconciliation will fix this automatically."
9. Add a history entry: `- YYYY-MM-DD HH:mm — Time edited for {date}: {old}h → {new}h (by {developer} via Claude CLI)`
10. Confirm: "Updated {ticket} on {date} from {old}h to {new}h."

### Deleting a Time Entry

Use `time_log_row(content, "delete", ...)` and `append_history()` from the Standard Ticket Helpers.

When a developer says "delete my time on WW-003 for March 17":

1. Fetch the ticket's Time Log section
2. Find all matching entries for this developer on this date
3. If zero matches: "No time entry found for you on {ticket} for {date}."
4. **If multiple matches (because each log is now its own row):** list them numbered with hours + description so the developer can pick:
   ```
   You have multiple entries on {ticket} for {date}. Which one should I delete?
     1. 2.0h — Initial investigation
     2. 1.5h — Fixed the bug
     3. 0.5h — Wrote tests
   ```
   Wait for them to pick a number. Use that row as the target.
5. If exactly one match: proceed with it directly.
6. Confirm: "Delete {hours}h ({description}) logged on {ticket} for {date}? This removes it from the ticket and the monthly ledger."
7. Same date restrictions as logging
8. Dual-delete (remove row from ticket first, then remove row from ledger). For the ledger match, use hours + description as additional disambiguation keys. If the ticket write fails, stop and tell the developer. If the ticket write succeeds but the ledger delete fails, tell the developer: "Time entry deleted from the ticket but the monthly report didn't sync — the daily reconciliation will fix this automatically."
9. If the Time Log table becomes empty after deletion, remove the entire `## Time Log` section from the ticket
10. Add a history entry: `- YYYY-MM-DD HH:mm — Time deleted for {date}: {hours}h removed (by {developer} via Claude CLI)`
11. Confirm: "Deleted {hours}h from {ticket} for {date}."

### Time Report

When someone asks about time logged — "how much time this week", "show time logged for March", "/ww time this week", etc. — generate a report from the **monthly ledger** on the `main` branch (fast, one file per month). No writes needed.

**Step 1: Determine who's asking**

Run `git config user.name` and look up the name in `wishworks/_config/team.md` (on `main` branch):

- If the name matches a developer in the Dev Team table → **developer mode** (show only their time)
- If the name is "Anna" or doesn't match a developer → **manager mode** (show all developers)

**Step 2: Parse the date range**

Interpret natural language date ranges. Default to "this week" if not specified. Examples:

- "this week" → Monday through today (or Friday if today is weekend)
- "last week" → previous Monday through Friday
- "March" or "this month" → March 1 through today (or end of month if past)
- "3/20 to 3/25" → exact range
- "yesterday" → single day

**Step 3: Fetch ledger data**

Read the monthly ledger file(s) for the relevant month(s): `wishworks/_reports/time-log-YYYY-MM.md` (on `main` branch). Parse all rows and filter to the date range.

For manager mode: also fetch `wishworks/_config/team.md` and filter to developers with `time_tracking_required: yes` (any row with `yes` in the Time Tracking column, matched by Slack ID).

**Step 4: Display the report**

**Manager mode (Anna) — all developers, summed by day:**

```
Time Logged: Mon 3/24 – Fri 3/28

| Developer | Mon 3/24 | Tue 3/25 | Wed 3/26 | Thu 3/27 | Fri 3/28 | Total |
|-----------|----------|----------|----------|----------|----------|-------|
| Bilal     | 8.0h     | 7.5h     | —        | —        | —        | 15.5h |
| Manish    | 6.0h     | 8.0h     | 7.0h     | —        | —        | 21.0h |
| Parish    | —        | 4.0h     | —        | —        | —        | 4.0h  |
| Subash    | 8.0h     | 8.0h     | 6.5h     | —        | —        | 22.5h |
| Aashish   | 3.0h     | —        | —        | —        | —        | 3.0h  |

Gaps: Bilal (Wed), Parish (Mon, Wed), Aashish (Tue, Wed)
```

Rules:

- Only show business days (Mon-Fri) as columns
- Only include developers with `time_tracking_required: yes`
- Use "—" for days with no time logged
- Future dates show "—" (not flagged as gaps)
- **Gaps line:** List each developer and their missing business days (past only, not future). If no gaps, show "No gaps — all developers logged time for all past business days."
- Sort developers alphabetically

**Developer mode — their own time with detail:**

```
Your Time Logged: Mon 3/24 – Tue 3/25

| Date     | Ticket | Hours | Description                        |
|----------|--------|-------|------------------------------------|
| Mon 3/24 | WW-003 | 5.0h  | Gift card tax fix              |
| Mon 3/24 | WW-005 | 3.0h  | Unit tests for payment flow    |
| Tue 3/25 | WW-003 | 7.5h  | QA fixes and deploy            |

Total: 15.5h
```

Rules:

- Sort by date, then ticket ID
- Show individual entries (not consolidated by day)
- Include the total at the bottom

<!-- Smart Prompt A (session-start time reminder) removed in T-163 — Slack DM bot covers this now. -->

### Smart Prompts (time_tracking_required developers only)

These prompts trigger automatically. Check if the developer has time tracking required (via the Time Tracking column in team.md, matched by Slack ID from `git config user.name` → team lookup). If not required, skip all smart prompts.

**A) Status change to deploy_ready**

When a developer moves a ticket to `deploy_ready`, check if there's ANY time logged on that ticket by this developer (check the ticket's `## Time Log` section).

If no time logged:

```
You haven't logged any time on {ticket_id}. Want to log your hours before I move it to deploy ready?
```

Non-blocking — if they decline, proceed with the status change.

**B) Moving a ticket to in_progress**

When a developer moves a ticket to `in_progress`, check their OTHER `in_progress` tickets for unlogged time (no entries in the last 3 business days in the ledger on `main` branch).

If gaps found:

```
Heads up — you have unlogged time on WW-038 (in progress since {date}, no time logged).
```

Informational only — proceed with the status change regardless.
