# Command: reseed-wishdesk-local

Reseed the **local WishDesk DB** (`sugarwish_wishdesk_new` on `127.0.0.1`) from the
**dev WishDesk DB** (Hetzner, the bare-IP `DB_HOST_MANAGE`). Mirrors what the repo's
`npm run migration-seed` does — replace most tables, keep local `users`/`proposals` so
your login survives — but over a **plaintext** connection so it works on Node ≥23.

## Usage

```
/reseed-wishdesk-local              # full reseed (skips the big CRM tables you don't use)
/reseed-wishdesk-local dry-run      # preview which tables replace vs preserve, write nothing
/reseed-wishdesk-local with-crm     # also reseed the large swcrm_* CRM tables (slow, ~550MB)
/reseed-wishdesk-local skip=foo,bar # add extra tables to the skip list
```

`$ARGUMENTS` may contain `dry-run`, `with-crm`, and/or `skip=t1,t2,…`. Anything else is ignored.

---

## Why this command exists (the gotcha it encodes)

- The repo script `npm run migration-seed` (`server/scripts/drizzle/migration-seed.ts`)
  connects to the dev source via `getDatabaseConfig('dev')`, which **hardcodes
  `ssl: { rejectUnauthorized: false }`**. The dev host is the bare IP `5.78.187.176`
  (Hetzner — the _real_ dev DB, NOT the old AWS RDS hostname). **Node ≥23 refuses to set
  a TLS servername to an IP** → `ERR_INVALID_ARG_VALUE`, so the repo script crashes on
  connect. The DB itself is fine — it accepts **plaintext** (`ssl:false`) connections.
  This command does the same dev→local copy over plaintext, so it works regardless of Node.
- The bare IP is correct and intended (confirmed in Slack `#devgroup_wishdesk`). Do NOT
  "fix" it to a hostname — that's a different (stale AWS) box.
- Creds + host come from the **SWAC `.env`** (gitignored): `DB_USERNAME_MANAGE` /
  `DB_PASSWORD_MANAGE` / `DB_HOST_MANAGE` for the source, `LOCAL_DB_*` for the target.
  The dev password contains `&`, so **never `source .env`** (zsh chokes) and never put it
  on a CLI — load via `dotenv` in a node block and write a `--defaults-extra-file` cnf.

## Table classification (faithful to migration-seed.ts)

- **skip** (never touched locally): `sessions`, `__drizzle_migrations`,
  `swcrm_z_gmail_messages`, `swcrm_z_gmail_sync_failures`, `swcrm_hhs_proposals`
- **merge** (kept local so login/proposals survive): `users`, `proposals`
- **replace**: everything else
- **PLUS this command's default extra skips** (large CRM tables Jack doesn't use locally —
  the bulk of the dump; pass `with-crm` to include them):
  `swcrm_z_gmail_messages`, `swcrm_z_gmail_sync_failures`, `swcrm_sync_status`,
  `swcrm_leads`, `swcrm_client_search_index`, `swcrm_client_profile_cache`,
  `swcrm_custom_fields`, `swcrm_cache_run_snapshots`

---

## Steps

### Step 1: Resolve config + build the skip set (one node block)

SWAC root is `/Users/jackkief/Desktop/Projects/SWAC`. Run from there. Write a scratch dir
(use the session scratchpad, NOT `/tmp`). This node block reads `.env` via dotenv, lists the
dev base tables, computes the replace list, and writes two `--defaults-extra-file` cnf files
(mode 0600) so the `&` password never hits a CLI:

