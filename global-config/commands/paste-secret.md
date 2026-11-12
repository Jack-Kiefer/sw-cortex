---
description: Collect one or more live secrets from Jack through a hidden-input macOS dialog and write each where it belongs; Claude never sees a value and nothing is left behind on disk
---

> **Effort:** low. Mechanical flow: infer the var(s) and destination, call `env_prompt`, report. Escalate only if a destination is genuinely ambiguous.

Jack needs to hand one or more live secrets (an API key, token, password) to the session **without them appearing in the transcript or lingering on disk**. The vault MCP server does all of it: `mcp__vault__env_prompt` pops a native macOS dialog with a **hidden** (bulleted) answer field per key, and the vault process writes the value straight into the destination. The value never passes through Claude, a drop-box file, an editor (no TextEdit versions or editor history), Spotlight, or a command line (`ps`). Responses only ever show a key's length and a keyed fingerprint.

## What to do

**Infer the var name(s) and destination from the current work** (e.g. `GOOGLE_API_KEY` in `sw-cortex/.env`, or the pair `SHIPSTATION_API_KEY` + `SHIPSTATION_API_SECRET` in `SERP/.env`). An optional `$ARGUMENTS` hint (`/paste-secret GOOGLE_API_KEY` or `/paste-secret STRIPE_KEY sw-cortex/.env`) pins them. Ask only if the destination is genuinely ambiguous.

1. **Say what is coming, in one line:** "A macOS dialog will pop up for each of `<VARS>` → `<destination>`. Paste, click Save (or Skip). I won't see the values." Then, in the same turn:

2. **Call `mcp__vault__env_prompt`** with all the keys at once (one dialog each, in order):

   ```
   mcp__vault__env_prompt { file: "/Users/jackkief/Desktop/Projects/SERP/.env", keys: ["SHIPSTATION_API_KEY", "SHIPSTATION_API_SECRET"] }
   ```

   - The destination must be on the vault allowlist (`src/services/vault/paths.ts`: the SERP/SWAC/sw-cortex `.env` files, SERP worktree `.env`s, `/private/tmp/*/.env`). For anything else, stop and tell Jack. Do NOT fall back to a shell write.
   - **Keychain instead of plain text:** if Jack wants it, or the destination already uses `keychain://` references (check with `mcp__vault__env_list_keys`), pass `keychain_item: "<group>"`. The value goes into the login Keychain and the `.env` line becomes `keychain://<group>/<KEY>`, so the app must then start via `npm run vault:run -- --env-file <file> -- <cmd>`.
   - Each dialog times out after 5 minutes; a skipped or timed-out key comes back in `skipped`, not as an error.
   - Need the same secret in more places (worktrees, another repo)? Follow up with `mcp__vault__env_copy { from, to, keys }`, which is also value-blind.

3. **Report** one line per key: where it went and `len=…` (from the tool result; never anything else about the value), plus any skipped keys. If a running MCP server or app holds the old value (a token the `github`/`db`/`knowledge` MCP uses, or a SERP `.env` secret), say that **Claude Code (or the SERP app) must be restarted** to pick it up.

## Fallbacks

- **The vault tools aren't loaded** (server still connecting or down): load them with `ToolSearch` (`select:mcp__vault__env_prompt`). If the server is genuinely down, do not improvise. Give Jack the terminal fallback below.
- **No GUI** (an SSH session, or the dialog won't show): Jack runs this himself in a terminal. Input is hidden; only lengths are printed:

  ```bash
  cd /Users/jackkief/Desktop/Projects/sw-cortex && npm run vault:paste -- --file <dest .env> [--keychain <group>] VAR1 VAR2
  ```

## Hard rules (never violate)

- **NEVER** ask Jack to paste a secret into the chat, a file you then read, or a terminal command you run.
- **NEVER** write a secret with shell (`perl -i`, `sed -i`, `printf >>`, `echo`). It puts the value on a command line and, on a quoting error, prints it into the transcript. Only the vault tools write secrets.
- **NEVER** print, log, or derive anything from a value except the `len=` / fingerprint the vault returns. There is no "safe prefix": for a hex or base64 key, any prefix is a real slice of the secret (a 2026-09-19 "leading class" print leaked a full key).
- The old drop box `sw-cortex/secret.txt` is **retired**. It is still deny-listed for `Read` and for any Bash command that mentions it; do not seed, open, or read it. The vault's `env_copy … wipe_source` exists only to drain a leftover one.
