---
description: Open a deny-read drop box, pre-labeled with the target VAR= lines, to paste one or more live secrets into; Claude wires each where it belongs without ever seeing the value, then wipes it
---

> **Effort:** low. This is a mechanical handling flow, not a design task — seed the drop box with the labeled `VAR=` lines, wait, wire each value in via shell (value never printed), wipe. Escalate only if a destination is genuinely ambiguous.

Jack needs to hand one or more live secrets (an API key, token, password) to the session **without them ever appearing in the transcript**. This command opens a write-only drop box for him to paste into — a file this session is **mechanically blocked from `Read`ing** — **pre-filled with a labeled `VAR=` line per secret so he knows exactly where each value goes** — then wires each pasted value into wherever the current work needs it, using shell only (each value goes into a variable, never `echo`ed / `cat`ed / printed), and wipes the drop box afterward so nothing lingers on disk.

The drop box is the already-protected `sw-cortex/secret.txt` — it is gitignored **and** hard-denied for `Read`/`cat` in `sw-cortex/.claude/settings.json` (`deny` wins over every permission mode, including `bypassPermissions`). Reusing it is deliberate: a fresh random path could **not** be reliably deny-read, because the deny list is static. So this command always drives `secret.txt`. (See the session memory `never-read-secret-txt`.)

## What to do

**The var name(s) and destination(s) are inferred from the current work, not fixed and not asked each time.** When Jack runs this command, the conversation up to that point already establishes which secret(s) are needed and where each goes (e.g. `GOOGLE_API_KEY` in `sw-cortex/.env`, or the pair `SHIPSTATION_API_KEY` + `SHIPSTATION_API_SECRET` in `SERP/.env`). An optional `$ARGUMENTS` hint (`/paste-secret GOOGLE_API_KEY` or `/paste-secret STRIPE_KEY sw-cortex/.env`) overrides/pins the target var and/or file when Jack wants to be explicit; when omitted, use the contextually-correct var(s) and destination(s). **State the var(s) and destination(s) you inferred before he pastes, so he can correct you if wrong.**

**More than one secret is normal** (a key + secret pair, several tokens). Seed one `VAR=` line per secret and wire them all in one pass — do NOT reopen the box per secret.

1. **Seed the drop box with the labeled target lines, then open it for pasting.** The file is not empty: it carries one `VAR=` line per secret you're collecting, plus a short comment header telling him to paste after each `=`. This is what tells him where each key goes, and it is what the wire-in step parses by var name (so order doesn't matter and a value containing `=` is fine).

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   # The vars you inferred / were given, one per line. NO values here — labels only.
   VARS=(SHIPSTATION_API_KEY SHIPSTATION_API_SECRET)     # e.g. a key+secret pair; a single-var run is just one entry
   {
     echo "# Paste each secret's value after its = sign (no quotes, no spaces around =)."
     echo "# Leave a line blank to skip it. Save, close, and say 'done'. I can't read this file."
     for v in "${VARS[@]}"; do printf '%s=\n' "$v"; done
   } > "$SECRET_DROP"
   open -e "$SECRET_DROP"        # opens in TextEdit; use `open -a "Visual Studio Code" "$SECRET_DROP"` if he prefers
   echo "drop box seeded with ${#VARS[@]} labeled line(s): ${VARS[*]}"
   ```

   Then tell Jack in one line, naming the exact var(s) and destination(s): **"The file that opened has a labeled line for each of `<VARS>` — paste each value after its `=`, save, close, and say `done`. I can't read the file — I'll wire each into `<destination>` and wipe it."** **Then STOP and wait** — do not proceed until he confirms.

2. **On `done`, wire each var in — no value ever surfaces.** Never `Read`/`cat`/`head`/`xxd`/`open` the drop box to "check" it. In a **single** Bash call, loop the target vars, pull each value out of its labeled line value-blind, and upsert it into that var's destination. Print only non-secret facts — **var name and length ONLY, never any slice of the value**:

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   # Map each var to its inferred/arg destination. A single shared dest is fine; so is one-each.
   declare -A DEST=(
     [SHIPSTATION_API_KEY]=/Users/jackkief/Desktop/Projects/SERP/.env
     [SHIPSTATION_API_SECRET]=/Users/jackkief/Desktop/Projects/SERP/.env
   )
   any_written=0
   for VAR in "${!DEST[@]}"; do
     D="${DEST[$VAR]}"
     # Pull the value after the FIRST '=' on the VAR= line, value-blind (never echoed).
     # -m1 first match; cut -d= -f2- keeps any '=' inside the value; tr strips CR/LF only.
     VAL="$(grep -m1 "^${VAR}=" "$SECRET_DROP" | cut -d= -f2- | tr -d '\r\n')"
     if [ -z "$VAL" ]; then echo "· ${VAR}: blank/absent — skipped"; continue; fi
     # Report the LENGTH ONLY — never any slice of the value. A length is safe; any
     # prefix/"class" is NOT: a hex/base64 key (e.g. a 32-char ShipStation key) has
     # no non-alphanumeric separator, so a `${VAL%%[!A-Za-z0-9]*}`-style "class"
     # strips nothing and echoes the WHOLE secret into the transcript. This bit us
     # once (2026-09-19). Length only, full stop.
     echo "· got ${VAR}: ${#VAL} chars"
     # upsert into D without printing the file's secret lines:
     if grep -q "^${VAR}=" "$D" 2>/dev/null; then
       perl -i -pe "s|^\Q${VAR}\E=.*|${VAR}=${VAL}|" "$D"
     else
       printf '%s=%s\n' "$VAR" "$VAL" >> "$D"
     fi
     # verify by boolean match (no print of the value):
     if grep -qxF "${VAR}=${VAL}" "$D"; then echo "  ✅ ${VAR} written to ${D}"; any_written=1; else echo "  ❌ ${VAR} write failed"; fi
   done
   [ "$any_written" = 0 ] && echo "nothing written — drop box empty or all lines blank?"
   ```

   - This step needs bash arrays (`declare -A`, `"${!DEST[@]}"`), which the Bash tool's zsh does NOT support — run it as `bash -c '…'` (or write the loop to a `.sh` in the scratchpad and `bash that.sh`), not as a bare zsh command.
   - Keep every `$VAL` interpolation **inside the quoted `perl` / `printf`** so the shell never expands a value into a place that could echo. Do not build a command that prints `$VAL`.
   - **Report LENGTH only — never a prefix, "class", first N chars, or any slice of the value.** There is no such thing as a "safe prefix": for a hex/base64 secret it is the whole thing. `${#VAL}` is the only value-derived thing that may ever be printed.
   - If a destination is something other than an `.env` var (a config JSON, a k8s secret, a keychain entry), adapt that var's write step to its target — the invariant is the same: **the value moves value-blind, never printed.**