```bash
cd /Users/jackkief/Desktop/Projects/SWAC
SCRATCH=<session-scratchpad-dir>; mkdir -p "$SCRATCH"
WITH_CRM=<true if "with-crm" in args, else false>
EXTRA_SKIP=<comma-joined tables from skip=… arg, else empty>
SCRATCH="$SCRATCH" WITH_CRM="$WITH_CRM" EXTRA_SKIP="$EXTRA_SKIP" node -e '
const mysql=require("mysql2/promise"); const fs=require("fs"); require("dotenv").config({path:".env"});
(async()=>{
  const base=["sessions","__drizzle_migrations","swcrm_z_gmail_messages","swcrm_z_gmail_sync_failures","swcrm_hhs_proposals","users","proposals"];
  const crm=["swcrm_z_gmail_messages","swcrm_z_gmail_sync_failures","swcrm_sync_status","swcrm_leads","swcrm_client_search_index","swcrm_client_profile_cache","swcrm_custom_fields","swcrm_cache_run_snapshots"];
  const extra=(process.env.EXTRA_SKIP||"").split(",").map(s=>s.trim()).filter(Boolean);
  const skip=new Set([...base, ...(process.env.WITH_CRM==="true"?[]:crm), ...extra]);
  const dev=await mysql.createConnection({host:process.env.DB_HOST_MANAGE,port:+(process.env.DB_PORT_MANAGE||3306),user:process.env.DB_USERNAME_MANAGE,password:process.env.DB_PASSWORD_MANAGE,database:process.env.DB_DATABASE_MANAGE,ssl:false});
  const [rows]=await dev.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type=\"BASE TABLE\" ORDER BY table_name");
  const all=rows.map(r=>r.t); const replace=all.filter(t=>!skip.has(t));
  fs.writeFileSync(process.env.SCRATCH+"/tables.txt", replace.join("\n"));
  fs.writeFileSync(process.env.SCRATCH+"/src.cnf","[client]\nhost="+process.env.DB_HOST_MANAGE+"\nport="+(process.env.DB_PORT_MANAGE||3306)+"\nuser="+process.env.DB_USERNAME_MANAGE+"\npassword=\""+process.env.DB_PASSWORD_MANAGE+"\"\nssl-mode=DISABLED\n",{mode:0o600});
  fs.writeFileSync(process.env.SCRATCH+"/local.cnf","[client]\nhost="+process.env.LOCAL_DB_HOST+"\nport="+(process.env.LOCAL_DB_PORT||3306)+"\nuser="+process.env.LOCAL_DB_USER+"\npassword=\""+(process.env.LOCAL_DB_PASSWORD||"")+"\"\n",{mode:0o600});
  console.log("dev base tables:",all.length,"| will replace:",replace.length,"| preserved:",all.length-replace.length);
  console.log("preserved:", all.filter(t=>skip.has(t)).join(", "));
  await dev.end();
})();'
```

### Step 2: If `dry-run`, STOP here

Print the replace/preserve counts from Step 1 and stop. Write nothing else.

### Step 3: Confirm (destructive)

This OVERWRITES the local DB. Show the summary and **require an explicit `yes`/CONFIRMED**
before Step 4 (skip the prompt only if the user already said yes in this turn):

```
🚀 Reseed local sugarwish_wishdesk_new ← dev sugarwish_wishdesk_dev
   Replace: <N> tables   Preserve: users, proposals, sessions, + skips
   ⚠️  Overwrites <N> local tables. Login (admin/swdev123) preserved.
   Type yes to proceed.
```

### Step 4: Dump (background — it's slow, ~2–4 min for ~150MB over the remote plaintext link)

zsh does NOT word-split unquoted vars, so feed the table list to mysqldump via **xargs**,
not `$TABLES`. Run in the background (foreground 2-min cap will kill it):

```bash
SCRATCH=<scratch>; DUMP="$SCRATCH/reseed.sql"
xargs mysqldump --defaults-extra-file="$SCRATCH/src.cnf" \
  --single-transaction --quick --no-tablespaces --add-drop-table \
  --skip-lock-tables --set-gtid-purged=OFF --column-statistics=0 \
  sugarwish_wishdesk_dev < "$SCRATCH/tables.txt" > "$DUMP" 2>"$SCRATCH/dump.err"
```

Wait for it (poll for `Dump completed` at the file's tail). Verify
`grep -c 'CREATE TABLE' "$DUMP"` equals the replace count.

### Step 5: Load into local (background; FK/UNIQUE checks off for a clean replace)

```bash
{ echo "SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0;"; cat "$DUMP";
  echo "SET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1;"; } \
  | mysql --defaults-extra-file="$SCRATCH/local.cnf" sugarwish_wishdesk_new 2>"$SCRATCH/load.err"
```

`load.err` should be empty (warnings ok).

### Step 6: Verify + report

- Row counts on a few replaced tables (`articles`, `attachments`, `design_templates`)
  should be non-zero.
- `users` still has the local admin; `SELECT username FROM users WHERE username='admin'`
  returns a row.
- If a SWAC dev server is running (`pm2 list` → `swac-*`), confirm login still works:
  `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:<port>/api/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"swdev123"}'` → `200`.
- Report: tables replaced, tables preserved, and that login is intact.

## Notes

- Only reseeds the **WishDesk** DB. `branding_records` / `preselect_orders` live in the
  **Sugarwish manage** DB (`SW_DB_*`, a different host) — not copied here; they're read live.
- `branding_records`/`proposals` showing 0 rows locally afterward is expected (the WishDesk
  dev DB references them but doesn't hold the data; `proposals` is a merge table kept local).
- Clean up the scratch `.cnf` files (they hold creds) when done.
