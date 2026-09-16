---
description: Open a deny-read drop box to paste a live secret into; Claude wires it where it belongs without ever seeing the value, then wipes it
---

> **Effort:** low. This is a mechanical handling flow, not a design task — open the drop box, wait, wire it in via shell (value never printed), wipe. Escalate only if the destination is genuinely ambiguous.

Jack needs to hand a live secret (an API key, token, password) to the session **without it ever appearing in the transcript**. This command opens a write-only drop box for him to paste into — a file this session is **mechanically blocked from `Read`ing** — then wires the pasted value into wherever the current work needs it, using shell only (the value goes into a variable, never `echo`ed / `cat`ed / printed), and wipes the drop box afterward so nothing lingers on disk.

The drop box is the already-protected `sw-cortex/secret.txt` — it is gitignored **and** hard-denied for `Read`/`cat` in `sw-cortex/.claude/settings.json` (`deny` wins over every permission mode, including `bypassPermissions`). Reusing it is deliberate: a fresh random path could **not** be reliably deny-read, because the deny list is static. So this command always drives `secret.txt`. (See the session memory `never-read-secret-txt`.)

## What to do

**The destination is inferred from the current work, not fixed and not asked each time.** When Jack runs this command, the conversation up to that point already establishes which secret is needed and where it goes (e.g. `GOOGLE_API_KEY` in `sw-cortex/.env`). Place it there. An optional `$ARGUMENTS` hint (`/paste-secret GOOGLE_API_KEY` or `/paste-secret STRIPE_KEY sw-cortex/.env`) overrides/pins the target var and/or file when Jack wants to be explicit; when omitted, use the contextually-correct destination and **state which destination you inferred** before he pastes, so he can correct you if wrong.

1. **Open the drop box in the editor, empty and ready to paste:**

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   : > "$SECRET_DROP"            # start empty (0 bytes)
   open -e "$SECRET_DROP"        # opens in TextEdit; use `open -a "Visual Studio Code" "$SECRET_DROP"` if he prefers
   ```

   Then tell Jack in one line: **"Paste the `<VAR>` into the file that just opened, save, close it, and say `done`. I can't read the file — I'll wire it into `<destination>` and wipe it."** Name the exact var and destination you're targeting. **Then STOP and wait** — do not proceed until he confirms.

2. **On `done`, wire it in — value never surfaces.** Never `Read`/`cat`/`head`/`xxd`/`open` the drop box to "check" it. Load it into a shell variable and write it to the destination in a **single** Bash call, printing only non-secret facts (class + length):

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   DEST=/Users/jackkief/Desktop/Projects/sw-cortex/.env      # the inferred/arg destination
   VAR=GOOGLE_API_KEY                                          # the inferred/arg var name
   VAL="$(tr -d '\r\n' < "$SECRET_DROP")"                     # trim trailing newline; NEVER echo $VAL
   if [ -z "$VAL" ]; then echo "drop box empty — nothing pasted?"; exit 1; fi
   # report only the shape, never the value:
   echo "got ${VAR}: ${#VAL} chars, prefix class ${VAL%%_*}…" | sed -E 's/(class )([A-Za-z0-9-]{0,4}).*/\1\2…/'
   # upsert into DEST without printing the file's secret lines:
   if grep -q "^${VAR}=" "$DEST" 2>/dev/null; then
     perl -i -pe "s|^\Q${VAR}\E=.*|${VAR}=${VAL}|" "$DEST"
   else
     printf '%s=%s\n' "$VAR" "$VAL" >> "$DEST"
   fi
   # verify by boolean match (no print of the value):
   grep -qxF "${VAR}=${VAL}" "$DEST" && echo "✅ ${VAR} written to ${DEST}" || echo "❌ write failed"
   ```

   - Keep `$VAL` interpolation **inside the quoted heredoc/`perl`** so the shell never expands it into a place that could echo. Do not build a command that prints `$VAL`.
   - If the destination is something other than an `.env` var (a config JSON, a k8s secret, a keychain entry), adapt the write step to that target — the invariant is the same: **the value moves value-blind, never printed.**

3. **Wipe the drop box and any secret-bearing backups:**

   ```bash
   SECRET_DROP=/Users/jackkief/Desktop/Projects/sw-cortex/secret.txt
   : > "$SECRET_DROP"                                    # truncate to 0 bytes (leave the file so the path/deny stays valid)
   rm -f /Users/jackkief/Desktop/Projects/sw-cortex/.env.bak.* 2>/dev/null   # perl -i.bak leftovers, if any
   echo "🧹 drop box wiped (0 bytes)"
   ```

   Do **not** `rm` `secret.txt` itself — leaving the 0-byte file keeps its path valid so the deny rule always matches next time.

4. **Report** in one line: which var went where, its length/class (never the value), and that the drop box is wiped. If a running MCP server holds the old env (e.g. updating a token the `github`/`db`/`knowledge` MCP uses), note that **Claude Code must be restarted** for the server to pick up the new value — it won't re-read `.env` until then.

## Hard rules (never violate)

- **NEVER** `Read`, `cat`, `head`, `tail`, `xxd`, `less`, or `open` `secret.txt` to inspect its contents. The `Read` deny is mechanical; the shell reads (`cat`/`head`) are on you to avoid. The only legitimate access is `... < secret.txt` piping into a variable.
- **NEVER** print, `echo`, log, or interpolate the secret value into any command whose output shows in the transcript. Report only class + length.
- **NEVER** commit the secret. `secret.txt` and `.env*` are gitignored; keep it that way. If you created a `.bak`, delete it (it holds the old secret).
- **ALWAYS** wipe the drop box (`: > secret.txt`) after wiring, even if the write failed — a pasted secret should never sit in the drop box after the command ends.