3. **Wipe the drop box and any secret-bearing backups:**

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   : > "$SECRET_DROP"                                    # truncate to 0 bytes (leave the file so the path/deny stays valid)
   rm -f /Users/jackkief/Desktop/Projects/sw-cortex/.env.bak.* /Users/jackkief/Desktop/Projects/SERP/.env.bak.* 2>/dev/null   # perl -i.bak leftovers, if any
   echo "🧹 drop box wiped (0 bytes)"
   ```

   Do **not** `rm` `secret.txt` itself — leaving the 0-byte file keeps its path valid so the deny rule always matches next time. The seed lines are labels only (no values), but wiping still clears the pasted values he entered between them.

4. **Report** in one line per var: which var went where, its **length only** (never the value or any slice of it), and that the drop box is wiped. If a running MCP server holds the old env (e.g. updating a token the `github`/`db`/`knowledge` MCP uses), note that **Claude Code must be restarted** for the server to pick up the new value — it won't re-read `.env` until then. For a SERP `.env` secret, note the SERP app/MCP servers likewise need a restart to see it.

## Hard rules (never violate)

- **NEVER** `Read`, `cat`, `head`, `tail`, `xxd`, `less`, or `open` `secret.txt` to inspect its contents. The `Read` deny is mechanical; the shell reads (`cat`/`head`) are on you to avoid. The only legitimate access is a value-blind extract piping into a variable (`grep -m1 "^VAR=" … | cut -d= -f2-`).
- **NEVER** print, `echo`, log, or interpolate a secret value — or ANY slice of it (prefix, "class", first N chars) — into any command whose output shows in the transcript. **`${#VAL}` (the length) is the ONLY value-derived thing you may print.** A "safe prefix" does not exist: for a hex/base64 key it is the entire secret. (This rule replaces an earlier one that allowed a "leading class" — that allowance caused a full-key leak on 2026-09-19.)
- **The seed lines carry NO values** — only `VAR=` labels + a comment header. Writing a value into the seed step would put the secret in the transcript. Seed labels; let Jack fill the values in the editor.
- **NEVER** commit the secret. `secret.txt` and `.env*` are gitignored; keep it that way. If you created a `.bak`, delete it (it holds the old secret).
- **ALWAYS** wipe the drop box (`: > secret.txt`) after wiring, even if a write failed — a pasted secret should never sit in the drop box after the command ends.
