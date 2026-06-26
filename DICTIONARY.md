# Supplementary Knowledge — SugarWish Ground Truth

This is the institutional memory an AI assistant **cannot** reconstruct from schemas, repo names, or org charts: how SugarWish (a corporate-gifting company) wires its systems together, who the real people are and what they own, and where the obvious-looking inference is the wrong one. Treat it as ground truth that **overrides** naming conventions, default-branch guesses, and "sensible" assumptions. Jack Kiefer (the user) is SugarWish's Solutions Engineer and sole owner-dev of **SERP** — the in-house ERP being built to replace Odoo. Most of what follows exists because it tripped up a previous assistant.

---

## TL;DR — Read This First

- `laravel_live` is **NOT** "the SERP database" — it is SugarWish's PRODUCTION Laravel e-commerce DB that co-hosts a thin, near-empty `serp_*` bridge. Live SERP data lives in the **darklaunch** DBs. When Jack says "live" he means `laravel_live`.
- SERP has **NO** dedicated production DB (as of June 2026) — it runs on the live Laravel/MySQL cluster. There is no `serp_prod` server.
- `*_replica` = clean, sparse, **pure Laravel mirror with ZERO Odoo data**; `*_darklaunch` = the full live Odoo-MERGED dataset the worker writes. **Never** interchange these names.
- `live_darklaunch_db` (MySQL `serp_test` on Hetzner `5.161.233.240:3306`) is the **REAL live production darklaunch mirror** — the name "test" is a **lie**; it is the most-current copy, not a throwaway/pytest DB.
- Join SERP/darklaunch to Odoo on **`odoo_id`**, **NEVER** `id = id` — but note **darklaunch-worker rows are now ALWAYS `odoo_id=NULL` by design** (PR #291, 2026-06-25: the worker stamps nothing and never queries Odoo), so the drift monitor switched to **stampless aggregate comparison** (count/sum by the `sw_id` bridge) rather than an `odoo_id` row-join. `odoo_id` is still the join key for **seed rows and the `odoo_sync_queue` push path** (Odoo hands the id back via XML-RPC). Durable origin test: `odoo_id IS NULL` = SERP-native, `IS NOT NULL` = Odoo-sourced. **NOT** any `id >= 1_000_000_000` range (that scheme was reversed the next day).
- The Odoo sync flag column is intentionally misspelled **`oddo_synchronized`** (double-d, one o) — match it exactly. Value `3` = stuck/archived-SKU, `5` = error.
- `stock_move`/`serp_stock_move` `state` enum is positive: `draft`,`confirmed`,`waiting`,`partially_available`,`assigned`,`done`,`cancel`. **`assigned` = stock RESERVED/ready-to-pick, NOT shipped.** `done` is the only state that moved inventory.
- **PERF FOOTGUN:** never filter `stock_move` state with a NEGATED predicate (`NOT IN ('done','cancel')`) on the ~15.8M-row table — forces a seq scan and times out (Odoo.sh 330s limit). Use the POSITIVE list `state IN ('draft','confirmed','waiting','partially_available','assigned')`.
- `stock_picking.state` is the Odoo picking lifecycle, **NOT** a payment/order status.
- **Jason Kiefer ≠ Jack Kiefer ≠ Anna Kifer** — three distinct people. Jason = founder/CEO (Jack's father); Jack = SERP developer (the user); Anna **Kifer** (one E) = Director of Software Dev & QA. The spelling difference is **NOT** a typo.
- SERP is a deliberate from-scratch clone of **Odoo 15's ORM** held to line-by-line parity — divergences are **bugs to fix against Odoo 15 source**, not "best-practice" refactors.
- Darklaunch is a dual-write VALIDATION/reconciliation system writing ONLY to a replica DB (never live Odoo / never main SERP), gated on **<1% drift** as the cutover-readiness signal — **not** a feature-flag library, and SERP has not yet replaced Odoo.
- Pre-cutover, **Odoo is the inventory/accounting source of truth**; SERP/Serpy READ live from Odoo, so discrepancies usually originate in Odoo's data, not SERP's.
- SERP production does **NOT** auto-deploy. CI runs on push to `main` but deploy is a manual step on the Hetzner K3s node: `ssh jack@5.161.95.56` then `bash deploy-k8s.sh main`. (The old AWS `deploy.sh` path is frozen legacy.)
- `ec_order.size` is **MISNAMED** — it holds `buyer_products.id`, NOT a physical size. `sw_fulfill` = in-house vs vendor, NOT a shipment-status flag.
- **SWAC IS WishDesk** — the GitHub description "SugarWish Activity Coordinator" is misleading.
- Inventory has **no single source of truth**: sellable (SA) = Laravel `receiver_products.inventory_qty`; raw material (RM) = Odoo only; accounting/valuation = Odoo `stock_quant`/SVL.
- SERPY is an **AI inventory-ops agent** (Slack bot), NOT a typo for SERP and NOT a human.
- `git stash` is **FORBIDDEN** in all repos. Never `git add -A`. Advisory by default on anything risky/data-related.
- Inventory Days formula (Jason originated): `current inventory / (last-7-day use / 7)`.

---

### Executive Org Chart

All report to CEO/founder **Jason Kiefer**. Technology org is co-led by **Seth Finley (CTO)** + **Anna Kifer (Director, Software Dev & QA)**.

| Person                   | Title                               | Slack ID      |
| ------------------------ | ----------------------------------- | ------------- |
| Jason Kiefer             | Founder / CEO / owner               | `U07P61DHV`   |
| Ric Marquis              | CFO / VP Finance                    | `U01N7G9DSLC` |
| Seth Finley              | CTO (co-leads Technology)           | `U088ZMSCA`   |
| Matthew Patrick ("Matt") | COO / Operations & New Products     | `U01NS0UJ802` |
| Anna Kifer               | Director, Software Development & QA | `U013F8WT18X` |
| Clare McClaren           | VP Creative & Merchandising         | `U034VB6F886` |
| Mike Fraser              | Director of Supply Chain            | `U029Y2X828P` |
| Lindsay Monson           | Director of Marketing (Adwords/SEO) | —             |
| Melissa Mills McLoota    | VP People & Culture (HR/handbook)   | —             |
| Elisabeth Vezzani        | Co-founder                          | —             |
| Leslie Lyon              | Co-founder; Chief Creative Officer  | —             |

### Tech Principals & Key Owners

**Jason Kiefer** — CEO; final word on product/pricing/strategy. Despite being exec, deeply hands-on: processes WishDesk tickets, runs SQL/Retool, ships PRs, fixes data in Laravel (`design_boxes`, sw-design). Owns `jasonbkiefer` org: `SWAC` (=WishDesk), `swirl` (=WishWorks), `sw-design`. Originated: **core SKU** concept, 90% availability goal, `is_core` flag, `sa_inventory_days`, `total_inventory_days`, Inventory Days formula, canonical forecast view `serp.sugarwish.com/forecast/live-products`. Architected Proposal system, design suite, custom shoppe, Custom Merchandise + AI/SWIRL. Final escalation on discounts (`#enterprise`). Local SWAC repo: `/Users/jasonkiefer/Documents/GitHub/SWAC`.

**Jack Kiefer** — the user; Solutions Engineer; sole SERP owner-dev (~95% author). jack@sugarwish.com; Colorado; `Jack-Kiefer` org; repo `Jack-Kiefer/SERP`; prod server `/opt/SERP`. De-facto PM of SERP; runs weekly SERP meeting (Tue 8 AM); plans in `#serp-planning`. Owns: SERP, SERP↔Odoo↔Laravel sync, Volume & Supplier Forecasting app, shipping report, auto-disable/drop-level workflow, order queue, darklaunch replica, n8n automations, Retool dashboards, SERPY. Joined dev team ~mid-Feb 2025. Infra/Hetzner = **Munyr** (Jack is a consumer); cross-team design/product = **Jason**.

**Anna Kifer** — Director, Software Dev & QA; dev PM, QA gate, SERP sponsor. Owns Jira/WishWorks board; approves/assigns/triages WW-\* tickets (gated on Seth's technical approval). Gates QA, dev on-call, glitch-to-bug process, release timelines, "Tech L10". Primary liaison to Prixite/Manish; co-sponsor AWS→Hetzner. Ticket actions attributed to "Anna Kifer via WishWorks UI" in commits.

**Seth Finley** — CTO / lead infra + platform engineer (**internal employee, NOT a contractor**). Owns `sugarwish-odoo` + `sugarwish-laravel` (org `sethfinley`) + `sethfinley/sugarwish-frontend-react`; Odoo prod + staging-new on **Odoo.sh** (`sethfinley-sugarwish-odoo-main-*`). Runs DB replications/cutovers; oversees Jenkins (via Munyr); owns external API accounts (USPS, Smarty/Avalara, SendGrid). Reframed SERP as sequential phases (POs first). His Odoo work is **automated**, not manual record-editing.

**Matthew Patrick** — COO; ops-side product owner; SERP exec/business sponsor. Sequences Jack's priorities; confirms launch-viability. Primary consumer of `/forecast/ecard-inventory`.

**Ric Marquis** — CFO / VP Finance. Owns payables, QuickBooks, bill/PO reconciliation. **Hard non-negotiable SERP requirements (must precede Odoo deprecation):** FIFO costing, inventory valuation, COGS, monthly manufacturing report, PO report, roll-forward report. Works with **Erly** (heaviest Odoo inventory user) on costing.

**Mike Fraser** — Director of Supply Chain. Owns inventory accuracy, replenishment, purchasing/supplier forecasting; primary stakeholder of Jack's supplier forecast; skeptical of Odoo's inventory accuracy.

**Carolyn Pardee** (`U011CPHRPMH`) — Operations/Inventory Manager (NOT a software engineer). Owns BoM/kit/packaging setup in Odoo, inventory location rules, EW coordination. Jack's ops counterpart for SERPY (usual draft approver); one non-Jack SERP branch: `carolyn/pack-tomorrow`. Reluctant to move kits before SERP fully implemented.

### Operations, Warehouse & Purchasing

| Person            | Slack ID      | Site/Role                                                       |
| ----------------- | ------------- | --------------------------------------------------------------- |
| Sophie Jalowsky   | `U01JMCHDX0F` | Fulfillment ops & volume planning lead (EW+TY); Dir of Ops CO   |
| Tracy Kamin       | `U066CLB2R8Q` | TY/Taylor fulfillment lead (FC Mgr MI); executor                |
| Jose Miranda      | `U03DEL9KYR0` | EW warehouse lead; submits Serpy ops                            |
| William Meilinger | `U05PPBBJ4H4` | EW fulfillment/packing — **NOT Neal** (Neal = `U02SRPY7N2V`)    |
| Neal Hustava      | `U02SRPY7N2V` | Purchasing/buyer; wine/Vinebox owner (with Brian `U08KVEQD3FU`) |
| James Emeric      | `U06UV0142S0` | Buyer; reported forecast 1000-row export limit                  |
| Erly              | —             | Heaviest Odoo inventory user; feeds Ric's roll-forward          |

### Product Catalog Owners

| Person                    | Slack ID      | Decides                                                           |
| ------------------------- | ------------- | ----------------------------------------------------------------- |
| Clare McClaren            | `U034VB6F886` | VP Creative; ecard consolidation; coordinates annual price change |
| Kelley Meiser (kelleymax) | `U099GLS5D`   | Product-type migration; `drop_level`; tags seasonal/legacy        |

### Offshore Dev / QA Team (Prixite vendor — channel `#odoo-prixite` `C07QRF6MHD4`)

| Person                        | Track/Role                                       | Slack ID      | GitHub / Notes                                                                          |
| ----------------------------- | ------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| Manish Chaudhary              | Lead; most Odoo-experienced; SERP secondary lead | `U03858W1K7C` | Nepal; owns Odoo→SERP migration scripts; merges blue→main; applies live `manage` schema |
| Bilal Ahmed                   | Senior Integrations Dev                          | `U07BM9JHGAZ` | Pakistan; `bilalahmed-1994`; Laravel 11 upgrade                                         |
| Subash Chaudhary              | Laravel-track dev                                | `U03A13MS7KL` | Nepal                                                                                   |
| Parish Shrestha               | WishDesk/SWAC-track **technical lead**           | `U045FJ66K6K` | Nepal; `sw-parish` merge-bot; runs dev→staging→live                                     |
| Aashish Shrestha              | Junior dev (low-risk only)                       | `U03RUA9F5EX` | Nepal; `beingaashish` / `aashish/WW-*`                                                  |
| Munyr Ahmed                   | DevOps/infra lead                                | `U068USJ2LQM` | Pakistan; `itsmunyrhere`                                                                |
| Jaypee (John Pascual Lalucis) | Test Manager / QA                                | `U0201JZHJDR` | Philippines; `JaypeeLalucis`; bulk-updated ~14,000 `card_id`s                           |
| Dhon Kekim                    | QA Automation                                    | `U06QJFASK8W` | Philippines; `dhonkekimsugar`                                                           |
| Hamza Khan Niazi              | Historical Odoo dev                              | `U07RAQ8LCE5` | `prixite_customization` module; last commit Jul 2025                                    |
| Zain Arshad                   | Prixite Odoo (v15→v17 upgrade)                   | `U07QRFBM19C` | zain.arshad@prixite.com                                                                 |

**NOT interchangeable:** Manish = lead/Odoo+SERP; Subash = Laravel-track; Parish = SWAC-track; Aashish = junior.

**Munyr** owns **Jenkins** (org-wide CI/CD for ALL platforms, `ciservice.sugarwish.com`) and the company-wide **AWS→Hetzner migration**. The `manage` MySQL cluster is already fully on Hetzner (AWS `manage` shut down ~Apr 29 2026); darklaunch MySQL at `5.161.233.240` (created ~Apr 28 2026). Jack is a consumer of infra, NOT its driver.

### Customer Service & Other Roles

| Person               | Slack ID / GitHub                 | Role                                                                                   |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Madison Meilinger    | `U021G7V41D1`                     | CS & WishDesk ops lead — **NOT a developer**                                           |
| Madison Parks        | `madison-m-sugarwish`             | SWAC **developer** (Vinebox, email threading) — **Parks codes; Meilinger runs CS**     |
| Ellen Nelson         | `UMSMMGL22`                       | CS/WishDesk lead; Gift Concierge + WishDesk KB; billing lead                           |
| Payton Castaneda     | `U01ERBYFHMJ` / `paytoncastaneda` | WishDesk admin/agent setup; Outreach & Sales Tech                                      |
| Tara Kliebenstein    | —                                 | Billing lead                                                                           |
| Cris / Criston Sloan | `U040UH4GVPX` / `csloan-sw`       | Automation Engineer (reports to COO); owns `csloan-sw/livery` (=SWOP); SERP user id 13 |

### Repo / System Ownership

| Repo / System                              | Owner                                 | Notes                                                        |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------ |
| `Jack-Kiefer/SERP`                         | **Jack** (solo)                       | Reviewed by Seth+Anna; sponsor Matt; `carolyn/pack-tomorrow` |
| `sethfinley/sugarwish-laravel`             | **Seth** + Prixite                    | Main/legacy e-commerce monolith                              |
| `sethfinley/sugarwish-odoo`                | **Seth** + Prixite (Manish)           | `prixite_customization`; Odoo 15 modules                     |
| `sethfinley/sugarwish-frontend-react`      | **Seth**                              | React receiver app                                           |
| `jasonbkiefer/SWAC` (= WishDesk)           | **Jason** org; **Parish** lead/merger | CS ops: Madison Meilinger                                    |
| `jasonbkiefer/swirl` (= WishWorks + SWIRL) | **Jason** org; **Anna** runs board    | WW-\* tickets                                                |
| `jasonbkiefer/sw-design`                   | **Jason** + Clare McClaren            | Builder configs, box recipes, icon manifests                 |
| `csloan-sw/livery` (= SWOP)                | **Cris Sloan** (seeded by Jason)      | Print-station; MCP suite                                     |
| `laravel_live` (MySQL)                     | **Seth** (DB replications)            | SugarWish prod e-commerce — **NOT SERP**                     |
| Jenkins / CI/CD (all platforms)            | **Munyr**                             | `ciservice.sugarwish.com`; Seth oversees                     |
| Odoo prod + staging-new (Odoo.sh)          | **Seth**                              |                                                              |

> Repo ownership ≠ authorship. SWAC lives under `jasonbkiefer` but is built by the offshore dev team. **SERP is NOT in the SWIRL who-owns-what doc** — it is Jack's domain.

---

## The Systems & How They Connect

| Repo                | What it is                                                                | Stack                                                       | Prod branch / flow                                                 |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `SERP`              | In-house ERP replacing **Odoo 15**, built from scratch                    | Python FastAPI/Uvicorn + custom ORM on MySQL; Next.js/React | `main` (manual deploy); `dev` = development                        |
| `SWAC` (= WishDesk) | CS/fulfillment desk + proposal/receiver flows                             | React + Express + TS + MySQL + Drizzle                      | `live` (dev→staging→live)                                          |
| `sugarwish-laravel` | Main/legacy e-commerce monolith                                           | Laravel 11 / PHP 8.2 / MySQL 8                              | `main` ← `blue` (integration) ← `manage` (staging) ← `development` |
| `sugarwish-odoo`    | Custom Odoo 15 modules                                                    | Odoo 15.0.1.3 / PostgreSQL                                  | `main` ← `staging_new`                                             |
| `sw-design`         | Design/asset pipeline (ecards/sleeves/boxes/merch/Genie configs)          | Build scripts → S3 → WishDesk                               | —                                                                  |
| `swirl`             | SWIRL AI knowledge platform **AND** WishWorks ticket datastore (one repo) | docs + MCP/Slack/Qdrant                                     | —                                                                  |
| `livery`            | Ops-tooling MCP suite **AND** sleeve imposition/printing (Mac Mini)       | Express + MCP servers                                       | —                                                                  |

### SERP — The Odoo-Replacement ERP

- Live at `serp.sugarwish.com`. Target launch **~Sept 15, 2026** (mandated by Anna Kifer, ~6–8 weeks production testing before the Q4/Halloween peak). Slipped repeatedly (2025 → Jan/Feb 2026 → ~early Aug → Sept 15) — treat all SERP dates as **soft**; Odoo stays live past stated dates.
- **NOT** a dashboard/replica — SERP **re-computes** Odoo's logic locally on MySQL; intended to **replace Odoo entirely**.
- Two frontend apps: **red sidebar** = ERP (POs, kits, suppliers); **teal sidebar** = Forecast (isolated subsystem).
- **4 phases:** (1) Purchase Orders, (2) Bills, (3) Raw Materials/Components/Kits/BOMs, (4) Manufacturing Orders & Inventory. Odoo sunset is **post-cutover and gated** — full deprecation comes after the Sept 15 2026 full SERP release + 6–8 weeks production testing (the older "~Jul 2026 sunset" was a stale soft target; Odoo stays live past it, and a v15→v17 upgrade looms ~Oct 2026 if SERP isn't ready). Product-line rollout order: Popcorn/EW → cupped products → all.
- ~25–50% complete as of Jan 2026. Viable only after Seth reframed it into sequential pieces (POs first) with Odoo dual-running. **No "do nothing" option** — if SERP stalls, Odoo 15 must still be upgraded v15→v17 before deprecation.

**SERP schema & code:**

- `serp_*` MySQL tables = 1:1 mirror of Odoo PG schema (50+ models, ~1018 fields), using **Odoo dot-names** (`stock.picking`, `stock.move`, `mrp.bom`, `mrp.production`, `purchase.order`, `sale.order`, `account.move`, `stock.valuation.layer`, `stock.quant`, `res.partner`…).
- Costing is **FIFO** via `stock.valuation.layer` (SVL). Chain: `button_validate → _action_done → _consume_fifo → _create_out_svl → create_valuation_journal_entry` → Stock Journal (STJ, `journal_id=6`).
- `serp_product` bridge links to `components` (raw materials) and `receiver_products` (finished goods) via `component_id` / `receiver_product_id`.
- Single endpoint `POST /api/call_kw` dispatches to `@api.callable` model methods. New logic → fat ORM models in `serp_orm/models/`. **Never** add per-resource REST routers for ORM-backed resources. REST routers (`backend/routers/`) exist only for auth, forecast, Odoo sync, inventory_sync, receipts.
- **Canonical approved divergences** (documented in `docs/ODOO_APPROVED_DIFFERENCES.md`; suppressed in drift monitor): `button_confirm` allows empty PO (test-pinned); no bin-level putaway; byproducts via `serp_mrp_bom_byproduct`; sale-order names `f"S{ec_order_id}"` not via `ir.sequence`; no invoicing flow; no `supplier_rank` bumps; SERP uses **CONTINENTAL** accounting (Odoo = Anglo-Saxon); no reconciliation engine (`payment_state` force-written). **Any OTHER divergence = bug.** Fix against Odoo 15 source (`raw.githubusercontent.com/odoo/odoo/15.0`). Slash commands: `/check-odoo-alignment`, `/odoo-fix-divergence`.

**SERP auth (two unrelated layers):**

- **nginx HTTP Basic Auth** — `serp_admin` / `swserp12`, checks `/etc/nginx/.htpasswd`. Browser-cached (Safari flushes aggressively). `deploy.sh` does NOT regenerate `.htpasswd`. Repeated "sign in" popup = Basic-Auth cache flush, NOT a JWT bug.
- **In-app JWT login** — 15-min HS256 access token in memory; 7-day refresh token as HttpOnly cookie scoped to `/api/auth`.
- Identity/auth data in **`serp_res_users`** (MySQL `manage`, post-2026-03 migration); group-based RBAC via `serp_res_groups`. Retool `serp_users` is now a stripped bridge (`id` → `orm_user_id`), still hit on every authenticated request. `_backup_serp_users` is stale.
- Internal-vs-external redirect race: checks `user.groups?.some(g => g.full_name === 'base.group_user')`; right after login `groups` hasn't loaded → valid internal user briefly sent to `/external-access`. "Why does it think I'm external?" = groups-not-loaded race, not permissions.
- `is_internal` gates all internal API access (false → 403 `external_user_redirect`). External users = **suppliers** (Redstone, Blair Candy), portal-only.

**SERP deploy:**

- **Production is the Hetzner K3s cluster** (node `5.161.95.56`, namespace `serp`, app root `/opt/SERP`, live host `serp.sugarwish.com` — health-check from the node, the hostname doesn't resolve from Jack's Mac). Deploy = `bash deploy-k8s.sh main` run on the node; the node tracks `main` and this is the normal, safe deploy (verified 2026-06-10 — do NOT re-flag "the script only lives on a feature branch"). Darklaunch prod DB on Hetzner (`5.161.233.240`).
- **`serp-backend` runs `replicas: 2` safely** (since 2026-06-09): live-path refresh tokens moved from a per-process dict to **shared Redis** (`backend/crud/crud_refresh_token.py`, keys `serp:refresh_token:<hash>`; redis pod in ns `serp`), so any pod validates any token and `/api/auth/refresh` works cross-pod. `WORKERS_ENABLED=false` MUST stay set on serp-backend (workers run only in `serp-workers`, replicas 1) — it's set via the **`serp-env` secret** consumed by `envFrom`, NOT inline `env:`, so deployment-YAML inspection shows nothing; verify with `kubectl exec -- printenv WORKERS_ENABLED`.
- **Image accumulation:** un-pruned, each deploy leaks ~1.3GB into `/var/lib/containerd` (Docker uses the containerd image store — `/var/lib/docker` looks tiny and misleads `du`); kubelet image GC force-kicks at 85% disk. `deploy-k8s.sh`'s `[7/7]` prune phase keeps current `$TAG` + `$PREV_TAG` (captured BEFORE `kubectl apply` rewrites spec images to `:latest`) + `:latest`, plus `docker builder prune --keep-storage=8GB`.
- **Legacy AWS EC2** (`34.203.231.65`, `/opt/SERP`, PM2 + nginx, old `deploy.sh`: git reset → pip install → Next.js build with Node heap **1.5GB** cap → pm2 restart) is retained **frozen** during cutover — NOT deployed to; its workers disabled (`WORKERS_ENABLED=false`). The PM2 notes below apply to that legacy box:
- **PM2 caches env vars.** Changing `.env` requires `pm2 delete serp-backend` then `pm2 start … --only serp-backend`. Plain `pm2 restart/reload` does NOT pick up `.env` or script `args`.
- PM2 over non-interactive SSH: `export PATH=/home/ubuntu/.nvm/versions/node/v20.20.1/bin:$PATH; PM2_HOME=/home/ubuntu/.pm2`.
- Local dev: backend `:8000`, frontend `:3002`; login `jack@sugarwish.com` / `localdev123`. Slack interactivity locally needs ngrok.
- **`deploy.sh` does NOT run migrations against the prod `manage` cluster (now on Hetzner, not AWS RDS).** New `serp_*` tables/columns must be applied to the live `manage` DB manually (by Manish + DBA) **BEFORE** code ships.

**SERP workers** — three PM2 apps:

| PM2 app         | What                        | `WORKERS_ENABLED` |
| --------------- | --------------------------- | ----------------- |
| `serp-backend`  | gunicorn, 2 uvicorn workers | **false**         |
| `serp-frontend` | Next.js                     | —                 |
| `serp-workers`  | single fork, `instances:1`  | **true**          |

- All background workers share **one asyncio event loop** in `serp-workers`. No row-level locking — running in multi-worker gunicorn would double-fire Slack pings / emails / pickings.
- **Worker can silently hang forever** on idle-dropped sockets (`asyncpg pool.acquire()`, `xmlrpc.client`, PyMySQL) — PM2 shows "online" while wedged. Fixes: bounded `pool.acquire()` + `asyncio.wait_for` watchdog; supervisor restarts wedged workers (added 2026-05-29). Recovery: `pm2 restart`.

### Darklaunch

- **Dual-write / parallel-run validation, NOT a feature-flag library.** `darklaunch_order_worker.py` **REPLAYS** Odoo's order writes through the SERP ORM into a separate MySQL mirror. **Never** touches live Odoo or the main SERP ORM pool.
- Gated by env **`SERP_DARKLAUNCH_ENABLED`** (default **False** in prod). When OFF, behavior is identical to pre-darklaunch. Darklaunch is **additive** — safe to disable temporarily.
- When ON, Serpy appends `SYNC_TARGET_SERP_DARKLAUNCH='serp_darklaunch'` alongside every Odoo target → **two** `odoo_sync_queue` items per op. Handlers in `backend/workers/handlers/serp_orm/` use the same functions as the SERP ORM, different connection pool (`get_darklaunch_pool`, `serp_orm/darklaunch_pool.py`). Routing-key prefixes: `serp:<entity>` vs `serp_darklaunch:<entity>`.
- **Invariant:** darklaunch must NOT change what the underlying op does.
- Cutover recorded per-env at `serp_darklaunch_meta.darklaunch_cutover_at` (prod `2026-06-04 09:27:20`, staging `2026-06-03 11:52:27`). Must be set BEFORE the seed snapshot or orders in the gap get lost. Validation gate: **<1% drift, stable 2 weeks**. Event log: `serp_darklaunch_processed_events`. Tools: `/compare-darklaunch`, `/compare-orders`, `compare_odoo_replica.py`.

### Serpy

- **AI inventory-ops agent** (Slack bot `SERPY` / `SERPY Dev`, user `U096P936NQ7`). Code in `backend/serpy/`. NOT a dev experiment, NOT a typo for SERP, NOT a human.
- Ops describe inventory changes in plain English → Serpy generates structured JSON ops → human approval → pushed to Odoo via XML-RPC. Drafts post to **`#inventorymanagement`** (`C03G8LP36P6`) for approval; web UI `serp.sugarwish.com/serpy/<draft_id>`.
- Pipeline: `classify_intent → find_products → propose_operations → DRAFT (serp_draft_operations/_live) → /save-raw-draft` (validates against `OpTypeRegistry` in `serpy/ops/types.py`) `→ /ai-submit` (DRAFT→PENDING_APPROVAL) → human approval → `odoo_sync_queue_live` (Retool PG) → odoo-sync worker (~30s poll) → XML-RPC + local mirror + Laravel (`manage` MySQL).
- Lifecycle: `DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED`. Drafts numbered ("Draft #860"). **Nothing hits DB or Odoo until approved.** Rule: "don't change anything about who can approve serpy."
- Drafts are **per-user**, keyed by Retool `serp_users.id`, **not** Slack id.
- In `x/y synced`: `y` = total ops, `x` = succeeded into Odoo. **Partial count = Odoo-side validation rejection, NOT a SERP failure.**
- Op families: `odoo_*` (Odoo), `serp_*` (local phantom kits), `laravel_*` (`manage` MySQL), cross-system. New MO date ops in the `odoo_*` family: **`odoo_update_mo_date_finished`** edits a done MO's completion date; MO-**creation** now **requires** a packed/MO date (`date_finished`, `YYYY-MM-DD` Mountain Time) and Serpy **asks for it** via `request_user_choice` (offering the last 3 calendar days as labeled buttons + "Another date") rather than defaulting to today.
- "Replace SKU" = **kit component swap** (remove old + add new across every kit), NOT archive-old + activate-new.
- Guards fire on **structured facts** (`images_present`, classifier `op_types`, `has_replayed_image`), NOT semantic overlap with user text. Embeddings may add long-tail examples but **never gate/drop** a guard rule.
- **Provenance floors** (anything before its path's go-live can't be Serpy): `product_template` path **2026-03-24**, `create_product` **2026-04-13**, `create_receiver_product_everywhere` (SA- path) **2026-05-05**.

### Supplier Forecast (Teal Sidebar) — Isolated Multi-DB Subsystem

- **Out of scope for `serp_orm`.** Uses `asyncpg`/SQLAlchemy + raw SQL under `backend/services/forecast/`, REST routers `routers/forecast/`. NOT the `env.cr`/ORM-RPC pattern.
- Reads **three DBs simultaneously** via `ForecastDatabaseConnector`: `laravel_live` MySQL (active SA SKUs + SA inventory, SSH tunnel), Retool PG (SA/size projections, lead-times), Odoo PG (BOM SA→RM + RM inventory).
- Two-tier cache (L1 in-process LRU + L2 Redis; ElastiCache `rediss://` prod). Stale-while-revalidate at 80% TTL. Per-source circuit breakers. TTLs: static 600s, dynamic 300s, volatile 120s.
- Two orchestration paths both live: `SupplierForecastPipeline` (`/api/forecast`) vs legacy `ForecastService.generate_forecast` (`/inventory`, `/suppliers`, `/export`) — **fixes in one don't propagate** (CSV export can show zeros while dashboard is correct).
- Rule: add new forecast logic in `services/forecast/` (not ORM); add a **new pipeline+endpoint** rather than mutating the default. `globals.css` doesn't hot-reload — per-page CSS in a `<style>` block in the `.tsx`.

### Odoo — The ERP / Inventory / Accounting Brain

- Odoo 15 (v15.0.1.3) on **Odoo.sh** under Seth's account — **NOT self-hosted**. Prod host `sethfinley-sugarwish-odoo-main-5932805.dev.odoo.com:5432`. **Staging URL/creds change on every rebuild** — cached staging strings go stale.
- **Puller, not receiver.** Odoo runs `ir.cron` jobs that **pull** orders from Laravel's REST API (~6-min cron). **Laravel does NOT push to Odoo.** No webhooks, no real-time.
- All imported SOs book under single catch-all partner **`sugarwish_customer`** / id **94** "SW Customer". **No per-customer Odoo partners** — real customer identity lives entirely in Laravel.
- Key crons: #26 "Update Failed Orders" (every 10 min); #57 "Send Failed Orders Email" (dumps/emails `failed_products_log`, then unlinks).
- Custom modules: `sugarwish_integration` (main bridge), `purchase_features`, `sales_features`, `stock_features`, `mrp_features`, `sale_stock_picking`, `pr_vendor_product_automation`, `sw_reports`, `odoo_logger`, `prixite_customization`.

### SWAC = WishDesk

- `SWAC` (repo) = `WishDesk` (product, internally "WishWorks"). One codebase serves **both** the admin/support console **and** customer-facing proposal/receiver flows.

| Subdomain             | Env        | Branch        | DB                                         |
| --------------------- | ---------- | ------------- | ------------------------------------------ |
| `desk.sugarwish.com`  | production | `live`        | `sugarwish_wishdesk` (RDS)                 |
| `desk3.sugarwish.com` | staging    | `staging`     | ⚠️ **points at LIVE DBs** — not isolated   |
| `desk2.sugarwish.com` | dev        | `development` | `sugarwish_wishdesk_dev` + `manage` dev DB |

- Branch flow: feature → `development` → `staging` → `live`. **Not `main`.** Branch naming `<username>/<desc>`. Ticket prefixes `WD-*` / `WW-*`.
- Two DB pools: `server/db.ts` = WishDesk DB; `server/sugarwish-db.ts` = Sugarwish DB.
- **All DB timestamps stored in Mountain Time, NOT UTC.**
- Local dev auth: **cookie-based sessions** (not JWT). Needs `ENABLE_LOCAL_AUTH_BYPASS=true` + `APP_ENV=local`. Route auth: `isAgentOrAdmin` (most admin routes; **`agent` role ≠ admin**), `isAdmin`, `isAuthenticated`. Dev login fixture: `admin` / `swdev123`.
- SWAC owns sleeve **resolution** (`server/services/sleeve-resolution.ts` writes `branding_records.physical_branding`); actual PDF imposition/printing done by **livery**.
- WishDesk MCP server must run as its own PM2 app (Jenkins deploy didn't restart it → stale code on desk2: 23 tools vs 28 local).

### Other Platforms

**Insightly** (`crm.na1.insightly.com`) — legacy sales CRM, system of record for accounts/buyers. Companies = `Organisation` records; buyers = `Contact` records. Being succeeded by in-house `swcrm` (WishDesk `swcrm_*`).

**Retool PostgreSQL** — **analytics/ops scratch + cache + config layer; NOT a source of truth.** Shared "Frankenstein" multi-app DB (~165 tables, ~40 SERP-owned). Hosts SERP↔Odoo sync engine, AI observability, auth bridge, forecast caches, supplier meta, legacy Insightly CRM, BI mirrors. Table suffix convention: bare/`_dev` (local) vs `_live` (prod). Retool has been observed **overwriting `updated_at`** — don't trust it as a change timestamp.

**n8n** — self-hosted at `n8n.sugarwish.com` (v1.78.1). Fleet of hourly inventory/ops alert workflows + sync glue. NOT app code. All post as bot user "n8n" (`U08QP0DL9L5`). Pattern: PG node (Odoo read) + MySQL node (live SugarWish) + Code node + IF gate + Slack alert.

**sw-design** — Jason-owned design/asset pipeline. Source of truth for `design_images`, box+sleeve dims (`boxes/*/box.json` → `design_boxes`), merch recipes, Genie/router quiz configs (`genies/{key}.json`). Builds → S3 (`s3://sugarwish-design/`) → WishDesk syncs in (full-overwrite). AI gen: Claude + Gemini + OpenAI.

**SWIRL** (Sugarwish Intelligence Reference Library) — Jason-owned `swirl` repo; org-wide knowledge platform (markdown KB + Qdrant + discoveries + slash commands). Interface: SWIRL Bot Slack DM. Same repo also holds the **WishWorks** git-backed ticket datastore (auto-commits for WW-#### tickets). **WishWorks** = internal dev bug/feature tracker (`desk.sugarwish.com/admin/wishworks/tickets`, introduced 2026-03-12, replaced the freeform glitch process). **SWIM** = WishDesk-embedded AI chatbot (Qdrant `kb-v2`/`instructions`/`agent-chats`). All three are **separate from Jack's sw-cortex**.

**livery / SWOP** ("Sugarwish Operations Platform", `csloan-sw/livery`, Cris Sloan) — two roles: (1) sleeve/slip **PDF imposition & printing** for branded products (drives LogoJet printers, runs on Mac Mini "fulfillment appliance"); (2) **MCP-tooling backbone** (`mcp-db-tool-live`, `mcp-slack`, `mcp-wishdesk`, `swim-kb`, `custom-shop-slip`). Debug mug/sleeve PDF issues → point to **livery**, not SWAC. Deploy: `feature/*`/`fix/*` → `dev` → `main` → `production` (pre-commit hook blocks direct prod commits).

### Fulfillment Centers

| Code   | Location                   | `location_id` | SKU suffix | People                                               |
| ------ | -------------------------- | ------------- | ---------- | ---------------------------------------------------- |
| **EW** | Englewood, CO (primary/HQ) | 1             | `-E`       | Sophie, Will Meilinger, Jose Miranda, rashad.johnson |
| **TY** | Taylor, MI                 | 2             | `-A`       | Tracy Kamin; same-day delivery                       |

- Perishables (cookies, brownies) tied to one building; carton'd shelf-stable (coffee, tea) can reship from either. Remaining 13 warehouses = partner/dropship (SGD, SGM, ST, WCC, MS, PM, CPD, CPF, LR, MSS, MC, CC, PNB).
- **Production slips = two-slip custom flow:** Slip 1 (Laravel, product production) + Slip 2 (SERP print interface, sleeve production, appended as page 2). `preprints` deducts on slip generation, adds back on cancellation. Print cron runs ~5 min after buyer order; pre-prints filed by location code (`ENGLEWOOD-FILED-143`). Custom sleeves = CEO Jason's "biggest near-term revenue opportunity"; cost ~$2–5 each (min ~1000 @ $4.99; ~7–9 business days after art approval).
- Custom branding is **JSON-driven**: `branding_records` has `digital_branding`, `physical_branding`, `merchandise` JSON. **Branding record = what is OFFERED; `ec_order.merchandise_selections` JSON = what recipient CHOSE.**

---

## The 14-Database Landscape

**11 MySQL, 3 PostgreSQL.** Several `serp_*` DBs are **disposable local rebuilds**, NOT peer remote servers. `retool` is a shared multi-app DB, NOT SERP-owned.

| Database (MCP key)                 | Engine     | Role                                                                                                                                                                                          |
| ---------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wishdesk`                         | MySQL      | WishDesk/WishWorks CS+CRM+billing (179 tables, SSH tunnel)                                                                                                                                    |
| `wishdesk_dev`                     | MySQL      | WishDesk dev/staging (~5,121 users, partial sandbox)                                                                                                                                          |
| `laravel_live`                     | MySQL      | SugarWish/Laravel **PROD** — orders/customers (SSH tunnel); co-hosts ~70 sparse `serp_*` tables                                                                                               |
| `manage`                           | MySQL      | SugarWish/Laravel **STAGING** (~8% of prod); holds SERP's upstream ORM tables + `serp_res_users` auth                                                                                         |
| `local` (→`serp_local`)            | MySQL      | SERP dev partial schema (`LOCAL_DB_NAME`); all `serp_*` + ~3,091–3,449 products; **missing** `ec_order`/`items`/`kits`/orders                                                                 |
| `serp_prod_replica`                | MySQL      | Verbatim mirror of `laravel_live`, ZERO Odoo data — near-empty shell                                                                                                                          |
| `serp_staging_replica`             | MySQL      | Verbatim mirror of `manage`, ZERO Odoo data — near-empty shell                                                                                                                                |
| `serp_prod_darklaunch`             | MySQL      | Odoo PROD + `laravel_live` merged — future prod DB (lagging local snapshot)                                                                                                                   |
| `serp_staging_darklaunch`          | MySQL      | Odoo STAGING + `manage` merged — active staging SERP DB                                                                                                                                       |
| `live_darklaunch_db` (`serp_test`) | MySQL      | **Live PROD darklaunch** on Hetzner `5.161.233.240:3306`; canonical/most-current write target                                                                                                 |
| `serp_app`                         | MySQL      | **Main/live SERP app DB** — same Hetzner host as `live_darklaunch_db` (`LIVE_DARKLAUNCH_DB_*`), database `serp_app`; the prod DB the SERP app reads/writes — NOT the darklaunch shadow mirror |
| `odoo`                             | PostgreSQL | Odoo 15 ERP PROD — inventory/accounting source of truth                                                                                                                                       |
| `odoo_staging`                     | PostgreSQL | Near-identical staging clone (lags prod ~2 weeks / ~110k orders)                                                                                                                              |
| `retool`                           | PostgreSQL | Shared BI + SERP sync engine + auth bridge + AI observability + forecasting (~165 tables)                                                                                                     |

### Fingerprinting

- **Table prefix:** `serp_stock_move` = SERP's **MySQL mirror** of an Odoo model; same name **without** `serp_` (`stock_move`, `sale_order`) = native **Odoo PostgreSQL**. SugarWish/Laravel: `giftcards_card`, `ec_order`, `cart`, `preselect_orders`, `company`. WishDesk/CRM: `swcrm_*`, `swcrm_z_gmail_*`, `design_*`, `ds_*`, `orders_*`, `sw_billing_*`.
- **Darklaunch vs replica:** darklaunch DBs _only_ have `_migrations` + `serp_darklaunch_meta`. **Absence of `serp_darklaunch_meta` = it's a replica**, not darklaunch.
- `live_darklaunch_db` is consistently **AHEAD** of local `serp_prod_darklaunch` (e.g. ~35,983 vs ~34,289 moves) — treat it as canonical; the local is a lagging snapshot. Rebuild via `npm run db:push:prod-darklaunch`; **pause the worker first** (`pm2 stop serp-workers`) or get MySQL **1412 "table definition changed"**. Local Docker darklaunch: `127.0.0.1:3307`, user `devuser`.
- ⚠️ **ALWAYS use `live_darklaunch_db` (live `serp_test`) when reproducing/diagnosing what the live darklaunch worker or drift monitor actually sees — NEVER the local `serp_*_darklaunch` Docker DBs.** The local `serp_prod_darklaunch` is reseeded from scratch and contains **ZERO worker-created rows** (`id != odoo_id`); only seed rows where `id == odoo_id`. Both `darklaunch_mysql_pool` (app/worker, `DARKLAUNCH_DB_ENV=local-prod-darklaunch`) and `mcp__serp-orm` default to it. So reproducing a drift-monitor or worker FK comparison against local silently returns **0 of the exact rows the bug is about** — e.g. worker `stock_move` rows carrying a `sale_line_id`: **955 on live `serp_test` vs 0 on local**. The drift monitor compares live `serp_test`; reproduce against the same DB or the local-vs-Odoo id-space overlap masks the bug.
- **`serp_app` vs `live_darklaunch_db` (same Hetzner host, different DBs):** `live_darklaunch_db` = the darklaunch shadow/validation mirror (database `serp_test`); `serp_app` = the main/live SERP app DB the app actually reads/writes (database `serp_app`). Both share the `LIVE_DARKLAUNCH_DB_*` connection params (host/port/user/password) — only the database name differs. Do **not** conflate the app DB with the darklaunch mirror. **`serp_app` is wired in `src/services/databases.ts` + the db MCP enum but the running MCP must be restarted before it is queryable** (until then only `live_darklaunch_db`/`serp_test` is addressable on that host).

### Two Separate Flags (do not conflate)

1. `*_replica` — clean verbatim Laravel/manage mirrors, no Odoo overlay.
2. `serp_shadow` (Hetzner) — handler-correctness validation under real prod traffic; gated by **`SERP_SHADOW_WRITES_ENABLED`**.
3. Darklaunch proper — `*_darklaunch` locally / `serp_test` on Hetzner; gated by **`SERP_DARKLAUNCH_ENABLED`**.
4. Local `serp_shadow_meta` — the **predecessor** mechanism to darklaunch (`serp_local`, cutover `shadow_cutover_at = 2026-05-08`); NOT the Hetzner DB.

`SERP_SHADOW_WRITES_ENABLED` ≠ `SERP_DARKLAUNCH_ENABLED`. `/compare-darklaunch` (renamed 2026-05-28 from `/compare-replica`) compares against the **darklaunch** DB, not `*_replica`.

### The `id` / `odoo_id` Join Invariant (the #1 footgun)

Three id buckets on every `serp_*` table holding both Odoo and SERP rows:

| Bucket                 | `id` vs `odoo_id`                                                                  | Origin                      |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| Odoo-seeded            | `id == odoo_id` (Odoo's own id, < 1B)                                              | seeder                      |
| Worker-created, linked | `id` = MySQL AUTO_INCREMENT past Odoo range; `odoo_id` = Odoo id → `id != odoo_id` | darklaunch worker           |
| SERP-origin            | `odoo_id IS NULL`                                                                  | worker, no Odoo counterpart |

- **ALWAYS join `darklaunch.odoo_id = odoo.id`, NEVER `id = id`** (IDs diverge independently).
- Durable origin test: **`odoo_id IS NULL` = SERP-origin** (increasingly common for new receiver-orders). NOT the `id >= 1_000_000_000` scheme — `SERP_ORIGIN_ID_FLOOR = 1_000_000_000` was **reversed the next day**; code assuming a 1B floor is stale.
- Worker rows most reliably identified by `name = 'S' + ec_order_id`, NOT heuristic `id != odoo_id`. **SERP data wins conflicts** — Jack explicitly rejected a `serp_id` surrogate.
- Child rows (`stock_move`, `stock_move_line`, quants) often have `odoo_id = NULL` until later stamped. Drift tooling only diffs rows where `odoo_id IS NOT NULL`.

---

## Odoo (PostgreSQL) — the ERP Source of Truth

- `sale_order` history begins **2022-11-15** (id=1); older orders only in legacy Laravel. Prod `sale_order` max id ~2,352,430; staging max ~2,342,312.

### Sales

**`sale_order`** (~2.21M rows) — `name` = `S#######` (used as `stock_picking.origin`). `state`: `sale`=active (~2.14M), `cancel` (~66k), `done` (6, ignore). `partner_id` is **ALWAYS 94** (grouping collapses to one bucket). **`sw_id`** = Laravel order id = THE cross-system join key. `name = 'S'+digits` is **NOT** the same as `id`. On confirm: spawns `stock_picking` + one `stock_move` per BOM component.

**`sale_order_line`** — `product_uom_qty`=ordered; `qty_delivered`=shipped (from `done` moves). `display_type`=`line_section`/`line_note` → header rows (no `product_id`); **exclude when summing**.

### Inventory

**`stock_picking`** — transfer header. `name` = `WAREHOUSE/OPERATION/number` e.g. `EW/OUT/3178644` (trailing number ≠ id ≠ SO number). `state`: draft→confirmed→`assigned` ("Ready" = reserved, **NOT shipped**)→`done` (~3.02M)/cancel. **Only `done` moves inventory**; stuck `assigned` pickings cause phantom reservations. `origin` = TEXT source-doc (`P01906`/MO/`S#######`) — join picking→PO via TEXT `origin`, NOT id. `move_type`: `one`=all-or-nothing (~99.7%, SW default) vs `direct`=partials allowed.

**`stock_picking_type`** (135 rows = 9 types × 15 warehouses) — `code`: `incoming` (Receipts AND Returns), `outgoing` (Deliveries ~3.0M), `internal`, `mrp_operation`. EW ids 1–9 (id 2 = Englewood Delivery Order); TY 10–18. Always join for `code + warehouse_id` (each warehouse reuses different ids).

**`stock_move`** (~**15.8M rows**: ~14.4M done, ~1.45M cancel) — see TL;DR footgun. Delivery = `location_id=2008` (EW/Stock/Fulfillment) → `location_dest_id=5` (Customers). ~4.4k `assigned` + ~1.3k `confirmed` are **stuck** from old/cancelled orders, falsely locking `stock_quant.reserved_quantity`. `bom_line_id` present on MO raw-material moves AND phantom-kit delivery moves.

**`stock_move_line`** (~14.5M) — `product_uom_qty`=reserved/planned; `qty_done`=executed. `do_unreserve()` can leave line at qty=0 while parent move stays `assigned` = **zombie reservation** (Odoo bug). Orphan-reservation diagnostic: `location_id=2008 AND product_uom_qty>0 AND state NOT IN ('done','cancel')`.

**`stock_valuation_layer`** (SVL, ~13.4–14.4M) — FIFO costing ledger, **company-wide FIFO** (all 115 `ir_property` rows `value_text='fifo'`). `quantity`/`value` are **SIGNED** (positive=receipt, negative=delivery/COGS). `remaining_qty`/`remaining_value` = unconsumed inbound portion (~3,900 layers >0); SUM(`remaining_value`) per product = current inventory $. **NO `sequence_number` column** — FIFO order = `id`/`create_date` ascending.

**`stock_quant`** — on-hand snapshot (not a log). **AVAILABLE = `quantity` − `reserved_quantity`.** Filter on-hand by `usage='internal'` (NOT `inventory_date IS NOT NULL`). Cycle-count to zero does NOT clear reservations → `quantity=0` + `reserved_quantity>0` = negative available = **root cause of negative "West Coast Qty"** in Laravel. ~5,900 negatives; only internal-location negatives are bugs (virtual-location negatives are normal). Odoo rejects quants on consumables/services.

**`stock_location`** (~2,686) — `usage`: `internal`=real owned stock (EW/Stock/Fulfillment **id 2008**, TY/Stock/Fulfillment id 2006); `supplier`=Vendors **id 4**; `customer`=Customers **id 5**; `production`=15; `inventory`(adjustment)=14; scrap=16. `sugarwish_id`: EW=1, TY=2, 0=Odoo-only, NULL=virtual. ~88 duplicate internal shelf locations.

**`stock_warehouse`** (15 rows, 13 active) — EW=id 1, TY=id 2. All warehouses `reception_steps=one_step`, `delivery_steps=ship_only` — receipt/delivery is **one move, not a chain**.

**`stock_scrap`** (~1,590): only `done` reduces inventory. **`stock_landed_cost`** (~97): adds VALUE only — does **NOT** add `stock_quant.quantity`.

### Manufacturing

**`mrp_production`** (~28k, mostly done) — `name` e.g. `EW/MO/05584`. **Phantom/kit BOMs create NO MOs** — kits explode directly into component delivery moves. **`date_finished` footgun:** marking an MO done (`button_mark_done`) stamps `date_finished = server-now`. A slip entered the next day therefore lands on the **wrong production day**, undercounting SERP's throughput dashboard (and skewing the packing bonus). Ops (Will/Sophie) catch this against paper packing slips; Jack has historically corrected it with a one-off Python XML-RPC script. Two SERPY ops now manage it: **`odoo_update_mo_date_finished`** (PR #175 — edits the completed date on an already-done MO via the `/manufacture-orders` cart) and a **required packed/MO date on MO _creation_** (PR #176, branch `feature/serpy-mo-create-date`). Both convert the Denver calendar day → **noon naive-UTC** via `_denver_day_to_odoo_utc` so the dashboard's `DATE(date_finished)` buckets to the right day (per the ~6h naive-MT-vs-UTC rule).

**`mrp_bom`** (~2,194) — `type`: `normal`=real manufacturing BOM; `phantom`=KIT (explodes at SO confirmation, NO MO). **All 813 phantom BOMs are `active=false`.** ~97.9% have `product_id` NULL (linked via `product_tmpl_id` only) — matching on `product_id` alone causes "no BOM found".

**`mrp_bom_line`** (~6,845) — `product_qty` = component qty per parent unit; **~437 lines have `product_qty=0`** (optional packaging) — filter `product_qty>0` as denominator. **`mrp_unbuild`** (~200): reverse-MO; `done` adds component stock, removes finished-good.

### Product

**`product_template`** (~7,278) — SKU prefixes (see Glossary). `detailed_type`: `product`=stockable, `consu`=consumable, `service`. **`sugarwish_id`** = external sync key, lives on **template only** (NOT `product_product`). **`product_product`** (~7,278) — `default_code` = SKU = THE cross-system join key (`SA-15-014-A`). **~483 rows have NULL `default_code`** — exclude (`WHERE default_code IS NOT NULL`). **Join Odoo↔Laravel on `default_code` (SKU), never `product_id`.** **`product_category`** (~137): organized by TYPE not pack size; cost method NOT a column here — it's `ir_property` keyed `res_id='product.category,<id>'`, all FIFO.

### Purchasing & Accounting

**`purchase_order`** (~1,992) — `name`=`P#####`. `state`: `purchase`=**APPROVED** (NOT "arrived"), `draft`, `cancel`. `effective_date` = **ACTUAL arrival** (NULL until receipt picking `done`). `invoice_status='invoiced'` = "fully billed for received-so-far" — open backorder still possible. **`purchase_order_line`** (~17,391): ~2,300 lines have `qty_received > product_qty` (over-receipts); `sale_order_id` always empty (all POs = pure stock replenishment). **`product_supplierinfo`**: `name` field = vendor's `res_partner.id` as INTEGER, not a text name.

**`account_move`** (~13.2M) — `move_type`: `entry`=GL journal (~13.22M, mostly auto inventory/COGS via STJ), `in_invoice`=vendor bill (~1,719), `out_invoice`=customer (**1 row, unused**). `payment_state` almost always `not_paid` — payments reconciled in **QuickBooks**, never back to Odoo; **not a source of truth**. **`account_journal`**: 8 journals; volume dominated by **STJ** (Inventory Valuation, id 6) + **BILL** (id 2). US sales tax = **Avatax** (external); `account_tax` is a placeholder. **PO→bill junction:** `account_move_purchase_order_rel` (~1,722; many-to-many — de-dupe on joins). Vendor billing is **100% manual** (posting a bill increments `qty_invoiced`; bills NOT auto-generated from POs).

### Partner

**`res_partner`** (~294: 170 vendors, 124 internal) — `customer_rank` = **0 for every row** (no real customers in Odoo). `supplier_rank>0` = vendor; id 94 = catch-all. **`res_company`**: single id=1 "Sugarwish Englewood", USD. **`res_users`**: staff/bots only; common bill creators Nora Stein, James Emeric.

---

## SERP (MySQL `serp_*`) — the In-House Odoo Re-Implementation

### The 4-DB Matrix — NEVER conflate replica with darklaunch

| DB                        | Seed source                | Odoo overlay? | Writer            | Contents                                                                     |
| ------------------------- | -------------------------- | ------------- | ----------------- | ---------------------------------------------------------------------------- |
| `serp_prod_replica`       | verbatim `laravel_live`    | NO            | SERP app          | ~19 sale_orders, 0 POs/MOs — **nearly empty**                                |
| `serp_staging_replica`    | verbatim `manage`          | NO            | SERP app          | 0 rows in most tables                                                        |
| `serp_prod_darklaunch`    | Odoo PROD + `laravel_live` | YES           | darklaunch worker | ~10.2k sale_orders, ~2k POs, ~5.5k pickings, ~34k moves — **future prod DB** |
| `serp_staging_darklaunch` | Odoo STAGING + `manage`    | YES           | darklaunch worker | ~36,144 moves, 1,971 POs — **active staging SERP DB**                        |

- DB routing: SERP app → `SERP_ORM_ENV`/`ACTIVE_ODOO_DB_NAME`; darklaunch worker → `DARKLAUNCH_DB_ENV`. **Routes independently.** If a SERP page shows empty Odoo-owned entities (normal BOMs, MOs, inventory) → **config-routing issue, not a bug** (ORM pointed at the clean replica).

### `serp_*` Table Reference

- **`serp_sale_order`** — PRIMARY ORDER BRIDGE. `order_type` enum (`receiver-order`/`preselect-order`): exactly one of `ec_order_id`/`preselect_order_id` set. `name` = `'S'+sw_id`. `state='sale'`=CONFIRMED. Dates: `create_date`/`write_date` (NOT `created_at`). ~19 rows in `laravel_live`; full data in `*_darklaunch`.
- **`serp_stock_picking`** — `state`: draft→waiting→confirmed→`assigned` (reserved/ready, **NOT shipped**)→`done` (shipped)→cancel.
- **`serp_stock_move`** — `component_order_id` → `component_orders` ties an Odoo move to a SugarWish component pick.
- **`serp_stock_quant`** — Available = `quantity` − `reserved_quantity`.
- **`serp_stock_valuation_layer`** — negative `quantity`/`value` = outbound/COGS. Same cols as Odoo + `odoo_id`.
- **`serp_stock_picking_type`** — `code` = direction/purpose, NOT progress.
- **`serp_product_template`** (~3,776) — **NO `default_code` column here.**
- **`serp_product_product`** (~3,449) — `default_code` lives here. THREE mutually-exclusive bridge FKs: `component_id`→components (~2,441), `buyer_product_id`→buyer*products (~386), `receiver_product_id`→receiver_products (~81); ~541 rows have NONE. \*\*Unified product FK target for all `serp*\*` tables.\*\*
- **`serp_purchase_order`** — `state='purchase'` = confirmed PO (Odoo term, not "a purchase happened"). `partner_id` = **VENDOR**.
- **`serp_res_partner`** — role via `supplier_rank`/`customer_rank`. `weeks_on_hand` = SugarWish-added, non-standard.
- **`serp_mrp_bom`** — `type` ENUM(`normal`,`phantom`) (no third value). In replica/`manage`: frozen April-2026 snapshot, **~224–228 phantom rows only, `odoo_id` NULL**, no normal BOMs/MOs (those live in darklaunch). Excluded from comparisons (`KNOWN_FILTERED_TABLES` filters `mrp_bom` to `active=true AND type!='phantom'`).
- **`serp_account_move_line`** — filter `display_type='product'` for real goods; `is_anglo_saxon_line` = system COGS (not manual).
- **`serp_res_company`** — exactly 1 row, id=1 (odoo_id=1). `company_id` always 1.
- `serp_product_supplierinfo` — dual local FKs + parallel Odoo FKs (`odoo_partner_id`, `odoo_product_id`); `delay`=lead-time days. `components.inventory_source` enum `'odoo'`/`'serp'` = per-component darklaunch switch (only **3 of 2524** are `'serp'` in prod darklaunch). `components.odoo_id` is **varchar** and synthetic.

---

## Laravel (`laravel_live` / `manage`) — the App & Order Domain

- **`laravel_live`** = SugarWish PRODUCTION app DB. Full Laravel schema AND ~70 sparse `serp_*` tables. SSH tunnel. **NOT SERP-only.** **`sku_type`/`is_core` real values exist ONLY here.**
- **`manage`** = staging (~8% of prod). Has staging-only tables (`gift_card_processing_progress`, `label_generation_logs`, `box_images`). Seed source for `serp_staging_*`. SERP auth in `manage.serp_res_users`. **In `manage`, ALL `receiver_products` default to `sku_type='legacy'`, `is_core=0` — NOT real classification.** Never infer prod state from `manage`.

### Order Domain (the gifting flow)

Flow: buyer checks out (`buyer_orders`) → creates gifts (`giftcards_card`, one per recipient) → recipient redeems → shipment (`ec_order`). Pre-curated direct-ship uses `preselect_orders`.

- **`giftcards_card`** (~4.9M) — PK is **`card_id`** (no `id`/`increment_id`). Gift = **choose-your-own credit**, NOT a stored-value card or pre-selected box. Source of truth for sender/receiver email. `card_status` TINYINT: **2**=redeemed/active (~80%), **1**=sent/awaiting (~329k), **0**=unredeemed/canceled (~669k), **4**=voided. `card_type`: print/email/offline/sms. `delivery_method='wishlink'` identifies a WishLink.
- **`ec_order`** (~4M) — one row = one physical shipment to one recipient. **0 rows in SERP/replica DBs** — real data only in `laravel_live`. `increment_id` = cross-system key to Odoo. `status`: `pending` (~99%, card issued NOT awaiting payment), `processing`/`complete`/`shipped`/`canceled`. `sw_fulfill`: 1=in-house, 0=vendor, NULL=legacy. **`oddo_synchronized`** (intentional typo) = Odoo sync flag. **`size` = `buyer_products.id` (MISNAMED, NOT a size).** **NO `recipient_email` column.** `is_printed=3` = address/label-blocked queue → **reset** after API fix (not terminal). `giftcards_card` ↔ `ec_order` = **1:MANY** (reships). JOIN: `ec_order.giftcards_card_id = giftcards_card.card_id`; `ec_order.size = buyer_products.id`. **`ec_order` has DB triggers with huge blast radius** — a broken trigger jeopardizes ALL insert/update/delete (WW-142); emergency lever: Munyr can disable triggers.
- **`receiver_orders`** is **NOT** the shipment table — `ec_order` is (70+ columns). `receiver_orders` only tracks notification/survey state.
- **`preselect_orders`** — direct-ship (sender pre-selects). `type` enum = ORDER CHANNEL (`preselect`/`sweet-shoppe`/`sweetificate`), not status. Same `oddo_synchronized` flag.
- **`buyer_orders`** (~1.3M) — checkout header (one purchase → many gifts). `status` and `preselect_status` = two independent state machines. `product_sku` is free-text cart text — always use `ec_order` for attribution.
- **`items`** — recipient's chosen flavors (one row per flavor, belongs to `ec_order`). **`component_orders`** — box/packaging component lines; `order_type`=`receiver-order`/`preselect-order`; `inventory_source`=`odoo`/`serp`.

### Two-Sided Product Model

| Table               | What it is                                             | Key facts                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buyer_products`    | What the **sender buys** (gift size/box/credit SKU)    | ~1,215; `odoo_id` populated on ALL rows; `type`: `ecard`(~906)/`sweetshoppe`/`sweetificate`; `default_kit`→`kits.id`. **Dual-homed**: Retool synced copy + `laravel_live` table                                       |
| `receiver_products` | Individual candy/snack **flavors the recipient picks** | ~5,000+; `product_id`/`sugarwish_id` = join to Odoo `product_template.sugarwish_id`; `inventory_qty`/`odoo_inventory` live here. **`product_id` = SugarWish id, NOT Odoo product_id**. **Non-`id` PK = `product_id`** |

- `kits`/`component_kits` = Laravel-side BOM (source of truth for component recipes); distinct from and can diverge from Odoo `mrp_bom`/`serp_mrp_bom`. `ecard` type ≠ a greeting-card image.
- **`users`** (sugarwish) — sender/buyer accounts. `account_type`: ''/Guest/Onboarding/Personal/Company/Both. Company relationship is **M:N via `company_users_pivot`** — **no single `company_id` on users**.

---

## WishDesk (`wishdesk`) — CS + CRM + Design + Billing

Not a support-only DB. Full CS+CRM+design+billing platform (internally "WishWorks"). 179 tables, primarily a **sales CRM + Gmail-AI assistant**. WishDesk is a **downstream replica** — customer/company/order truth lives in SugarWish (Laravel/Odoo); WishDesk stores ids + cached snapshots.

| Prefix                                    | Subsystem                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `swcrm_*`                                 | Full sales CRM (modeled on Insightly)                                       |
| `swcrm_z_gmail_*`                         | Gmail mirror + AI-draft (SWIM) email assistant (20+ tables, ~155k messages) |
| `orders_tickets` / `orders_ticket_events` | CS email ticketing                                                          |
| `sw_billing_tickets`                      | Slack-driven billing/finance queue                                          |
| `swcrm_actions`                           | sales tasks/to-dos (NOT customer-facing tickets)                            |
| `design_*`/`ds_*`/`merchandise_*`         | ecard/custom-product design studio                                          |

**Three independent ticket systems:** `orders_tickets` (CS email), `sw_billing_tickets` (Slack billing), `swcrm_actions` (sales tasks). Plus `wishdesk.orders_monthly_orders` = managed-gifting recurring-order planner (year-grid). **"Orders" means three different things** — see Gotchas.

- **`users`** = BOTH staff AND synced customers (split by `role`: `customer`~49k, `guest`~8.5k, `user`~5.9k, agent/admin few dozen). `role_type` staff: GC/HS/super/MOD/Billing/Sidekick/test. `sw_id` = FK to Laravel user id; `slackid` = staff Slack id.
- **`user_cache`** = denormalized customer snapshot synced from Laravel; join key is **`user_id`** (Laravel id), NOT `users.id`. CRM `'user'` object resolves via `user_cache.user_id`. Metrics are cached, not live.
- CRM object naming: lowercase (`user`, `opportunity`) = new/native; capitalized (`Opportunity`, `Contact`, `Organisation`) = legacy Insightly-imported.
- **`swcrm_leads`** (~158k): `lead_status` is messy free-text (~115k `Won - Setup Account` = bulk-imported converted customers); use `converted_*` columns.
- **`swcrm_opportunities`** (~36k) — use **`opportunity_state`** (OPEN/WON/LOST/INVALID/UNTAPPED), the authoritative field. Legacy `state` + free-text `status` exist but **do NOT use for reporting**. `category` = deal-SIZE bucket (SMALL/MEDIUM/LARGE/MEGA/NA), NOT product category.
- **`swcrm_pipelines`** — only ONE pipeline (`Default`), 3 stages: Expressed Interest → Active Discussion → Order Paid (WON).
- **`swcrm_links`** = polymorphic bidirectional M:N junction (backbone of all CRM relationships) — query both `(object_name,object_id)` AND `(link_object_name,link_object_id)`, dedupe. NO direct FK join tables between CRM entities.
- **`swcrm_activity`** and **`swcrm_campaign`** are EMPTY (use `swcrm_field_change_log` + `swcrm_opportunity_stage_history`). `dev_leads`/`dev_*` = a separate parallel CRM pipeline in prod, **NOT** dev copies.
- **`orders_tickets`** — email CS inbox. `ticket_id` = VARCHAR display id `SKTKT-...` (not the int PK); children join on **`ticket_id`** (VARCHAR). `orders_ticket_events.type`: filter `IN ('INBOUND_EMAIL','OUTBOUND_EMAIL','INTERNAL_NOTE')` for actual correspondence.
- **`sw_billing_tickets`** — billing/finance queue (Slack-driven); has `slack_*` columns tying each to its thread. **`proposals`** (~99.5k): config is JSON (`details_json`, `recipient_json`, `metadata`); `parent_proposal_id` = revision chain; locked version mirrors to `branding_records` (keyed `proposal_id`).
- **WishDesk sync** = ONE-WAY Laravel → WishDesk. `swcrm_z_gmail_messages.ai_draft_status`: GENERATED/EDITED/SENT_AS_IS/DISCARDED (only SENT_AS_IS/EDITED were actually sent). Threads by `gmail_thread_id`, not subject. RingCentral: `swcrm_ringcentral_calls` ~7,855.

---

## Retool (PostgreSQL) — SERP Operational Backbone + BI

Environment separation is by table-name **suffix**, not separate DBs. Production = **`_live`** tables.

| Domain                    | Local                                          | Prod                                                     |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| draft-ops                 | `serp_draft_operations`                        | `serp_draft_operations_live`                             |
| inventory-counts          | `serp_inventory_counts`                        | `serp_inventory_counts_live`                             |
| AI messages/turns         | `serp_ai_messages_dev`, `serp_ai_turns_dev`    | `serp_ai_messages_live`, `serp_ai_turns_live`            |
| Odoo sync queue + breaker | `odoo_sync_queue`, `odoo_sync_circuit_breaker` | `odoo_sync_queue_live`, `odoo_sync_circuit_breaker_live` |
| auth / user / forecast    | (no suffix)                                    | (no suffix)                                              |

- **Auth/AI:** Token tables `serp_refresh_tokens`/`serp_password_reset_tokens` are documented as Retool PG but actually live in **MySQL** (serp ORM). Serpy drafts-as-conversations (Apr 2026): event stream in `serp_ai_messages_{dev,live}` + `serp_ai_turns_{dev,live}`. Legacy `serp_ai_prompt_logs_live` is read-only/older.
- **`orders`** — mirror of SugarWish/Magento orders. `increment_id = '300' + id`. `path_status` = CS/routing classification (NOT fulfillment): includes `Test Account` (~62k rows — **filter out**), size buckets.
- **`sku_projections`** — per-SKU popularity at 3wk/8wk/1yr from **recipient gift-selection survey data**. No active/archive flag — join Odoo `product_product.active` to exclude discontinued.
- **`sku_supplier`** — per-SKU forecast config. `lookback_period` ENUM per-SKU: `8 Week` (default), `3 Week` (fast-moving), `Year` (seasonal). **No `case_qty` column here.**
- **`supplier`** — vendor replenishment config; **`default_case_qty` lives HERE**. Real suppliers: Jack's, Albanese, Blair Candy, Redstone, CJ Dannemiller, Nuts.com, Jerry's, Buckin' Nuts, Sew Many Tails, AG Alchemy, The Pound Bakery.
- **`rm_sku_supplier`** — RM SKU → supplier for automated RM POs; own `case_qty`. **`rm_weekly_demand_cache`** = authoritative RM purchasing forecast (PG, not SERP MySQL); column **`product_type_keys`** is PLURAL (ARRAY) — no singular `product_type_key`. **`bom_components_cache`** = cached BOM (RM→SA) mirrored from Odoo `mrp.bom` — use instead of querying Odoo live.
- **`operation_levels`** = canonical inventory thresholds + alert state. `previous_level`: **0**=critical/red, **1**=minimum/orange, **2**=below-goal/yellow, **3**=at-goal/green. Ops Slack workflow (every 20 min) **writes** `previous_level` + `time_turned_red/orange/yellow`; Daily Operations Message (8 AM) **reads** them for "days below threshold."
- **`opportunities`** (Retool) = legacy Insightly import (casing dups `Open`/`OPEN` — normalize); distinct from `wishdesk.swcrm_opportunities`. **`receiver_product_status`** drives Slack alerts — the `*_slack_ts`/`*_channel`/`*_alerted_at` columns are **de-dup guards**, not message content.
- **`serp_inventory_counts_live`** — `fulfillment_entry_index` groups independent count sessions. **VERIFIED = 2+ different users, same sku+location+entry_index, matching qty.** Uncounted SKUs get **ZEROED on sync** by design. `location_id` 2001/2002 = TEST data. **`serp_beginning_inventory_snapshots`** = pre-computed beginning-of-period on-hand (avoids scanning 8.8M-row `stock_move_line`).
- **`buyer_products` is dual-homed** (Retool synced copy used by forecast SQL + separate `laravel_live` table). BI mirrors (NOT transactional sources): `quickbooks_dashboard`, `stripe_dashboard`, `shopifymonthlydata`, `insightly_contact_data`.

---

## Cross-System: Inventory Source-of-Truth & Concurrent Writers

**Inventory is split — no single source of truth:**

- **SA (finished/sellable):** Laravel `receiver_products.inventory_qty` is master for what's available to sell (deducts pending un-imported orders immediately).
- **RM (raw material):** **Odoo only** (active `mrp_bom` + `stock_quant`).
- **Final available formula (canonical Dec 2024):** Odoo AVAILABLE qty (not on-hand) − orders Laravel still holding. Odoo syncs its number to Laravel → Laravel subtracts un-imported orders. The old Jan-2023 "Odoo is the source" statement is **superseded**.
- `receiver_products.odoo_inventory` ("West Coast Qty") = **cached int, NOT a live Odoo read** (source: Odoo `stock_quant usage='internal'`); can be off-by-one. Inventory adjustments in Odoo do **NOT** auto-propagate to Laravel `inventory_qty` (recurring bug).

**Concurrent writers / deadlocks:** Laravel backend, Retool apps, and n8n all write the same MySQL rows simultaneously → `ER_LOCK_DEADLOCK`. The n8n "Auto-Disable" workflow deadlocks against other writers → **partial application** (some rows silently not updated).

---

## Integrations & Sync (SERP ↔ Odoo ↔ Laravel)

### Three-System Correspondence

- **Laravel** = order origin (`ec_order`, `preselect_orders`, `giftcards`). **SERP** ingests as `serp_sale_order` (back-refs `sw_id`, `ec_order_id`). **Odoo** = legacy ERP, linked via `odoo_id` on every `serp_*` table. Source-of-truth is **per-entity**.

| Entity                                              | Owner         | Write path                                      |
| --------------------------------------------------- | ------------- | ----------------------------------------------- |
| Normal BOMs/MOs/POs/product creation                | Odoo-owned    | SERP → `odoo_sync_queue` → XML-RPC              |
| Phantom BOMs / kits (`serp_mrp_bom type='phantom'`) | SERP-owned    | local `serp_mrp_bom_line` via `serp_update_kit` |
| `receiver_products`, `component_kits`               | Laravel-owned | SERP → `manage` MySQL via `laravel_*` ops       |

### Cutover Strategy

- **DUAL-WRITE + PARALLEL TEST** — SERP and Odoo run side-by-side; Serpy writes to BOTH; Odoo → SERP one-way sync keeps SERP populated. Gate: **<1% drift, stable 2 weeks.** Target ~2026-06-04. Each env's authoritative cutover = its own `serp_darklaunch_meta.darklaunch_cutover_at`.
- **Jack's SERP milestones (targets):** repeatable sync script May 13 · dual-write wired Jun 3 · order queue expanded (`ec_order`+`preselect_orders`) Jun 24 · parallel test launched Jul 1 · parallel test complete Jul 15.

### `odoo_sync_queue` (Outbound Bus, SERP → Odoo)

- Lives in **Retool PostgreSQL** (`RETOOL_DATABASE_URL`), tables `odoo_sync_queue_live`/`_dev`. Direction is **SERP → Odoo via XML-RPC**, NOT Odoo → SERP. Worker: asyncio, ~30s poll, batches 50 (but **`BATCH_SIZE=1` in prod**), priority ASC then created_at ASC. Statuses: `pending → processing → done/synced/failed/partial/cancelled/dlq`.

| `sync_target`     | ~Count | Target                                                |
| ----------------- | ------ | ----------------------------------------------------- |
| `odoo`            | ~3044  | Odoo XML-RPC                                          |
| `multi`           | ~218   | fan-out                                               |
| `laravel`         | ~154   | `manage` MySQL via `handle_laravel_kit_composition()` |
| `serp`            | ~43    | SERP mirror                                           |
| `serp_darklaunch` | few    | darklaunch mirror                                     |

- `idempotency_key` = `'odoo:{entity}:{id}:{op}:{hash}'`. `odoo_id` populated ONLY after successful create where `odoo_response.verified=true`.
- **NO auto-retry, NO exponential backoff, NO functional DLQ** — `'failed'` rows are NEVER re-picked; require manual `/api/admin/sync-queue` retry. `recover_stuck_items` only resurrects `'processing'` >5min rows, never `'failed'`. `max_attempts` column is unused.
- Circuit breaker `odoo_sync_circuit_breaker(_live/_dev)`: OPENS after **5** consecutive failures, resets after **2** successes, `reset_timeout_seconds=30`. `ODOO_SYNC_DRY_RUN=True` generates fake odoo_ids (`99990000 + entity_id`).
- **Replay landmines** (unguarded handlers): `mrp_unbuild` and `purchase_order_state` `'edit'`/`'add'`.
- `entity_types`: `mrp_production`, `po_receipt`, `stock_picking`, `inventory_adjustment`, `stock_scrap`, `mrp_unbuild`, `purchase_order_state`.

### Two SERP Order Pipelines (+ Merchandise)

1. **Odoo sync queue** (`odoo_sync_worker.py`, Retool PG) — triggered on approved Serpy draft; warehouse ops vs Odoo via XML-RPC + mirrors to darklaunch. **PO receipts flow here.**
2. **Darklaunch order worker** (`darklaunch_order_worker.py`) — **NO queue**; polls `ec_order WHERE oddo_synchronized=1`; `POLL_INTERVAL=300s`, `BATCH_LIMIT=50`, single-threaded; dual-writes receiver/preselect orders to `serp_prod_darklaunch` only; never pushes back to Odoo. **As of PR #291 (2026-06-25) it queries Odoo ZERO times** — `_resolve_odoo_ids` (id-stamp + the 3 cancel/cold-cancel/ship gates that read live Odoo `sale_order.state`) was removed; the cancel/ship gates now key off a non-Odoo signal / are caught by aggregate drift instead. Consequence: the worker is allowed to run **AHEAD of Odoo** (worker rows are `odoo_id=NULL`, AUTO_INCREMENT `id`). **Detector bug (pre-#291):** `detect_shipped_orders_odoo` had `ORDER BY … DESC LIMIT 50` stranding the oldest tail (observed 883 in-flight) — fix = oldest-first.
3. **Merchandise** (`order_queue_worker.py`, gated `ORDER_QUEUE_WORKER_ENABLED`): polls `component_orders WHERE order_type='merchandise' AND inventory_source='serp'`; writes **main/live SERP DB**.

Orders that never reach Odoo intentionally get `odoo_id=NULL`. `inventory_source='serp'` → main DB (merchandise queue); `inventory_source='odoo'` → darklaunch/replica DB.

### Performance (intentionally slow)

`button_validate → _action_done` = ~440–650 serial statements per 8–12 move shipment over ~80ms AWS→Hetzner RTT = **~35–72s/shipment** (~47–66s prod). Single-threaded ceiling ≈ **72 shipments/hr** (~6–7× below the 2025-12-29 peak of ~11,433). This is **intentional** — accounting fidelity over speed. **Do NOT batch** — would break `account_move.sequence_number` ordering and `/compare-costing` parity. Fix directions: batch per-move loops into recordset ops, co-locate DB. **Newest-first `LIMIT 50` starves the backlog** — detectors must process **oldest-first** by `MIN(create_date)`.

### Serpy Product-Write Fan-Out & Provenance

| Op type                                                              | Systems written                   |
| -------------------------------------------------------------------- | --------------------------------- |
| `create_odoo_product`                                                | Odoo + SERP                       |
| `create_component_everywhere` / `create_receiver_product_everywhere` | Odoo + Laravel + SERP             |
| `create_serp_tracked_component`                                      | Laravel + SERP only (**no Odoo**) |

- `create_uid=55` = Jack's shared login used by BOTH Serpy AND manual edits — **NOT** a Serpy signal. Canonical provenance ledger = `odoo_sync_queue_live` (search by `odoo_id` or `payload->>'sku'`). `origin` carries `'SERP Batch #<draft_id> op <n>'`. Manual UI imports fingerprinted by `ir_model_data.module='__export__'`.

### `odoo_id_stamper` (post-create stamping) — RETIRED 2026-06-25

- ⚠️ **The stamper is GONE as of PR #291** (stampless aggregate compare, merged + deployed to prod). Since the drift monitor no longer row-joins on `odoo_id`, worker rows are intentionally left `odoo_id=NULL` and nothing back-fills child `odoo_id`s anymore. The `stamp_child_odoo_ids` call was dropped from the `odoo_sync_worker` path too. Treat the notes below as **historical** (why the stamper was fragile, which motivated retiring it):
- Ran **after** the darklaunch worker created rows (`workers/odoo_id_stamper.py`, own pool). Natural-key matching for `stock_move` is non-unique (adjacent orders share `product_id`/`qty=1`) → could **mis-stamp neighbor moves** (observed ~84% NULL, ~16% mis-stamped). **Frozen frontier signature** = `MAX(odoo_id)` stuck while `MAX(id)` climbs = dead stamper (SSL-closed idle conn). Was gated by `ODOO_ID_STAMP_ENABLED`. (Earlier fix 2026-06-03: high-volume order path created thousands of `odoo_id=NULL` rows because `stamp_child_odoo_ids` was only wired into the Serpy path, not the order path.)
- **Stamper Odoo reads MUST use asyncpg, never psycopg2** (resolved 2026-06-03 after 3 deploys): the prod Odoo SaaS host (`*.dev.odoo.com`) sits behind an SSL proxy that **refuses libpq's in-band SSLRequest handshake entirely** — every psycopg2 connect fails "SSL connection has been closed unexpectedly" regardless of sslmode (reproduced locally; a raw Python TLS wrap to :5432 succeeds), while asyncpg (direct TLS) works against the same host. The failure was intermittent (worked one morning, then the proxy stopped accepting psycopg2). Fix: stamper reads via `odoo_pool.execute_query_via_loop` (a `run_coroutine_threadsafe` bridge from the worker thread onto `OdooPool._loop`), with `%s`→`$N` placeholder conversion. Two earlier deploys (query-layer retry, `SET LOCAL statement_timeout`) treated symptoms. Related gotcha: the host is a transaction-pooling proxy that REJECTS libpq startup `options` — `psycopg2.connect(options="-c statement_timeout=…")` makes EVERY connect fail; session GUCs must go per-txn via `SET LOCAL`. **Lesson: when a connection error hits 100% of attempts including fresh connects, reproduce the raw connect first — the transport itself may be refused, and no retry/pool logic helps.**

### Drift Monitor & `/compare-darklaunch`

- ⚠️ **STAMPLESS AGGREGATE COMPARE is now the live design (PR #291, merged + deployed to prod 2026-06-25).** The drift monitor **no longer row-joins on `odoo_id`** — the darklaunch order worker stamps NOTHING (every worker row is `odoo_id=NULL`, AUTO_INCREMENT `id`) and **queries Odoo zero times** (the fragile `_resolve_odoo_ids` call that aborted whole poll cycles is gone). The new comparer (`workers/darklaunch_drift/worker.py`) compares **aggregate signatures** — per-entity `COUNT`, `COUNT GROUP BY state`, `SUM(amount_untaxed)`, quant `SUM(quantity) GROUP BY (SKU, location_id)` — grouped on the **stampless `sw_id` bridge** (`Odoo.sale_order.sw_id = darklaunch.serp_sale_order.sw_id`, 100% populated both sides), windowed on **`sw_datetime`** (the original Laravel timestamp, the only non-diverging time anchor; `date_order`/`date_done` are replay-`now()`-derived). A **15-min settle window** (PR #296) excludes rows younger than 15 min so in-flight orders can't false-flag. Cron `0 6-18 * * 1-5`; Slack to `#jack-test`. **GENERATED** by `scripts/build_darklaunch_drift_n8n.py` — **do NOT hand-edit the JSON**; add suppressions to the Python.
- The legacy row-join `compare_odoo_replica.py` (column-by-column on `odoo_id`, `odoo_id IS NULL` rows filtered out) is **superseded** — with stamping off, every worker row is NULL, so a row-join would either go blind (skip the rows you care about) or report a false-MISSING flood. The aggregate compare was mandatory, not optional.
- **Most drift is EXPECTED** (don't chase): (1) windowed seeding (~5000 most-recent ids); (2) `odoo_only` post-seed writes; (3) SERP-origin `odoo_id IS NULL` rows; (4) ~6h datetime drift; (5) reservation timing (SERP reserves immediately, Odoo ~6h later); (6) `stock_quant` freshness gap. **The only signal that matters: column-level `settled values: diverge` on Odoo-origin rows.** By-design suppression list (`WORKER_ROW_DIVERGENT_COLUMNS`): `sale_order.name`, `date_order`/`sw_datetime`, `sale_order_line.sequence`.

### Odoo ↔ Laravel Sync (`sugarwish_integration`)

- Odoo **POLLS** Laravel REST on a **~6-min cron** for `oddo_synchronized=0` rows — **no webhook**. Polled: `GET /api/odoo`, `/api/odoo/pre-pick`, `/api/odoo/failed-ecard-orders`, `/api/odoo/failed-prepick-orders`. Odoo finds products by `sugarwish_id`, creates `sale.order` keyed `sw_id=ec_order.id`, confirms (phantom-BOM explosion → deducts inventory), POSTs back to `/update-order-passed` or `/update-order-failed`. `UNRESOLVED_GRACE_SECONDS` = 15 min.
- **CRITICAL RACE:** state changes between polling cycles (<6 min) can be **missed entirely**. n8n "Odoo Order Sync Integrity Monitor" (`bR4rEQjFI3GuwkiY`, hourly at `:20`) resets `oddo_synchronized=0`+`component_imported=0`+`items.odoo_sync=0` for orders missing from Odoo; **~8–9% miss rate per run**; posts to `#api-autofix`.

### Per-Row Odoo Sync Flags (misspelling intentional)

Column is **`oddo_synchronized`** (two d's, one o) — NOT `odoo_synchronized`.

| Flag                          | Values                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `oddo_synchronized`           | `0`=not synced, `1`=pushed, `3`=stuck (archived SKUs), `5`=error |
| `ship_date_odoo_synchronized` | `0`/`1`/`2` (shipment/ship-date sync, independent)               |
| `items.odoo_sync`             | `0`=needs sync, `2`=synced, `5`=bypass Odoo (vendor drop-ship)   |

### Product Bridge & Failed-Products Loop

- Bridge key: `product_template.sugarwish_id` ↔ `manage.components.odoo_id`/`buyer_products.odoo_id`. Synthetic id conventions: kit products = `'500'+buyer_products.id`; component/packaging = `'800'+components.id`. `components.odoo_id` is **fabricated** (`'800'+id` as string) — joining it to an Odoo PK silently matches wrong rows; de-reference `800611 → components.id 611 → product_product.id 28006`.
- **Failed Products email** fires when `sugarwish_id` not found in active Odoo products; causes: `product_product.active=false` or NULL `sugarwish_id`, or a Laravel endpoint missing the `inventory_source='odoo'` filter → loops every ~10 min. `inventory_source='serp'` items do NOT exist in Odoo (Odoo must skip serp lines; Laravel sends full payload).

### External Services

- **AvaTax (Avalara):** `ec_order.avatax_status`: `not-processed/processed/sent/skipped/adjusted/voided/cancelled/locked`. Manual retry: DELETE `avatax_items` rows + set `avatax_status='not-processed'`. Root cause usually bad user-entered address (free-text state field). Alerts → `#avalara-alert`.
- **Smarty (SmartyStreets):** paid metered (5k validations, bumped by Seth); rate-limit stalls fulfillment via `is_printed=3`; recovery = renew + reset `is_printed`.
- **USPS:** token array index-swap between auth and label workflows is a recurring label-failure cause (not USPS outages). Use `apis.usps.com` (not `api.usps.com`).
- **Vendor drop-ship:** routing code **`550`** = Vinebox → Shopify → vendor ShipStation (WCC's vinebox.com account). Drop-shipped SKUs bypass Odoo (`odoo_sync=5`). Wine needs ShipCompliant/address compliance.
- **Tango Card:** `tango_orders` maps `ec_order_id`→Tango; `receiver_products.tango_utid` = catalog link.

### Genies/Routers & Qdrant

- Genies source of truth = **sw-design** `genies/{setting_key}.json`, NOT WishDesk `system_settings`. Pipeline → `s3://…/genies-sync.json` → `POST /api/quiz-config/sync-genies` → upserts `system_settings`. **FULL-OVERWRITE per key** — direct edits to `system_settings` get wiped on next sync.
- **Qdrant collections:** `kb-v2` (Product KB → SWIM), `instructions`, `agent-chats`, `kb-internal`, `discoveries_swirl`, `org-knowledge`. Embeddings: OpenAI `text-embedding-3-small`.

---

## Business Rules & Workflows

### Two Warehouses & Fulfillment Routing

- SKU site from `receiver_products.location_id`; **anything not location_id 2 defaults to Englewood**. BOMs deduct from `ew/stock/fulfillment` (2008). Production-slip printing hard-gated to EW/TY only (`validate_slip_rows`, `ALLOWED_LOCATIONS`).
- **Custom branding (sleeve) OVERRIDES default location/vendor:** Bakery & Cafe / Custom Mug & Treats default TY → **EW if sleeve/merch attached**; Mini Popcorn default external (Poppin & Mixin) → **CityPop if sleeve attached**.
- Custom mug: production=TY, but **forecast usage attribution=EW** (Jack explicit, twice-corrected). Forecast location = first item's `location_id`. Mug+treats can split EW+TY → doubled shipping + manual tracking emails.

### Seasonality & Capacity

- **Peak #1:** December holiday (~Dec 3–20). Supplier buffer locked by ~week 40 (early Oct). **Peak #2:** EAD (Employee Appreciation Day) = first Friday of March. Mid-summer slowest. Large summer bulk needs 2–3 wk lead + extra staff. BofA-scale clients need ~90 days notice.

### Forecasting & Redemption Model

- Redemption curve (`retool.redemption_curve`): ~**82.3%** day 0, ~71% day 1, ~48% day 7, ~41% day 11. Unredeemed = no inventory consumed. Discount tier uses **~70% redemption assumption**.
- **Purchasing/reorder rule (Ric):** keep 4 weeks on hand + coverage until next PO lands. No outstanding PO = 4 wks + lead time; outstanding PO = 4 wks + time-to-oldest-PO; PO outstanding > normal lead = 4 wks only.
- **Variance formula (Matthew):** Starting Odoo count + all Odoo purchases − all Odoo sales = Projected Inventory; compare vs physical count.
- **SA vs RM layers:** `rm_quantity = rm_inventory / bom_quantity`; `total_inventory = rm_quantity + sa_inventory − unreserved_qty`; `total_days = total_inventory / daily_rate`. A SKU "requires packing" when `bom_quantity > 0`.
- **SA buildable runway limited by its OWN matching RM** (`SA-19-044-A` → `RM-19-044-A`, derived as `'RM'+sa_sku[2:]`). Summing all shared RMs/cartons **wildly inflates** inventory. **A carton does NOT count as an RM** for SA runout. Negative inventories are **acceptable/expected** — do NOT guard against them. Forecast at **parent-SKU granularity** (`_PREFIX_LEN=11`).

### SKU Naming, Suffixes & Classification

- **`-A` suffix** = standard/non-branded, Taylor (location_id 2). **`-E` suffix** = branded Englewood (location_id 1). Orders with a sleeve **must use `-E`**; non-branded **must use `-A`** (n8n hourly "SKU/branding mismatch" flag). `-A` and `-E` are the **same product** — roll up as ONE in forecasts. **"Move qty from `-A` to `-E`" (same location) = a PAIR of inventory adjustments, never a `stock_transfer`.** **ROUTING RULE:** attribute new products / historical sales to **`-E` rows**.
- **Product-line source of truth = `laravel_live.product_type`** (via `receiver_products`) + SA-NN- prefix number. **Odoo categories are inconsistent and must NOT be used.**

| product_type | Line             | product_type | Line                |
| ------------ | ---------------- | ------------ | ------------------- |
| 1/156        | Candy            | 25           | 12 Nights           |
| 2            | Popcorn          | 39           | Gourmet Pantry      |
| 3/45         | Cookies/Brownies | 51           | Gourmet Goods & Spa |
| 5            | Snacks           | 550          | Vinebox             |
| 6            | Dog Swag         | 10           | Wine Tastings       |
| 16/40        | Candles/Spa      | 14           | Wine                |
| 19/20        | Coffee/Tea       | 567          | Bakery & Cafe       |

- A `category` / `receiver_products.product_type` mismatch silently makes a product **non-orderable** despite stock + enabled (Retool alert + n8n daily ~7am MDT).
- **3-tier classification:** `sku_type` ∈ {`core`,`seasonal`,`legacy`}; `is_core` tinyint(1); `drop_level` int. `is_core` must equal `(sku_type=='core')`, enforced **only in app code** (`core_flag_for_sku_type`) — **NO DB trigger**, write both columns. Added Feb 2026 at Jason's request (~220 SA SKUs). SERP is canonical for classification; belongs on **parent SKUs only** (`parent_sku IS NULL`); propagates parent→child only in the **forecast READ pipeline**. Child SKU: `LEFT(sku,2) IN ('SA','FG')` AND >4 dash-segments.
- **Forecast simulation:** CORE = always replenished; SEASONAL/LEGACY run out and are NOT reordered — their demand redistributes onto surviving CORE SKUs in the same product_type. **Core 90% goal:** keep ≥90% of core SKUs live. `drop_level` = floor below which a SKU is disabled; `threshold` (~2× drop_level) = alert trigger. **Serpy writes `receiver_products` in `manage` DB** — must whitelist `sku_type`/`is_core` in `RECEIVER_PRODUCT_WRITABLE`.

### Live Availability & Auto-Disable

- Auto-disable when `actually_available − inventory_reservations ≤ drop_level`: sets `status='disabled'` + cascades to child SKUs (`inventory_link` = parent `product_id`). Runs ~1×/min (n8n). Pre-pick bypasses drop level. "Live choice" rule: `archive != 1` AND `status='enabled'` AND `deleted_at IS NULL` AND within date AND `(odoo_inventory − active reservations) > drop_level`. `drop_level` fallback = `feature_attributes` id=1 (`receiver-inventory-drop-level`, value **100**). Parent SKUs = length 11; children = first 11 chars + suffix. Ops lever: lower `drop_level` (often to 5 or 1), re-enable parent+child.

### Kits & BOMs — Three Parallel Independent Systems

A "replace X with Y" must touch all three:

| System                           | Owns                                              | SKU prefixes            | Key op                                                                          |
| -------------------------------- | ------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Laravel `kits`/`component_kits`  | Colored-box packaging                             | B-\*                    | `laravel_update_kit`; `buyer_products.default_kit`→`kits.id`; `components.hide` |
| SERP `serp_mrp_bom` phantom BOMs | Shippers, inserts, paper, cups, merch recipe keys | S-_, I-_, P-_, E-_/C-\* | `serp_update_kit`; `serp_find_kits_by_sku` (phantom only)                       |
| Odoo `mrp_bom`                   | Manufacturing recipes                             | RM-\*                   | —                                                                               |

- **CRITICAL id-namespace trap:** Laravel `kits.id` and SERP `serp_mrp_bom.id` collide numerically (e.g. 682 is a phantom-BOM id, NOT a `kits.id`). `serp_find_kits_by_sku` returns `serp_mrp_bom.id` wrongly passed as `kit_id` to `laravel_update_kit` → all ops fail.
- Swap = `remove_component(old)` + `add_component(new)` + `hide=1` old / `hide=0` new across all three. **Discontinue = ARCHIVE** (`product_product.active=false` / `components.hide=1`), never delete. New Serpy-created `receiver_products` default to `status='disabled'`, `archive=1` — must be manually enabled. Phantom BOMs **cannot** be created via Odoo API (UI only).
- After Apr 2026: Laravel sends items+box, Odoo adds shipper/insert/paper via phantom-BOM explosion; both together define a complete kit.

### Popcorn (special mechanism — read before touching)

- Popcorn flavors (`SA-02-*`) have **NO BOM**. Each flavor = a **$0 selection token** in Laravel only, **archived in Odoo**. Cost is on the **sticker SKU** (`L-B02-REG-23-0NN-COX`) + a 32oz cup. `receiver_products.product_id` = sticker's id; `/api/odoo` keys by `product_id` → resolves to costed sticker.
- **Do NOT fix COGS by adding a BOM or resolving by `product_sku`** — resolve by `product_id` (→ sticker). Popcorn is **vendor-fulfilled** (City Pop / Poppin & Mixin); orders should **NOT** contain merch/sleeves (WW-964). Approved divergence: `feature/popcorn-phantom-explode` flips ~48 `SA-02-*` BOMs `normal→phantom` in SERP local/darklaunch seed **only, NEVER in live Odoo** (`make_popcorn_boms_phantom()`). Popcorn forecast splits by vendor **CityPop vs Poppin** (no collapse).

### Kit Explosion Scope (SERP delivery path)

- Phantom BOM explosion scoped to **`items`-origin lines ONLY** (gift selections). `component_orders` lines (wine/flower/candy-box/buyer-product phantom kits) do **NOT** explode — prevents double-booking. Legacy Odoo: every `stock.move` has `bom_line_id=NULL` + `sale_line_id` (flat 1:1); kit expansion happens at order-build time. Newer SERP-driven Laravel flow (`insertComponentOrdersFromRecipeBom → SerpBomService`, gated by `hasMerchandise()`) uses SERP phantom BOMs.

### Sleeves, Branding & Custom Merch

- Sleeve chain: `proposals.details_json` → `branding_records` (`physical_branding`, `digital_branding`, approval flags, `print_render_status`) → `ec_order` (design via `giftcards_card` records, **NOT** a column on `ec_order`). To fulfill **without** sleeve: NULL `physical_branding`/`digital_branding`, approvals=0, `print_render_status='not_required'`, swap giftcards-card design, regenerate slip.
- Sleeves resolve by **`ec_order.size`** (= `buyer_products.id`) → `physical_branding.entries[].buyer_product_ids[]` keyed by box family (`box_sku`: `a_small`, `a_medium`, `c_medium`, `h_medium`). Multiple products in same box share ONE entry. **"Missing sleeve" bugs = `buyer_product_id` absent from the entry's array → fix = ADD the id, don't create a new entry.**
- `branding_records.review_status`: 0=unset, 1=needs review, 2=CS review, 3=approved. `accessory_images.review_status` (mug images): only 0/1/2 written — **no real "approved"** value; approval = "Choose Variant" → S3 + `review_status=0` + `original_print_image_url`. Mug images normalized to **720×720 px**. SWAC mug-image-review endpoints must carry **`isAgentOrAdmin`** (`agent` ≠ admin).
- `recipe_snapshot` lives in `ec_order.merchandise_selections → $.items[0].recipe_snapshot` + `branding_records.merchandise`. Key = `CONCAT(cube_size,'cube-bp', ec_order.size)`. **Livery does NOT read `recipe_snapshot`** — it uses `branding_records.physical_branding.entries[].box_sku` matched by `ec_order.size`.

### Billing, Cancellation & Discounts

- Default "undo" = **cancel-and-credit −10%** (credits 90% of gift value to corporate credit balance; within 1 year; not redeem-only). True money-back refund = "Refunds - Without Cancelation" Slack shortcut (rarer).
- **Redeem-only accounts:** pay 10% upfront, billed 90% on redemption; if cancelled before redemption, NOT eligible for 90% credit; cannot combine with HHS/PPS.
- Enterprise promo codes (`Enterprise5`/`8`/`15`) **do NOT work on pre-pick (preselect) orders** — billing applies discount manually. WishLinks: $2/link + redemptions; can now cancel-and-credit −10%.
- Revenue metric **"sales with sleeves"** = % of ecard value with sleeves ÷ total ecard value (NOT dollar value of sleeves).
- **Discount approval:** non-standard discounts require approval **before quoting** (`#enterprise`; escalate → Jason). Custom-box MOQ **1500 units** (8–10 wk lead); 1000–1500 units = +$250 setup. Annual price change coordinated by **Clare** via Slack List; **Caley** does bulk buyer-product updates by hand. Size names: Mini, Small, Medium, Large, X-large, Grand, Deluxe.

### Costing, Accounting & Manufacturing

- Costing source of truth = `stock_valuation_layer` / `serp_stock_valuation_layer`, NOT `standard_price`. **One JE per `stock.move`** (not per picking) — SERP creates+posts per-move in a loop; consolidating to one-JE-per-picking is **wrong**. **Manufactured quantity rule:** SERP MO sync uses **actual manufactured quantity**, never back-fills from BOM standard; use `bom_qty_ratio_historical` for past batches. Equivalency: candy=1, popcorn=0.5; cost-per-equivalent = dollars ÷ units (Ric corrected Jack 2026-04-03).

### Order Lifecycle, Slip Batching & Provenance Floors

- Odoo processes lifecycle **per-order, interleaved** — 6 `ir.cron` jobs (Orders/Prepicks/Component-orders/Component-prepicks/Failed-orders/Failed-prepicks, priorities 1–6, `numbercall=-1`) pull `GET /api/odoo?perPage=500`. **No per-order webhooks.** Order-id ranges: `sw_id < 600,000,000` = receiver/`ec_order`; `sw_id >= 600,000,000` = **preselect/wholesale** (bridge via `preselect_order_id`). Order-number prefixes: `200`/`2000`=receiver, `6000`=preselect.
- Production slip batch number = `COALESCE(MAX(production_slip_batch)+1, 900000001)`. `ec_order` UPDATE sets `is_printed=1`+batch+`batch_date`; `preselect_orders` has **NO `batch_date`** column. Only `is_pdf_generated=1` rows participate. `sw_fulfill=0` skips label requirement.
- Provenance floors: Jack's local Claude transcripts go back only to **2026-05-04**; EW warehouse launch floor **2026-05-19**.

### Wine (special case)

- **Wine should be marked NOT core** (~29 `product_type=10` + ~29 `type=14` were still core as of 2026-06-01, inflating the %). Wine uses a **CATEGORY-GOAL model** (target available-count per sub-category), keyed `'Category|product_type_id'` in `retool.operation_levels`. Wine = `receiver_products.product_type IN (10,14)` (exclude 25 '12 Nights', 550 'Vinebox'). Wine FC = `location_id 5` (WCC). Wine purchased as `SA-14-xxx` with **NO real BOM/RM**; `rm_ordered`=0 is **EXPECTED** (replenished via WCC gravity racks outside Odoo PO flow).

---

## n8n & Automations

Hosted at `n8n.sugarwish.com`. All post as bot "n8n" (`U08QP0DL9L5`); messages end `_Automated with this n8n workflow_`. Workflow JSON in `sw-cortex/workflows/n8n/`. **`active:false` in an export ≠ inactive in prod**; export IDs differ from live IDs — check `n8n.sugarwish.com` for actual state.

| Workflow                          | Export / Live ID                         | Schedule         | Action                                                                                                     |
| --------------------------------- | ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Daily Operations Message          | `dailyOpsMsg01` / `ZH5i32eGyRE6Zb1f`     | Daily 8 AM MT    | Posts "Daily Inventory Status Report" → `#live-product-warnings` `C084Z9EKDSL`                             |
| Operations Slack                  | `opsSlackWorkflow01`                     | Every 20 min     | Level-change alerts; **writes** `time_turned_*` to `operation_levels`                                      |
| Disable Unreserved Products       | `z3gsFEZ9Z0853Gj1` / `VRdmXlm2XTeRbOyT`  | Every 1 min      | Auto-disables SKUs with no real availability; **known deadlock source**; also the 330s "oversell" offender |
| Cost Tracker Weekly Average       | `costTrackerWeekly` / `8tETscs44BzY1f3J` | Mon 8 AM         | Posts "Weekly Cost Tracker Report" → `#ops-and-tech`                                                       |
| Odoo Order Sync Integrity Monitor | `bR4rEQjFI3GuwkiY`                       | hourly `:20`     | resets sync flags → `#api-autofix` `C088M68FD47`                                                           |
| Sheets Export (forecast → Retool) | `pLjFlQDc9kEeA8DG`                       | hourly           | → `#jack-test` `C083M27KU8L`                                                                               |
| Add Retool Incremental Tables     | `givRuaU8E7jawAGD`                       | daily midnight   | SKU/size sync → `#jack-test`                                                                               |
| Darklaunch Drift Monitor          | `HpHN9Reme3L6bNBd`/`IalsmpKBKbJM4LXg`    | `0 6-18 * * 1-5` | → `#jack-test`                                                                                             |
| Preselect Address Auto-Fixer      | `Zp59HJx19mly3lQ1`                       | —                | zip/state fixes → `#preselect-address-fixes` `C0A1F8FS6R0`                                                 |

- **Disable Unreserved — 3-factor formula (live-verified):** `final_available = Actually Available − SW Reserved (inventory_reservations.status='active') − Orders Not Imported (items.odoo_sync IN (0,1))`. SKU scope `default_code LIKE 'FG-%'/'SA-%'/'L-B02%'`, `sugarwish_id` 1–800,000. **NOT two separate ids** — `z3gsFEZ9Z0853Gj1` already contains the 3-factor formula (commit `d7bf45f`); the "2-factor older version" narrative is wrong.
- Inventory thresholds + days-below-threshold live in **Retool `operation_levels`**, computed from timestamps written by Ops Slack — NOT computed at report time. Sentinel-object guard: Code nodes return `{no_alerts:true}`/`{no_changes:true}` to prevent empty alerts.
- **n8n sanctioned production writes are intentional** (not read-only violations): `UPDATE receiver_products SET status='disabled'`; UPDATE sync flags on `items`/`ec_order`/`preselect_orders`.
- Credentials: `sw_live_creds` (MySQL live), `Retool` (PG), `Odoo_read` (PG read replica), `Slack account`. "Live Darklaunch DB" creds = `serp_test` MySQL.

---

## How Jack Works (Tools & Preferences)

### Jack's Working Preferences (read first)

- **Minimal, additive change.** Extend existing pages/tabs/structures; never create new ones. Do exactly what's asked.
- **Advisory by default for anything risky or data-related.** Surface SQL / diffs / full new-file contents as TEXT; let Jack apply. "ok I updated the projections" = he already applied it (NOT a request).
- **Never edit `.env`/secrets directly.** State the diff. **Never execute production DB writes** — surface SQL only.
- **Fix in the seeder, not via direct DB edits.** Local replica/darklaunch data is **disposable** — reseed, never `UPDATE` to fix drift.
- **Read-only drift/diff tools must be strictly read-only against live.**
- **Verify before claiming done** — confirm the data path actually changed (right pipeline? page refreshed? table populated?).
- **Root-cause only, TDD.** "NO WORKAROUNDS — FIX THE ROOT CAUSE"; write a failing test first.
- **Strictly-scoped commits.** Never `git add -A`. **`git stash` is FORBIDDEN** in all repos (caused a silent 4-hunk drop). Never commit/push without explicit per-action permission. Never work directly on the integration branch.
- **Stop immediately when Jack takes over / says "nevermind."**

### Git & Deploy (per-repo — NOT uniform)

| Repo                  | Branch off    | Promotion                                             | Deploy                                                                   |
| --------------------- | ------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| **SERP**              | `dev`         | feature → `dev` → `main`                              | **MANUAL** `deploy-k8s.sh main` over SSH (Hetzner K3s) — NOT auto-deploy |
| **SWAC/WishDesk**     | `development` | `development` → `staging` → `live`                    | Parish runs promotions                                                   |
| **sugarwish-laravel** | `development` | feature (`SUG-*`/`WW-*`) → `manage` → `blue` → `main` | Jenkins jobs for `manage`/`blue`/`live`; live runs manually              |
| **sugarwish-odoo**    | —             | `staging_new` → `main`                                | —                                                                        |

- `blue` = **integration branch**, NOT production (`main` is). `WW-*` tickets are NOT SWAC-exclusive; `SUG-*` is NOT Laravel-only — both span repos. `/pr-to-blue` (renamed from `/merge-to-blue`). June 2026 renamed `ww-*` slash commands to `sw-*` (**command-prefix only — WW-\* ticket prefix unchanged**).
- **SWAC and Laravel intentionally bundle multiple unrelated features per branch/PR — do NOT suggest splitting.**

### SERP Env Flags (independent switches)

| Flag                              | Gates                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `SERP_DARKLAUNCH_ENABLED`         | Darklaunch Odoo-mirroring writes                              |
| `SERP_SHADOW_WRITES_ENABLED`      | Shadow/prod-traffic validation (distinct from darklaunch)     |
| `ORDER_MANAGEMENT_WRITES_ENABLED` | Prod writes from Order Management page                        |
| `ORDER_QUEUE_WORKER_ENABLED`      | Merchandise order queue worker                                |
| `PACK_TOMORROW_ENABLED`           | Pack-tomorrow feature                                         |
| `ODOO_ID_STAMP_ENABLED`           | odoo_id stamping (off → no Odoo DB/XML-RPC during processing) |

Removed/legacy: `USE_SERP_AS_LIVE`, `USE_MOCK_ODOO` (keep `LIVE_SSH_*`). `ODOO_SOURCED_ORDERS_ENABLED` was consolidated into `SERP_DARKLAUNCH_ENABLED` — treat standalone references as legacy.

### SERP Test & Local-DB Rules

- Tests may **write to exactly ONE DB: `serp_test`** — NOT Retool, NOT `manage`. Serpy/queue tests that update Odoo run against **staging Odoo**.
- `mcp__python__run_python` is the **required** way to run Python validation — never `./venv/bin/python -c`. Always verify table structure with **live MCP queries**, not schema files.
- To align ORM with Odoo: `curl https://raw.githubusercontent.com/odoo/odoo/15.0/addons/<module>/models/<file>.py`, quote the matching method, write a **failing test first**, then fix citing line numbers.
- 4 local DBs rebuilt together via `npm run db:seed` (wipes + reseeds). `npm run db:pull` (~2m) only when `manage` schema changes. Seeder **caps windowed tables** (`account_move`, `stock_move_line`) at latest 5–10k ids — "nothing compared" in drift reports is **by design**. **`APP_ENV` must be `local`** for safe seeding. Seed order: Odoo first → APPEND SERP-native tables (phantom kits). Each table wiped between seeds.

### The Three "Wish" Systems (do NOT conflate)

| System        | What it is                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **WishDesk**  | CS ticketing/CRM at `desk.sugarwish.com` (built on SWAC); has `swcrm_z_gmail_*` Gmail tables                        |
| **WishWorks** | Internal dev bug/feature tracker (`WW-####`) at `desk.sugarwish.com/admin/wishworks/tickets`; introduced 2026-03-12 |
| **SWIRL**     | Company-wide knowledge repo + "SWIRL Bot" Slack DM                                                                  |

**WishBot** (`U0AHZK4FDSA`): DM or tag in a thread (not main channel) to create a WW ticket. Ticket **TRACK** routes to the codebase/team (`laravel`/`wishdesk`/`retool`/`react-receiver`/`react/proposals`) — wrong track = wrong team. `/ww` slash command **self-updates** from `jasonbkiefer/SWIRL` on each invocation (must re-read the freshly-downloaded file).

### sw-cortex (Jack's Personal Tooling — NOT production)

- Personal work-intelligence platform. MCP servers: db (read-only), slack-search (Qdrant, encrypted), knowledge (semantic search over `DICTIONARY.md`), jack-slack (Slack post/read), logs, github. `~/.mcp.json` runs via `npx tsx` — **no build step but requires Claude Code restart after editing `.ts`**.
- 30s query timeout (MySQL `max_execution_time=30000`; PG `statement_timeout=30000`; plus JS `Promise.race`). **`limit` param caps RESULT ROWS only** — does NOT stop a slow scan. `query_database_from_file` requires file under `~/Desktop/Projects` (override `MCP_DB_ALLOWED_DIRS`).
- `jack-slack` MCP posts as "jackbot" (uses `JACK_SLACK_BOT_TOKEN`, a Bot token not user token; bot must be invited to the channel).
- **The discoveries feature is removed.** There is no `add_discovery`/`mcp__discoveries__*` server and no `.claude/rules/db-discoveries.md` rule. Institutional knowledge now lives in this file (`DICTIONARY.md`) and is searched via the `knowledge` MCP (`mcp__knowledge__search_knowledge`); `/refresh-knowledge` distills new learnings into it.
- **Org-wide shared AI tooling (livery + SWIRL):** livery ships read-only MCP servers (`mcp-db-tool-live` with SQL keyword-blocklist + timeouts + SQLite audit log, `mcp-slack`, `mcp-wishdesk` stdio→HTTP proxy, `swim-kb` Qdrant). On the primary dev machine, live RDS / WishDesk require SSH tunnels first (live RDS → `localhost:13306`, WishDesk → `localhost:3001`). SWIRL is **symlinked** (not submoduled) into SWAC/Laravel/sw-design.

### Operational Alerting & Error Channels

| Channel / var                       | ID            | Use                                                                                             |
| ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `#serp-planning`                    | `C0ADCHKB9QQ` | Strategy/timeline                                                                               |
| `#serp-bugs-features`               | `C0986P364BC` | SERP testing/bugs                                                                               |
| `#serp-errors`                      | `C0B1SSZSV8W` | SERP worker/runtime errors; SERPY draft-sync results                                            |
| `#jack-test`                        | `C083M27KU8L` | SERPY/SERP-500 errors + **automated darklaunch reconciliation reports** — NOT a scratch channel |
| `#inventorymanagement`              | `C03G8LP36P6` | SERPY draft approval + Odoo/Laravel firefighting                                                |
| `#ops-and-tech`                     | `C025KEUDK99` | Inventory source-of-truth rules + weekly cost report                                            |
| `#api-autofix`                      | `C088M68FD47` | Self-healing workflows only — **informational, no action needed** (Seth standing instruction)   |
| `#odoo-prixite`                     | `C07QRF6MHD4` | Odoo vendor work                                                                                |
| `SLACK_INVENTORY_CHANNEL`           | `C0A19EW6RU3` | Inventory alerts                                                                                |
| `expiration_alert_slack_channel_id` | `C0A3ERYUGG1` | Expiration alerts                                                                               |
| `WISHLINK_PREPICK_SLACK`            | `C097SRFM85D` | Proposal approval                                                                               |

- **Order retry gotcha:** `order_dispatch_logs.status` must be `failed` for Retry to fire — any other status = silent no-op (manually UPDATE to `failed` first).
- Most `:rotating_light:` alerts in `#api-warnings`/`#avalara-alert`/`#live-product-warnings`/`#address-error` are routine auto-resolved noise. **"Fixed" rarely means root-caused** — usually a one-off data patch for one customer. `#low-nps-scores` is a **reference/learning channel**, not a resolution channel (every detractor NPS auto-generates a ticket; surveys go to **recipients**, not buyers).

### Dev Fixtures & Credentials

| Item                       | Value                                | Notes                          |
| -------------------------- | ------------------------------------ | ------------------------------ |
| SWAC/WishDesk dev login    | `admin` / `swdev123`                 | Non-secret fixture, `/auth`    |
| SERP prod nginx Basic Auth | `serp_admin` / `swserp12`            | Browser-cached HTTP Basic gate |
| SERP local login           | `jack@sugarwish.com` / `localdev123` | local dev                      |

---

## Gotchas & Footguns

### "Orders" Means Three Different Things

| Table                            | Purpose                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `wishdesk.orders_tickets`        | CS support tickets **about** orders (~411 rows, all `CLOSED`) — NOT the orders themselves |
| `retool.orders`                  | Actual e-commerce orders (~250k+), mirroring SugarWish/Laravel                            |
| `wishdesk.orders_monthly_orders` | Managed-gifting / recurring-order planner (year-grid)                                     |

### "Reserved" and `move_type` — Same Name, Different Meaning

- **Odoo `reserved`** = `stock_quant.reserved_quantity`. **Laravel `reserved`** = a large order sitting in the buyer's **CART**. Unrelated.
- `stock_picking.move_type`: shipping **policy** (`one` ship-complete vs `direct` allow-backorders). `account_move.move_type`: accounting **document type** (`entry`/`in_invoice`/`out_invoice`). Same column name, different meaning.

### `ec_order` Footguns

- `receiver_orders` is NOT the shipment table (`ec_order` is). `ec_order.size` is MISNAMED (= `buyer_products.id`). `buyer_orders.product_sku` is free-text — use `ec_order` for attribution. `ec_order` triggers have huge blast radius (Munyr can disable).

### Core Inventory Structural Problems

- **Single-location limitation:** Laravel can only pull available inventory from ONE Odoo stock location; nearly all SKUs stored under `ew/stock/fulfillment` even when physically in TY — Odoo cannot distinguish EW vs TY.
- **Off-site vendor stock is invisible** (vendors hold cartons/slips/stickers, ship in as POs land; Mike infers by subtraction). **No inventory snapshot-in-time mechanism** — cannot prove systems matched at a point in time, complicating reconciliation/cutover. **Leadership distrusts Odoo inventory** (default: Odoo is wrong, not the forecast).
- **Outer-shipper stockouts** (corrugated mailing boxes: 2/4/8/12-pick, grand, mini) HOLD shopped orders until a pallet arrives.
- **Negative inventory / oversell:** Laravel holds qty for orders not yet imported to Odoo → Odoo never reserves/subtracts → caches stagnant; when order ships fast, inventory never deducted. Team resolves "reserved negatives" manually daily; workaround: nudge Odoo on-hand by 1, apply, revert.

### Laravel ↔ Odoo Sync Bugs

- Archiving/disabling a SKU on one side without the other breaks SERPY sync. Inventory added to Odoo **before** the SKU exists in Laravel never gets picked up. Orders stuck at `oddo_synchronized=3` reference archived/disabled SKUs. Common root cause: matching Odoo `product_product.active=false` (archived variant) while the template stays active.

### Duplicate Charges & Orders

- Stripe charge with no order / duplicate charge = known race (WW-798, WW-1085); the daily detection n8n job has silently failed without alerts. Checkout add-to-cart race: a hardcoded **2-second `setTimeout`** between `/buyer/recipient-info` and `/buyer/add-to-cart` silently drops the cart item if the session write is slow. Duplicate orders are frequently **backend system-generated** (queue/dispatch re-fires), not double-clicks — check `order_queue_batches`/dispatch logs (one order shipped 24× in ShipStation).

### Custom Mug / Sleeve / Branding Print Files

- Mug print image source = **`ec_order.merchandise_selections.items[N].design_selected.print_image_url`** (matched by `item_id` to `branding_records.merchandise.items[N]`) — **NOT** `branding_records.merchandise.items[0].designs[0]…`. If `ec_order`'s `design_selected` is NULL, patching the branding record alone does NOT fix the PDF.
- Print files silently fall back to low-res: `ENABLE_BRANDING_RENDER_CRON` never set in live `.env` → `print_url=null` → 50 DPI JPEG fallback (`s3_url`). Livery: `renderUrl = render.print_url || render.s3_url`.
- **Two box-SKU vocabularies — do NOT cross-map:** RECIPE boxes (`merchandise_packaging_recipes` / `recipe_snapshot.outer_box_sku`): `c_1`, `c_1.25`, `c_1.5`, `c_2`, `c_3`, `c_4`. LIVERY/SLEEVE boxes (`branding_records.physical_branding`): `a_mini`, `a_small`, `a_medium`, `a_large`, `a_xlarge`, `c_1`, `c_small`, `h_small`. (`c_1` ≠ `c_small` — a real bug class.)
- **Fixing data in SWAC does NOT regenerate Livery's cached PDFs** — they're cached at `{batch}/{orderId}_sleeve.pdf`. To pick up a fix: click **"Regenerate"** (`POST /reset-status/:orderId`), then re-run `generate-batch`. Dashboard cell falls back to `all[0]` (looks fine) but the print path throws "no sleeve entries."
- **5 distinct "no sleeve / wrong sleeve" root causes:** (a) `buyer_product_id` duplicated across two box entries → 2 sleeves; (b) `box_sku` not in `SKU_TRIM_TABLE` (e.g. `h_*`) → `normalizeSkuKey` throws → whole PDF aborts; (c) missing size entry; (d) NULL `physical_branding`; (e) `design_box_override`-only ghost rows.

### SERP / Darklaunch Footguns

- **Timezone (~6h offset is BY DESIGN):** SERP/darklaunch stores **naive Mountain Time** (America/Denver); Odoo PG stores **naive UTC**. Every comparison MUST convert Denver wall-clock to UTC accounting for DST (−7h MST / −6h MDT). Seeding incident: a laptop in Eastern stamped `darklaunch_cutover_at` 2h off, creating a dead zone — always use the time of the Odoo prod seed, NOT laptop-local `NOW()`.
- **Dual-write failure modes:** `stock_picking` stuck in `confirmed`/`assigned` (expected `done`) usually = (1) `sugarwish_integration` overrides `button_validate` calling private `_action_done` (blocked over XML-RPC); (2) `put_product_qty` wizard → empty API → `JSONDecodeError`; (3) **UoM mismatch** (sync sends `uom_id=1` Units but product is `lb`) — look up the product's real `uom_id` first. SERP = atomic upsert; Laravel = SELECT-then-UPDATE → cross-system oversell risk during parallel run.
- **Worker / picking creation:** `action_confirm` does **NOT** create a picking (permanent divergence). The darklaunch worker is the **SINGLE** picking creator (`action_process_new_order`) — adding a second creator on `action_confirm` produces two pickings. Intentionally omitted: no `procurement.group`, no lot/serial, no package/owner tracking, no `ir.model.data`/`env.ref()`, chatter only on document-level models.

### Other Footguns

- **Odoo BOMs/quants:** "we don't use Odoo phantom BOMs anymore." Phantom BOMs **cannot** be created via the Odoo API (UI only). Inventory corrections = inventory adjustments, not phantom-BOM consumption. SERP's own phantom-BOM concept is separate.
- **Odoo.sh 330s timeout:** prod Odoo has a 330-second statement timeout. `NOT IN`/`!=`/`<>` on indexed columns of multi-million-row tables → seq scan → exceeds 330s. Use positive `IN`-lists. Known offender: n8n `VRdmXlm2XTeRbOyT` ("oversell"). Check `odoo.log` for "reaching the timeout limit of 330.0 seconds."
- **FastAPI serialization:** `response_model` **silently strips** fields not in the Pydantic schema (SERP has `ForecastItem` vs `ForecastItemSchema` — fields added to one but not the other vanish). Raw-dict endpoints with NO `response_model` serialize `Decimal` as a JSON **string** → frontend `.toFixed()` throws; fix with `float()` at the converter.
- **Forecast data sources:** projections always read from **`size_projections_copy`** (not `size_projections`). `product_type_key` (PTK) = `'ProductType|Size'`; dashboard and `sa_projections.sql` MUST produce identical PTK strings. Three non-interchangeable "days of inventory" metrics: SA Days / Total Days (`/forecast/live-products`, last-7-day basis), supplier `total_inventory` (`/forecast/dashboard`, 25-week forecast), ecard days-to-90% (`/forecast/ecard-inventory`, simulation). **`/forecast/throughput`** (`backend/services/fulfillment_throughput.py`) = per-day **production/packing** counts, read from **live Odoo**, bucketed by `DATE(COALESCE(mp.date_finished, write_date, date_start, create_date))` — effectively `DATE(date_finished)` for any done MO. Feeds a **per-period packing bonus** (`fulfillment_throughput_bonus.py`). Because `date_finished` defaults to when the MO is marked done (not when it was physically packed), late-entered slips land on the wrong day — see the `mrp_production` `date_finished` footgun.
- **April 2026 — BOM/kit expansion moved out of Odoo:** Jack intentionally moved expansion into Laravel/SERP; Odoo now receives pre-expanded component items. Buyer-product/packaging info **disappeared from Odoo sale orders** (~2026-04-16) — pull from **`component_orders`** in Laravel instead.
- **SSH tunnels:** remote prod DBs (live Laravel, WishDesk) only reachable through a bastion-host SSH tunnel. `paramiko` removed `DSSKey` → switch tunnel library to **ssh2 / ssh2-python**.
- **`receiver_products.product_id`** is the SugarWish product id, **NOT** Odoo `product_id`.

---

## Terminology / Glossary

**Business model:** corporate/personal gifting. Buyer sends an **eCard** → **recipient** clicks through and **chooses their own gift** → ships to their door. The recipient (not buyer) picks the SKU at redemption. Catalog: candy, snacks, cookies, popcorn, eCards, flowers, custom mugs/merch, custom-branded merchandise — not candy-only.

**Warehouse jargon:** "**shop**" (verb) = warehouse pick/pack a gift order (NOT browsing). "**pick**" (noun) = treat count in a size (2/4/6/8/12/16-pick → box/shipper size). "**shopped and shipped**" = packed and sent.

**Gift sizes (ascending price):** Mini → Small → Medium → Large → X-large → Grand → Deluxe.

### SKU Prefix Taxonomy

`default_code` (Odoo) / `sku` (Laravel) prefixes:

| Prefix                                  | Meaning                                                            | System       |
| --------------------------------------- | ------------------------------------------------------------------ | ------------ |
| `RM-`                                   | Raw Material (bulk, received via POs)                              | Odoo BOMs    |
| `SA-`                                   | Sub-Assembly / saleable finished good; has Odoo BOM                | Odoo BOMs    |
| `FG-`                                   | Finished-Goods kit (sellable receiver product)                     | Odoo BOMs    |
| `C-`/`E-`                               | Cartons/containers/cups/packaging                                  | —            |
| `S-`                                    | Shippers/outer boxes                                               | Laravel kits |
| `B-`                                    | Box components                                                     | Laravel kits |
| `I-`                                    | Inserts                                                            | —            |
| `L-`                                    | Labels/stickers                                                    | —            |
| `M-`/`M-CCC-`/`M-CEW-`                  | Mug/merchandise                                                    | SERP-tracked |
| `VB-`/`V-`                              | Wine/bottles                                                       | —            |
| lowercase words / `h_*` / `a_*` / `c_*` | Saleable kit/category/sleeve box-size products (often phantom-BOM) | —            |

- **Numeric middle segment = product line:** `01`/`156`=candy, `02`=popcorn, `03`=cookies, `10`/`14`=wine, `19`=coffee, `20`=tea, `21`=cocoa, `40`=socks/merch, `45`=brownies.
- **Box SKU token order:** `[type][product-letter]-REG-[YEAR]-[color]-[size]`. **YEAR token is critical** — boxes get re-versioned (`REG-22` → `REG-25`); BOMs must be swapped when ops switches.
- RM → SA via Manufacturing Order (one RM + one carton → SA). `WW-###`/`SUG-###` = Jira ticket prefixes (unrelated to SKUs). `swcrm_`/`ec_`/`component_` = table prefixes (unrelated).

### `sugarwish_id` / `odoo_id` Prefix Encoding

`product_template.sugarwish_id` bridges Odoo product → Laravel:

| Prefix     | Maps to                          | Resolution                                         |
| ---------- | -------------------------------- | -------------------------------------------------- |
| `800`      | Laravel `components` row         | Strip `800` → `components.id` (`8002578` → `2578`) |
| `500`      | `buyer_products` row             | —                                                  |
| plain int  | `receiver_products.product_id`   | —                                                  |
| `0`/`NULL` | No SW mapping (~1,371 templates) | —                                                  |

`components.odoo_id` is **fabricated** (`'800'+components.id` as string) — NOT a real Odoo product id.

**Odoo-tracked vs SERP-tracked:** SERP-tracked = custom-branded merch (mugs, t-shirts) — lives entirely in SERP's own `stock_quant`/`stock_move`/`buyer_orders` infra, **never in Odoo**; processed via `component_orders` that bypass the kit system.

### Kits, BOMs, Recipes

- **kit** = **phantom BOM** (`mrp_bom.type='phantom'`), also called "recipe" — auto-explodes into component lines on sale/delivery. **normal BOM** = manufacturing BOM, reduced only via manual MO, does NOT auto-explode. `serp_mrp_bom.type` = ENUM(`normal`,`phantom`) (no third value).
- **Recipe key** (`erecipe`/`recipe`, e.g. `1cube-bp6978`) = lookup key for a packaging config in `merchandise_packaging_recipes`, snapshotted onto orders as `ec_order.merchandise_selections` JSON → `recipe_snapshot.recipe_key`/`outer_box_sku`. Composition driven by recipe key → `mrp.bom` → `serp_product_product`, NOT order rows.
- **Multiple kit sources can disagree:** Laravel `kits`/`component_kits`, SERP phantom BOM, Odoo `mrp_bom`. The box that ships often comes from the SERP phantom BOM while the Laravel kit is empty. SERP UI: `serp.sugarwish.com/kits`.

### Order Lifecycle Tables

| Table              | Purpose                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `giftcards_card`   | eCard before redemption; source of truth for sender/receiver email              |
| `ec_order`         | Redeemed receiver order (one shipment); `size` = `buyer_products.id` (MISNAMED) |
| `items`            | Recipient's chosen flavors (one row per flavor)                                 |
| `preselect_orders` | Buyer pre-selects contents + recipient address                                  |
| `component_orders` | Box/packaging component lines; `inventory_source` = `odoo`/`serp`               |

- **Preselect / Pre-pick:** buyer chooses recipient's flavors up front (vs standard eCard where recipient chooses). Often bulk B2B. Bypasses cart and drop-level; promo codes do NOT apply; buyer enters recipient's address; ship-dated prepicks prioritized over FIFO. Disabled site-wide Oct 2021 (caused majority of stockouts despite <4% of sales); later relaunched.
- **WishLink:** shareable redemption link (`giftcards_card.delivery_method='wishlink'`). $2.50/card OR 10%-down + charge-on-redemption. Single-Use or Multi-Use. Prefer `delivery_method` over `is_wishlink`.
- **Prepay programs:** **HHS** = Holiday Head Start; **PPS** = Pre-Pay/budgeted prepay. Client pre-pays a lump sum → tiered bonus credit (~18% effective vs 15% standard large-order discount). Triggers/renews **"SugarWish Premium"** status.
- **Custom Shoppe / Custom Shop** = custom-branded-product storefront (logo'd mugs, merch). Own Retool Location. Team: Sophie + Neal. Generates custom-shop PDF + sleeve PDF.

### Warehouse Locations & Forecasting Terms

- **EW** = Englewood, CO (`location_id 1`, suffix `-E`); **TY** = Taylor, MI (`location_id 2`, suffix `-A`). Stored in legacy `locations` table — **no FK** to Odoo `serp_stock_location`. **Bakery & Cafe** (`product_type 567`) is split in SERP forecast: `Bakery&Cafe@EW`/`@TY` (driven by `product_type` + `location_id` of the **first item** in order). Picking name prefixes: `EW/OUT`/`EW/IN`/`EW/MO`/`EW/INT`; worker-created outbound named `EW/OUT/%` origin `RO-%`/`PSO-%`.
- **Forecasting RM vs SA vs Carton:** SA runout depends only on its own RMs (not cartons); `total_inventory` is per-RM-row. Forecast color codes (`/forecast/live-products`): **GREEN** = inventory available; **ORANGE** = SA (manufactured) runs out but RM remains; **YELLOW** = on-hand runs out but incoming PO not arrived; **RED** = all inventory runs out.
- **Popcorn phantom explode:** `feature/popcorn-phantom-explode` flips ~48 `SA-02-*` BOMs `normal→phantom` in SERP seed only. Popcorn forecast splits by vendor **CityPop vs Poppin** (no collapse).

### System Acronyms

- **SERP** = Jack's in-house ERP replacing Odoo 15. **SERPY** = SERP's AI ops agent (Slack bot). **Darklaunch** = SERP's dual-write shadow processing (writes only into local `serp_*_darklaunch`, never prod; validated by `/compare-darklaunch`; UNRELATED to feature-flag/canary darklaunches).
- **manage** / `manage.sugarwish.com` = SugarWish Laravel admin/management app + DB; serves as the dev/staging SugarWish DB AND the staging SERP schema source. "Test on manage" = the Laravel manage staging environment.
- **Livery / SWOP** = "Sugarwish Operations Platform" (`csloan-sw/livery`, Cris Sloan) — print/image-rendering for branded products + MCP-tooling backbone. **SWIRL** = Jason's org-wide knowledge platform; **SWIM** = WishDesk-embedded AI chatbot. Both separate from sw-cortex.
- **SWAC** = WishDesk (the GitHub description "SugarWish Activity Coordinator" is misleading).

# Discoveries Knowledge Base

This document is a distillation of all **2,196 records** in the `discoveries_encrypted`
knowledge base — the accumulated institutional memory an AI assistant can't reconstruct
from schemas, repo names, or org charts. It covers how **SugarWish** (a corporate-gifting
company) wires its systems together (Odoo, Laravel, SERP, WishDesk/SWAC, Retool, darklaunch,
Serpy, n8n), who the real people are and what they own, and — most importantly — where the
obvious-looking inference is the wrong one. Treat it as ground truth that overrides naming
conventions, default-branch guesses, and "sensible" assumptions.

**The user is Jack Kiefer** — SugarWish's Solutions Engineer and sole owner/developer of
**SERP**, the in-house ERP being built to replace Odoo. Most of what follows exists because
it tripped up a previous assistant.

> Generated from `discoveries_encrypted` (2,196 records: 998 fact / 481 insight / 286 anomaly
> / 269 pattern / 148 relationship / 14 optimization). The richest source databases are
> `odoo` (455), `sugarwish` (135), `retool` (108), `laravel` (100), `wishdesk` (54).

---

## TL;DR — Read This First

The 22 highest-value, most counter-intuitive facts. If you internalize nothing else, internalize these.

1. **Source of truth is split PER-ENTITY, not global.** Odoo owns normal BOMs/MOs/products/POs (SERP writes back via `odoo_sync_queue` → XML-RPC); phantom kits are SERP-owned (`serp_mrp_bom` type='phantom'); `receiver_products`/`component_kits` are Laravel-owned (Serpy writes the `manage` MySQL). No single sync direction.
2. **Inventory truth is also split:** Odoo is canonical for on-hand/available and is the ONLY home of **RM (raw-material) inventory**; **Laravel** is source of truth for what's _available to sell_ (it deducts pending orders Odoo can't see).
3. **The legacy Laravel↔Odoo sync is PULL-based, not push.** Odoo crons authenticate to Laravel's `/api/odoo/*` endpoints and pull unsynced orders. Laravel has **no XML-RPC client**. SERP's dual-write XML-RPC capability is NEW and being built.
4. **Never join SERP↔Odoo on `id = id`. Always join on the `odoo_id` column.** `id` and the Odoo id diverge after finalize. The durable SERP-origin test is **`odoo_id IS NULL`**, NOT any `id >= 1_000_000_000` range.
5. **The Odoo sync flag column is literally misspelled `oddo_synchronized`** in the SugarWish/Laravel tables. Match the typo exactly.
6. **`stock_move`/`serp_stock_move` `state` is a POSITIVE enum** (`draft,confirmed,waiting,partially_available,assigned,done,cancel`). `assigned` = stock RESERVED/ready-to-pick, **NOT shipped**; `done` is the only state that actually moved inventory.
7. **PERF FOOTGUN:** never filter `stock_move.state` with a NEGATED predicate (`NOT IN ('done','cancel')`) on the ~15.8M-row table — it forces a seq scan and times out. Use the POSITIVE list.
8. **`stock_picking.state`** is the Odoo picking lifecycle, NOT a payment/order status. `assigned`=reserved/ready, `done`=actually shipped.
9. **SERP does NOT auto-deploy.** GitHub Actions CI runs on push but does NOT deploy. Deploy is a manual SSH step on the Hetzner K3s node: `ssh jack@5.161.95.56 'cd /opt/SERP && bash deploy-k8s.sh main'`. A merge to `main` is not live until that runs. (The old AWS `ssh ubuntu@34.203.231.65 ... bash deploy.sh` path is frozen legacy — not the deploy target.)
10. **`laravel_live` is NOT "the SERP database"** — it's SugarWish's PRODUCTION Laravel e-commerce DB. The real live darklaunch mirror is MySQL `serp_test` on Hetzner (`5.161.233.240`); the name "test" is a lie — it's the most-current copy.
11. **`*_replica` vs `*_darklaunch` are opposites:** replica = clean sparse pure-Laravel mirror with ZERO Odoo data; darklaunch = the full live Odoo-MERGED dataset the worker writes. Never swap the names.
12. **Jason Kiefer ≠ Jack Kiefer.** Jason = Founder/CEO (Jack's dad, `jasonbkiefer` org); Jack = the SERP developer (the user, `Jack-Kiefer` org). Major design decisions route through Jason.
13. **"Anna Kifer" is spelled with ONE e** (not "Kiefer"), is a separate person, and is Director of Software Development & QA — dev PM, QA gate, Prixite liaison, SERP sponsor.
14. **Two Madisons:** Madison Parks (SWAC/WishDesk developer) ≠ Madison Meilinger (CS/ops lead). Never merge them.
15. **Serpy is an AI ops agent (a Slack bot), not a typo for SERP and not a human.** SERPY Slack messages are bot-authored.
16. **Retool is a SHARED multi-app PostgreSQL DB, not SERP's database**, and several finance tables (`quickbooks_dashboard`, `stripe_dashboard`, `mock_*`, etc.) are stale mock/demo data, not live sources.
17. **Retool environment separation is by table-name SUFFIX, not separate DBs:** `_live` = prod, `_dev`/base = local (e.g. `odoo_sync_queue` / `_dev` / `_live`). `_live` tables hold the real high-row-count data.
18. **SERP auth is dual-system, matched by EMAIL not ID:** identity/passwords live in Retool PG `serp_users` (now a 4-col bridge; old cols in `_backup_serp_users`); roles live in MySQL ORM (`serp_res_users`/`serp_res_groups`), bridged lazily per login.
19. **WishDesk is downstream, not a source.** Chain: WishDesk → reads → Sugarwish DB ← syncs ← Laravel API ← polls ← Odoo. WishDesk stores only ids + cached snapshots.
20. **SERP is a deliberate from-scratch clone of Odoo 15's ORM held to line-by-line parity.** Divergences are bugs to fix against Odoo 15 source, NOT "best-practice" refactors.
21. **Darklaunch is a dual-write VALIDATION/reconciliation system** that writes ONLY to a replica DB (never live Odoo/main SERP), gated on <1% drift as the cutover-readiness signal. It is not a feature-flag library, and SERP has NOT yet replaced Odoo.
22. **The word "orders" means (at least) three different things** (eCard `ec_order`, receiver/preselect orders, merch `component_orders`) and **"reserved"/`move_type`** mean different things in different systems — disambiguate before querying.

---

## Who's Who — Roles, Org & Who Owns What

### ⚠️ Spelling & Identity Footguns (read first)

- ❌ **AI assumes "Kifer" and "Kiefer" are the same person / a typo** → ✅ **Reality: TWO distinct surnames, both real.** **Jack Kiefer** (founder's son, SERP dev) and **Jason Kiefer** (Founder/CEO, Jack's father) are spelled **Kiefer**. **Anna Kifer** (Director of Software Dev & QA) is spelled **Kifer** — no second "e". Keep them distinct.
- ❌ **AI assumes there is one "Madison"** → ✅ **Reality: two different Madisons.** **Madison Parks** is a SWAC/WishDesk _developer_; **Madison Meilinger** is a _CS/ops management_ lead. Never merge them.
- ❌ **AI assumes "Serpy" is a typo for "SERP", or that SERPY Slack messages are written by a person** → ✅ **Reality: Serpy is an AI ops agent (Slack bot `U096P936NQ7` / "SERPY Dev"), distinct from the SERP platform.** Reading SERPY messages as human-authored is wrong.
- ❌ **AI assumes offshore devs are interchangeable** → ✅ **Reality: they are specialized** (see Offshore/Prixite table). Manish ≠ Subash ≠ Parish ≠ Aashish in skill, track, and risk tolerance.

### Executive & Leadership Team

| Person              | Title / Role                        | Owns / Decides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Slack ID      |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Jason Kiefer**    | Founder/CEO (Jack's father)         | Final word on company direction, product priority, pricing, metric definitions & naming (packing goal / purchase goal / inventory days), product consolidation, custom branding/AI initiatives. Decided custom-branding merchandise routes **100% through SERP, never Odoo** (Feb 8, 2026). Owns `jasonbkiefer/SWIRL`, `jasonbkiefer/SWAC`, and **sw-design** repos. Co-founded SugarWish with **Elisabeth Vezzani** and **Leslie Lyon** (CCO). Canonical forecast view is `serp.sugarwish.com/forecast/live-products` (NOT Retool). Describes **custom sleeves as "biggest near-term revenue opportunity."** |               |
| **Seth Finley**     | CTO                                 | Engineering/architecture/permissions/infra; lead on **live deploys**; owns external API accounts & CI/CD oversight. Owns `sugarwish-laravel` (under **sethfinley** org) and `sugarwish-odoo` repos; coordinates the **Prixite** vendor team. SWAC/Admin-Console owner. Reframed SERP rollout strategy (incremental, POs-first, Odoo dual-run) — the unblock that made SERP viable. Sponsors AWS→Hetzner migration.                                                                                                                                                                                            |               |
| **Anna Kifer**      | Director, Software Development & QA | Triages bugs, co-leads Technology org with Seth, approves process changes. Owns Jira/WishWorks board, dev workflow, glitch-to-bug escalation, QA gating, release timelines. **Primary liaison to Prixite.** SERP sponsor/PM oversight; mandated the Sept 15 SERP release with 6–8 weeks production-testing buffer before peak season. **Spelled "Kifer."**                                                                                                                                                                                                                                                    |               |
| **Matthew Patrick** | COO                                 | Operations/fulfillment direction, inventory/warehouse policy, launch-viability decisions. **SERP exec/business sponsor**; sequenced Jack's work. Confirmed **SERP is canonical source of truth for is_core/sku_type** (at Jack's L10). Priorities (per huddle): (1) Supplier Forecast changes ASAP, (2) SERP this quarter, (3) Shipping Reports.                                                                                                                                                                                                                                                              |               |
| **Ric Marquis**     | VP Finance / CFO                    | Leads Finance org. **Hard requirements stakeholder** — FIFO costing, inventory valuation, COGS, monthly manufacturing report, PO report, roll-forward report must be solved before Odoo deprecated. Approved Odoo schema-replication strategy. Defined the **draft-bill 3-way-match workflow** (Operations creates draft bills from received qty × unit price; Accounting reconciles vs vendor invoices, then posts to QuickBooks).                                                                                                                                                                           |               |
| **Mike Fraser**     | Director of Supply Chain            | Inventory accuracy, replenishment, purchasing/supplier forecasting; **primary consumer of Jack's supplier-forecast app.** Explicitly "very low confidence in accuracy of Odoo inventory data" — a core motivation for SERP. Created the legacy "Packaging & Supplies Tracker" Google Sheet (origin of `vietnam_stock`). Active vendor-bill creator (112 bills).                                                                                                                                                                                                                                               |               |
| **Sophie Jalowsky** | Director of Operations, CO          | Leads fulfillment ops & volume planning; manages EW/Englewood. Tagged on low-inventory/drop-level alerts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `U01JMCHDX0F` |

### SugarWish — Engineering & Systems Owners

| Person                         | Role                               | Owns / Decides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Slack ID / GitHub |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **Jack Kiefer**                | SERP developer (sole owner)        | Owns **SERP** (in-house ERP) solo, **Volume & Supplier Forecasting app**, **SERP shipping report**, auto-disable/drop-level workflow, **darklaunch**, **Serpy**, and **n8n sync automations**. First-line dev for glitch triage & manual order corrections; writes the Odoo→SERP migration plans & SQL migrations. By 2026 took over Odoo maintenance from Prixite. Reviewed by Seth + Anna, sponsored by Matthew Patrick. `is_core`/`sku_type` source-of-truth decided at his L10. **GitHub: `Jack-Kiefer/SERP`** | `U022BUNHE1Z`     |
| **Cris (Criston) Sloan**       | Automation Engineer                | Owns **livery / SWOP** (branded print-station backbone + MCP ops-tooling suite: mcp-db-tool, mcp-slack, mcp-wishdesk, swim-kb, custom-shop-slip PDF) and fulfillment-automation tooling. **Does NOT own SERP.** Mechanical Engineering degree; Colorado/Taylor. Reports to COO Matthew Patrick. **Ulises Miranda Amateco** reports to him. GitHub org **csloan-sw**; SERP user id 13.                                                                                                                              | `U040UH4GVPX`     |
| **Munyr Ahmed**                | DevOps / Infra lead (Pakistan)     | Owns **Jenkins / CI/CD for ALL platforms** (WishDesk/SWAC, sugarwish-laravel, SERP). Owns **AWS→Hetzner migration** (Seth/Anna sponsors); manage cluster + Desk2 DB already migrated (~Apr 29 2026). Can disable triggers as emergency lever. **Jack is a consumer of this infra, NOT the owner.** Also part-time Retool expert. n8n bot is `U08QP0DL9L5`; itsmunyrhere.                                                                                                                                           | `U068USJ2LQM`     |
| **Haseeb Ahmed & Aima Shahid** | Retool experts, part-time (Canada) | Retool support. Haseeb reported the Jan 2025 escalating `ec_order` deadlocks.                                                                                                                                                                                                                                                                                                                                                                                                                                      |                   |
| **Dhon Kekim**                 | QA Automation (Philippines)        | Deployment / Jenkins questions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `U06QJFASK8W`     |

### Offshore / Prixite Dev Team (NOT interchangeable)

| Person               | Role                                                      | Track / Ownership                                                                                                                                                                                                                                                                                                                                                           | Slack ID / GitHub |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Manish Chaudhary** | Senior Lead Developer (Nepal)                             | **Most Odoo-experienced dev.** Lead engineer on `sugarwish-laravel` (authors/merges most PRs, coordinates deploys). Main **Prixite/Odoo contact** (with Zain Arshad). **SERP SECONDARY lead** — owns the Odoo→SERP migration scripts and kits-migration testing. Built SQL generators for SERP product/BOM migration to manage DB. Owns Phase-3 (Kits/BOMs) migration prep. | `U03858W1K7C`     |
| **Subash Chaudhary** | Developer (Nepal)                                         | **Laravel-track dev.**                                                                                                                                                                                                                                                                                                                                                      | `U03A13MS7KL`     |
| **Parish Shrestha**  | SWAC release engineer / WishDesk-track lead dev (Nepal)   | Runs dev→staging→live promotions for **SWAC/WishDesk**; merges nearly ALL SWAC PRs; posts deploy confirmations in `#devgroup_wishdesk`. Debugging philosophy: don't chase irreproducible bugs — add logging in the wild.                                                                                                                                                    | `U045FJ66K6K`     |
| **Bilal Ahmed**      | Senior Integrations Dev (Pakistan)                        | Did the **Laravel 11 upgrade**; handles **manage/blue pushes**. GitHub: `bilalahmed-1994`.                                                                                                                                                                                                                                                                                  | `U07BM9JHGAZ`     |
| **Aashish Shrestha** | Junior dev (Nepal)                                        | Being brought up for **small backend Laravel tasks and low-risk work under supervision.** Do NOT route complex work to him. GitHub: `beingaashish` / `aashish-shrestha`.                                                                                                                                                                                                    | `U03RUA9F5EX`     |
| **Hamza Khan Niazi** | Primary offshore Odoo dev through 2024–mid-2025 (Prixite) | Authored most of `sugarwish_integration` + `prixite_customization` modules (last commit ~Jul 2025).                                                                                                                                                                                                                                                                         |                   |
| **Zain Arshad**      | Prixite Odoo contact                                      | Odoo code changes, cron frequency, reverts. Has Odoo staging user (`zain.arshad@prixite.com`).                                                                                                                                                                                                                                                                              |                   |

- **Prixite** = external Odoo vendor (Manish + Zain + historically Hamza). Relationship strained by May 2025 — a key motivation behind the SERP build. Handles Odoo code changes, cron/scheduled-action frequency, and reverts. **Senior devs (Parish, Manish, Munyr, Bilal) take the harder tickets.**

### Product, Merchandising & Catalog

| Person             | Role                                       | Owns / Decides                                                                                                                                                                                                                                                       | Slack ID / handle |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Clare McClaren** | VP Creative & Merchandising                | eCard product consolidation, buyer-product disabling, custom sleeves/merchandise/digital branding, design icons. Requested unified mug-image-review page for CS. Uses the mug-image-review queue (with Cris, Nachae).                                                | `U034VB6F886`     |
| **Caley**          | Receiver-product / catalog owner (caleynh) | Owns receiver-product updates; **key product-decision APPROVER** for prepick/validation direction. Confirmed `components.inventory_quantity` is not actively used (Jun 2025). Handled inventory-reservation cancellations via raw SQL before the admin page shipped. | `U1H9YEATC`       |
| **Kelley Meiser**  | Ops / product-type migration (kelleymax)   | Drives product-type migration requests; **tags SKUs seasonal/legacy** (kelleymax).                                                                                                                                                                                   | `U099GLS5D`       |
| **Kellen Evans**   | Product/SKU data                           | Maintains Product Tracker Reference, Odoo product/SKU data; **has Odoo admin access** (fixes failed-products).                                                                                                                                                       | `U04CDD0L4K1`     |
| **Nora Stein**     | Odoo receiving / accounting                | Handles Odoo receiving/MOs/transfers; **has Odoo admin access**; re-activates variants / corrects Odoo-ID mappings to clear failed-products email. **Most active vendor-bill creator (556 bills).**                                                                  | `U06PC310WU9`     |
| **Olive Ren**      | AI Product Builder                         | Owns Proposals System (creation/pricing).                                                                                                                                                                                                                            |                   |

**Validation/product-change sign-off authority:** Receiver-product/catalog changes require sign-off from **Caley / Clare / Kelley**; **Anna** triages; **Seth** owns external API accounts & infra. ❌ AI assumes engineering can unilaterally fix a recurring data-entry glitch with a validation/code change → ✅ Reality: validation/product changes need product-owner sign-off, not engineering fiat.

### Purchasing, Buyers & Suppliers

| Person           | Role                     | Owns / Decides                                                                                                                                                                                                                                                                                                 | Slack ID      |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **James Emeric** | Buyer                    | Primary user/stakeholder of SERP forecast; asked to fold component forecasting in. Requested PO-receiving approval be **restricted to James + Neal only**. Confirmed EW Bakery Cafe `-E` SKU rename convention. Active vendor-bill creator (436 bills). Real Serpy submitter.                                  | `U06UV0142S0` |
| **Neal Hustava** | Senior Buyer             | Primary forecast user/stakeholder; reviews/approves Serpy requests; **wine/Vinebox owner** (with Brian). Requested archived SKUs be hidden from forecast except Q3/Q4; reported `vietnam_stock` double-counting (Oct 7 2025). Requested PO-receiving restricted to James+Neal. Vendor-bill creator (94 bills). | `U02SRPY7N2V` |
| **Brad Hartt**   | Stephen Gould vendor rep | Production-paper / Vietnam-sourced packaging supplier contact.                                                                                                                                                                                                                                                 |               |

### Warehouse, Fulfillment & Operations

| Person                       | Role                           | Owns / Decides                                                                                                                                                                                                                                                                                                                                                                                                                              | Slack ID      |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Carolyn Pardee**           | Operations / Inventory Manager | Owns BoM/kit/packaging setup, inventory location rules, physical counts, failed-product routing. **Primary Serpy approver**; one of two non-Jack SERP contributors (e.g. `carolyn/pack-tomorrow` branch). Knows the popcorn flavor-deviation rule (approved 2025-07-03). **PRIMARY recipient of the daily "Odoo Live: Failed Products" email.** Reluctant to move Kits/BOMs to Laravel before SERP fully implemented. Real Serpy submitter. |               |
| **Tracy Kamin**              | TY/Taylor fulfillment lead     | TY (and Custom Mug & Treats) fulfillment lead; executor of physical inventory tasks; reports stockouts. Requested BOM-change flagging in the location-move workflow. Flagged vendor-fulfilled order-tracking gap (Aug 2024).                                                                                                                                                                                                                | `U066CLB2R8Q` |
| **Jose Miranda**             | Englewood warehouse lead       | Inventory counts; submits Serpy ops. Real Serpy submitter.                                                                                                                                                                                                                                                                                                                                                                                  |               |
| **William Meilinger (Will)** | Englewood fulfillment/packing  | EW packing; tagged on EW location-owner alerts.                                                                                                                                                                                                                                                                                                                                                                                             | `U05PPBBJ4H4` |
| **Shomari Bomani**           | Warehouse (shippers/stockouts) | Reports outer-shipper stockouts (with Tracy).                                                                                                                                                                                                                                                                                                                                                                                               |               |
| **Rashad Johnson**           | Warehouse                      | Posts rack→floor movement notes for audit.                                                                                                                                                                                                                                                                                                                                                                                                  |               |
| **Milica**                   | Odoo BOM creation              | Creates BOMs manually in Odoo alongside Carolyn.                                                                                                                                                                                                                                                                                                                                                                                            |               |
| **Ulises Miranda Amateco**   | Automation/print               | Reports to Cris Sloan.                                                                                                                                                                                                                                                                                                                                                                                                                      |               |

### Customer Service, CRM & WishDesk Ops

| Person                              | Role                                     | Owns / Decides                                                                                                                                                                                                                                                                 | Slack ID      |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **Ellen Nelson**                    | Customer-service / WishDesk lead         | Owns **Gift Concierge**, WishDesk Knowledge Base; submits PRs / reports CS bugs.                                                                                                                                                                                               | `UMSMMGL22`   |
| **Madison Meilinger**               | Ops/CS management lead                   | Manages CS agents; handles **product substitutions, placeholder/custom-shoppe orders, eCard swaps**, manual placeholder order placement; routes WishDesk feature requests to Parish. Reported the SLA business-hours timezone bug. **(NOT the SWAC dev — see Madison Parks.)** | `U021G7V41D1` |
| **Madison Parks**                   | SWAC/WishDesk **developer**              | Developer on `jasonbkiefer/SWAC`. **(NOT the CS lead — see Madison Meilinger.)**                                                                                                                                                                                               |               |
| **Payton Castaneda**                | SWAC contributor / Outreach & Sales Tech | Owns Outreach & Sales Tech; handles WishDesk admin/agent setup; gets WW tickets auto-assigned.                                                                                                                                                                                 | `U01ERBYFHMJ` |
| **John Pascual Lalucis ("Jaypee")** | Test Manager (Philippines)               | Owns Jira dashboards, glitch-impact accountability; links tickets, tags devs, does QA verification. **Active coder on SWAC.** Bulk-fixed the ~14K stale-product_id ecard cards.                                                                                                | `U0201JZHJDR` |
| **Christopher Pavela**              | Custom mug fulfillment                   | Reported the production-slip stale-image issue (Oct 16 2025, `#custom-mug-and-treats-fulfillment`).                                                                                                                                                                            |               |
| **Beth S**                          | Mug image review                         | Requested mug-image-review filtering/sorting features.                                                                                                                                                                                                                         |               |
| **Nicole**                          | Ops reporting                            | Manually posts the daily Slack ops report to `#ops-management`; reads the Retool Ops Dashboard.                                                                                                                                                                                |               |
| **Deb / Jen Connelly**              | Enterprise/sales (historical)            | Historical discount-approval authority (see Discount Authority below).                                                                                                                                                                                                         |               |

### Who Owns Which System / Repo / Data Store

| System / Data store                                                             | Type                                                                  | Owner                                                                                                   | Notes                                                                                          |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **SERP** (`Jack-Kiefer/SERP`)                                                   | In-house ERP (Next.js + FastAPI/MySQL)                                | **Jack Kiefer** (sole); Manish = secondary lead on migration scripts                                    | Bridges Laravel ↔ Odoo. Sponsored by Matthew Patrick; PM'd by Anna; strategy reframed by Seth. |
| **Odoo** (PostgreSQL, cloud on Odoo.sh)                                         | ERP / inventory / accounting source-of-truth                          | **Seth Finley** (repo `sugarwish-odoo`); Prixite (Manish/Zain) for code; Jack for 2026 SERP-era changes | Being phased out post-cutover. Admin access: Kellen Evans, Nora Stein.                         |
| **sugarwish-laravel** (`sethfinley/sugarwish-laravel`)                          | Main e-commerce app & order domain                                    | **Seth Finley** (CTO, owner); Manish = lead engineer                                                    | Primary devs: Subash (Laravel), Parish (SWAC), Manish (lead/Odoo).                             |
| **SWAC / WishDesk** (`jasonbkiefer/SWAC`)                                       | CS/CRM/design/billing platform                                        | **Jason Kiefer** (`jasonbkiefer` org owner); **Parish Shrestha** = release engineer/merger              | Contributors: Madison Parks, Payton Castaneda, Jaypee.                                         |
| **SWIRL / sw-design / SWAC repos**                                              | Knowledge platform + design/config                                    | **Jason Kiefer** (`jasonbkiefer`)                                                                       | SWIRL = (1) AI knowledge library, (2) WishWorks datastore.                                     |
| **livery / SWOP** (`csloan-sw/livery`)                                          | Branded print station + MCP ops tooling                               | **Cris (Criston) Sloan**                                                                                | Reports to COO. NOT SERP.                                                                      |
| **Retool**                                                                      | Analytics/ops (PostgreSQL); SERP sync engine + auth + forecast caches | Shared multi-app DB; **NOT SERP-owned**; Retool experts: Munyr, Haseeb, Aima                            | ~165 tables; SERP touches ~40.                                                                 |
| **Jenkins / CI/CD** + **AWS→Hetzner migration**                                 | Infra                                                                 | **Munyr Ahmed** (all platforms)                                                                         | Jack is a consumer, not owner.                                                                 |
| **darklaunch / Serpy / n8n sync**                                               | SERP validation + AI ops + automation                                 | **Jack Kiefer**                                                                                         | Serpy = AI bot `U096P936NQ7`.                                                                  |
| **Forecast metric definitions** (packing goal / purchase goal / inventory days) | Business logic                                                        | **Jason Kiefer** (defines); Jack (implements)                                                           | Canonical view = `serp.sugarwish.com/forecast/live-products`.                                  |
| **Finance/COGS/valuation requirements**                                         | Hard requirements                                                     | **Ric Marquis**                                                                                         | Must be solved before Odoo deprecation.                                                        |
| **Supply chain / forecasting consumption**                                      | Stakeholder                                                           | **Mike Fraser**                                                                                         | Primary forecast-app consumer.                                                                 |

### Leadership Routing — "Who do I ask about X?"

| Topic                                                  | Route to                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Engineering / architecture / permissions / infra       | **Seth Finley (CTO)**                                                                  |
| Dev process / Jira / timelines / glitch→bug escalation | **Anna Kifer (Dir SW Dev & QA)**                                                       |
| QA / glitch tracking / ticket verification             | **Jaypee (John Pascual Lalucis), Test Manager**                                        |
| Ops roadmap / priorities / launch-viability            | **Matthew Patrick (COO)**                                                              |
| Supply chain / inventory / purchasing policy           | **Mike Fraser**                                                                        |
| Finance / COGS / costing / reporting                   | **Ric Marquis (CFO/VP Finance)**                                                       |
| Warehouse / physical / Englewood                       | **Carolyn Pardee** (+ Tracy Kamin/TY, Jose Miranda, William Meilinger, Shomari Bomani) |
| Purchasing / suppliers / PO receiving approval         | **James Emeric & Neal Hustava**                                                        |
| Receiver Products / catalog                            | **Caley (caleynh) & Kellen Evans**                                                     |
| Customer Service / WishDesk ops                        | **Ellen Nelson & Payton Castaneda** (CS management: Madison Meilinger)                 |
| SERP / Odoo migration                                  | **Jack Kiefer** (secondary: Manish)                                                    |
| Print/rendering, livery/SWOP, MCP tooling              | **Cris Sloan**                                                                         |
| Final business decisions / pricing / strategy          | **Jason Kiefer (CEO)**                                                                 |

### Approval & Escalation Authority

#### Discount / Enterprise Pricing (`#enterprise`)

- Gated human-judgment process: account managers request approval **before any non-standard discount**. Approval authority = enterprise/sales leadership (**Deb / Jen Connelly** historically); **Jason Kiefer (CEO)** is final escalation on strategy/exceptions. Approvers reason explicitly quantity-vs-margin (e.g. "I'd rather not do 10%, big drop in quantity") and instruct AMs to "publish" a higher price with room to discount down.
- Standing volume tiers: ~5% ($10k–$20k), ~8% (push-room concession), 10% (above ~$20k), 15% (very large, ~$250k+), ~20% (single-location shipping). **HHS/PPS** prepay programs ≈ 18% effective discount.

#### Serpy Operations Approval

- **Carolyn Pardee = primary Serpy approver** (ops manager). Some ops need "Needs review from @James @Neal." Real Serpy submitters: **James Emeric, Jose Miranda, Carolyn Pardee, Jack Kiefer**.
- ❌ AI assumes Serpy approval endpoints enforce role/threshold checks → ✅ Reality: web approve/reject endpoints require only any internal user (no per-op-type permission); `serp_approval_thresholds` ($5K ops / $50K finance) **exists but is NOT enforced in code.** Slack path _does_ check `stock.group_stock_user`/`base.group_system`.

#### PO / Bill Approval (SERP design)

- SERP PO approval gates: `ready_for_approval_at` → `ops_approved_at` → finance_approved_at`→`ordered_at`. Thresholds **$5K (ops)**, **$50K (finance)** — design intent, not yet wired.
- **PO-receiving approval** requested restricted to **James Emeric + Neal Hustava** (not yet implemented).
- **Vendor-bill creators** (manual, in Odoo, after goods arrive): Nora Stein (556), James Emeric (436), Mike Fraser (112), Neal Hustava (94). Payment reconciliation happens in **QuickBooks**, not Odoo.

#### Glitch → Bug → Fix Process

- Non-dev staff file **glitches**; devs **only replicate glitches, never fix directly** — a separate **BUG ticket** must be Product-prioritized. Fixing a glitch directly violates process. **WishBot/Anna require an archive REASON for unreproducible bugs**, escalating to Critical if recurring for weeks or blocking redemption.

### Family Relationship

- **Jack Kiefer** (SERP dev) is the **son** of **Jason Kiefer** (Founder/CEO). Both surnames are **Kiefer**. **Anna Kifer** (Dir SW Dev & QA) is a separate person with the distinct surname **Kifer** — not a relative implied by the spelling.

---

## The Systems & How They Connect

SugarWish runs on a constellation of systems that overlap and feed each other. The single most common AI failure is treating any one of them as the source of truth, or assuming clean one-system-one-database boundaries. They do not exist. This section maps every system, its host, its repo, its branches, its deploy model, and exactly how data flows between them.

### The Ten Systems at a Glance

| System              | What it is                                                                         | Tech                                                                 | Repo                                 | Owner                                    |
| ------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **SERP**            | In-house ERP being built to replace Odoo, sitting between Laravel and Odoo         | Next.js frontend + FastAPI/Python backend, MySQL ORM modeled on Odoo | `Jack-Kiefer/SERP`                   | Jack Kiefer (solo)                       |
| **Odoo**            | PostgreSQL ERP — current source of truth for inventory/manufacturing/accounting    | Odoo 15 (v15.0.1.3), cloud-hosted on Odoo.sh                         | `sugarwish-odoo` (sethfinley org)    | Seth Finley; Prixite vendor maintains    |
| **Laravel**         | Main e-commerce app + order domain                                                 | Laravel/PHP, MySQL                                                   | `sugarwish-laravel` (sethfinley org) | Seth Finley (CTO)                        |
| **WishDesk / SWAC** | CS + CRM + design + billing platform                                               | React + Express + TypeScript + Drizzle + MySQL                       | `jasonbkiefer/SWAC`                  | Jason Kiefer; Parish Shrestha (lead dev) |
| **Retool**          | Analytics/ops + the operational backbone for SERP's sync engine, auth, forecasting | Low-code over a shared multi-app PostgreSQL DB                       | n/a                                  | Munyr/Haseeb/Aima (part-time)            |
| **Serpy**           | SERP's AI ops agent (plain-language → ERP operations)                              | Python; Slack + web UI                                               | part of SERP                         | Jack Kiefer                              |
| **darklaunch**      | SERP's parallel Odoo-shadow validation system                                      | MySQL `serp_*` mirror on Hetzner                                     | part of SERP                         | Jack Kiefer                              |
| **n8n**             | Automation platform (alerts, sync monitors, drift monitor)                         | Self-hosted at n8n.sugarwish.com                                     | `workflows/n8n/`                     | Jack Kiefer                              |
| **sw-design**       | Design/config repo (CustomGenie quiz, box recipes, product-category sync, icons)   | —                                                                    | `sw-design` (jasonbkiefer)           | Jason Kiefer; Clare McClaren (designer)  |
| **swirl / SWIRL**   | (1) company-wide AI knowledge platform; (2) WishWorks datastore                    | — + Slack bot                                                        | `jasonbkiefer/SWIRL`                 | Jason Kiefer                             |
| **livery / SWOP**   | Warehouse print-station backbone + sleeve imposition + MCP ops-tooling             | Node; PDF generation                                                 | `csloan-sw/livery`                   | Cris Sloan (Automation Engineer)         |

---

### SERP — The In-House ERP

**SERP** (GitHub `Jack-Kiefer/SERP`, `serp.sugarwish.com`) is SugarWish's home-grown ERP/inventory layer being built to **replace Odoo incrementally**. It sits **between Laravel (orders, products) and Odoo (accounting/manufacturing source-of-truth)**, bridging the two so SugarWish orders flow into Odoo and costs/inventory flow back.

**Dual nature of the schema.** SERP has ~60 `serp_*` tables that mirror Odoo models in MySQL (stock, purchase, MRP, accounting, products), plus a handful of SugarWish-DOMAIN tables (buyer*products, receiver_products, components, kits, component_kits, ec_order, preselect_orders, items, component_orders) that mirror Laravel. **Naming convention:** every table is prefixed `serp*`and named after the corresponding Odoo model with dots→underscores (e.g.`stock.picking`→`serp_stock_picking`, `purchase.order`→`serp_purchase_order`, `mrp.production`→`serp_mrp_production`).

#### Hosting & Infrastructure (AWS → Hetzner migration in progress)

- **Production SERP app server**: the **Hetzner K3s cluster** — node `5.161.95.56`, namespace `serp`, app root `/opt/SERP`, live host `serp.sugarwish.com` (health-check from the node; the hostname doesn't resolve from Jack's Mac). Deployments: `serp-backend` (**replicas 2** — safe since 2026-06-09 because live-path refresh tokens live in shared Redis `serp:refresh_token:<hash>` instead of a per-process dict; `WORKERS_ENABLED=false` stays set via the **`serp-env` secret**/`envFrom`, invisible in inline `env:` — check `kubectl exec -- printenv`), `serp-frontend`, `serp-workers` (replicas 1, the only place workers run). Ingress/TLS via cert-manager (`k8s/ingress.yaml`). Deploy = `bash deploy-k8s.sh main` on the node: runs `migrate:serp-app` (phase [4]) before rolling pods, and its `[7/7]` prune phase prevents the ~1.3GB/deploy image leak into `/var/lib/containerd` (Docker uses the containerd store — `/var/lib/docker` misleads `du`; kubelet GC force-kicks at 85% disk). The **legacy AWS EC2** (**34.203.231.65**, PM2 + nginx + old `deploy.sh`) is retained **frozen** — NOT deployed to; workers disabled there.
- **Production darklaunch MySQL DB**: Hetzner at **5.161.233.240**, database `serp_test` (MCP key `live_darklaunch_db`) — this is the **REAL live production darklaunch mirror**, NOT a throwaway test DB.
- **Already migrated to Hetzner** (as of ~Apr 29 2026): the `manage` cluster MySQL (AWS shut down Apr 29), Desk2/Desk3 (WishDesk), and the darklaunch DB.
- **Still on AWS**: the frozen legacy SERP EC2 (not production traffic), AWS ALB (TLS:443 → nginx:80), ElastiCache Serverless Redis, S3 (`sw-serp` bucket for attachments/serpy-logs via boto3 `S3_ENDPOINT_URL`), and `laravel_live` MySQL (AWS RDS `database-1.cqqg1tfyyubp.us-east-1`, accessed via SSH tunnel).
- **Hetzner caveats**: a fresh Hetzner MySQL needs `SET GLOBAL sql_mode='NO_ENGINE_SUBSTITUTION'`; Hetzner has no managed Redis (self-host), no managed ALB (use Hetzner Cloud LB + Let's Encrypt), no S3 equivalent (Hetzner Object Storage via `S3_ENDPOINT_URL`, s3v4, virtual addressing, `payload_signing_enabled=False`, no dots in bucket names). Est. cost drop ~$128/mo → ~€9-18/mo. **Munyr owns the migration** (Seth/Anna sponsors); Jack is a consumer, not infra owner.

#### Git / Deploy Model (a frequent footgun)

- Branch flow: `feature/bugfix/hotfix` branches off `dev` → `dev` → `main`. **NEVER work directly on dev/main without permission.**
- **Deploy is MANUAL.** GitHub Actions CI runs on push but does **NOT deploy**.
  - ❌ AI assumes SERP auto-deploys from `main` via Jenkins → ✅ Reality: deployment is a manual step on the Hetzner K3s node: `ssh jack@5.161.95.56` then `cd /opt/SERP && bash deploy-k8s.sh main`. A push/merge to `main` is NOT live until `deploy-k8s.sh` runs. (The old AWS `deploy.sh` path is frozen legacy.)
- **PM2 over SSH** requires explicit exports: `PATH=/home/ubuntu/.nvm/versions/node/v20.20.1/bin:$PATH; PM2_HOME=/home/ubuntu/.pm2`. Inline `pm2 reload` fails without them.
- **Before rebuilding the darklaunch DB you MUST `pm2 stop serp-workers`** or get MySQL `1412 'table definition changed'` errors that kill in-flight shipments; resume after.
- **`deploy.sh` does NOT run schema migrations against the prod `manage` cluster (now on Hetzner, not AWS RDS)** (`npm run migrate` is local-only; `seeding/migrations/*.sql` are deleted at HEAD; deploy hardcodes the docker `serp_staging_darklaunch`). New `serp_*` tables/columns need **manual migration of the live `manage` DB BEFORE code ships** (Manish + DBA) or you get "table doesn't exist" in production.
- Local dev: backend on 8000, Next.js on 3002 (some sources 3000); local login `jack@sugarwish.com` / `localdev123` (alt creds `jack@sugarwish.com` / `UZ(8!C5Q2Y1f`). E2E uses isolated ports (backend 8888, frontend 3333) with database `serp_e2e`.

#### Auth Layers — TWO independent layers (confuses users into thinking login is broken)

1. **nginx HTTP Basic Auth** — `serp_admin` / `swserp12` on the `/` catch-all (`deployment/nginx/sites-available/serp.conf` checks `/etc/nginx/.htpasswd`). Browser-cached (Safari aggressive); `deploy.sh` does NOT regenerate `.htpasswd`, so deploys don't invalidate cached auth. ❌ Repeated login popup = browser-side Basic Auth cache dropping, NOT an app/JWT bug.
2. **In-app JWT login** (`/login`) — 15-minute HS256 access token (in memory), 7-day refresh token as HttpOnly cookie scoped to `/api/auth`. Token rotates on each refresh (old revoked).

**SERP auth split across DBs (CRITICAL):**

- **Identity** lives in Retool PostgreSQL: `serp_users` is a stripped bridge table (4 columns: `id, created_at, updated_at, orm_user_id`) hit on every authenticated request. Old columns (name, email, password, roles, is_admin/finance/ops/internal, supplier_name) moved to `_backup_serp_users`.
- **Roles** live in MySQL ORM (`serp_res_users` + `serp_res_groups` for group-based RBAC). As of the 2026-03 migration, SERP user auth moved to `manage` MySQL `serp_res_users`.
- **Passwords** stored in Retool PG only; SERP MySQL has placeholder `'synced-from-retool'`. Lazy sync on each login via `ensure_orm_user()`. Retool serial IDs and ORM bigint IDs are independent — **users matched by EMAIL, not ID**.
- `serp_refresh_tokens` and `serp_password_reset_tokens` are **documented as Retool but actually live in MySQL** (serp ORM, via `env.cr`).
- ❌ AI assumes a separate PostgreSQL auth DB (the `.env` has `TEST_AUTH_DB_*` localhost:5432 vars) → ✅ Reality: those vars are dead code; `auth_database.py` imports engines directly from `database.py` (the same MySQL). "Cannot connect to main database for auth on 127.0.0.1" = it's trying local MySQL (127.0.0.1:3307).
- ❌ `SUPERUSER_ID = 1` is hardcoded in `environment.py`; `get_env()` can return uid=1 — accidental production use = full privilege escalation.

#### Two SERP Frontends

- **Red sidebar** (traditional ERP at `app/(serp)/`): `/dashboard`, `/purchase-orders`, `/suppliers`, `/inventory`, `/receipts`, `/locations`, `/bill-of-materials`, `/manufacture-orders`, `/bills`.
- **Teal sidebar Forecast App** (`app/forecast/`): the Volume & Supplier Forecasting app at `https://serp.sugarwish.com/forecast/live-products`, replacing the Retool live-products & ecard-inventory reports.

**Frontend architecture:** React (NOT Odoo's OWL framework), custom TypeScript hooks (`createRpcHooks` factory, `useRpcAction`), `callKw()` for RPC. SERP routes ALL model CRUD through a single **RPC endpoint `POST /api/call_kw`** (JSON-RPC 2.0, mimicking Odoo) dispatching to `@api.callable`-decorated ORM methods; built-in CRUD (search, search*read, read, create, write, unlink) allowed without the decorator; private `*`-prefixed methods always blocked (403). REST routers still exist for non-ORM functions (PDFs, summaries, email, validation). **Direction (as of 2026-03):** editing/mutation is being REMOVED from the SERP frontend — all create/edit/delete moves to Serpy.

**SERP route gotchas:**

- ❌ FastAPI sub-routers REQUIRE the right trailing-slash convention. Root routes defined as `/` issue 307 redirects, and browsers drop the `Authorization` header on redirect → 401. Fix: use empty string `""` for root routes (`@router.get("")` not `@router.get("/")`).
- ❌ SERP routes to `/external-access` by checking the Odoo `base.group_user` group, but groups load AFTER the user object, so a post-login race mis-routes a valid internal user out. "Why does it think I'm external?" = groups-not-loaded race, not a permissions problem.

#### SERP Connection Pools (a known mess)

SERP runs **6+ independent connection pools** with heavy duplication. Retool PG alone has THREE pools (asyncpg max=5 + psycopg2 sync max=15 + SQLAlchemy asyncpg 5+5). The SERP ORM pool (`serp_orm/db.py`, custom PyMySQL, size=5/overflow=8 = 13 max, `pool_recycle=60s` aggressive) is held idle for the entire 200-320s forecast request, so only ~13 concurrent requests exhaust it. The `ForecastDatabaseConnector` singleton holds 3 pools (Odoo asyncpg, Live SERP SQLAlchemy MySQL via SSH tunnel, Retool asyncpg; min_size=2, max_size=15, timeout=90s). On the now-frozen AWS EC2 (`i-0a0de24d0845c6341`, `34.203.231.65`) this overwhelmed the box under load (504s, resource exhaustion); production now runs on the Hetzner K3s cluster, but the same pool/index footguns still apply.

#### SERP's Permanent, Intentional Divergences from Odoo

SERP deliberately does NOT replicate (documented in `docs/ODOO_APPROVED_DIFFERENCES.md`, `docs/KNOWN_BUGS.md`):

- The invoicing flow (worker creates SO with default `invoice_status='to invoice'`, never advances; `commitment_date`/`effective_date` left at worker values).
- `res.partner._increase_rank` supplier_rank bumps on PO confirm; PO receipt/vendor-bill recompute fields; Odoo crons that move stock_move/quant states post-create.
- No `procurement.group` model (`group_id` is raw BigInteger only), no lot/serial tracking, no package/owner tracking, no `ir.model.data`/`env.ref()`, chatter only at document level (never on stock.move/move_line/quant).
- **`sale.order.action_confirm` is deliberately INERT** — it does NOT launch procurement or create a delivery picking. The **darklaunch worker is the SINGLE creator of delivery pickings** via `stock.picking.action_process_new_order`. Adding a second picking-creator would produce two pickings per order.
- Bin-level putaway/removal strategy: SERP writes the parent stock location per standard MO flow; Odoo refines move-lines to specific bins. This is approved divergence, not a bug.

---

### Odoo — The Current Source of Truth

**Odoo** is the PostgreSQL ERP/inventory/fulfillment/accounting brain — NOT the storefront/CRM. Version **15 (v15.0.1.3)**, **cloud-hosted on Odoo.sh** (`sugarwish.odoo.com` / `sethfinley-sugarwish-odoo-staging-new-*.dev.odoo.com` for staging) with a **330s statement timeout** and **NO direct shell access** (all ops via Web UI, Server Actions/Python, XML-RPC/JSON-RPC, or custom wizards). It is being replaced by SERP post-cutover but remains the live fallback. ~584 tables, ~5,800 active products, ~290 partners, ~2,600-2,700 locations, ~1,900 POs, ~2,078 BOMs, ~26,000+ MOs, ~13.4M stock_valuation_layer rows.

- **`sugarwish-odoo`** (Seth's repo) holds the custom modules. The MAIN custom module is **`sugarwish_integration`** (depends on `sale_stock_picking`, `mrp`, `sw_api_logs`); other modules: `purchase_features`, `sales_features`, `stock_features`, `mrp_features`, `pr_vendor_product_automation`, `sw_reports`/`sw_excel_update`, `odoo_logger`, `prixite_customization`. Branch flow: `staging_new` → `main` (prod).
- **History:** Hamza Khan Niazi / Prixite offshore team built it through mid-2025; 2026 SERP-era changes by Jack. **Prixite contacts:** Manish Chaudhary + Zain Arshad. Relationship was strained by May 2025 (a driver of SERP). A **v15→v17 upgrade** looms (Odoo version upgrade deadline ~October 2026; upgrade-test-16/17 branches exist).
- **Odoo rejects** (statement timeout / RPC limits): negated predicates (`NOT IN`/`!=`/`<>`) on indexed state columns of multi-million-row tables (use positive IN-lists); quant creation on consumable/service products; private `_`-prefixed methods over XML-RPC ("Private methods cannot be called remotely"); UoM category mismatches; missing mandatory fields on remote RPC create.

**27 ACTIVE Odoo crons** (note: misspelled `oddo_synchronized` flag throughout): "Sugarwish: Update Orders" (every 6 min), "Update Failed Orders" (every 10 min), "Update Prepicks" (every 120 min), "Update Failed Prepicks" (every 15 min), "Re-Update Movelines Cost" (3 min), "Reset Reupdated Zerocost Movelines" (3 min), hourly Google Sheet exports (the `sw_excel_update` module pushes Sales→"Live", Purchase→"Purchase", Inventory→"Inventory" tabs of Sheet `1ESYinwhFztJfzo0Aec3BwafS9d7cHxWTUhh9vpVGGJA`; errors logged not raised = silent failures), daily email digests ("Send Failed Orders Email" daily ~14:15, recipient Carolyn → routed to Nora Stein/Kellen Evans to fix).

---

### Laravel — E-Commerce & the Order Domain

**`sugarwish-laravel`** (Seth's `sethfinley` org) is the main e-commerce app and order domain (orders, products, giftcards). It is the LIVE production app DB and also co-hosts an early `serp_*` ERP pilot.

- **`laravel_live`** (MySQL, AWS RDS `database-1.cqqg1tfyyubp.us-east-1`, read over SSH tunnel via user `replit-read-9173`): ~4.92M `giftcards_card`, ~4.01M `ec_order`, ~150K `company`. Holds `receiver_products`, `components`, `kits`, `component_kits`, `ec_order`, `items`, `giftcards_card`. **CRITICAL: the `serp_*` tables embedded here are essentially EMPTY (~19 `serp_sale_order` rows, 0 POs) — they are NOT live SERP data. Live SERP transactional data lives in the darklaunch DBs.**
- **`manage`** (MySQL, Laravel STAGING; renamed 2026-05-11 from "laravel staging"): near-identical schema to `laravel_live` (~8% of prod: 396K giftcards vs 4.9M). Hosts SERP's upstream ORM tables and is the seed source for `serp_staging_replica`. Serpy writes `receiver_products` HERE (not prod `laravel_live`). The `manage` cluster + Desk2 DB are already on Hetzner.
- **Branch/deploy:** feature branches off `development`; commits/branches use `SUG-XXXXXXXXX:` ticket prefix (also `WW-*`). Flow: feature → `development` → `manage` (staging) → `blue` (production; "merge blue to main for release"). Primary devs: Subash (Laravel-track), Parish (SWAC-track), Manish (lead/Odoo), Bilal (handles manage/blue pushes; did the Laravel 11 upgrade).
- **SERP↔Laravel DB access:** user **`SERP-readfull-writepartial-7161`** has FULL READ but PARTIAL WRITE — table-by-table grants gated by Serpy approval, can only INSERT/UPDATE/DELETE on `receiver_products`, `kits`, `component_kits`, `buyer_products`. Intentionally NOT full-write.

**Laravel→Odoo is PULL-based, not push.** Odoo is the puller: its crons authenticate to Laravel's `/api/odoo/*` endpoints (Bearer token from `ir.config_parameter`, middleware `odoo.api`), pull unsynced orders (`oddo_synchronized` flag), process them, and call back to mark passed/failed. Laravel has no XML-RPC client. Endpoints: `GET /api/odoo` (receiver orders), `GET /api/odoo/pre-pick`, `GET /api/odoo/components/ecard`, `POST /api/odoo/update-order-passed`, `POST /api/odoo/update-order-failed`, `PUT /api/odoo` (inventory). Inventory push-back from Odoo→Laravel uses a `sidecar/SynchronizeOdooInventory` Lambda (XML-RPC via Ripoo) sharding by `product_id % 10`.

---

### WishDesk / SWAC — CS, CRM, Design, Billing

**SWAC** (GitHub `jasonbkiefer/SWAC`, description "SugarWish Activity Coordinator") **IS WishDesk** — they are the same React + Express + TypeScript + Drizzle + MySQL codebase.

- ❌ AI takes "SugarWish Activity Coordinator" literally → ✅ Reality: it's the CS/CRM platform (live chat, ticket management, knowledge base, AI workflows, proposal management).
- ❌ AI conflates the three "Wish" systems → ✅ Reality: **WishDesk** = the CS product; **WishWorks** = the in-house WW-#### ticket tracker (via WishBot, replaced glitch reports March 2026); **SWIRL** = the company knowledge repo.

**Environments:** `desk.sugarwish.com` (prod, branch `live`), `desk2` (dev, branch `development`, auto-deploys), `desk3` (staging, branch `staging`). **GOTCHA: desk3 staging points at the LIVE databases — data is NOT isolated.** Branch flow: feature → `development` → `staging` → `live` (NOT `main`). CI/CD via Jenkins (`ciservice.sugarwish.com/job/sw-deploy-to-wishdesk/`). **Parish Shrestha** is the release engineer/lead (merges nearly all SWAC PRs, posts confirmations in #devgroup_wishdesk); Madison Parks is a developer; Payton Castaneda and Jaypee contribute. Tickets are `WD-*`/`WW-*`.

**Two DBs via separate pools:** `server/db.ts` (WishDesk DB) and `server/sugarwish-db.ts` (Sugarwish DB). The Mug Image Processor creates its OWN MySQL pools for isolation. **All timestamps stored in Mountain Time, NOT UTC.** SWAC's React UI uses **cookie-based sessions, NOT JWT Bearer tokens** (Bearer only works for curl/API); local dev needs `ENABLE_LOCAL_AUTH_BYPASS=true`, `APP_ENV=local`. Route auth via `isAdmin`/`isAgentOrAdmin`/`isAuthenticated` middleware. Socket.IO requires sticky sessions with load balancers (except WebSocket-only transport).

**The SWAC MCP server** runs at port ~3001 (`/mcp`). Recurring deploy bug (Oct-Nov 2025): Jenkins deploy did NOT restart it, so it served stale code/tool-counts (Jason saw 28 tools local vs 23 on desk2). Standing rule was "when we change the MCP server, also request Seth restart it"; fixed by moving to PM2. There is only ONE MCP server, not per-env.

**WishDesk is downstream, not a master.**

- ❌ AI expects customer/order master data in WishDesk → ✅ Reality: truth is in SugarWish (Laravel/Odoo); WishDesk stores IDs + cached snapshots. **3-tier flow: WishDesk → reads → Sugarwish DB ← syncs ← Laravel API ← polls ← Odoo.** WishDesk does NOT integrate with Odoo directly; it sees Odoo data via Sugarwish fields (`odoo_sync`, `odoo_id`, `bypass_odoo`, `ship_date_odoo_synchronized`).
- Cross-system links: `sw_user_id`/`users.sw_id`/`user_cache.user_id` = SugarWish (Laravel) CUSTOMER id; `sw_company_id`/`company_id` = corporate account id; `linked_order_id`/`order_ids`/`ecard_ids`/`wishlink_ids` (JSON) = SugarWish order/ecard/wishlink ids.

**Integrations:** Gmail (the `swcrm_z_gmail_*` family — 20+ tables mirroring reps' mailboxes, auto-generating AI reply drafts; `z` prefix sorts last), RingCentral (`swcrm_ringcentral_*` phone/SMS), and **Qdrant** vector collections (kb-v2, instructions, draft-instructions, agent-chats, kb-internal, discoveries_swirl, org-knowledge; OpenAI `text-embedding-3-small`). **SWIM** is WishDesk's AI chatbot powered by kb-v2; the live chat has a BOT→AGENT handoff flow (sessions start BOT/PENDING → customer "Request Agent" → AGENT/PENDING_AGENT → Slack notify #cs_wishdesk_chats → agent accepts). The CRM backbone is the **polymorphic `swcrm_links` junction** (stored bidirectionally; `role` carries semantics; no per-pair FK tables). **Design config is full-overwrite synced from `sw-design`** — editing genies/boxes/sleeves directly in WishDesk gets wiped; changes must go in the sw-design repo.

---

### Retool — Not SERP-Owned, but SERP's Operational Backbone

**Retool** is a shared multi-app "Frankenstein" PostgreSQL DB (~165 public tables; SERP touches ~40). It is NOT SERP-owned but is the operational backbone for SERP's integrations. It hosts:

1. **SERP↔Odoo SYNC ENGINE** — `odoo_sync_queue`/`_dev`/`_live`, `odoo_sync_circuit_breaker`/`_dev`/`_live`, `odoo_sync_stats`, `serp_draft_operations`/`_live`.
2. **SERP AI OBSERVABILITY** — `serp_ai_messages_*`, `serp_ai_turns_*`, `serp_ai_prompt_logs`/`_live`, `serp_ai_prompts`.
3. **AUTH / app config** — `serp_users` (the id↔orm_user_id bridge hit on every auth request), `serp_user_counting_locations`, `serp_approval_thresholds`, `serp_audit_logs`, `serp_inventory_counts`/`_live`, `serp_vendor_inventory_counts`, `serp_beginning_inventory_snapshots`.
4. **Heavy FORECASTING caches** — `sa_projections_cache`, `size_projections_copy` (source of truth for size %), `sku_projections`, `week_settings`, `product_type_key_sizes`, `sku_product_type_key`, `mix_predictions`, `projected_orders`, `bc_size_location_split`, `rm_weekly_demand_cache`, `redemption_curve`.
5. **SUPPLIER meta** — `supplier`, `supplier_buffer`, `sku_supplier`, `rm_sku_supplier`, `supplier_permissions`.
6. **COST/WINE/BI** — `sku_costs`, `sku_equivalency_ratios`, `wine_category_goals`, plus mostly-stale mock tables (`quickbooks_dashboard`, `stripe_dashboard`, `shopifymonthlydata`, `mock_*`).

**CRITICAL suffix convention** (environment separation via table-name SUFFIX, not separate DBs): draft-ops/inventory-counts/prompt-logs use BASE locally and `_live` in prod; AI message/turn tables use `_dev` locally and `_live` in prod; sync queue uses plain/`_dev` vs `_live`. Auth/user/forecast tables have NO suffix. `_live` tables hold real prod data with far higher row counts. As noted above, `serp_refresh_tokens`/`serp_password_reset_tokens` are documented as Retool but actually live in MySQL.

- ⚠️ **In-flight migration (2026-06-17): SERP's operational app tables are moving OFF Retool PostgreSQL INTO the new `serp_app` MySQL DB** (Hetzner, `SERP_APP_LIVE_DB_PARAMS['db']='serp_app'`, pool `backend/pools/serp_app_live.py` → `get_sync_serp_app_connection()` / `serp_app_live_pool`; migrations in `serp_app/migrations/*.sql` auto-run on `deploy-k8s.sh`). **Already hard-swapped (no dual-read/fallback): the auth bridge `serp_users` + `serp_user_counting_locations`** — `_resolve_retool_context` (`backend/dependencies.py`, every-request hot path) now reads serp*app, so **serp_app availability gates logins.** Counting tables (`serp_inventory_counts`/`_live`, `serp_vendor_inventory_counts`, `serp_beginning_inventory_snapshots`) + forecast/config tables are being migrated next. So the "AUTH / app config" + "FORECASTING caches" entries above are progressively becoming serp_app-resident, not Retool-resident — check the live code before assuming a `serp*\*`app table is still in Retool. **serp_app SQL gotcha:** the live pool is **pymysql, not SQLAlchemy`text()`** — positional `%s`is correct and the`text()`landmines (bare`%`, `:word`) do NOT apply; but psycopg2→pymysql means every migrated query is a hand-translated PG→MySQL rewrite.
- ❌ AI treats QuickBooks/Stripe/Shopify tables as live transactional sources → ✅ Reality: they're reporting/reconciliation mirrors; source systems are external. The mock dashboards are STALE (all-text numerics, 2022 dates).
- **Retool query timeout (live, June 2026):** 30s engine abort + JS wall-clock guard. MySQL: `SET SESSION max_execution_time = 30000`; PostgreSQL: `SET statement_timeout = 30000` (NOT via startup parameter — fails with "unsupported startup parameter").

---

### The Two Order Pipelines + the Odoo Sync Queue

There are **TWO completely separate order pipelines** plus a third merchandise worker — they behave differently and AI must not assume a unified queue.

**1. Odoo Sync Queue** (`odoo_sync_worker.py`; tables `odoo_sync_queue`/`_dev`/`_live` in Retool PG). Triggered when a Serpy draft is approved. Executes warehouse ops (pickings, MOs, BOMs, POs, bills) against live Odoo via **XML-RPC** and mirrors to darklaunch. **PO receipts flow through HERE**, not the darklaunch order worker. Worker polls every ~30s, `BATCH_SIZE=1` in prod, orders priority ASC then created_at ASC. Failures retry exponential backoff `5*2^attempts` capped at 300s; `max_attempts=5` → DLQ. A **circuit breaker** (CLOSED/OPEN/HALF_OPEN, 5-failure threshold, 30s reset) halts processing when Odoo is failing. Statuses: pending/processing/synced/partial/failed/dlq. `ODOO_SYNC_DRY_RUN=True` generates fake odoo_ids (`99990000 + entity_id`). Handlers live in `backend/workers/handlers/` (stock.py, purchasing.py, manufacturing.py, serp_orm/, laravel.py).

- ❌ AI assumes 'processing' items auto-recover → ✅ Reality: items stuck 'processing' from a worker crash are NEVER reset; no heartbeat/TTL/sweeper exists; requires manual admin intervention.

**2. Darklaunch Order Worker** (`darklaunch_order_worker.py`). **NO queue at all.** It dual-writes receiver-order + preselect-order rows into `serp_prod_darklaunch` ONLY (never the main DB), shadow-processing Odoo-sourced orders (`order_type IN ('receiver-order','preselect-order') AND inventory_source='odoo'`), reading read-only against Odoo/live MySQL for seeding, never pushing back to Odoo. **As of 2026-06-17 (PRs #181/#182/#183, deployed) it no longer polls live Laravel MySQL directly for new orders — a new `staging_copier_worker.py` ("staging copier", `STAGING_COPIER_ENABLED`, 5-min, `RECENT_WINDOW_DAYS=7`) copies recent Odoo-synced ec_order/preselect/items/component_orders rows from live Laravel (read-only, PII-stripped via an allow-list + `PII_COLUMNS` deny-map) into the local `serp_test` legacy tables; `detect_new_orders_odoo` (now SYNC, `store_id=2`) reads those local tables and decides "already synced" by `NOT EXISTS serp_sale_order` (no watermark, no flag). `serp_test` `ec_order.id` is a local AUTO_INCREMENT and detection joins on `ec.order_id`/`odoo_id` (never raw `id`). ⚠️ **Copier dup-bloat bug (found 2026-06-23):** `staging_copier_worker.py` declares `_PK['ec_order']='order_id'` and uses `INSERT … ON DUPLICATE KEY UPDATE`, but the staging `ec_order` table (schema mirrored from `manage_schema.json`) has `order_id` as a **non-unique** index — its only unique key is `PRIMARY(id)`, and `EC_ORDER_COLUMNS` omits `id` — so the conflict never fires and every 300s cycle plain-INSERTs ~5k fresh rows (live `serp_test`: ~950k rows for ~5.1k distinct orders, up to ~209 copies of one `order_id`). Sibling staging tables (`items`/`component_orders`/`preselect_orders`) are clean because their column lists DO include `id`. Detection stays *correct* (paths use `SELECT DISTINCT ec.order_id` + `NOT EXISTS serp_sale_order`) so this is a latent cost/timeout risk, not a missing-row cause. Fix: add a UNIQUE index on staging `ec_order(order_id)` via a `seeding/migrations/*.sql` migration (+ one-time dedup keeping `MAX(id)` per `order_id`), and/or have the copier write the real Laravel `id`.**

**3. Merchandise Order Queue** (`order_queue_worker.py`, gated by `ORDER_QUEUE_WORKER_ENABLED`, currently disabled). Polls `component_orders WHERE order_type='merchandise' AND inventory_source='serp'`, writes the main/live SERP DB. This is the path for custom-branding merchandise that goes 100% through SERP and never to Odoo (Jason's Feb 8 2026 decision).

**KEY ASYMMETRIES:**

- The darklaunch worker resolves Odoo `sale_order.id`/`sale_order_line.id` (via `sale_order.sw_id = ec_order.id`) BEFORE creating SERP rows. Orders that never reach Odoo intentionally get NULL odoo_ids.
- `sw_id` discriminates pipelines: `sw_id < 600,000,000` = receiver/ec_order (bridge via `ec_order`); `sw_id >= 600,000,000` = preselect/wholesale (bridge via `preselect_order_id`, NOT ec_order). Darklaunch worker discriminates at lines 446-447, 544-545.
- DETECTOR BUG: `detect_shipped_orders_odoo`/`detect_cancelled_orders_odoo` had a vestigial `ORDER BY ... DESC LIMIT 50` that permanently strands the oldest tail when in-flight candidates exceed 50 (~883 observed). Fix is oldest-first ordering (by replica `serp_stock_picking.create_date`) + a per-cycle cap. **GATE-THEN-LIMIT compounding (confirmed 2026-06-16):** `detect_cancelled_orders_odoo` applies `LIMIT 50` IN THE SQL (returning the oldest 50 _Laravel-canceled_ candidates) and THEN the Odoo-cancel gate in `_poll_cycle` filters those 50 down — so a cycle often processes far fewer than 50 actual cancels, worsening starvation. `detect_new_orders_odoo` has the same shape (`ORDER BY ec.id DESC LIMIT 50` at the SQL layer before the Python oldest-first re-sort, so the re-sort only reorders the already-truncated newest 50; same-day high-id floods saturate the window and held-then-shipped low-id orders ~900 ids below it are never fetched). The in-code comment claiming it "drains the backlog bottom-up" is WRONG. **NEW-ORDER side FIXED 2026-06-17:** `detect_new_orders_odoo` no longer does `ORDER BY ec.id DESC LIMIT 50` against live Laravel — it reads the locally-staged copy (populated by `staging_copier_worker`) and gates on `NOT EXISTS serp_sale_order` (gap-safe, no LIMIT-then-dedup), so new-order starvation is resolved. (The `detect_shipped_orders_odoo`/`detect_cancelled_orders_odoo` ordering issue is a separate path; verify current state before relying on it.)
- **CANCELLATION POLICY (Jack, 2026-06-16):** order cancellation in the darklaunch path must **NOT depend on Odoo to decide what to cancel** — the cancel decision should not read Odoo state at all. Replacement rule: **don't ship orders more than 1 year old** (age-based cutoff), not an Odoo-driven cancel gate.

**Worker process model & hangs:** All workers run in ONE process on ONE asyncio loop, supervised by an asyncio supervisor in `workers_main.py` (added after a May 29 2026 silent odoo-sync death; it restarts individual wedged coroutines). The darklaunch `_poll_cycle` is `async def` but does synchronous blocking PyMySQL work with NO yield, **starving the odoo-sync worker** (contrast: `order_queue_worker` uses `await asyncio.to_thread(_poll_cycle)`). Live 2026-05-29: odoo-sync stalled ~95 pending, syncing once per ~24-min darklaunch cycle. Blocking network/DB calls with no timeout (asyncpg `pool.acquire`, `xmlrpc.client.ServerProxy`, PyMySQL) run forever on idle-dropped sockets; PM2 keeps the process 'online' so nothing alerts. Fixes: PR #107 bounded `pool.acquire`, PR #108 per-poll `asyncio.wait_for` watchdog, XML-RPC socket timeouts. Recovery needs `pm2 restart`.

**Supervisor footgun:** it spams ERROR logs ("Worker X task is not running — restarting") every 30s for config-disabled workers (e.g. `ORDER_QUEUE_WORKER_ENABLED=false`, `EMAIL_ENABLED=false`) — these are intentionally disabled, not an outage.

---

### Darklaunch — The Parallel Odoo Shadow

**Darklaunch** is SERP's parallel validation system: SERP and Odoo run side-by-side, with Serpy dual-writing to BOTH plus a one-way Odoo→SERP sync. The cutover gate: **"<1% drift confirmed, stable for 2 weeks."**

**Cutover timestamps** (per-env, authoritative is `serp_darklaunch_meta.darklaunch_cutover_at`): primary 2026-05-30 14:14 MT; prod reseed **2026-06-04 09:27:20**; staging **2026-06-03 11:52:27**.

**The SERP 4-DB matrix:** `{prod, staging} × {replica, darklaunch}`, all MySQL with `serp_*` tables.

- **REPLICA DBs** (`serp_staging_replica`, `serp_prod_replica`) — clean row-for-row mirrors of `manage`/`laravel_live` with ZERO Odoo overlay; the app reads/writes these; nearly empty shells (frozen ~2026-05-28).
- **DARKLAUNCH DBs** (`serp_staging_darklaunch`, `serp_prod_darklaunch`) — replica PLUS Odoo overlay (normal BOMs, MOs, SVL, POs) where the worker dual-writes Odoo-style ops. `serp_prod_darklaunch` is the future production DB. The live prod darklaunch is `serp_test` on Hetzner 5.161.233.240 (consistently ahead, ~35K stock_moves vs ~34K in `serp_prod_darklaunch`).
- **Fingerprints:** darklaunch DBs have `_migrations` + `serp_darklaunch_meta`; replicas lack both. There is also a **predecessor `serp_shadow`** mechanism (Hetzner `serp_shadow` DB, gated by `SERP_SHADOW_WRITES_ENABLED`, with `serp_shadow_meta`/`serp_shadow_processed_events`, `shadow_cutover_at=2026-05-08`) — distinct from darklaunch and from the local `serp_local` dev schema.
- **Routing:** app DB via `SERP_ORM_ENV`/`ACTIVE_ODOO_DB_NAME` (default local-staging → `serp_staging_replica`); worker darklaunch via `DARKLAUNCH_DB_ENV` (e.g. `local-staging-darklaunch`, `live-darklaunch`). A single op writes the replica AND independently writes the darklaunch DB. "Empty list of Odoo entities" = a config routing issue, not a bug.
- ❌ "Darklaunch", "replica", "shadow", and `serp_test` are FOUR distinct things — and the "compare-replica" tooling actually compares darklaunch.

**The ISOLATION rule (forbidden to break):** the darklaunch worker queries Odoo ONLY to resolve IDs to stamp into `odoo_id` — it NEVER reads Odoo VALUES at runtime; everything else (products by SKU/default_code, locations) resolves against the LOCAL seeded darklaunch DB. Consequence: many drift/cost bugs trace to the SEED, not runtime. Fix in the seeder or reproduce Odoo's logic in SERP — never add an Odoo runtime read.

**`odoo_id_stamper`** (`workers/odoo_id_stamper.py`) is a SEPARATE post-create step opening its OWN darklaunch-pool connection (distinct from the worker's env connection) to resolve and write the real Odoo id into the local `odoo_id` column — the ONLY place the worker touches Odoo PG (via **asyncpg** through `odoo_pool.execute_query_via_loop`; psycopg2 cannot connect to the prod Odoo host at all — see the stamper-transport fix). It is fragile: runs while the worker's txn is uncommitted under REPEATABLE READ (so it can't see the worker's own picking → falls back to natural-key matching that mis-stamps a committed neighbor; observed ~84% NULL / ~16% mis-stamped); a dead idle Odoo PG connection silently breaks it (rows land `odoo_id=NULL`, frozen-frontier signature). The stamper must be wired into EVERY write-path (a real prod bug fixed 2026-06-03: it was only wired into the Serpy sync-queue path, not the order path). `/compare-darklaunch` only diffs rows where `odoo_id IS NOT NULL`, so unstamped children are silently excluded.

**Darklaunch Drift Monitor** (`/compare-darklaunch` tool + n8n workflow) — see n8n below.

---

### Serpy — The AI Ops Agent

**Serpy** (Slack bot `U096P936NQ7` / "SERPY Dev") is SERP's production AI inventory-operations agent — distinct from the SERP platform, and NOT a person.

- ❌ AI reads SERPY Slack messages as written by a human, or thinks SERPY is a typo for SERP.

It turns plain-language ops (Slack `/serpy` or web UI `serp.sugarwish.com/serpy/<draft_id>`) → JSON operations → Odoo via XML-RPC behind a Slack approval flow, dual-writing **Odoo + SERP + Laravel** and keeping IDs wired. Pipeline: user message → `classify_intent` → `find_products_with_locations` → `propose_operations` → **DRAFT** (`serp_draft_operations`/`_live`) → `POST /save-raw-draft` (validates via `OpTypeRegistry` JSON schemas in `serpy/ops/types.py`) → `POST /ai-submit` (DRAFT → PENDING_APPROVAL, Slack "Operations Request", enqueue) → human approval (ops managers like Carolyn; some ops need "@James @Neal") → queued to `odoo_sync_queue` → odoo-sync worker applies. Lifecycle: DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED. Drafts are numbered (e.g. "Draft #860"). Image transcription happens in `serpy/agent/transcribe.py` via a vision pass BEFORE the agent loop (agent never sees image bytes).

**Op routing is per-op-type, hardcoded — not decided at runtime per attribute.** Op families by target: `odoo_*` (create/update BOM, MO, po*receipt, po_confirm, create_component_everywhere, create_odoo_product), `serp*\_`(local phantom kits: serp_update_kit),`laravel\_\_`(manage MySQL: laravel_update_kit, laravel_update_receiver_product), plus create_product, inventory adjustment, transfer, archive, swap. A single op can write multiple systems. Retool front-end splits by DB: "Odoo Updates", "SERP Updates", "Laravel Updates", "Multi-DB Updates".`sync_target` is currently a DRAFT-level column (`odoo`/`serp`/`both`; prod is 100% `odoo`); per-operation routing is built in the backend but lacks the frontend dropdown.

- ❌ "Draft #683: 2/3 synced to Odoo" — x/y synced means x succeeded INTO Odoo, y = total ops; a partial count = Odoo-side validation REJECTED some ops, NOT a SERP failure.
- **Provenance bounds (product-creation go-lives):** `product_template` 2026-03-24, `create_product` 2026-04-13, `create_receiver_product_everywhere` 2026-05-05 — anything before its path's go-live cannot have been Serpy. `create_uid=55` (jack@sugarwish.com) is NOT a reliable Serpy signal (covers Serpy AND Jack's manual edits); authoritative ledger is `odoo_sync_queue_live`.

---

### n8n — Automation & the Drift Monitor

**n8n** is self-hosted (`n8n.sugarwish.com`); workflow exports live in `workflows/n8n/`. **n8n workflows intentionally write directly to production** — this is sanctioned and expected, separate from the read-only MCP DB access (via `sw_live_creds`/`Retool` credentials). Bot user `U08QP0DL9L5`. n8n exports are snapshots ("active" flag unreliable; workflow IDs differ from live — check `n8n.sugarwish.com` for actual state).

**Sanctioned prod writes & alerts:** `Disable_Unreserved_Products` (UPDATE `receiver_products SET status='disabled'` WHERE inventory_link=parent — runs every 1 min, known DEADLOCK source competing with Laravel/Retool writers, disable-only never re-enables); `Odoo Sync Monitor`/`Odoo Sync Issue Detector` (`bR4rEQjFI3GuwkiY`, every 10 min, posts to #api-autofix showing ~500 missing orders / 8-9% miss rate); low-inventory warnings (#live-product-warnings / #inventorymanagement at ~2x drop level); Daily Core SKU Report (~7am MDT); Order SKU/branding mismatch (hourly, flags `-E`/`-A` mismatches); `Cost_Tracker_Weekly_Average`, `Weekly_Cost_to_Scorecard` (consume SERP forecast `/api/forecast/cost-tracker/`); `Daily Operations Message`. **Alert fatigue is real** — most red-alert posts are auto-resolved noise (Seth: "No action on data/APIs should be necessary from alerts in #api-autofix").

Slack routing: #live-product-warnings (`C084Z9EKDSL`), #ops-and-tech, #api-autofix, #jack-test (`C083M27KU8L` / `C07GY977AEM` for daily ops errors), #billing (`C4086K801`), #inventorymanagement, #serp-errors.

**Darklaunch Drift Monitor** (n8n ids `HpHN9Reme3L6bNBd` / `IalsmpKBKbJM4LXg`) is a PORT of `compare_odoo_replica.py`. It runs hourly (cron `0 6-18 * * 1-5`, 6am-6pm MT Mon-Fri), windows the latest ~1000 ids per table from Odoo prod PG (the SOURCE OF TRUTH), joins darklaunch on `odoo_id` across ~42 tables, and Slack-alerts (to #jack-test) rows 30m+ old and MISSING ('sync gap') or settled-value drift (GRACE_MINUTES=30, WINDOW=1000, SAMPLES=5).

- **CODE-GENERATED by `scripts/build_darklaunch_drift_n8n.py` — DO NOT hand-edit the n8n JSON.** 9 linear nodes, LOOP-FREE (no SplitInBatches — it stalled ~14/42), uses a **Merge barrier** ("Wait For Both") because without it the report fires when only the 1st branch arrived → false-flags. Hard-won lessons: Slack `messageType:text` with mrkdwn (block-only `blocksUi` throws 'no_text'); date-only vs datetime tolerance; NULL↔numeric-zero coercion; float ±0.01; boolean↔0/1.
- **MOST FLAGGED 'DRIFT' IS NOT A BUG:** (A) post-seed/post-cutover Odoo staleness (Odoo crons edited rows after the seed snapshot; cleared by reseed); (B) by-design worker-row divergence on create-time columns (`sale_order.name='S'+ec_order_id` vs Odoo `ir.sequence`; `sale_order_line.sequence=10` always vs Odoo 10/300/301; worker skips Odoo's NULL-product separators — all in `WORKER_ROW_DIVERGENT_COLUMNS` suppression lists); plus intentionally suppressed `write_uid`/`create_uid`, picking-name drift, float noise; (C) ~6h Denver/UTC datetime offset. Only the minority are real bugs: dropped order lines when `product.default_code` is NULL, the seeder collapsing `partially_available`→`assigned`, and bin-level `location_id` divergence.

---

### sw-design, swirl/SWIRL, and livery/SWOP

- **`sw-design`** (Jason-driven, `jasonbkiefer`): holds design/config — the CustomGenie quiz, builder-classic PDP, box recipes, product-category sync, icon manifests. Clare McClaren (VP Creative & Merchandising) owns icons/design. A **full-overwrite sync from sw-design wipes** any genie/box/sleeve config edited directly in WishDesk — changes must be made in this repo.
- **`swirl` / SWIRL** (`jasonbkiefer/SWIRL`): two roles — (1) **SWIRL** = "Sugarwish Intelligence Reference Library", a company-wide AI knowledge platform (docs, MCP access, Slack bot); (2) the **WishWorks datastore** (auto-generated ticket commits; the `/ww` command self-updates from this private repo + an n8n archival step; the ticket "track" field determines repo/team ownership). SWIRL is SEPARATE from Jack's `sw-cortex`.
- **`livery` / SWOP** (GitHub `csloan-sw/livery`, "branded SWOP"): owned by **Criston (Cris) Sloan** (Automation Engineer, Slack `U040UH4GVPX`, SERP user id 13, reports to COO Matthew Patrick). Two jobs: (1) the warehouse **print-station backbone** + an MCP ops-tooling suite (`mcp-db-tool`, `mcp-slack`, `mcp-wishdesk`, `swim-kb`, `custom-shop-slip` PDF); (2) **sleeve imposition / printing** — `fulfillment/custom-shop-slip/lib/slip-data.js` `selectSleeveEntries` filters `branding_records.physical_branding.entries[]` by `ec_order.size` (which is actually a `buyer_products.id`), then `sleeve-pdf.js imposeBatch` maps `box_sku` → a hardcoded `SKU_TRIM_TABLE` for print dims. **CRITICAL: livery caches PDFs by orderId ONLY and NEVER invalidates on branding edits** — after a data fix an operator MUST click "Regenerate" (`POST /reset-status/:orderId`) then re-run generate-batch. A missing `SKU_TRIM_TABLE` key (e.g. `h_*` hot-sauce, `c_3`) throws and aborts the whole PDF (silent "no sleeve").

---

### Source-of-Truth Per Entity (the single biggest cross-system rule)

There is NO uniform sync direction. Ownership is split:

| Entity                                                | Owner / Source of truth                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Manufacturing/normal BOMs, MOs, product creation, POs | **Odoo** (SERP reads live, writes back via `odoo_sync_queue` → XML-RPC)                     |
| Phantom kits                                          | **SERP-local** (`serp_mrp_bom type='phantom'`, edited via `serp_update_kit`)                |
| `receiver_products` classification, `component_kits`  | **Laravel** (SERP writes to `manage` MySQL via `laravel_*` ops)                             |
| Custom-branding merchandise (sleeves, mugs, apparel)  | **SERP only — never Odoo** (Jason Feb 8 2026)                                               |
| What's AVAILABLE to sell                              | **Laravel** (deducts pending orders Odoo doesn't know about)                                |
| Canonical on-hand / available inventory               | **Odoo** stock_quant; RM inventory exists ONLY in Odoo                                      |
| Payment status                                        | **QuickBooks** (external) — Odoo `payment_state` is 99.8% 'not_paid' and never reconciled   |
| Forecast metric definitions                           | **Jason Kiefer**; canonical view is `serp.sugarwish.com/forecast/live-products`, not Retool |

When SERP-origin and Odoo-origin data collide on a natural key, **SERP usually wins** (users matched by email; exceptions exist).

**The `odoo_id` join rule (CRITICAL):** join cross-system tables NEVER on `id=id` — join on the `odoo_id` column. The ID space is partitioned: Odoo-origin rows have `id=odoo_id` (<1B); SERP-runtime post-seed rows have small ids above MAX(odoo_id) with `odoo_id=NULL`; SERP-merge rows have `id>=1B` with `odoo_id=NULL`. The seeder bumps AUTO_INCREMENT to 1B during seed then resets to MAX(odoo_id)+1. The durable "SERP-origin" signal is **`odoo_id IS NULL`, NOT `id>=1B`** (old code filtering id<1B became wrong after finalize). Child rows (stock_move, move_line, quant) get the parent stamped but leave child `odoo_id=NULL` until later stamped.

**Fabricated/encoded IDs (landmines):**

- `components.odoo_id` is SYNTHETIC `'800' + components.id` (varchar) — NOT a real Odoo product id. Joining it to an Odoo PK matches wrong rows. The real bridge is `product_template.sugarwish_id`.
- `buyer_products.odoo_id` = `'500' + buyer_products.id` (e.g. id 42 → 50042); maps to Odoo `product_template.sugarwish_id`.
- `product_template.sugarwish_id` (THE external sync key, on the template not the variant) decodes by prefix: `'800'` → strip to get `components.id`; other int → `receiver_products.product_id` OR `buyer_products.id`; 0/NULL → no mapping.
- `oddo_synchronized` is a permanent **typo** (not `odoo_`) — the real Laravel→Odoo sync flag on `ec_order` (values 0=pending, 1=synced ~3.9M, 2=in-flight, 5=vendor/special; value 3 does NOT exist in prod contrary to old reports).
- `ec_order.size` is misnamed — it actually holds a `buyer_products.id`, NOT a physical size.

**Two MCP `db` aliases to keep straight:** `laravel_live` (live SugarWish orders, with empty embedded `serp_*` tables — NOT SERP data) vs `manage` (Laravel staging + SERP's upstream ORM tables, also stale). Live SERP transactional data is ONLY in the darklaunch DBs.

---

## The Databases — Data Dictionary (tables, columns, enums)

This section is the per-database, per-table, per-column reference for SugarWish's data landscape. Name tables and columns EXACTLY as written. Enum values, ID conventions, and SQL gotchas are load-bearing — do not paraphrase them away.

### The 14-Database Landscape & How to Fingerprint a Table

SugarWish runs **14 databases** across MySQL and PostgreSQL (the 14th, `serp_app`, is wired in code but becomes queryable only after the db MCP server is restarted — until then `mcp__db__list_databases` returns 13). The unified `mcp__db__*` tools address them by these MCP names (from `.claude/rules/databases.md`):

| MCP name                                          | Engine     | Role                                                                                                         |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `wishdesk`                                        | MySQL      | WishDesk/SWAC CS+CRM+design+billing (SSH tunnel)                                                             |
| `wishdesk_dev`                                    | MySQL      | WishDesk dev twin (~5K vs ~64K prod users; has in-progress tables not yet in prod)                           |
| `laravel_live` / `sugarwish`                      | MySQL      | **LIVE** Sugarwish e-commerce/order domain (AWS RDS `database-1.cqqg1tfyyubp.us-east-1`, SSH tunnel)         |
| `manage`                                          | MySQL      | Laravel **staging** DB; also hosts SERP ORM upstream tables; renamed 2026-05-11 from "laravel staging"       |
| `odoo`                                            | PostgreSQL | **Production** ERP/inventory/accounting source of truth (Odoo 15, cloud-hosted on Odoo.sh — no shell access) |
| `odoo_staging`                                    | PostgreSQL | Odoo staging (credentials rotate frequently — check `#odoo-prixite`)                                         |
| `retool`                                          | PostgreSQL | Analytics/ops + SERP sync engine + SERP auth bridge + forecast caches (~123-165 tables; **NOT SERP-owned**)  |
| `local` (`serp_local`)                            | MySQL      | Partial SERP dev schema (port 3307); uses predecessor "shadow" mechanism                                     |
| `serp_test` / `live_darklaunch_db`                | MySQL      | **Live PRODUCTION darklaunch mirror** on Hetzner `5.161.233.240:3306`                                        |
| `serp_prod_replica`, `serp_staging_replica`       | MySQL      | Clean Laravel mirrors (no Odoo overlay)                                                                      |
| `serp_prod_darklaunch`, `serp_staging_darklaunch` | MySQL      | Replica + Odoo overlay (worker dual-writes Odoo-style ops)                                                   |

**SERP's 4-DB matrix**: `{prod, staging} × {replica, darklaunch}`, all MySQL with `serp_*` tables.

- **Replica DBs** (`serp_prod_replica`, `serp_staging_replica`): row-for-row mirrors of `manage`/`laravel_live`, **ZERO Odoo overlay**, nearly empty shells (~19 SO/~19 moves, frozen 2026-05-28).
- **Darklaunch DBs**: replica PLUS Odoo overlay (normal BOMs, MOs, SVL, POs). `serp_prod_darklaunch` is future production. `live_darklaunch_db`/`serp_test` on Hetzner is the canonical prod write target and runs consistently ahead (~35K stock_moves vs `serp_prod_darklaunch`'s ~34K).

#### Fingerprinting which DB a table belongs to

- **`serp_*` prefix** → SERP's MySQL mirror of an Odoo model (dots→underscores: `stock.picking`→`serp_stock_picking`, `purchase.order`→`serp_purchase_order`, `mrp.bom`→`serp_mrp_bom`, `account.move`→`serp_account_move`, `res.partner`→`serp_res_partner`).
- **Unprefixed same name** (e.g. `stock_picking`, `mrp_bom`, `account_move`) → native **Odoo PostgreSQL**.
- **`swcrm_*`, `swcrm_z_gmail_*`, `orders_tickets`, `live_chat_*`, `design_*`, `sw_billing_*`, `merchandise_*`, `quiz_*`, `crm_*`** → **WishDesk** MySQL.
- **`ec_order`, `giftcards_card`, `buyer_products`, `receiver_products`, `components`, `kits`, `preselect_orders`, `items`, `branding_records`** → **Laravel** (`laravel_live`/`manage`).
- **`serp_users`, `serp_draft_operations`, `odoo_sync_queue*`, `sa_projections_cache`, `size_projections*`, `sku_projections`, `quickbooks_dashboard`, `opportunities` (Insightly)** → **Retool** PostgreSQL.
- **Fingerprint tables**: `_migrations` + `serp_darklaunch_meta` present → darklaunch DB (replicas lack both). `serp_shadow_meta` → local dev predecessor. Replicas have NO Odoo-owned/manufacturing tables.
- **Suffix convention in Retool**: BASE locally, `_dev` locally for AI tables, `_live` in prod (e.g. `serp_draft_operations` vs `serp_draft_operations_live`; `serp_ai_messages_dev` vs `serp_ai_messages_live`; `odoo_sync_queue` / `odoo_sync_queue_dev` / `odoo_sync_queue_live`). `_live` tables hold real prod data with far higher row counts. Auth/user/forecast tables have NO suffix.

❌ AI assumes `laravel_live` is SERP-only or pure orders → ✅ Reality: it's the live Sugarwish app DB that ALSO co-hosts early `serp_*` pilot tables which are essentially **empty** (~19 `serp_sale_order`, 0 POs) — NOT live SERP data. Live SERP data lives in the darklaunch DBs.

❌ AI assumes `serp_test` is a throwaway test DB → ✅ Reality: it IS the live production darklaunch mirror on Hetzner.

---

## ODOO (PostgreSQL) — ERP / Inventory / Accounting Source of Truth

Odoo 15 (v15.0.1.3), ~584-740+ tables. Source of truth for products, BOMs, manufacturing, POs, stock movements, FIFO valuation. Statement timeout **330s** on prod. Catch-all customer partner is **id=94 "SW Customer"** (all ~2.21M sale orders).

### Products

#### `product_template` (~6,961-7,278 rows; ~5,804-6,167 active)

Product MASTER at template level.

- `name`, `default_code` (template SKU), `sku`, `categ_id`→`product_category` (drives FIFO costing + GL), `list_price` (often 1.00 placeholder), `uom_id`, `uom_po_id`, `active` (archive), `tracking` (`none`/`lot`/`serial` — all `none`, lot/serial NOT in use), `landed_cost_ok`, `split_method_landed_cost`.
- `detailed_type` enum: `product` (storable, ~6,167), `consu` (consumable, not inventory-valued, ~1,109), `service` (~2).
- **`sugarwish_id` = THE external sync key** (NOT on `product_product`). Decode: prefix `'800'` → strip to get `components.id` (e.g. 800439→component 439); prefix `'500'` → `'500'`+`buyer_products.id`; other int → `receiver_products.product_id` OR `buyer_products.id`; 0/NULL → no mapping (~1,371 templates).

#### `product_product` (~4,211-7,278 variants)

- `default_code` = SKU (cross-system join key, e.g. `SA-15-014-A`). **~482-483 rows have NULL `default_code`** (dupes/ghosts) — MUST exclude with `WHERE default_code IS NOT NULL` in sync queries.
- `product_tmpl_id`, `active` (false=archived; archived variants STILL hold `stock_quant` and `assigned` reservations — filter `active=true` for LIVE inventory but NOT for history audit), `barcode`, `weight`, `volume`, `combination_indices`.
- Raw `product_id` is NOT the SugarWish id — go through `product_template.sugarwish_id`.

#### `product_category` (~137 rows)

- `name`, `complete_name`, `parent_id` (self-FK tree), `parent_path`, `removal_strategy_id` (NULL all → default FIFO), `sugarwish_id`.
- **`cost_method`/`valuation` are NOT columns** — stored as Odoo `ir_property` keyed `res_id='product.category,<id>'`; prod has `property_cost_method='fifo'` universally.
- Tree organized by PRODUCT TYPE (01-Candy, 02-Popcorn, 03-Cookies, 06-DogTreats, 08-Coffee&Tea, 10-WineTastings, 14-Wine, 15-Flowers, 16-Candles, L-Labels, C-Carton) then by role (`-Packed Product`=sellable, `-Raw Materials`). Tasting-kit pack sizes encoded by category id: **55=3-pack, 56=6-pack, 57=9-pack, 165=12-pack, 190=4-pack, 202/203/205/206=monthly 6-pack**.

#### `product_supplierinfo`

- `name` = SUPPLIER as `res_partner.id` cast to int (NOT text), `price`, `min_qty`, `delay` (lead-time days), `date_start`/`date_end`, `sequence` (priority), `product_code`/`product_name` (vendor's). **NO `case_qty` column** (would require migration).

### Stock / Inventory

#### `stock_quant` (~14,729 records, 4,211 products × 424-502 locations)

On-hand snapshot.

- `quantity` (on-hand), `reserved_quantity` (allocated). **AVAILABLE = quantity − reserved_quantity.**
- `inventory_quantity` (counted), `inventory_diff_quantity` (variance), `inventory_date` (count date), `inventory_quantity_set` (count-pending flag), `lot_id`, `in_date` (FIFO arrival), `unit_cost`, `accounting_date`, `user_id`.
- **ANOMALY**: ~482-5,918 records with **negative quantities** (-37.8M to -189,619 units): Vendors (-25.2M), Production (-7.2M), Inventory adjustment (-5.2M), Stock (-81K internal), Fulfillment (-20K internal). Negatives in VIRTUAL locations are normal Odoo double-entry; only INTERNAL-location negatives are real problems (root cause: cycle count doesn't drop reservations → quantity=0 with reserved>0 = negative available = negative West Coast Qty in Laravel).

#### `stock_move` (~14.5-15.8M rows)

Inventory transaction spine. One row per product movement.

- `state` enum: **draft, confirmed, waiting, partially_available, assigned, done, cancel** (7 states; `assigned`=reserved-not-shipped; **only `done` actually changes inventory**).
- `product_uom_qty` (planned), `product_qty` (reference UoM), `quantity_done`, `location_id` (source), `location_dest_id` (dest), `state`, `price_unit`/`cost`, `date`, `reservation_date`.
- Link FKs: `bom_line_id` (MO/kit-exploded moves; ~30-95% coverage), `sale_line_id` (delivery moves; ~90% coverage), `purchase_line_id` (receipts; PRIMARY PO→inventory link), `production_id` (finished output), `raw_material_production_id` (component consumption), `picking_id`, `is_inventory` (true for count adjustments).
- **CRITICAL perf**: NEVER filter `state` with negated predicate (`NOT IN`/`!=`) on this table — forces seq scan, kills 330s timeout. Use **positive** `state IN ('draft','confirmed','waiting','partially_available','assigned')`.
- **CRISIS**: ~48,909 moves stuck in assigned/confirmed/waiting with active `sale_line_id` (oldest May 2023), permanently locking `reserved_quantity`. Top product `B-CCC-REG-22-MUG-XXX` with 2,404 stuck. ~1.3M rows have zero `product_qty`.

#### `stock_move_line` (~13.3-14.5M rows)

Execution detail. `move_id`→`stock_move`, `product_uom_qty` (reserved), `qty_done` (executed), `lot_id`, `location_id`/`location_dest_id`, `state`, `unit_cost`, `total_value`. ~413 rows zero `unit_factor` (division hazard).

#### `stock_picking` (~650K-2.9M rows)

Batch of moves.

- `state` (draft/confirmed/assigned/done/cancel), `picking_type_id`, `move_type` (`direct`/`one`), `origin` (PO name like `P02056`, `RO-200#####` receiver-order, `PSO-6####` preselect — **text reference, NOT FK** to PO), `location_id`/`location_dest_id`, `date_done`, `backorder_id`, `sale_id` (FK to sale_order, ~99.6% used), `date_deadline` (~99.7% used).

#### `stock_picking_type` (135 rows; 9 types × 15 warehouses)

- `code` enum: `incoming` (Receipts+Returns, 30), `outgoing` (Delivery, 15), `internal` (Pick/Pack/Transfers, 75), `mrp_operation` (Manufacturing, 15).
- `sequence_code` prefixes: IN, OUT, INT, PICK, PACK, PC, SFP, MO.
- EW: 1=Receipts, 2=Delivery, 3=Pick, 5=Internal, 6=Returns. TY: 10=Receipts, 11=Delivery, 14=Internal. WCC: 46=Receipts.

#### `stock_location` (~2,384-2,686 rows, ~20-level hierarchy)

- `usage` enum: `internal` (real stock, ~2,654-2,661), `view` (grouping ~18), `supplier` (Vendors id=4), `customer` (Customers id=5/id=3), `production` (id=15), `transit` (id=6/13), `inventory` (id=14 adjustments / id=16 Scrap).
- `name`, `complete_name` (full path e.g. `EW/Stock/ROW2-P4-UP`), `parent_path` (materialized ancestry `1/7/8/2962/`), `location_id` (parent self-FK).
- **`sugarwish_id` controls Laravel sync**: `>0` (only `EW/Stock/Fulfillment` id=2008 has =1) syncs to Laravel; `=0` internal Odoo-only; `NULL` virtual/system. `sugarwish_code` (mostly NULL).
- **Key IDs**: EW/Stock=8, EW/Stock/Fulfillment=2008, TY/Stock=20, TY/Stock/Fulfillment=2006, EW/Packing Zone=12, EW/Pre-Production=17, EW/Post-Production=18, Production=15, Wine/WCC=5.
- **ANOMALY**: 88 exact-duplicate active shelf locations (worst: `TY/Stock/R4-7-AR` exists 4× as IDs 3391, 4437, 4438, 4439). Test IDs 2001/2002 (`EW/Stock/Zone1/2`) referenced in Retool but DO NOT exist here.

#### `stock_warehouse` (15 rows, 13 active)

EW=1, TY=2, plus partner/dropship. `lot_stock_id` = main internal Stock (EW=8, TY=20). reception/delivery/manufacture_steps=`one_step` everywhere.

#### `stock_valuation_layer` (SVL) (~13.2-13.4M rows)

FIFO ledger. `quantity` & `value` SIGNED (positive inbound, negative outbound), `unit_cost`, `remaining_qty`/`remaining_value` (unconsumed inbound), `description` (e.g. `EW/IN/02132 - <product>`), `categ_id`, `stock_move_id`, `account_move_id` (GL), `stock_landed_cost_id`, `stock_valuation_layer_id` (self-FK child revaluation), `parent_layer_id`. **NO `sequence_number` column** — FIFO order is layer `id`/`create_date` ascending. Only ~3,705-3,900 inbound layers with `remaining_qty>0`; sum `remaining_value` = current inventory $.

#### Other stock tables

- `stock_landed_cost`: freight/duty allocation; `split_method` (`equal`/`by_quantity`/`by_current_cost_price`=54 most common/`by_weight`/`by_volume`), `state` (`draft`/`done`), `account_move_id`, `vendor_bill_id`.
- `stock_scrap` (~1,388-1,590 rows): `scrap_qty`, `state` (`draft`/`done`), `scrap_location_id`, `move_id`.
- `stock_lot`/`stock_production_lot`, `stock_warehouse_orderpoint` (reorder rules, NOT in SERP plan), `stock_putaway_rule` (288 rows), `stock_location_route` (66 rows).

### Manufacturing (MRP)

#### `mrp_bom` (~2,078-2,115 total: ~1,303-1,310 normal + ~775-786 phantom; ~207-265 active phantom)

- `type` enum: `normal` (manufactured via MO) vs `phantom` (kit/exploded at sale time, NO MO).
- `product_tmpl_id`, `product_id` (variant override — **~99.8% NULL**, template-level only → SERP `bom_find()` matching by `product_id` fails), `product_qty` (output, usually 1.0), `consumption` (`flexible`/`strict`/`warning`), `ready_to_produce` (`all_available`/`asap`), `code`, `picking_type_id`, `active`.
- Phantom BOMs create ZERO `mrp_production` records. Phantom kit maps to Laravel via `product_template.sugarwish_id` = `buyer_products.odoo_id`. Component SKU prefixes in phantom lines: S- (sweets, 238-253), P- (packaging/paper, 253-525), I- (inserts, 101-244), E- (extras, 46), L- (labels, 34-94), B- (boxes, 25-67), T- (tape, 22-77 all qty=0), C- (cards, 13).

#### `mrp_bom_line` (~6,478-14,000 rows)

- `bom_id`→`mrp_bom`, `product_id` (component), `product_tmpl_id`, `product_qty` (qty per parent unit), `product_uom_id`, `sequence`, `operation_id` (FK to routing for per-step/conditional components).
- **CRITICAL ANOMALY**: ~30-48+ active SA→RM BOM lines have **`product_qty=0`** (optional/conditional packaging) → division-by-zero in `inventory_variance.py`. Always filter `AND product_qty > 0` before using as denominator. Affected: SA-01-012/024/029/030/033/053/060/077/078/091/098/110/119/132-A, SA-05-045/049/051/052/055/058-A, +more.
- **MISSING INDEX on `bom_id`** (critical for JOINs).

#### `mrp_production` (~26,195-28,000 rows, mostly historical)

Manufacturing orders.

- `name` (MO ref like `WH/MO/00848`), `product_id` (finished good), `product_qty` (planned), `qty_producing`, `bom_id`.
- `state` enum: draft (~21-28), confirmed (~9-13), progress, to_close (~3-9), done (~25,581-27,300), cancel (~584-594).
- `reservation_state` (NULL done / confirmed waiting / assigned reserved), `location_src_id`, `location_dest_id`, `production_location_id`=15, `date_planned_start`/`_finished`, `date_start`/`_finished`, `consumption`, `extra_cost`, `move_raw_ids`, `move_finished_ids`, `is_locked`, `is_planned`.
- **Cross-warehouse pattern (NOT error)**: ~6,191 MOs have source TY/Stock(20) but dest EW/Stock/Fulfillment(2008).

#### `mrp_bom_byproduct`, `mrp_unbuild`, `mrp_routing_workcenter`

- `mrp_unbuild` (~200 rows): reverse-manufacturing. `product_qty`, `state` (`draft`/`done`), `mo_id`, `bom_id`. **Unbuild ADDS component stock and REMOVES finished-good** (inverse of MO); only `done` moves inventory.

### Purchasing

#### `purchase_order` (~1,846-1,992 rows; ~1,696-1,833 'purchase')

- `name` (P##### e.g. P02056), `partner_id` (vendor), `state` enum (`draft`/`sent`/`to approve`/`purchase`/`done`/`cancel`).
- **THREE distinct dates (CRITICAL)**: `date_order` = PO CREATED (NOT arrival); `date_planned` = expected delivery (user estimate); **`effective_date` = ACTUAL arrival** (NULL until receipt picking validated `state=done`) — **USE `effective_date` for "has PO arrived" / inventory variance**.
- `date_approve` (~94% used), `invoice_status` (INDEPENDENT of state: `no`=not received/`to invoice`=ready-to-bill/`invoiced`=Fully Billed-of-received-qty — NOT whole-PO-settled), `amount_untaxed`/`tax`/`total`, `picking_type_id`, `group_id` (procurement, ~94% used). `payment_term_id`/`incoterm_id`/`fiscal_position_id` = 0 rows used.

#### `purchase_order_line` (~14,549-17,391 rows)

- `order_id`, `product_id`, `product_qty` (ordered), `qty_received` (auto-updated from validated stock_move; method `stock_moves`/`manual`), `qty_invoiced`, `qty_to_invoice` (= received − invoiced), `price_unit` (often 0.00 at PO creation, ~7% zero), `date_planned`, `state` (mirrors parent), `display_type` (`section`/`note` for non-item lines).
- `sale_order_id`/`sale_line_id` exist for drop-ship but EMPTY (0 rows) — POs are pure replenishment.
- **ANOMALIES**: ~266 lines partially received; **~20 lines OVER-received** (`qty_received > product_qty`: P01654 +30K, P00749 +28.8K, P00449 +24.5K); 10 cancelled POs (P00010/11/57/58/68/89/94/117/174/199) have 2-18 active stock moves.

### Accounting (GL)

#### `account_move` (~13.2M rows, mostly auto inventory entries)

- `move_type`: `entry` (plain GL, ~13.22M auto inventory/COGS STJ postings), `in_invoice` (VENDOR BILL ~1,569-1,719: 1,201-1,344 posted + 358-362 draft), `in_refund` (vendor credit), `out_invoice` (customer, only 1, unused).
- `state` (`draft`/`posted`/`cancel`), `payment_state` (`not_paid`/`in_payment`/`paid`/`partial`/`reversed` — **99.8% `not_paid`** because payment tracking is in QuickBooks, NOT Odoo; field is NOT source-of-truth), `amount_total`/`untaxed`/`tax`/`residual`, `invoice_date`/`invoice_date_due`, `invoice_origin` (PO name e.g. `P00876`), `journal_id`, `partner_id`.
- Bills linked to POs TWO ways: `invoice_origin='P#####'` AND junction **`account_move_purchase_order_rel`** (~1,722 rows; one PO → many bills, e.g. P00876 has 7 bills; one bill → multiple POs rare; **100% linkage**).

#### `account_move_line` (~24.3M rows)

- `move_id`, `debit`/`credit`/`balance`, `account_id`, `purchase_line_id` (direct bill→PO-line match, how `qty_invoiced` attributed), `is_landed_costs_line`, `is_anglo_saxon_line` (COGS auto-entry — true=system offset, NOT human-entered; **0 rows** since Sugarwish is Continental not Anglo-Saxon), `tax_line_id`, `reconciled`/`full_reconcile_id` (exists but NOT populated for bills).
- `display_type` enum: `product` (real lines), `tax`, `payment_term`, `line_section`, `line_note`, `rounding`. **`product_id` NULL = tax/section/balancing line** (don't sum).

#### `account_journal` (8 journals, heavily skewed)

- `type` (`sale`/`purchase`/`bank`/`cash`/`general`), `default_account_id`.
- **STJ "Inventory Valuation" (id=6)** receives ~12.2-13.2M auto COGS/stock entries. **BILL "Vendor Bills" (id=2)** ~1,594-1,719. INV/BNK1/MISC barely used.
- **GL accounts**: 110100 Stock Valuation, 110200 Stock Interim Received, 110300 Stock Interim Delivered, 500000 COGS/Expense. Anglo-Saxon COGS chain: receipt DR 110100/CR 110200; delivery DR 110300/CR 110100; COGS DR 500000/CR 110300; vendor bill DR 110200/CR A/P.

#### `account_account` (~41 rows)

- `code`, `name`, `internal_group` (reliable P&L bucket: asset ~18, expense ~10, liability ~6, income ~4, equity ~3 — don't infer from code prefix), `internal_type`, `reconcile`, `deprecated`.

#### `account_tax` (2 active: 15% sale/purchase placeholders)

- `type_tax_use` (`sale`/`purchase`/`both`), `amount_type` (`percent`/`fixed`), `amount` (15.0000), `price_include`, `tax_exigibility`. **NOT system of record for US sales tax — Avalara AvaTax is external.**

### Partners, Sales, Utilities

- **`res_partner`** (~294 rows): vendor/supplier directory, NOT customer DB. `supplier_rank` (int >0 = vendor; 1=preferred/2=alternative/3+=lower), `customer_rank` (**0 for EVERY row** — no individual customers stored), `is_company`, `type` (`contact`/`invoice`/`delivery`/`other`/`supplier`), `commercial_partner_id`, `email`/`phone`, address, `purchase_warn`/`invoice_warn`/`sale_warn`. SugarWish extension: `weeks_on_hand` (NOT standard Odoo). Catch-all id=94 "SW Customer".
- **`res_users`**: internal logins/bots ONLY (NOT customers). `login`, `active`, `share`, `partner_id` (1:1). To get name/email, join `partner_id`→`res_partner`. `id=55` = jack@sugarwish.com = Serpy writes AND Jack's manual edits (so `create_uid=55` is NOT a reliable Serpy signal). Author map: 76=Neal, 87=Mike, 240=James, 262=Nicole.
- **`sale_order`** (~2.21M rows, all partner 94): `sw_id` (= `ec_order.order_id`, the bridge), `sw_datetime`, `name` (`S######`), `state` (quotation/sent/sale/done/cancel), `increment_id`.
- **`res_currency`**: id=2=USD ONLY active. **`uom_uom`**: `category_id`, `factor` (relative to category ref; ~413 rows factor=0 = division hazard), `uom_type` (`reference`/`bigger`/`smaller`). **`res_company`**: single row id=1 "Sugarwish Englewood", `currency_id`=2, `partner_id`=1.
- **`ir_property`**: holds `standard_price` & cost_method keyed `res_id='product.product,<id>'`/`'product.category,<id>'`.
- **`ir_attachment`**: centralized file storage (`res_model`, `res_id`, `db_datas`, `store_fname`, `checksum`, `url`); product images live here, NOT on product tables. `mrp_production`/picking/MO carry NO chatter (PO-only ~5,607 messages). `failed_order_logs`/`failed_products_log` (EMPTY tables).

---

## SERP (`serp_*` tables, MySQL) — In-House ERP Mirror

SERP mirrors ~58 Odoo models as `serp_*` MySQL tables plus a handful of SugarWish-domain tables. Same column semantics as Odoo equivalents above.

### Critical SERP id / odoo_id join rule

- **JOIN NEVER `id=id` — always join on the `odoo_id` column** (primary cross-system key). `odoo_id` (bigint, nullable) holds the PK of the matching Odoo record; **NULL = SERP-only / not-yet-synced** (NOT invalid).
- ID space partitioning: (1) Odoo-origin rows have `id=odoo_id` (<1B); (2) SERP-runtime post-seed rows have small ids above MAX(odoo_id) with `odoo_id=NULL`; (3) SERP-merge rows have `id>=1B` with `odoo_id=NULL`. Seeder bumps AUTO_INCREMENT to 1B during seed, resets to MAX(odoo_id)+1 at finalize.
- **Durable "SERP-origin" signal is `odoo_id IS NULL`, NOT `id>=1B`** (old `id<1B` filters became wrong post-finalize). Better worker-row signal: `name='S'+ec_order_id` or odoo_id origin, not `id!=odoo_id`.
- **`/compare-darklaunch` only diffs rows where `odoo_id IS NOT NULL`** — unstamped worker children (stock_move/line/quant with `odoo_id=NULL`) are silently EXCLUDED (false "no-overlap").
- **ZERO UNIQUE constraints or indexes on `odoo_id`** across `serp_*` tables.

### Core mirror tables (selected exact columns / divergences)

- **`serp_stock_move`**: state enum **MISSING `partially_available`** (only draft/confirmed/waiting/assigned/done/cancel — seeder collapses Odoo's `partially_available`→`assigned`). `quantity_done` is **computed store=False** from move_lines (writing it silently no-ops — must edit `serp_stock_move_line.qty_done`). `product_qty` ALWAYS NULL (known UoM-normalization bug). `purchase_line_id`, `sale_line_id`, `production_id`, `raw_material_production_id`, `odoo_move_id`. No row-level locking → duplicates if run in parallel.
- **`serp_stock_picking`**: state enum ALSO missing `partially_available`. SERP extension `purchase_order_id` (FK — Odoo uses `origin` string). `sale_id` = `ec_order.increment_id`. picking_type_id 1=EW/IN, 10=TY/IN.
- **`serp_stock_quant`**: `quantity`/`reserved_quantity` (DECIMAL 16,4), `available_quantity` = quantity − reserved, dual product tracking `component_id` OR `receiver_product_id` (use ONE), `odoo_quant_id`.
- **`serp_stock_valuation_layer`**: `account_move_id` link, `stock_landed_cost_id`, `parent_layer_id`. NO `sequence_number`.
- **`serp_product_product`** (~3,007-7,387 rows): bridges via THREE mutually-exclusive FKs `component_id` / `receiver_product_id` / `buyer_product_id` (at most one). `default_code` (SKU) lives here, NOT on template. `receiver_product_id` is Integer (because `receiver_products` PK is `product_id` not `id`).
- **`serp_mrp_bom`** (frozen ~224-406-row snapshot from **2026-04-03**, identical create_date, **NO `odoo_id` links**, only `type='phantom'` in some copies, `type='normal'` only in darklaunch overlay; ~29% coverage of Odoo phantoms). `/boms` page filters `type='normal'`, `/kits` filters `type='phantom'`.
- **`serp_purchase_order`**: `po_type` enum (`inventoried`/`service`/`blanket`/`distribution`), `parent_blanket_po_id` (self-FK blanket), two-tier approval timestamps, `receipt_status`. **NO `odoo_id`** (locally-created POs don't sync yet). **FK bug**: `serp_purchase_order_line.order_id` references OLD `purchase_order` table (migration 008 renamed but didn't update FK).
- **`serp_account_move`** (~20-24 cols vs Odoo's 78): direct `purchase_order_id` FK (Odoo uses junction). `move_type`/`state`/`payment_state` enums as Odoo. `serp_account_move_line` uses **`component_id` instead of `product_id`** (causes `action_reverse` bug accessing nonexistent `component_id`); `debit`/`credit`/`balance` are **Float not Decimal** (precision loss); `amount_residual` plain field default 0, NOT computed.
- **`serp_res_users`** / **`serp_res_groups`** (group-based RBAC; Odoo groups base.group_user=1, base.group_portal=2, base.group_system=4, stock.group_stock_user=7), **`serp_res_partner`** (290/295 have odoo_id), `serp_audit_logs`.
- Missing AUTO*INCREMENT on `serp_res_currency`/`serp_stock_location`/`serp_stock_picking_type` id columns → INSERT 1048 errors. M2M rel tables missing `serp*` prefix (`purchase_order_stock_picking_rel`, `stock_move_line_consume_rel`).
- Fingerprint tables: `_migrations` (schema ledger), `serp_darklaunch_meta` (key/value; `darklaunch_cutover_at` per env — prod **2026-06-04 09:27:20**, staging **2026-06-03 11:52:27**, primary cutover **2026-05-30 14:14:26 UTC**), `serp_shadow_meta` (`shadow_cutover_at`=2026-05-08, local dev).

---

## LARAVEL (`laravel_live` / `manage`, MySQL) — E-Commerce & Order Domain

`laravel_live`: ~4.92M `giftcards_card`, ~4M `ec_order`, ~150K `company`. `manage`: ~8% of prod, staging twin + SERP ORM upstream.

### Orders & Gifts

#### `giftcards_card` (~4.9M)

CENTRAL hub = one gift to ONE recipient. **PK is `card_id` (NOT `id`)**.

- `card_status` tinyint: **2=REDEEMED (~80%), 1=SENT/awaiting (~329K), 0=OPEN/UNREDEEMED (~669K), 4=cancelled-voided (~3K)**.
- `card_amount`, `card_balance`, `paid`, `card_type` enum(`print`/`email`/`offline`/`sms`), `delivery_method` enum(`email`/`message`/`print`/`wishlink`/`sms`), `product_type` int (13='Customize a Sugarwish' ~3.2M), `product_sku`, `card_code` (unique redemption), `expiration_date`, `redeem_only`, `wishlink`, `reason` (bounce/blocked/dropped/spamreport), follow-ups, `autodonation`/`maw_autodonate_date`.
- LINKS: `company_id`, `user_id`→users (sender), `order_id`→buyer checkout, `branding_record_id`, `proposal_id`, `product_id`/`product_configuration_id`.
- **`ec_order.giftcards_card_id = giftcards_card.card_id` (NOT `.id`)** — 1-to-MANY fan-out (one card → up to 13,719 `ec_order` rows via reships).

#### `ec_order` (~4M, ~585K in some snapshots)

Redeemed RECEIVER order — one shipment/recipient. **PK is `id`**.

- `increment_id` (bigint public order number, range ~200000001..20019817045, the bridge sent to Odoo / `serp_stock_picking.sale_id`), `order_id` (parent checkout, the `component_orders` join key — NOT increment_id), `giftcards_card_id`→`giftcards_card.card_id`.
- **`size` is MISNAMED — it actually equals `buyer_products.id`** (NOT a size). Join: `ec_order.product_type=buyer_products.product_type AND ec_order.size=buyer_products.id`. **GC-order collision**: low `buyer_products.id` values (41, 61-65, 90-91, 116, 137, 353, 923) collide with old disabled `receiver_products` ids → wrong candy on custom-shop slip. **NO `recipient_email` column** (querying errors).
- `status` varchar (**`pending` ~99% = giftcard issued NOT redeemed, NOT "awaiting payment"**; `processing`, `complete`, `shipped`, `canceled`), `delivery_status` (NULL/`delivered`/`returned`), `product_type`, `product_sku`.
- **`sw_fulfill`** tinyint: 1=SugarWish in-house (~559K), 0=vendor/dropship (~584K), NULL=legacy (~2.8M).
- **`oddo_synchronized`** tinyint (TYPO 'oddo' — the REAL Odoo-sync flag): **0=not started (~77K), 1=synced (~3.88M), 2=EXPOSED/claimed — `IndexController` flips a row `0→2` the moment it hands that batch to Odoo's pull (a claim/lease, not "partial"); it returns to `1` once Odoo confirms (~64-166 in-flight at any time), 3=stuck/errored, 5=vendor/bypass (~17K)**. (`value 3` exists per some reports, NOT-exists per others — verify per env.) Plus `ship_date_odoo_synchronized`, `component_imported`, `vendor_imported`.
- **`avatax_status`** enum: `not-processed`/`processed`/`sent` (~2.6M)/`skipped`/`adjusted`/`voided`/`cancelled`/`locked` — Avalara TAX state, NOT shipping state. Companions `sales_tax`, `taxable_total`, `co_ship_tax`.
- **`is_printed`** multi-state int: 0=not printed, 1=printed/in-fulfillment (auto-removes from print group), 2=Issue (missing boxcard / no high-res image), 3=address/label-blocked / on-hold, 5=in print group.
- `ship_date` (DATE — returns as UTC timestamp via mysql2, off-by-1 in MT if Date-converted; use `formatDateOnly()`), `merchandise_selections` JSON (recipient choices; **NULL for all rows historically** — WW-158 blocking), `hold_until_date`, `production_slip_batch`, `test_order`, tracking fields.
- Located: live in `laravel_live`; structurally present but **EMPTY (0 rows)** in SERP/replica DBs.

#### `preselect_orders` (~149K-212K)

Buyer pre-selects contents + recipient address up-front (order numbers 6000+, vs receiver 200+; `sw_id >= 600M`).

- `type` enum(`preselect`/`sweet-shoppe`/`sweetificate`) = CHANNEL, `status` enum(`pending`/`completed`/`canceled`/`deleted`/`shipped`/`on_hold`), `master_id` (groups batch; bridge to `sale_order.sw_id` via `preselect_order_id`), `reissue_id`, `production_slip_batch`, `is_printed`, `is_pdf_generated`, `avatax_status`, `oddo_synchronized`, `ship_date_odoo_synchronized`, receiver\_\* address, `seasonal_box`, `insert_id`, `theme_id`. **70,799 orphan `master_id` not in `preselect_master_ids`**; 387 NULL master_id.
- `preselect_master_ids`: ID allocator only (id PK + timestamps, ~22,346 rows, ids 700000001+).

#### `buyer_orders` (~57K-1.3M)

Buyer-side checkout HEADER. `status` varchar (`complete`/`queued`/`processing`/`closed`/`not-applicable`/payment*review/paypal*\*) and `preselect_status` (SEPARATE independent state machine, mostly NULL). One buyer_order → MANY giftcards_card. `preselect_master_id`.

#### `items` (~5.3-14.5M)

Order line items. `order_type` enum(`receiver-order`/`preselect-order`/`sweet-shoppe-order`), `product_sku`, `product_id`, `qty_ordered`, `parent_sku`/`parent_name` (kit bundling — items sharing parent_sku form a kit), `vendor_cost`, **`odoo_sync`** enum (0=not synced, 1=syncing, 2=synced, 5=unknown — **items with odoo_sync IN (0,1) = NOT-yet-in-Odoo, deduct from available inventory**).

#### `component_orders` (~682K-2.26M)

Order-time exploded BOM (NOT static recipe). `order_id`→`ec_order.order_id`, `order_type` enum(`receiver-order`/`preselect-order`/`merchandise`; prod live has only first two; `manage` has all three), `inventory_source` enum(`odoo`/`serp`), `component_id`, `component_sku`/`component_name` (denormalized), `quantity`, `location_id`, `accessory_images_id`.

### Product Catalog (two-sided)

#### `buyer_products` (~697-1,215 rows)

BUYER-FACING catalog = what SENDER buys (box/credit/SKU; e.g. `candy-mini`, `gift-cards-25-pcs2`).

- PK `id`. **`odoo_id` = `'500'`+`buyer_products.id`** (e.g. id=42→50042; ~12/1215 mismatch) = the SugarWish↔Odoo link via `product_template.sugarwish_id`.
- `sku`, `type` enum(`ecard`/`sweetshoppe`/`sweetificate`/custom-mug/cert), `category`, `price`, `number_of_candies` (picks granted: 2/4/6/8/12), `product_type`, **`default_kit`** (FK→kits.id, year-round) / **`seasonal_kit`** (seasonal override; if seasonal_box use seasonal_kit else default_kit), `size_name_id`, `item_multiplier` (**=1 for Grand SKUs**, NOT 3 — Grand ships 3 boxes via kit_id=917 component qty=2), `sw_fulfill`, `location_id`, `accessory_id`, `disabled`/`deleted_at`.

#### `receiver_products` (~5,059-7,000+ rows)

Individual treats recipient chooses. **PK is `product_id` (NOT `id`)**.

- **`sku_type`** varchar(16) NOT NULL, exactly 3 values: **`core` (~456), `seasonal` (~8), `legacy` (~4,699; default)**.
- **`is_core`** tinyint(1): rule `is_core <=> sku_type='core'` (enforced in APP CODE only, NO DB trigger; helper `core_flag_for_sku_type()`; 1 live exception product_id 4177 SA-46-033). ~220-299 SA SKUs flagged core.
- `status` varchar (`enabled`/`disabled`), `archive` tinyint (PRIMARY archive flag), `deleted_at` (soft delete — **95 rows have `status='enabled'` BUT `deleted_at IS NOT NULL`** contradictory), `drop_level` int nullable (floor below which auto-disabled; NULL/0-500, outliers 4987/5886), `threshold` (~2× drop_level, alert trigger).
- `inventory_qty` (Englewood/current SA), `mi_inventory_qty` (Taylor), `odoo_inventory` (synced cache, can be NEGATIVE -122/-44/-325, stale — use `inventory_qty` for decisions), `inventory_link` (parent product_id for cascading disables — set NULL on combo-line children in Apr-2026 migration), `location_id` (FK locations; **ALL ~5,150 rows NULL — field unused**), `vendor_id`, `vendor_cost` (decimal 8,2), `product_id` (= `sugarwish_id`, join to `product_template.sugarwish_id`), `product_type`, `tango_utid`, `odoo_id`. **Duplicate SKUs exist** (SA-01-026-A as product_ids 1706+4499; 13 component SKUs duplicated) — use `product_id`/`id` for joins, NOT SKU.

#### `components` (~118-2,238 visible/3,198 total)

Raw materials / packaging. PK `id` (bigint unsigned). `sku`, `prod_slip_sku`, `name`, **`odoo_id` = FABRICATED `'800'`+`id` varchar** (NOT real Odoo PK — joining to Odoo PK matches wrong rows; real bridge is `product_template.sugarwish_id`), `company_id`, `number_of_picks`, `start_date`/`end_date`, `hide` (0=visible/1=hidden, PRIMARY toggle — no `deleted_at`), `shelf_id`, `tax_code_id`, `image_url`, `inventory_source` enum(`odoo`/`serp`). Deprecated `(deleted)`-suffixed cols: inventory_quantity, status, drop_level, mi_inventory_qty, location_2_status. **58-97 rows have swapped sku/name fields** (B-AAA-HAL-22-\*, seasonal).

#### `kits` (~37-1,157, ~795-1,124 active) / `component_kits` (junction)

- `kits`: `id`, `name`, `buyer_product_id` (FK, nullable; one buyer_product → 3-6+ kits), `company_id`, `deleted_at` (soft delete). 89% single-component (just the B-\* box).
- `component_kits`: `kit_id`→kits, `component_id`→components, `quantity`. Set `hide=1` old / `hide=0` new when swapping; `recipe_key`.

#### `bill_of_materials` (EMPTY, 0 rows) — designed `product_id`→`rm_id` + `qty`, never populated.

### Branding / Custom (Laravel)

#### `branding_records` (~25 in manage / ~1,977 in prod)

Sleeve/mug/awning assets. THREE JSON fields:

- `physical_branding` JSON: `{entries:[{type:'sleeve', box_sku, box_id, template_id, logo_url, logo_override, logo_colors, render:{s3_url 50DPI, thumbnail_url, mockup_url, print_url 1200DPI per-order UUID NULL-until-cron, print_rendered_at}, buyer_product_ids[]}], _metadata:{proposal_id}}`. NO active/primary/status flag — all entries equal; fulfillment filters to entry whose `buyer_product_ids` CONTAINS `ec_order.size`. box_sku vocab: `a_mini/a_small/a_medium/a_large/a_xlarge/c_1/c_small/c_medium/h_small/c_3`.
- `digital_branding` JSON: `awning.canvas_width/height`, `note_card_logo`.
- `merchandise` JSON: `items[].designs[].print_image_url`, `recipe_snapshot` (`recipe_id`, `recipe_key`="{N}cube-bp{buyer_product_id}", `outer_box_sku`, `additional_components:{add:[],remove:[]}`).
- Approval columns `physical_branding_approval`/`digital_branding_approval`/`merchandise_approval` tinyint: **0=default/unapproved, 1=needs review, 2=pending CS, 3=approved**. `print_render_status` enum(`pending`/`not_required`/`rendered`/`failed`).

#### `design_boxes` (Laravel)

`size_name_id`, `sku` (a_mini/a_medium/etc.), `product_type_ids` JSON. **Hot Sauce 2-sleeve bug**: a_medium/a_mini/a_xlarge still list type 46 in product_type_ids while a_small/a_large cleaned to [6,49] → buyer_product (type 46) matches BOTH a_medium AND h_medium.

#### Other Laravel

- `ecard_designs` (`inserts`=FK to box-card SKU; NULL breaks PDF cron → is_printed=2; `sku`, `full_image`, `occasion_id`, `theme`, `type` enum legacy/standard/html), `ecard_uploads`, `accessory_images` (mug: `review_status` 0=Main/pending, 1=Creative/in-review, 2=CS-review; `needs_customer_review`, `priority` unused, `metadata.workflow_history`, no `reviewed_by`/`reviewed_at` cols — metadata is only audit; **no index** → full scan), `accessory_image_giftcards_card` junction, `proposals` (`details_json` multi-writer; 8 required: sender_id, product_id, product_sku, product_configuration_id, quantity, delivery_method, price, product_selections-nonempty), `locations` (id 1=Englewood/`inventory_qty`/`status`, 2=Taylor/`mi_inventory_qty`/`location_2_status`, 3=City Pop, 4=Simple Times, 5=WCC, 6=Vista, 7=Becket and Quill, 8=Poppin & Mixin), `product_type`/`product_lines`/`size_names`, `raw_materials` (`unit_type` enum units/lbs), `component_inventory`/`raw_material_inventory`/`inventory_transactions` (legacy dual inventory), `domain` (~77,791 rows email→logo), `company` (test_account flag), `manage_audit_logs` (~4.7M, 14 audited tables; receiver_products/components/kits NOT audited).

---

## WISHDESK / SWAC (MySQL) — CS + CRM + Design + Billing

`swcrm_*` prefix family. Times stored in **Mountain time, NOT UTC**. TWO DB pools (`server/db.ts` WishDesk + `server/sugarwish-db.ts` Sugarwish). WishDesk is DOWNSTREAM — stores IDs + cached snapshots; truth is in Laravel/Odoo.

### CRM Graph

#### `swcrm_links` (~1.15M-2.3M)

Polymorphic M:N BACKBONE (no dedicated FK join tables). `object_name`+`object_id` (source) / `link_object_name`+`link_object_id` (target). Rows stored **BIDIRECTIONALLY** (A→B and B→A, dedupe by direction). `role` semantics: `related` (~80%, generic), `assigned_to` (opportunity→user=owner), `owned_by`/`owner`, `assigned_by`, `follow_up`, NULL (legacy Insightly). To find everything attached to an entity, query BOTH `(object_name,object_id)` AND `(link_object_name,link_object_id)`.

#### `swcrm_opportunities` (~36K: ~24K LOST, ~12K WON, ~170-182 OPEN)

- **`opportunity_state`** enum (AUTHORITATIVE, use this): `OPEN`/`WON`/`LOST`/`INVALID`/`UNTAPPED`. Legacy `state`/`status` exist but DON'T use for reporting.
- `pipeline_id`+`stage_id`, `probability`, `forecast_close_date`, `opportunity_value`/`total_opportunity_value`/`true_opportunity_value`/`bid_amount`, `category` enum(`SMALL`/`MEDIUM`/`LARGE`/`MEGA`/`NA` = deal SIZE, NOT product), `products`/`quantity`/`occasion`, `user_responsible`/`gc_responsible` (Gift Concierge), `sw_company_id`, `sw_user_id` (SugarWish customer), `linked_order_id`/`linked_proposal_id`, `archived_at`/`archive_reason`.

#### `swcrm_pipelines` / `swcrm_pipeline_stages`

Only "Default" pipeline used; 3 stages: 1 Expressed Interest, 2 Active Discussion, 3 Order Paid (=WON). `closes_state` enum(OPEN/WON/LOST).

#### `swcrm_leads` (~158K)

`lead_status` varchar (messy free text, dominated by 'Won - Setup Account' ~115K bulk-imported; 'No Response' ~29K, 'Qualification Pending' ~10K), `converted` (0/1) + `converted_user_id`/`converted_company_id`/`converted_opportunity_id`, `user_responsible`/`created_user_id`, `email_opted_out`.

#### `user_cache` (~24K)

DENORMALIZED snapshot of SugarWish customers. **`user_id` = SugarWish/Laravel CUSTOMER id (THE join key, NOT wishdesk `users.id`)**, `full_name`/`email`/`phone`, `company_id`/`company_name`, `lifetime_sales`/`l90d_sales`, `credit_balance`, `gifts_per_year`, `profile_metadata` JSON, `last_synced_at`. Companions: `swcrm_client_profile_cache`, `swcrm_client_search_index`, `yoy_sales_cache`.

#### `wishdesk.users` (~63.7K: ~49K customer, ~8.5K guest, ~5.9K user, internal agent/admin)

BOTH internal staff AND synced customer mirror. `id` = internal PK (FK target). `role`/`role_type` (staff: GC/HS/super/MOD/Billing/Sidekick/test), `auth_provider`+`google_uid`, `sw_id` (→Laravel user), `slackid`, `brand`. DISTINCT from CRM 'user' OBJECT (which resolves via `user_cache.user_id`).

### Gmail Integration (`swcrm_z_gmail_*`, 20+ tables, 'z' sorts last)

#### `swcrm_z_gmail_messages` (~155K)

Full Gmail mirror. `gmail_message_id`, `gmail_thread_id` (groups conversation — thread by this NOT subject), `linked_sw_user_id`/`linked_swcrm_lead_id` (CRM linkage), `from_email`/`to_emails`/`cc_emails`/`bcc_emails`/`subject`/`message_body_text`/`message_body_html`, `received_at`, `labels` JSON, flags `is_read`/`is_starred`/`is_important`/`is_spam`/`in_trash`/`has_attachments`, `status` enum(`ACTIVE`/`ARCHIVED`/`DELETED`), `draft_generated` (0/1), `draft_id`, **`ai_draft_status`** enum(`GENERATED`/`EDITED`/`SENT_AS_IS`/`DISCARDED` — only SENT_AS_IS/EDITED-then-sent were actually sent).

#### Other Gmail tables

- `swcrm_z_gmail_drafts`: `draft_content_html`/`draft_content_text`, `status` enum(GENERATED/EDITED/SENT_AS_IS/DISCARDED), `similarity_score`, `metadata`. Known leak bugs: greeting 'Hi the customer,' (`{{firstname}}` not replaced), missing signature (`{{agent_name}}` placeholder). 7,184 `draft_classifications` analyzed: 57% HTML formatting, 36% greeting changes, ~11% signature changes; ~1% accepted as-is.
- `swcrm_z_gmail_labels`: `label_type` enum(`SYSTEM`/`USER`), `parent_label_id` (nesting) — mirror each rep's REAL Gmail labels (vary by user, include Google system labels).
- `swcrm_z_gmail_sync_status`: `last_history_id` (incremental cursor), `sync_status` enum(`IDLE`/`SYNCING`/`ERROR` — latest run's state, RESETS on next success, NOT permanent failure).
- `swcrm_z_gmail_oauth_credentials`, `swcrm_z_gmail_sync_failures`, `swcrm_z_gmail_attachments`, `_inline_images`, `_message_labels`.

### Field-Sync, RingCentral, Live Chat, Drafts/Prompts

- Dynamic custom-field registry: `swcrm_field_sync_history`, `swcrm_field_change_log`, `swcrm_field_registry`, `swcrm_available_fields`, `swcrm_field_permissions`, `swcrm_custom_field_definitions`.
- RingCentral: `swcrm_ringcentral_calls` (~7.85K), `_sms`, `_contacts`, `_user_phones`, `_config`.
- **`live_chat_sessions`** (~30,574-65,233): `session_id` (UUID), `type` enum(CHAT/TICKET/EMAIL/CALL), `chat_mode` (BOT/AGENT), `status`, `user_id`/`agent_id`, email-threading (`thread_id`/`message_id`/`in_reply_to`/`thread_references`/`requester_email`/`cc_addresses` JSON), SLA (`first_response_at`/`hold_started_at`/`total_hold_seconds`), `priority` tinyint (**2=Corporate, 4=Registered, 6=Guest, 8=Unsubscribe** — per-priority SLA targets NOT differentiated). **Email-thread bug**: matching by `thread_id` ALONE (not verifying `requester_email`) merges different customers' replies to same bulk email into one ticket.
- `live_chat_messages` (~94,016): `sender_type` (CLIENT/AGENT/BOT/SYSTEM), `message_content`, `message_html`, `content_format` (MARKDOWN/HTML), `source` (WIDGET/EMAIL/AGENT_UI), `draft_send_id`, `deleted_at`.
- `sla_settings` (key-value: `first_response_target_minutes`=60, `resolution_target_minutes`=120, `exclude_hold_time`=true). `sla_events` (~55,826): `event_type` enum(session_created/first_response/first_response_breach/resolution/resolution_breach/hold_started/hold_ended/reopened/sla_recalculated), `manually_reclassified`. `business_hours` (Mon-Fri 09:00-17:00 / 08:00-17:00 America/Denver).
- `orders_tickets` (~94): SEPARATE system, `priority` varchar(20) HIGH(6)/MEDIUM(42)/LOW(46); `company_id` = SugarWish corporate account.
- Prompts/instructions: `admin_instructions` (`is_active`, `qdrant_sync_status`, `version`), `system_prompts` (no versioning), `prompts` (user-created, no is_active), `swcrm_email_templates`/`live_chat_email_templates`, `draft_classifications`/`draft_human_reviews`.
- CRM teams/routing: `crm_teams` (`routing_method` ROUND_ROBIN/LEAST_LOADED/SKILL_BASED/PRIORITY), `crm_team_members` (`max_capacity`/`current_load`), `channel_configurations`, `channel_routing_log`.
- `articles` (63 published; NO URL column — synthesized `https://desk.sugarwish.com/articles/{id}`), `design_templates` (157, SVG+JSON), `design_company_logos` (~1,781; company_id=24 = consumer fallback ~1,500 unrelated uploads), `design_colors` (12: Sugar-0 #55c5ce, Wish-0 #d2232a), `design_restrictions` (990), `themes` (1,332, recipient-facing branding), `merchandise_packaging_recipes` (35, `recipe_key` UNIQUE "{N}cube-bp{id}", `outer_box_sku`).
- Cross-system links: `sw_user_id`/`users.sw_id`/`user_cache.user_id` = SugarWish (Laravel) CUSTOMER id; `sw_company_id`/`company_id` = corporate account; `linked_order_id`/`order_ids`/`ecard_ids`/`wishlink_ids` (JSON) = SugarWish order/ecard/wishlink ids.

---

## RETOOL (PostgreSQL) — Analytics/Ops + SERP Sync Engine + Auth Bridge

~123-165 tables; SERP touches ~40. Shared multi-app "Frankenstein" DB. **NOT SERP-owned.**

### SERP Auth / Sync / Audit

- **`serp_users`**: now a stripped 4-column bridge (`id`, `created_at`, `updated_at`, `orm_user_id`→`serp_res_users.id` in SERP MySQL). Hit on EVERY auth request to map identity. **Old columns (`name`, `email`, `password_hash`, `is_admin`/`is_finance`/`is_ops`/`is_internal`, `supplier_name`) moved to `_backup_serp_users`**. Auth split: identity here, roles in MySQL ORM group-based RBAC. `is_internal`=false → 403 on internal endpoints. ❌ AI assumes `name`/`email`/`role` columns exist → ✅ Reality: stripped to bridge.
- **`serp_refresh_tokens`** + **`serp_password_reset_tokens`**: documented as Retool but **actually live in MySQL (SERP ORM via env.cr)** — `crud_refresh_token.py`/`crud_password_reset.py` use `cr.execute()`. SHA-256 token_hash, 7-day refresh, 15-min access.
- `serp_audit_logs`: `user_id`, `table_name`, `record_id`, `action` (INSERT/UPDATE/DELETE), `old_values`/`new_values` JSONB, `ip_address`, `created_at`.
- `serp_draft_operations` / `_live` (Serpy drafts; `data` JSONB `{summary, warnings, confidence, operations:[], sync_target}`, `status` DRAFT/PENDING*APPROVAL/APPROVED/REJECTED/EXECUTED, `sync_target` VARCHAR odoo/serp/both — prod 100% 'odoo'). `serp_approval_thresholds` (ops=$5K, finance=$50K — table exists but NOT enforced in code). `serp_ai_messages_dev/_live`, `serp_ai_turns*\*`, `serp_ai_prompt_logs/\_live`, `serp_ai_turn_seq`.
- **`odoo_sync_queue` / `_dev` / `_live`**: SERP↔Odoo sync engine. Columns: `entity_type`, `entity_id`, `operation`, `payload` JSONB, `status` (`pending`/`processing`/`synced`/`partial`/`failed`/`dlq`), `attempts`/`max_attempts`(=5), `priority`, `odoo_id`, `error_message`, `next_attempt_at`, `origin`. Worker polls ~30s, BATCH_SIZE=1 prod, exp backoff capped 300s. `odoo_sync_circuit_breaker` (`state` CLOSED/OPEN/HALF_OPEN, 5-failure threshold). `odoo_sync_stats`.

### Inventory Counts (Retool)

- **`serp_inventory_counts` / `_live`** (14 cols, ~1,510 active): `sku`, `item_name`, `location_id`→Odoo stock_location, `location_name`, `count_quantity`, `counted_by_user_id`/`_email`/`_name`, `notes`, `counted_at`, `fulfillment_entry_index` (groups multi-user counts; **NULL for ~75%** = single count), `odoo_product_id` (~99.3% mapped), `counting_location` (`englewood`/`taylor`/`both`/`unassigned`). VERIFIED = 2+ different users same sku+location+entry_index+counting_location with matching qty (single count NOT verified). Conflict types: `unverified` / `quantity_mismatch`; `conflict_group_key` = "sku::location_id::entry_index::counting_location".
- `serp_vendor_inventory_counts` (supplier-submitted, do NOT satisfy 2-user verification), `serp_beginning_inventory_snapshots` (period-start baseline), `serp_user_counting_locations`, `sku_inventory_status_log` (`in_stock` bool, `quantity_available`, `last_status_change_at`, `notified_at`).

### Forecast Caches (Retool)

- **`size_projections_copy`** (~17,056-62,460 rows): source-of-truth size %; `product_type` (TEXT), `sku`, `size_name`, `year` (int), `week` (int), `last_year_projection`/`this_year_projection` (double), `projection_date`. **2025-2026 only — ZERO 2027 data → zero-cliff at year boundary.** Missing index on `product_type` and `(year, week)`.
- **`sku_projections`** (~10K-206K rows): per-SKU popularity from REAL recipient survey data (NOT seeded; new SKUs = zero). `product_type` (INT), `product_sku`, `popularity_3_weeks`/`_8_weeks`/`_1_year` (double, default 0), `projection_date`. **No archive flag — join Odoo `product_product.active` to exclude archived.** No index on `product_sku`/`projection_date`.
- `sku_product_type_key` (~4,889): `sku`→`product_type`(TEXT)+`product_type_key`+`size_group_name`. Maps BASE skus AND `<sku>-bakerycafe` variants (base maps WRONG type for Bakery & Cafe).
- `product_type_key_sizes` (~697): `product_type_key`→`size_sku`/`size_name`/`buyer_product_id` (only Candy + Gourmet Goods & Spa have entries — Candles/Gift Sets missing → 0% forecast).
- `operation_levels`: category goals keyed **"CategoryName|product_type_id"** (e.g. "Bold Reds|10"); wine uses CATEGORY-GOAL not per-SKU. Level states 0=below critical,1=below minimum,2=below goal,3=at goal; `time_turned_red/orange/yellow`.
- `product_type_adj`, `product_type_min_levels`, `mix_predictions` (`mix_percent` 0-1, key "YYYY-WW-ProductType"), `projected_orders`, `bc_size_location_split`, `week_settings`, `season_week_ranges` (14 rows; `applies_to` 0=replacement/1=overlay, `percentage`), `redemption_curve` (~82% day-0→~41% day-11), `component_forecast_tracking` (`is_active`, `quantity_per_order`), `vietnam_stock` (`remaining_qty`, double-count risk vs Odoo POs).
- Supplier/cost: `supplier` (lead_time, weeks_on_hand, override_buffer, default_case_qty), `supplier_buffer`, `sku_supplier` (lookback_period, NO case_qty), `rm_sku_supplier` (own case_qty, discontinued), `rm_weekly_demand_cache` (plural `product_type_keys`), `sa_projections_cache`, `bom_components_cache`, `sku_costs` (manual override fallback), `sku_equivalency_ratios` (candy=1, popcorn=0.5), `wine_category_goals`, `product_cost_goals`, `supplier_permissions`, `allocation_master`, `bc_size_location_split`.
- Operations: `receiver_product_status` (`status` enabled/disabled, `became_inactive_at`, `*_slack_ts`/`_channel` = alert de-dup GUARDS not message bodies, `bc3x_alerted_at`/`_slack_ts`), `receiver_product_change_log`, `replacement_tracking`, `unshipped_order_notes`, `hours_wages_daily`.
- Insightly snapshots (reporting mirrors, NOT transactional): `opportunities` (`opportunity_state` 'LOST'/'WON'/'ABANDONED'/'Open'/'OPEN' case dupes/'SUSPENDED'), `organizations` (~1 populated row, sparse), `insightly_contact_data`/`insightly_import_records`.
- External reporting mirrors (STALE mock for some): `quickbooks_dashboard`, `QuickbooksLastUpdates`, `stripe_dashboard`, `shopify*`/`shopifymonthlydata`, `slack_integrations`. Real QB sync state = `QuickbooksLastUpdates`/`ManageToLiveLogs`. ❌ AI treats these as live transactional sources → ✅ Reality: reporting/reconciliation mirrors; source systems external; `quickbooks_dashboard`/`stripe_dashboard`/`mock_*`/`sample_users`/`Sheet1` etc. are STALE seeded demos (2022 dates).
- `buyer_products` (synced copy — dual-homed with `laravel_live`).

---

### Cross-Database Relationship & ID Cheat Sheet

| Bridge                                                | From             | To                                                                   |
| ----------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| `ec_order.giftcards_card_id`                          | Laravel ec_order | `giftcards_card.card_id` (NOT .id), 1→many                           |
| `ec_order.size`                                       | Laravel          | **`buyer_products.id`** (misnamed)                                   |
| `ec_order.increment_id`                               | Laravel          | Odoo `sale_order` (via `sale_order.sw_id`=`ec_order.order_id`)       |
| `buyer_products.odoo_id`                              | Laravel          | `'500'`+id → `product_template.sugarwish_id`                         |
| `components.odoo_id`                                  | Laravel          | `'800'`+id (FABRICATED) → decode via `product_template.sugarwish_id` |
| `receiver_products.product_id` (=sugarwish_id)        | Laravel          | `product_template.sugarwish_id`                                      |
| `serp_*.odoo_id`                                      | SERP             | Odoo PK (NULL = SERP-origin)                                         |
| `preselect_orders.master_id`                          | Laravel          | bridge via `preselect_order_id` → `sale_order.sw_id` (sw_id ≥ 600M)  |
| `stock_location.sugarwish_id`                         | Odoo             | Laravel location sync gate (only 2008=1 syncs)                       |
| `serp_inventory_counts.location_id`/`odoo_product_id` | Retool           | Odoo `stock_location`/`product_product`                              |

❌ AI assumes one uniform sync direction / source of truth → ✅ Reality: split — Odoo owns BOMs/MOs/products/POs/on-hand; Laravel owns receiver_products classification, component_kits, and what's AVAILABLE-to-sell; RM inventory ONLY in Odoo; phantom kits SERP-local. For SERP-overlay seed conflicts, SERP-origin generally wins (users matched by email).

---

## Integrations & Sync (SERP <-> Odoo <-> Laravel)

This section documents how SugarWish's three core systems stay in sync: **Laravel** (the e-commerce/order domain), **Odoo** (the legacy PostgreSQL ERP — inventory/accounting source of truth), and **SERP** (Jack's in-house Laravel/Python ERP being built to replace Odoo). The wiring is asymmetric, partial, and full of historical scars. Read the misconceptions at the end before touching anything.

### The Big Picture: Three Pipelines, Not One

There is **no single sync bus**. At least four distinct sync mechanisms coexist:

| Mechanism                          | Direction                            | Trigger                                | Writes to                                |
| ---------------------------------- | ------------------------------------ | -------------------------------------- | ---------------------------------------- |
| **Odoo crons** (legacy)            | Laravel → Odoo (PULL)                | Odoo polls Laravel API every 6–120 min | Odoo `sale_order`, stock                 |
| **odoo_sync_queue** (Serpy)        | SERP → Odoo (+SERP mirror + Laravel) | Serpy draft approved                   | Live Odoo via XML-RPC; darklaunch mirror |
| **Darklaunch order worker**        | Laravel → SERP shadow (poll)         | Polls `ec_order` directly              | `serp_prod_darklaunch` only              |
| **Merchandise order_queue_worker** | Laravel → SERP main                  | Polls `component_orders`               | Main/live SERP DB                        |

⚠️ **AI assumes a unified order queue and both workers behave identically** → ✅ **Reality:** Two separate order pipelines (queue-based Odoo sync vs poll-based darklaunch) PLUS a separate merch `order_queue_worker`. PO receipts flow through the **Odoo sync queue**, NOT the darklaunch order worker. Orders that never reach Odoo intentionally get `NULL` `odoo_id`.

⚠️ **AI assumes integration is PUSH-based (Laravel pushes to Odoo)** → ✅ **Reality:** Legacy Laravel↔Odoo is **PULL-based** — Odoo authenticates to Laravel's `/api/odoo/` endpoints and pulls unsynced orders via cron, then calls back to mark passed/failed. Laravel has **no XML-RPC client**. SERP's dual-write (XML-RPC `OdooXMLRPCService`) is the NEW capability being built.

---

### The `odoo_id` Join Invariant (CRITICAL)

This is the single most important sync fact and the source of the most subtle bugs.

#### Core rule

- **Never join SERP↔Odoo on `id = id`. Always join on the `odoo_id` column** — it is the PRIMARY cross-system key. `id` and the Odoo id **diverge** after finalize.
- `odoo_id` (bigint, nullable) holds the PK of the matching Odoo record. **`NULL` = SERP-origin row** (created locally, not yet pushed to / matched in Odoo). `NULL ≠ invalid`.
- `odoo_id` is present on virtually every `serp_*` mirror table AND on SugarWish-domain tables that sync to Odoo (e.g. `serp_stock_picking.odoo_id` → Odoo `stock.picking`; `serp_product_product.odoo_id` → `product.product`; `serp_purchase_order.odoo_id` → `purchase.order`).
- **Zero UNIQUE constraints or indexes exist on `odoo_id`** across any `serp_*` table.

#### ID-space partitioning (how the invariant is maintained)

1. **Odoo-origin rows**: `id = odoo_id` (both < 1,000,000,000) — "Odoo owns all IDs < 1B."
2. **SERP-runtime post-seed rows**: small `id` above `MAX(odoo_id)`, with `odoo_id = NULL`.
3. **SERP-merge rows** (from the live-SERP merge phase): `id >= 1B`, with `odoo_id = NULL`.

- The seeder bumps `AUTO_INCREMENT` to 1B during seed so Odoo/merge rows don't collide; **finalize resets `AUTO_INCREMENT` to `MAX(odoo_id)+1`.**

#### Durable invariants (memorize these)

- (a) The durable "SERP-origin" signal is **`odoo_id IS NULL`**, NOT `id >= 1B`. (Old code that filtered on `id < 1B` became wrong after finalize.)
- (b) `id` and the Odoo id **diverge** — the ONLY reliable cross-system join key is the `odoo_id` column.
- (c) The `id = odoo_id` equality holds **only for Odoo-seeded rows**.
- (d) **Child rows** (stock_move, stock_move_line, stock_quant) created by the SERP ORM get the parent stamped but leave child `odoo_id = NULL` until a later stamping step.

#### `odoo_id` population reality after seeding

| Table                                                       | Population                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `serp_purchase_order`                                       | FULLY populated (e.g. 1805/1805)                                                                     |
| `serp_product_product` / `serp_product_template`            | Mostly populated (~6130/7387)                                                                        |
| `serp_res_partner`                                          | PARTIAL (290/295; 5 local auth-seed rows NULL)                                                       |
| `serp_stock_picking`, `serp_mrp_production`, `serp_mrp_bom` | **COMPLETELY NULL despite being seeded** (seeding rule broken, likely in consolidate-odoo-id branch) |

⚠️ **AI assumes all `serp_*` tables have `odoo_id` populated** → ✅ **Reality:** `serp_stock_picking`, `serp_mrp_production`, `serp_mrp_bom` all have `odoo_id = NULL` despite being seeded.

⚠️ **AI assumes `odoo_id` is reliably populated on worker rows** → ✅ **Reality:** The `odoo_id_stamper` frequently leaves NULLs or mis-stamps via natural-key collisions; a dead Odoo connection silently breaks it. **Only `odoo_id`-stamped rows are diffed by the drift monitor** — the stamper must be wired into EVERY write-path.

#### Fabricated/synthetic odoo_id traps

- **`components.odoo_id` is FABRICATED** = string concat `'800' + components.id` (e.g. component 439 → `'800439'`; component 8 → `'8008'`). It is **NOT** a real Odoo `product_product.id`. Joining it to Odoo PKs matches wrong rows. The real bridge is `product_template.sugarwish_id`. Most rows follow this (597/598 set; only ~6 have real Odoo IDs in some envs). 13 component SKUs are duplicated across IDs — **use `component.id`, not SKU, to link.**
- **`buyer_products.odoo_id`** = `'500' + buyer_products.id` (e.g. id 42 → `50042`; id 17 → `50017`). 1215/1215 populated; ~12 outliers (~1% remapped). Odoo searches by `product_template.sugarwish_id = 500 + id`.
- **Real Odoo `product_product.id`** is a different range (~1789–29210). To find the real Odoo id, match by SKU (`components.sku = product_product.default_code`).

#### The identity bridge: `product_template.sugarwish_id`

- **`sugarwish_id` lives on Odoo `product_template`, NOT `product_product`.** It is THE external sync key.
- Decode by prefix: `'800'` prefix → strip to get `components.id` (~2238 templates); other integer → `receiver_products.product_id` OR `buyer_products.id`; `0`/`NULL` → no mapping (~1,371 templates).
- `sugarwish-odoo` `sale.py` filters on `startswith('500')` / `startswith('800')`.
- Do NOT assume a `sugarwish_id` without `'800'` means receiver — it could be a buyer product.

---

### odoo_sync_queue (Serpy → Odoo)

**Table:** `odoo_sync_queue` / `odoo_sync_queue_dev` / `odoo_sync_queue_live` — lives in **Retool PostgreSQL** (not SERP MySQL; easier to manage). Suffix convention: plain/`_dev` locally, `_live` in prod.

- **Triggered** when a Serpy draft is approved. Executes warehouse ops (pickings, MOs, BOMs, POs, bills) against **live Odoo via XML-RPC** and **mirrors to darklaunch**. **PO receipts flow through HERE** (not the darklaunch order worker).
- **Worker** (`odoo_sync_worker.py`, ~1,685 lines): polls every **~30s**; `BATCH_SIZE = 1` in prod (isolates failures); orders by `priority ASC, created_at ASC`.
- **Payload/columns:** `entity_type`, `entity_id`, `operation`, `status`, `payload` (JSONB), `odoo_id` (stamped on success), `origin` (Slack msg link or `'SERP Batch #<draft_id> op <n>'`), `created_at`, `synced_at`, `attempts`, `next_attempt_at`.
- **Status enum:** `pending` → `processing` → `synced` | `partial` (created but not finalized) | `failed` (retrying) | `dlq` (dead-letter after max retries).
- **Entity types:** purchase_order, stock_picking, inventory_adjustment, mrp_production, bom_change, stock_scrap, product_product, product_template, po_receipt, laravel_receiver_product, laravel_component, laravel_kit_composition, stock_transfer, stock_picking_correction.
- **Retry:** exponential backoff `5 * 2^attempts` capped at 300s; `max_attempts = 5` then DLQ.
- **Circuit breaker** (`odoo_sync_circuit_breaker[_dev/_live]`, states `CLOSED`/`OPEN`/`HALF_OPEN`, 5-failure threshold, 30s reset) halts processing when Odoo is failing; prevents cascading failure. No guaranteed delivery (can lose items if DB fails).
- **DRY_RUN mode** (`ODOO_SYNC_DRY_RUN=True`): generates fake `odoo_id`s = `99990000 + entity_id` for testing without touching Odoo.
- **`/queue-test` slash command** pushes a single entity (e.g. stock-picking) through the sync queue for debugging; exercises ONLY the Odoo sync queue, NOT the poll-based darklaunch order worker.

#### Stuck-item recovery & idempotency

- **No automatic recovery** for items stuck in `'processing'` by a worker crash — manual intervention via admin API. (Gunicorn restart kills the asyncio worker task; no heartbeat/TTL/startup sweeper.)
- `recover_stuck_items`: item stuck `processing` > 5 min → reset to `pending` → handler re-runs.
- **Idempotency guards** (via `_check_existing_record` + natural keys): `stock_picking` (origin search), `inventory_adjustment` (move_name), `mrp_production` (origin+product_id), `stock_scrap` (origin). **UNGUARDED (high-risk):** `mrp_unbuild` (raw `xmlrpc.create` → 2nd unbuild reverses inventory twice on replay), `po_state` edit/add, `stock_picking_correction`, `bom_change remove_component`.
- **Real prod bug FIXED 2026-06-03:** `stamp_child_odoo_ids` was wired only into the Serpy sync-queue path, not the order path → thousands of move/line rows with `odoo_id = NULL`. **The stamper must be wired per write-path.**
- **Stamper transport FIXED 2026-06-03 (3 deploys):** psycopg2/libpq **cannot connect to the prod Odoo host at all** — its SSL proxy refuses libpq's in-band SSLRequest handshake (every sslmode fails "SSL connection has been closed unexpectedly"); asyncpg's direct TLS works. Stamper now reads Odoo via `odoo_pool.execute_query_via_loop` (run_coroutine_threadsafe bridge, `%s`→`$N`). Also: the host's transaction-pooling proxy rejects libpq startup `options` (`-c statement_timeout=…` fails every connect) — use per-txn `SET LOCAL` for GUCs. When a connection error is 100% (incl. fresh connects), reproduce the raw connect first: the transport may be refused, and no retry/pool logic helps.
- **`po_receipt` false "Sync Failed"** after a successful receive (XML-RPC timeout hung the call, item retried, found picking already `done` → RuntimeError). Fixed 2026-06-01 with `_already_received_result()` guard that searches for a DONE picking on origin, sums `qty_done` per product across backorder splits.

#### Serpy provenance / go-live bounds

Authoritative ledger of "was this Serpy?" is `odoo_sync_queue_live`. Product-creation path go-lives (anything before its path's go-live cannot have been Serpy):

- `product_template`: **2026-03-24**
- `create_product`: **2026-04-13**
- `create_receiver_product_everywhere`: **2026-05-05**

⚠️ **`create_uid=55` is NOT a reliable Serpy signal** — uid 55 = `jack@sugarwish.com` = both Serpy writes AND Jack's manual edits. Confirm via `odoo_sync_queue_live`. `ir_model_data.module='__export__'` = manual CSV/XLSX import via Odoo UI (NOT Serpy).

---

### Legacy Odoo Crons (Laravel → Odoo, PULL)

Odoo is the **PULLER**. Sync state is tracked on the **Laravel side** via the `oddo_synchronized` flag.

- **`Sugarwish: Update Orders`** — every 6 min
  - **The receiver feed is `Order::ordersForOdoo($status, 500)` (Laravel `IndexController` → `GET /api/odoo`).** It selects `WHERE oddo_synchronized=$status (0 for the main feed) AND store_id=2 (receiver orders only) AND created_at >= '2022-12-04 19:00:00' (hard floor) AND whereHas(items → receiver_product NOT soft-deleted)`, then `simplePaginate(500)` with **NO `ORDER BY`** → MySQL returns storage/PK order = **oldest `order_id` first, 500 per call**. Serving a batch immediately flips those rows `0→2` (a claim/lease — see the `oddo_synchronized` flag note). **Why ~78,825 orders sit stuck at `oddo_synchronized=0` (verified 2026-06-17): NOT a sync bug — every product the recipient chose on them was later soft-deleted in `receiver_products`, so the `whereHas` item filter excludes them from the feed forever** (old gift orders for discontinued SKUs). Of the 78,825 `=0` receiver orders, only ~1 currently qualifies for the feed. The `store_id` and 2022-12-04 date floor exclude almost nothing — the soft-deleted-item filter is the real excluder.
- **`Sugarwish: Update Failed Orders`** (cron id 26) — every 10 min; re-pulls orders Laravel marked errored
- **`Sugarwish: Update Prepicks`** — every 120 min
- **`Sugarwish: Update Failed Prepicks`** (cron id 43) — every 15 min
- **`Sugarwish: Send Failed Orders Email`** (cron id 57) — daily ~14:15; primary recipient **Carolyn Pardee**, routed to Nora Stein / Kellen Evans to fix wrong/missing Odoo id or unarchive product

**Laravel `/api/odoo/` endpoints** (Bearer token from `ir.config_parameter`, middleware `odoo.api`):

- `GET /api/odoo` (receiver orders), `GET /api/odoo/pre-pick`, `GET /api/odoo/components/ecard`, `GET /api/odoo/component/ecard-orders` (where `oddo_synchronized=1 AND component_imported=0`), `GET /api/odoo/component/prepick-orders`
- `POST /api/odoo/component/update-passed-orders`, `POST /api/odoo/component/update-failed-orders`
- `PUT /api/odoo` (inventory updates)
- The `sugarwish_integration` Odoo module creates `sale.order` rows with `sw_id` (bridges to `ec_order.order_id`) + `sw_datetime`, then confirms them (triggering phantom-BOM explosion). All SOs booked to catch-all partner `'SW Customer'` (`res_partner.id = 94`).

**Odoo "monitoring" health:** n8n workflow `bR4rEQjFI3GuwkiY` ("Odoo Sync Issue Detector") runs every 10 min, posts to #api-autofix / #jack-test; shows **~500 missing orders (~8–9% missing rate)** at any time. Most #api-autofix alerts are auto-resolved noise (Seth: "No action on data/APIs should be necessary from alerts in #api-autofix").

---

### The `oddo_synchronized` Misspelling (CRITICAL)

⚠️ **AI assumes the column is `odoo_synchronized`** → ✅ **Reality:** It is spelled **`oddo_synchronized`** (double-d, missing second-o) on Laravel `ec_order` and `preselect_orders`. The typo suggests a hasty/legacy implementation. Companion flag `ship_date_odoo_synchronized` (correctly spelled) tracks ship-date push separately. The fragmented two-flag design and the typo are both signals of legacy debt.

**Values of `oddo_synchronized` (production reality):**
| Value | Meaning | Count (approx) |
|-------|---------|----------------|
| `0` | not synced / not started | ~77,498–77,667 |
| `1` | synced / pushed to Odoo | ~3.88M (99%) |
| `2` | partial / in-flight / recent | ~64–166 |
| `3` | **stuck/failed** (errored, references archived/disabled SKU) | exists but RARE — observed as **1 order total (19783360)** in prod, contrary to WW-510 bug report which assumed many |
| `5` | vendor/special / bypass-Odoo state | ~17,428–17,512 |

⚠️ **`oddo_synchronized=3` is far rarer than assumed.** Stuck orders typically sit at `2` (pending sync) or trace to the April 2026 combo-line migration that archived child SKUs → Odoo fails with "product not found." Companion flags: `component_imported` (0 not imported → 1 success → 2 exposed/in-progress → 3 failed → 5 bypass-Odoo), `items.odoo_sync` (0=not synced, 1=syncing/in-flight, 2=synced ~14M+ rows, 5=unknown ~22K).

⚠️ **`items` with `odoo_sync IN (0,1)` = "Orders Not Imported"** — placed in SugarWish but not yet in Odoo; these must be **deducted from available inventory** when deciding to disable a product.

#### No transactional integrity (the Dec 23 2024 disaster)

⚠️ **AI assumes orders are marked synced only after confirmation** → ✅ **Reality:** Orders are marked `oddo_synchronized=1` **BEFORE** confirmation. **Dec 23, 2024: 906 `ec_order` rows marked `=1` but never actually sent to Odoo** ("ghost" orders). Fix required: mark `=1` ONLY after a success response from Odoo. No distributed transaction exists. There is **no `odoo_id` stored on `ec_order`** — matching to Odoo relies on `increment_id` / `order_id`.

---

### Darklaunch: Dual-Write / Shadow-Validation System

**Darklaunch** is SERP's parallel validation system: SERP and Odoo run side-by-side, dual-writing via Serpy to BOTH systems plus a one-way Odoo→SERP sync. It exists to prove SERP can faithfully replicate Odoo before cutover.

⚠️ **Darklaunch vs `serp_shadow` are TWO DIFFERENT features** (different feature flags):

- **Darklaunch** (`SERP_DARKLAUNCH_ENABLED`): expander appends `SYNC_TARGET_SERP_DARKLAUNCH` to every Odoo op; worker routes to serp_darklaunch handlers. The Odoo+Laravel merged mirror.
- **`serp_shadow`** (`SERP_SHADOW_WRITES_ENABLED`): a **separate, predecessor** Hetzner DB (`serp_shadow`, `5.78.203.128`) for prod-traffic shadow validation; provisioned by Manish 2026-04-28. Has `serp_shadow_meta` (`shadow_cutover_at = 2026-05-08`, `serp_shadow_processed_events`). Distinct from darklaunch.

⚠️ When `SERP_DARKLAUNCH_ENABLED=false`, behavior must be **identical to before** (Jack: "if dark launch is false, then don't set anything").

#### The 4-DB matrix: replica vs darklaunch

⚠️ **AI lumps replica/darklaunch/shadow/serp_test together** → ✅ **Reality:** They are DISTINCT. The matrix is **{prod, staging} × {replica, darklaunch}**, all MySQL with `serp_*` tables:

| DB                                                                 | Contents                                                                                                                                                                                                               | Fingerprint                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **REPLICA** (`serp_staging_replica`, `serp_prod_replica`)          | Clean row-for-row mirror of `manage`/`laravel_live` — **ZERO Odoo overlay**. App reads/writes these. Nearly-empty shells (~19 SOs frozen ~2026-05-28). NO Odoo-origin/manufacturing rows.                              | NO `_migrations`, NO `serp_darklaunch_meta` |
| **DARKLAUNCH** (`serp_staging_darklaunch`, `serp_prod_darklaunch`) | Replica PLUS Odoo overlay (normal BOMs, MOs, SVL, POs). Worker dual-writes Odoo-style ops here. `serp_prod_darklaunch` is the future production DB (~10.2k SOs, ~2k POs, ~5.5k pickings, ~34k stock_moves at cutover). | HAS `_migrations` + `serp_darklaunch_meta`  |

- **`live_darklaunch_db`** (MCP key) = MySQL `serp_test` on **Hetzner `5.161.233.240:3306`** — the REAL live PRODUCTION darklaunch mirror (NOT a throwaway test DB), the canonical prod write target for the worker. Consistently _ahead_ of `serp_prod_darklaunch` (~35K moves vs ~34K). TZ = `America/Denver`.
- **"compare-replica" tooling actually compares darklaunch.**
- **Routing:** app DB via `SERP_ORM_ENV` / `ACTIVE_ODOO_DB_NAME` (default `local-staging` → `serp_staging_replica`); worker darklaunch via `DARKLAUNCH_DB_ENV` (`local-staging-darklaunch`, `live-darklaunch`). A single op writes to the normal replica AND independently to the darklaunch DB. An "empty list" of Odoo entities = config routing issue, NOT a bug.

#### `serp_darklaunch_meta` & cutover timestamps

- Key/value table present ONLY in darklaunch DBs (fingerprint distinguishing darklaunch from replica). Key `darklaunch_cutover_at` is the authoritative per-env go-live timestamp.
- **Primary darklaunch cutover:** **2026-05-30 14:14 MT** (`2026-05-30 14:14:26 UTC`).
- **Per-env reseeds:** prod darklaunch `2026-06-04 09:27:20`; staging `2026-06-03 11:52:27` (each env's `serp_darklaunch_meta.darklaunch_cutover_at` is authoritative; `serp_test`/`live_darklaunch_db` shares the prod key).

#### Pre/post cutover behavior

- **Pre-cutover (seed):** seed all tables from Odoo (`INSERT...ON DUPLICATE KEY UPDATE`); high-volume tables (sale_order, sale_order_line, stock_picking, stock_move*, stock_move_line*, SVL, account_move\*, mrp_production) seeded with only the **latest ~5,000 ids** as of seed-start snapshot. Whole-table row-count delta vs live Odoo is EXPECTED.
- **Post-cutover (worker):** worker creates new rows with `id != odoo_id`, `odoo_id` stamped on successful Odoo `xmlrpc.create`. **Odoo→SERP is one-way** — rows written to live Odoo by crons/users AFTER the seed snapshot do NOT appear in SERP until reseed.

#### Darklaunch ISOLATION rule (NON-NEGOTIABLE)

⚠️ **AI tries to "fix" worker discrepancies by reading the correct value from live Odoo at runtime** → ✅ **Reality: explicitly forbidden.** The worker queries Odoo ONLY to resolve IDs to stamp into `odoo_id` — it **never reads Odoo VALUES at runtime**. It resolves everything (products by SKU/`default_code`, locations) against the LOCAL darklaunch DB, seeded at build time. Every column value on a worker-created row comes from SERP's own logic. **Consequence:** many drift/cost bugs trace to the SEED, not runtime. If local `serp_product_product.default_code` is NULL, the worker drops that order line (`stock_picking_delivery.py:200-204`, "if not product_id or qty<=0"). Fix = backfill `default_code` / seed the `sugarwish_id→product` map / fix worker resolution logic — NOT suppress drift or add Odoo reads.

#### Single picking-creator + intentional omissions

- **SERP's `sale.order.action_confirm` deliberately does NOT trigger procurement or create a delivery picking** (permanent divergence from Odoo). The **darklaunch worker is the SINGLE creator of delivery pickings** via `stock.picking.action_process_new_order` (create + confirm + assign). Adding a second picking-creator would produce two pickings per order.
- SERP permanent omissions: NO `procurement.group` model (raw `group_id` BigInteger only), NO lot/serial tracking, NO package/owner tracking, NO `ir.model.data`/`env.ref()`, chatter only at document level (never on `stock.move`/`move_line`/`quant`).

---

### `odoo_id_stamper` (workers/odoo_id_stamper.py)

A **separate post-create step** that opens its OWN darklaunch-pool connection (distinct from the worker's env connection) to resolve and write the real Odoo id into the local `odoo_id` column. **This is the ONLY place the worker touches Odoo PG (via asyncpg — `odoo_pool.execute_query_via_loop`; psycopg2/libpq is refused by the prod Odoo host's SSL proxy).** Matches on natural key (`product_id, qty, location_id, location_dest_id`).

**RULE:** stamp NEW rows on creation only (updates should already be linked); stamp the VARIANT id on `serp_product_product` and the TEMPLATE id on `serp_product_template` (a fixed bug).

#### Fragility (the stamper's failure modes)

1. **REPEATABLE-READ race / neighbor mis-stamp:** `_stamp_sync` runs while the worker's txn is still uncommitted under REPEATABLE READ, so its snapshot can't see the worker's own picking. `parent_replica_id` falls back to `parent_odoo_id`, and the local move query then matches an already-COMMITTED **neighbor** picking (adjacent orders share `product_id`/qty=1 → non-unique keys; local↔Odoo ids overlap ~3.22M but are REORDERED, shifting −38..+1). Result on one observed batch: **~84% NULL (1208/1435), ~16% mis-stamped** (correct only on shared products, NULL on products unique to the correct picking). Better worker-row signal: `name='S'+ec_order_id` or `odoo_id` origin — NOT `id != odoo_id`.
2. **Dead idle Odoo PG connection (SSL closed) silently breaks the stamper** → rows land `odoo_id = NULL` → drift monitor reports them "missing" though they physically exist. **Signature = FROZEN frontier:** `MAX(odoo_id)` stuck while `MAX(id)` climbs; latest rows 100% `odoo_id = NULL`. Fixed with a liveness-pinging pool: `_acquire_live_sync_conn()` pings `SELECT 1` on checkout, drains dead handles (`putconn close=True`), retries up to `maxconn+2` with capped exponential backoff (0.25s base, 2.0s cap), age-recycles (`max_conn_age_seconds=120`), `keepalives_idle=30`, `connect_timeout=10` (PR #107 bounded `pool.acquire`, PR #108 added per-poll `asyncio.wait_for` watchdog; deployed 2026-06-03).
3. **CRITICAL diff exclusion:** `/compare-darklaunch` only diffs rows where `odoo_id IS NOT NULL`. Unstamped worker children (`stock_move`, `stock_move_line`, `stock_quant` with `odoo_id = NULL`) are **silently EXCLUDED** → false "no-overlap."

---

### Darklaunch Drift Monitor (`compare-darklaunch` + n8n)

- **`/compare-darklaunch`** compares **Odoo prod (PG, SOURCE OF TRUTH)** column-by-column vs SERP `serp_*` shadows in darklaunch, joining on `odoo_id`. `--target=live` compares live Hetzner darklaunch against live Odoo prod (post-cutover validation); `--target=local` (default) hits Docker darklaunch.
- **n8n "Darklaunch Drift Monitor"** (workflow ids `HpHN9Reme3L6bNBd` / `IalsmpKBKbJM4LXg`): runs hourly (`0 6-18 * * 1-5`, 6am–6pm MT Mon–Fri), windows the latest ~1000 ids per table from Odoo prod PG, joins darklaunch on `odoo_id` across **~42 tables**, Slack-alerts to **#jack-test (`C083M27KU8L`)** rows 30m+ old that are MISSING ("sync gap") or have settled-value drift. Constants: `GRACE_MINUTES=30`, `WINDOW=1000`, `SAMPLES=5`.

⚠️ **AI tries to hand-edit the n8n drift workflow JSON** → ✅ **Reality:** It is **CODE-GENERATED by `scripts/build_darklaunch_drift_n8n.py`** — regenerate via the script, never hand-edit.

⚠️ **AI assumes SERP/Laravel is the source of truth being diffed** → ✅ **Reality: Odoo is the baseline** (golden copy until cutover). The monitor is loop-free (no SplitInBatches; uses a Merge barrier), with `_equiv` normalization (date-only vs datetime, NULL↔'0.0000', float ±0.01, bool↔0/1). It is intentionally AGGRESSIVE on staleness (30m+ missing = alert).

#### Reading the report — the ONLY signal that matters

The per-table **`values:` line** is the only meaningful signal: `'K rows, C columns — clean'` = faithful mirror (nothing to investigate); `'X/Y rows diverge'` = real drift. Genuine issues are: (1) `'X rows 30m+ old in Odoo MISSING from darklaunch'` (real sync gap), and (2) column-level **`settled` value-divergences on Odoo-origin rows.**

#### MOST FLAGGED "DRIFT" IS NOT A BUG — expected-noise categories

- **(A) Post-seed/post-reseed Odoo staleness:** Odoo crons/users edited rows AFTER the seed snapshot via a path SERP doesn't dual-write (crons, invoicing, PO receipt). Cleared by reseed — drift count often equals post-cutover-write-count. (Verified: e.g. all 79 drifting `stock_quant` rows had post-reseed Odoo write dates → 100% staleness, real_bug = none.)
- **(B) By-design worker-row divergence on create-time columns** (live in `WORKER_ROW_DIVERGENT_COLUMNS` suppression lists):
  - `sale_order.name` = `'S' + ec_order_id` vs Odoo `ir.sequence`
  - `date_order` uses processing-time
  - `sale_order_line.sequence = 10` always vs Odoo's 10/300/301... (worker skips Odoo's NULL-product separator lines — 214 in Odoo, 0 in darklaunch)
  - `serp_sale_order.effective_date` never equals Odoo's
- **Windowed seeding** (whole-table row-count deltas; only the latest-N id window must match).
- **`odoo_only` IDs** (Odoo writes between seed and compare — hundreds/hour on account_move\*, sale_order_line).
- **SERP-origin rows** (`odoo_id IS NULL`) — intentionally NOT compared.
- **~6h DATETIME drift** (Denver/UTC: seeder stored Odoo naive-UTC as MT wall-clock; live darklaunch is `America/Denver`, Odoo PG is naive-UTC → darklaunch raw = Odoo +6h MDT).
- **Reservation timing** (replica reserves on detection, Odoo 6h later on picking create; re-converges on validation).
- **`stock_quant` freshness gap** (Odoo reserves faster than worker polls; one-directional `darklaunch_quant = odoo_quant − N`; converges next poll; confirmed 2026-06-02 zero genuine detection gap).
- **Benign value drifts:** `invoice_status` (odoo=`invoiced` vs dl=`to invoice`), date/tz format (ISO-Z UTC vs local), `commitment_date`/`effective_date` nulls.
- Intentionally suppressed columns: `write_uid`/`create_uid`, picking name drift, float precision noise.

#### The minority that ARE real bugs

- **Dropped order lines when `product.default_code` is NULL** (worker drops line; e.g. post-cutover SO with 13 Odoo lines vs 12 darklaunch lines, missing product 27679 SKU `SA-10-155-A`; $1-off `amount_untaxed`/`amount_total`; affected 2 of 85 post-cutover orders). Fix: seed-backfill `default_code` or add worker resolution fallback.
- **Seeder collapsing `stock_move` `'partially_available'` → `'assigned'`** (`seeding/scripts/seeders/_seed_stock.py:53-54` overrides state; live `serp_test` enum DOES include `partially_available`; 0 such rows post-seed when ~85 should exist). Fix: remove the override.
- **Bin-level `location_id` divergence** (SERP doesn't replicate Odoo putaway/removal strategy; 3 of 9 in-window worker stock_move_lines write parent loc 8 where Odoo refines to a bin like 1285/1358/1366/3927). Plus `stock_move_line.move_id` (FK id-space) and `reference`=NULL should be added to `WORKER_ROW_DIVERGENT_COLUMNS['stock_move_line']`.
- **Worker mis-assigns `stock_picking.name`** (EW/OUT/\* sequence reversed within batch vs Odoo; `odoo_id` stamp correct but name wrong; create-time bug).

⚠️ **`isWorkerRow = (id != odoo_id)` misclassifies AUTO_INCREMENT-collision worker rows as seed rows** (`DIFF_AND_REPORT_JS:~462`): when a worker `id` coincidentally equals its resolved `odoo_id`, the monitor treats it as a seed row and skips suppressions. **Better signal:** `name = 'S' + ec_order_id`, or `odoo_id` origin — NOT `id != odoo_id`.

---

### Order Pipeline Workers & the `sw_id` Discriminator

#### Darklaunch Order Worker (`darklaunch_order_worker.py`)

- **NO queue.** As of 2026-06-17 new-order detection reads the locally-staged `serp_test` copy populated by the `staging_copier_worker` (no longer `ec_order WHERE oddo_synchronized=1` against live Laravel); `POLL_INTERVAL=300s`, `BATCH_LIMIT=50`, single-threaded. Dual-writes receiver-order + preselect-order rows into `serp_prod_darklaunch` ONLY (never the main DB). SHADOW-processes Odoo-sourced orders (`order_type IN ('receiver-order','preselect-order') AND inventory_source='odoo'`), reading read-only against Odoo/live MySQL for seeding, never pushing back to Odoo. Replaces Odoo's Update-Orders/Prepicks crons by design. ~80ms AWS→Hetzner RTT dominates ~25–27s/shipment.

#### Merchandise Order Queue (`order_queue_worker.py`)

- Gated by `ORDER_QUEUE_WORKER_ENABLED` (default False — disabled until `ec_order.merchandise_selections` is populated, WW-158). Polls `component_orders WHERE order_type='merchandise' AND inventory_source='serp'`, writes the main/live SERP DB. (Jason's Feb 8 2026 decision: custom-branding merchandise tracks **100% through SERP, never Odoo.**)

#### KEY ASYMMETRY

- The darklaunch order worker resolves Odoo `sale_order.id` / `sale_order_line.id` (via `sale_order.sw_id = ec_order.id`) BEFORE creating SERP rows. Orders that never reach Odoo intentionally get NULL `odoo_id`s ("shouldn't resolve odoo ids since they dont reach odoo").
- **`sw_id` numeric ranges (worker discriminator at lines 446-447, 544-545):** `sw_id < 600,000,000` = receiver/`ec_order` (bridge via `ec_order`); `sw_id >= 600,000,000` = preselect/wholesale (bridge via `preselect_order_id`, NOT `ec_order`).

⚠️ **Detector starvation bug:** `detect_shipped_orders_odoo` / `detect_cancelled_orders_odoo` had a vestigial `ORDER BY ... DESC LIMIT 50` that strands the oldest tail when in-flight candidates exceed 50 (e.g. **883 observed** = 765 receiver + 118 preselect, verified live 2026-06-04 — BOTH branches exceed 50). Newest-first + LIMIT permanently starves the low-id tail. Fix: oldest-first ordering by **replica `serp_stock_picking.create_date`** (NOT live `ship_date`, which is DATE-granular) PLUS a per-cycle processing-side cap. (Without a cap, draining ~883 at ~27s each ≈ 6.6h, freezing the shared loop.) Note: `serp_stock_picking.state` has no `partially_available` value — the third candidate-state filter element is dead.

⚠️ **Darklaunch worker blocks the shared event loop:** all workers run in ONE process on ONE asyncio loop. The darklaunch `_poll_cycle` is `async def` but does synchronous blocking PyMySQL work (~35–72s/shipment × 50, no `await` between items), starving odoo-sync (contrast: `order_queue_worker` uses `await asyncio.to_thread(_poll_cycle)`). Live 2026-05-29: odoo-sync stalled ~95 pending, synced once per darklaunch cycle. Disabling darklaunch restored a clean 15–17s sync cadence. Fix: wrap darklaunch processing in `asyncio.to_thread`. A **supervisor coroutine** in `workers_main.py` (added after the May 29 2026 silent odoo-sync death) restarts wedged worker coroutines.

⚠️ Darklaunch shipment processing is **intentionally SLOW** (~27s local / 47–66s prod per shipment, serial, ~130 per-move UPDATEs). This is a deliberate costing-parity choice to match `account_move.sequence_number` ordering — **do NOT batch to "optimize"** (batching breaks compare-costing parity with Odoo).

⚠️ **odoo-sync "Sync cycle wedged: 3 consecutive timeouts at 180s"** (`CYCLE_TIMEOUT=180s`, `MAX_CONSECUTIVE_TIMEOUTS=3`) is a DIFFERENT, self-recovering incident from darklaunch event-loop starvation: a downstream socket idle-dropped without RST; `asyncio.wait_for` converts the hang to a logged TimeoutError; circuit breaker recovers within the hour. Marker `"[Recovered from stuck processing]"` in `odoo_sync_queue_live` (8 events ever, 0 dups).

---

### Per-Entity Source-of-Truth Rules

⚠️ **AI assumes one uniform sync direction (Odoo always wins, all SERP writes go one place)** → ✅ **Reality: source of truth is split per entity.**

| Entity                                                                          | Owner                                                                  | SERP write path                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Manufacturing/normal BOMs (`mrp_bom type='normal'`), MOs, product creation, POs | **Odoo-owned**                                                         | SERP reads live Odoo, writes back via `odoo_sync_queue` → XML-RPC |
| Kits (phantom BOMs, `serp_mrp_bom type='phantom'`)                              | **SERP-local**                                                         | edited locally via `serp_update_kit` → `serp_mrp_bom_line` mirror |
| `receiver_products` classification, `component_kits`                            | **Laravel/SugarWish-owned**                                            | SERP writes to **MANAGE MySQL** via `laravel_*` ops               |
| Custom-branding merchandise (sleeves, hats, water bottles)                      | **SERP-only, never Odoo**                                              | `component_orders` + SERP `stock_quant`/`stock_move`              |
| On-hand inventory                                                               | **Odoo canonical** on-hand/available                                   | one-way Odoo→Laravel pull                                         |
| What's available to sell                                                        | **Laravel source of truth** (deducts pending orders Odoo doesn't know) | —                                                                 |
| RM inventory                                                                    | **ONLY in Odoo** (no Laravel RM)                                       | —                                                                 |

- **Conflict resolution:** When SERP-origin and Odoo-origin data collide on a natural key, **SERP is USUALLY source of truth** (for users specifically: match on **email**, SERP usually wins, with exceptions). For the SERP overlay seed, SERP-origin data generally wins key conflicts.
- ⚠️ **Don't rely on the old Jan 2023 "Odoo is source" statement** — truth is now split: Odoo canonical on-hand/available; Laravel canonical for sellable (deducts pending orders); RM only in Odoo.

#### SERP Laravel write access (least-privilege)

- SERP connects to Laravel as user **`SERP-readfull-writepartial-7161`**: FULL READ, **PARTIAL WRITE** with table-by-table grants gated by the Serpy approval flow. Can only INSERT/UPDATE/DELETE on `receiver_products`, `kits`, `component_kits`, `buyer_products`. Intentionally NOT full-write. Serpy writes `receiver_products` to the **`manage` (staging)** DB — and must add `sku_type`/`is_core` to the `RECEIVER_PRODUCT_WRITABLE` whitelist (`is_core` MUST equal `sku_type=='core'`, via helper `core_flag_for_sku_type()`).

---

### Bridge Tables (cross-system join keys)

| Bridge table                             | Domain   | Links                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serp_sale_order`                        | ORDER    | `ec_order` / `preselect_orders` → Odoo `sale.order` via `odoo_id`                                                                                                                                                                                                     |
| `serp_product_product`                   | PRODUCT  | `components`/`buyer_products`/`receiver_products` → Odoo `product.product` via `odoo_id`; has `sugarwish_id`, `inventory_source` enum (`'odoo'`/`'serp'`); three mutually-exclusive FKs `component_id`/`receiver_product_id`/`buyer_product_id` (at most one per row) |
| `serp_users` (Retool PG)                 | AUTH     | `orm_user_id` → `serp_res_users.id` (MySQL ORM); 4-column bridge (id, created_at, updated_at, orm_user_id) — hit on EVERY authenticated request                                                                                                                       |
| `serp_product` (SERP MySQL bridge)       | PRODUCT  | unified product ID space; `type` enum `'component'`/`'receiver_product'`; mutually-exclusive `component_id`/`receiver_product_id`; `sku`/`name` are STATIC denormalized copies captured at seed time (NOT auto-synced)                                                |
| `product_template.sugarwish_id` (Odoo)   | IDENTITY | THE external sync key bridging Odoo↔Laravel/components (see odoo_id section)                                                                                                                                                                                          |
| `account_move_purchase_order_rel` (Odoo) | BILLING  | many-to-many bill↔PO; ~1,575 bills → ~1,384 POs; 100% of vendor bills linked to ≥1 PO; one bill rarely references multiple POs                                                                                                                                        |

#### Order chaining (Laravel → Odoo)

`giftcards_card` (gift; PK `card_id`) → `ec_order` (shipment; `giftcards_card_id = giftcards_card.card_id`, **1-to-MANY** via reships — one card observed with 13,719 `ec_order` rows; `increment_id` is the order number sent to Odoo) → Odoo `sale_order` joined by `increment_id`. ⚠️ Join on `giftcards_card.card_id` (the PK), NOT `giftcards_card.id`. There is no `odoo_id` on `ec_order` — chain via `increment_id`/`order_id`.

---

### Cutover Strategy & Timeline

#### Strategy

- **SERP as Workflow Layer, Odoo as Inventory Source-of-Truth** (the Jan 2026 strategic pivot from Jason/Jack huddle): SERP becomes the Odoo _integration layer_, NOT a standalone replacement. Jack focuses on making Odoo the data repository, fixing sync flaws, ensuring connectivity.
- **Phasing was the unblock.** Jack originally told leadership full SERP was "too complex," all-at-once "too risky" (Jan 2026: only 25–50% complete, completely read-only from Odoo). Seth's proposal to phase it (POs first, dual-running with Odoo) gave more confidence and made it viable.
- **Phase model** (Odoo remains live fallback until each phase is stable; darklaunch dual-write validates parity; **<1% drift confirmed, stable for 2 weeks** is the go/no-go gate per phase):
  - **Phase 1:** Purchase Orders (sync arrivals back to Odoo to keep inventory/billing correct; two-stage receipt added)
  - **Phase 2:** Bills (event-driven sync via n8n; PO receiving → Odoo, inventory count → Odoo batch sync; reconciliation dashboard)
  - **Phase 3:** Raw materials / components / kits (Matthew Patrick confirmed no technical reason kits can't move to Laravel now; Manish Chaudhary = SERP secondary lead owning prep/testing migration scripts; Carolyn reluctant to move before SERP fully implemented; Ric caveat: kit/inventory problems must resolve pre-cutover)
  - **Phase 4:** Manufacturing orders / inventory dual-write (SERP primary, Odoo secondary via queue); line-level sync control via `purchase_order_line.odoo_component_id` (NULL = SERP-only/skip sync; populated = sync)
  - **Phase 5/6:** Kits/BOMs + manufacturing; final cutover (Odoo freeze + physical count, SERP source of truth)

#### Hard constraints / timeline

- **October 2026 Odoo version upgrade deadline** (looming v15→v17; existing `upgrade-test-16/17` branches) — a critical constraint shaping the cutover window.
- **Sept 15, 2026 full SERP release** mandated by Anna Kifer, with **6–8 weeks minimum production testing** before the Halloween/Q4 peak. (Launch repeatedly slipped: original 2025 → Jan/Feb 2026 → ~early Aug 2026 → Sept 15; timelines are soft, Odoo stays live past stated dates.)
- **Darklaunch cutover already happened (2026-05-30)** as the validation milestone; full Odoo deprecation is later/gated.

#### Sync-pattern risks flagged for later phases

- Daily reconciliation is too slow for inventory drift if XML-RPC fails silently → upgrade to hourly validation.
- COGS divergence during dual-write (Phases 4–5) lacks an explicit reconciliation mechanism → need a dashboard.
- No documented rollback strategy / point-of-no-return per phase; Phase-6 freeze window undefined (recommend ≤4h).

#### Pre-cutover data cleanup (BLOCKERS)

- **48,909 stock_moves stuck** in `assigned`/`confirmed`/`waiting` (oldest May 2023) permanently lock `stock_quant.reserved_quantity`. Must unreserve via Odoo's `stock.move._do_unreserve()` / `stock.picking.do_unreserve()` API — **NEVER direct SQL** (desyncs `stock_move_line.reserved_qty` ↔ `stock_quant.reserved_quantity`, triggers "Cannot unreserve more than in stock"). Odoo's `do_unreserve()` has a bug: when `qty_done > 0` it sets `product_uom_qty=0` but SKIPS `_recompute_state()`, leaving zombie moves stuck `assigned`. Cleanup script: `scripts/odoo_cleanup_stuck_moves.py`. (Server action 376 referenced in old notes — verify; some notes say it doesn't exist in current Odoo.)
- **482 stock_quant rows with negative quantities** (−189,619.87 to −37.8M units depending on scope); only internal-location negatives are real problems (virtual Vendors/Production/Inventory-adjustment negatives are normal double-entry).
- **88 duplicate active `stock_location` rows** with identical `complete_name` (worst: 4 copies of `TY/Stock/R4-7-AR`, ids 3391/4437/4438/4439) — split inventory complicates reconciliation, sync fails on duplicate IDs.
- **20 over-received PO lines** (e.g. P01654 +30K) and 10 cancelled POs with 2–18 active stock moves each.
- Negative inventory floored to 0 in `sugarwish_integration/wizards/sugarwish_stock.py:75-77`, hiding backorder depth (not fixed).
- **Test-data anomaly:** location IDs 2001/2002 (`EW/Stock/Zone1/2`) exist in `retool.serp_inventory_counts` but NOT in Odoo `stock_location` — fail sync validation.

#### Deploy/migration footgun

⚠️ `deploy.sh` does NOT run schema migrations against the prod manage cluster (now on Hetzner, not AWS RDS) (`npm run migrate` is local-only; `seeding/migrations/*.sql` deleted at HEAD; deploy hardcodes Docker `serp_staging_darklaunch`). New `serp_*` tables/columns need a **manual migration of the live manage DB BEFORE code ships** (Manish + DBA) or you get "table doesn't exist" in production. All ~40+ `serp_*` ORM tables exist ONLY in `laravel_local`; `laravel_staging`/`live_staging` have only `serp_audit_logs` and `serp_users`.

---

### Inventory Sync (Odoo → Laravel) Mechanics & Known Breakage

- **Location sync gate:** Only `stock_location.sugarwish_id > 0` locations sync to Laravel — and currently **ONLY `EW/Stock/Fulfillment` (id=2008, sugarwish_id=1)**. `sugarwish_id=0` = internal-only (raw materials/packaging, NOT synced); `sugarwish_id=NULL` = system/virtual (Vendors, Customers, Inventory adjustment, Production). Distribution: ~2M units sync, ~1.3M internal-only, ~1.2M system/virtual.
- **Inventory sync floors negatives to 0** → products stay enabled when oversold (loses backorder-depth visibility).
- **`SynchronizeOdooInventory` Lambda** reads the `odoo_inventory` table (separate from `receiver_products.odoo_inventory`), shards by `product_id % 10`, writes `receiver_products.inventory_qty`, and **never re-enables products** (asymmetric — disable-only). Its trigger was likely n8n workflow `6LYL1ThTQOCg1Fj8`, which **stopped Dec 31 2025**, leaving inventory stale.
- **`Disable_Unreserved_Products` V2** (n8n `VRdmXlm2XTeRbOyT`) runs every 1 min, queries Odoo directly, disables `final_available < drop_level` (disable-only, no cooldown — re-disables within seconds of manual re-enable). Known DEADLOCK source competing with Laravel/Retool writers. Forecast Odoo timeouts usually trace to this workflow re-firing a 330s query with no backoff, NOT SERP's own queries.
- **Stale inventory root causes:** ~86% of `odoo_inventory` records >30 days old; only ~190/day updated from 3 active Odoo hooks; `put_product_qty` silently returns False without raising; `stock_move_line.py` write() hook and `product._compute_quantities()` hook are commented out; sale-order deliveries (origin `^S\d+$`) skip `put_product_qty`.
- **`receiver_products` has TWO decoupled inventory caches:** `inventory_qty` (the source of truth) vs `odoo_inventory` (stale, can be 180× off — e.g. SA-03-050-A: `inventory_qty=1,974` but `odoo_inventory=11`). Always use `inventory_qty`; n8n alerts incorrectly read `odoo_inventory`.

#### Chronic Laravel↔Odoo sync bugs

- Inventory added to Odoo before the SKU exists in Laravel → never picked up.
- Wrong/errant Odoo location → `odoo_inventory` stagnant.
- Many SKUs simply "not connected" between systems.
- Creating a receiver product whose `base_product_id` isn't found in Laravel.
- BOM `add_component` with "No SERP product found for Odoo product_id."
- Archiving one side without the other breaks sync; orders stuck at `oddo_synchronized=3` referencing archived/disabled SKUs.

#### Common dual-write failure mode ("Odoo Sync Partial")

SERP records an op but Odoo rejects finalizing, leaving a picking stuck `'confirmed'` (expected `'done'`). Root causes: (1) Odoo `sugarwish_integration` overrides `stock.picking.button_validate` → calls private `stock.move._action_done`, which is **blocked over XML-RPC** ("Private methods cannot be called remotely" — works in Odoo UI, fails via RPC); (2) the same override triggers a `put_product_qty` wizard calling an external API returning empty → JSONDecodeError; (3) **UoM mismatch** — sync sends `uom_id=1` (Units) but product is `lb` (Weight category) → Odoo rejects cross-category UoM (fix: look up the product's real `uom_id` first); (4) Odoo rejects quant creation on consumable/service products ("Quants cannot be created for consumables or services"); (5) wrong `entity_type` (`stock_transfer` vs `stock_picking`).

⚠️ **`stock_transfer` ops update Odoo only, NOT Laravel/`serp_stock_quant`/`receiver_products.inventory_qty`** — no companion SERP write and no Odoo→Laravel reverse-pull job, so `odoo_inventory` stays stale indefinitely (e.g. SA-19-001-A: Odoo 112 / Laravel `inventory_qty` 2 / `odoo_inventory` 118). Fix: add `"serp"` to `odoo_stock_transfer.sync_targets`, OR add an Odoo→Laravel reverse-pull job.

---

### sync_target (Serpy per-system routing)

- `sync_target` (VARCHAR) is a **draft-level** column on `serp_draft_operations` + `odoo_sync_queue`; values `'odoo'` / `'serp'` / `'both'`. Production drafts are 100% `'odoo'`; dev has `'serp'` variants (14 drafts, 7 queue items).
- A single Serpy operation can write **THREE systems** (Odoo + SERP + Laravel), keeping IDs wired: new receiver products inherit from base Laravel rows; **RM SKUs sync ONLY to Odoo+SERP, NOT Laravel.** Routing is **hardcoded per op type** — the AI just chooses the op type.
- Retool front-end splits drafts by DB: "Odoo Updates", "SERP Updates", "Laravel Updates", "Multi-DB Updates."
- **Current limitation:** all ops in a draft batch share one `sync_target` (operations[] array has no per-op `sync_target` yet); backend supports per-op routing, frontend dropdown is the only missing piece.

---

## Business Rules & Workflows

### Order Lifecycle

SugarWish's core model is **recipient-choice gifting**: an eCard is sent, the recipient redeems it and chooses their own gift, and it ships. This produces a chain of distinct lifecycle objects — they are NOT one "order" type. Reasoning about them as a single object is the most common source of error.

#### Object Chain

| Object                        | Table / Range                                                           | What it is                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Buyer order**               | `buyer_orders` (~1.3M; `increment_id` pattern `200…`)                   | Sender's checkout HEADER. One buyer order fans out to MANY `giftcards_card` rows.                        |
| **Giftcard / eCard**          | `giftcards_card` (~4.9M; PK is `card_id`, NOT `id`)                     | One individual gift to ONE recipient. Pre-redemption record.                                             |
| **Receiver order (ec_order)** | `ec_order` (~4M)                                                        | The redeemed RECEIVER order — one physical shipment to one recipient. Buyer-chosen treats.               |
| **Items**                     | `items` (~5.3M)                                                         | Recipient's chosen gift-selection line items.                                                            |
| **Component orders**          | `component_orders` (~2.1M)                                              | Order-time exploded packaging/component lines (NOT a static recipe).                                     |
| **Preselect order**           | `preselect_orders` (~149K–212K; numbers `6000…`/`sw_id >= 600,000,000`) | Buyer pre-selects contents AND enters recipient shipping address up front. No recipient-redemption step. |
| **Sweet-shoppe order**        | `items.order_type='sweet-shoppe-order'`                                 | Self-purchase.                                                                                           |

#### Lifecycle Flow

1. **eCard sent** → `giftcards_card` row created (digital gift; `hold_until_date`, `delivery_method`, sender/receiver email). Status pre-redemption.
2. **Redemption** → recipient clicks through and CHOOSES treats/size → `ec_order` row created (one per shipment). `ec_order.giftcards_card_id` links them.
3. **Items / component_orders** populated for the chosen gift.
4. **Sync to Odoo** → `ec_order` imported into a `sale_order` (see fulfillment).

**Key relationship:** `giftcards_card` ↔ `ec_order` is **1-to-MANY** (fan-out via reships/replacements — one card was observed with **13,719** `ec_order` rows).

**JOIN KEY (critical):** `ec_order.giftcards_card_id = giftcards_card.card_id` — **NOT** `giftcards_card.id`. Chain to Odoo: `giftcards_card` → `ec_order` (via `increment_id` + `oddo_synchronized`) → Odoo `sale_order` matched by `increment_id`.

#### Key `ec_order` Columns & Enums

- **`oddo_synchronized`** (tinyint, **misspelled "oddo", NOT "odoo"** — this is the real Odoo-sync flag): `0`=not synced (~77K), `1`=synced (~3.9M), `2`=partial/retry/in-flight (~64–166), `5`=vendor/special (~17K). **Value `3` does NOT exist in production** (contrary to some bug reports; `3` is a _Laravel-side_ errored/retry value referenced elsewhere — reconcile carefully: in `ec_order` prod data only 0/1/2/5 appear).
- **`size`** (MISNAMED): holds `buyer_products.id` (the box the recipient chose), **NOT** a physical size string and **NOT** `size_names.id`. Correct join: `ec_order.size → buyer_products.id` (matched with `buyer_products.product_type`). Real size lookup is `buyer_products.size_name_id`.
- **`status`** (varchar): `'pending'` (~99%/3.9M = giftcard issued, NOT redeemed — **NOT** "awaiting payment"; payment happens pre-giftcard on `buyer_orders`), `'processing'` (~25K), `'complete'`/`'completed'` (~17K), `'shipped'`, `'canceled'` (~32K).
- **`delivery_status`** (varchar): NULL (~2.4M, not delivered), `'delivered'` (~1.58M), `'returned'`.
- **`avatax_status`** (enum, tracks Avalara TAX state — NOT shipping): `not-processed | processed | sent | skipped | adjusted | voided | cancelled | locked`. `'sent'` dominant (~2.6M).
- **`sw_fulfill`** (tinyint): `1`=SugarWish fulfills in-house (~559K), `0`=vendor/3PL/dropship (~584K), `NULL`=legacy (~2.8M). It is the in-house-vs-vendor flag, **not** a shipment/label status.
- **`is_printed`** (multi-state, label/print queue, NOT boolean): `0`=not printed (Pending), `1`=printed (In Fulfillment; order auto-removed from its print group when set to 1), `2`=slip "Issue" from PDF-cron failure (missing boxcard/insert or no high-res image), `3`=address/label-blocked / On Hold queue (reset, not terminal), `5`=added to print group.
- **`merchandise_selections`** (JSON): what the recipient chose; currently **NULL for ~all/586K+ rows** (WW-158 blocking the merchandise/custom-anything flow).
- Two ID columns: **`order_id`** (short numeric; join key for `component_orders.order_id`) vs **`increment_id`** (public-facing, e.g. `20015627753`; this is the `sale_id` bridge to Odoo `serp_stock_picking`/`sale_order`). **Order-number prefixes:** RECEIVER orders start `200…`; PRESELECT orders start `6000…`.
- **No `recipient_email` column** exists — querying it errors. Sender/receiver email come from `giftcards_card`.

#### Preselect / Prepick

3-table hierarchy: **`preselect_master_ids`** (grouping/ID allocator — only `id` + timestamps; mints batch master IDs) → **`preselect_order_billing_details`** (aggregate payment) → **`preselect_orders`** (individual shipments). Payment methods: `stripe` (card), `checkmo` (check/invoice). One master can have 10K+ children (e.g. master `700017956` = 10,033 children).

- `preselect_orders.type` enum (CHANNEL, separate from status): `preselect | sweet-shoppe | sweetificate`.
- `preselect_orders.status` enum: `pending | completed | canceled | deleted | shipped | on_hold`.
- `sw_id >= 600,000,000` = preselect/wholesale; bridges to Odoo via `preselect_order_id` (NOT `ec_order`). `sw_id < 600,000,000` = receiver/ec_order.
- **Data-integrity gaps:** ~70,799 preselect orders have a `master_id` that doesn't exist in `preselect_master_ids`; ~387 orphaned (NULL `master_id`).

#### Order Cancellation & Credits

- **Standard "undo" = cancel-and-credit minus 10%**: 90% **account credit** to corporate credit balance (NOT a card refund). Now AUTOMATED for accounts with "auto cancel/credit" on; otherwise manual via Retool "bounce request" list (if within 1 year and account not redeem-only).
- **Money-back-to-card refund**: rarer, separate path via the "Refunds - Without Cancelation" Slack shortcut (often large amounts, batched).
- **Cancelled BEFORE delivery** (Odoo): `sale_order`/`stock_picking`/`stock_move` → `cancel`; no return needed. **Cancelled AFTER delivery**: if no return exists, `delivery.automate_picking_return()` creates an `EW/RET/…` return picking, then `action_cancel()`. Code in `sugarwish_integration/wizards/sugarwish_sales.py` (~lines 149-198), triggered when Laravel API sends `order_status='canceled'`, uses `disable_cancel_warning=True`.

#### "Redeem-only" Accounts

Pay **10% upfront, 90% on redemption only**. **NOT eligible for the 90% cancel credit** if cancelled before redemption. **Incompatible with HHS/PPS** discounting. Volume discount applies on the upfront portion only.

---

### Fulfillment

#### Warehouses & Locations

- **EW = Englewood, CO** (`locations.id=1`, default; HQ 8450 Highfield Parkway Suite 100, Englewood CO 80112). **TY = Taylor, MI** (`locations.id=2`).
- SKU suffix encodes warehouse: **`-A` = Taylor/standard** (location_id 2), **`-E` = branded Englewood** (location_id 1). Branded (sleeve/merch) orders MUST use `-E`; non-branded MUST use `-A` (an hourly n8n workflow flags mismatches). Forecast rolls `-A` and `-E` as the SAME product. When an `-E` lacks a BOM, fix is a synthetic BOM pointing at `RM-XX-XXX-E` or a duplicated `-A` BOM with A→E swap. A Serpy "move quantity -A to -E" request = a PAIR of inventory adjustments (never a stock_transfer).
- **8 fulfillment locations** total: 1=Englewood, 2=Taylor, 3=City Pop, 4=Simple Times, 5=WCC (Wine), 6=Vista, 7=Becket and Quill, 8=Poppin & Mixin. Gift cards (`product_type=43`) have `location_id=NULL`. Orders can contain items from multiple locations → grouping grain is "items shipped per location," not "orders per location." The throughput dashboard filters `locations.id IN (1,2)` (EW+TY only) — other locations and NULL are silently dropped.
- **Laravel `locations`** (physical warehouses) is separate from Odoo `stock_location` (bins/zones); no FK between them. `locations.column` names the inventory column to read (`inventory_qty` for EW, `mi_inventory_qty` for TY); `locations.status_column` (`status` for EW, `location_2_status` for TY).
- Odoo `stock_location.sugarwish_id` controls Laravel sync: **`>0` syncs to Laravel** (only `EW/Stock/Fulfillment` id=2008 has `sugarwish_id=1`), **`=0`** internal-only, **`NULL`** system/virtual. `receiver_products.location_id` exists but **all rows NULL — unused**; real deduction location is via Odoo `stock_location.sugarwish_id` (EW=2008, TY=2006).

#### Product-Line Routing (mid-2026)

Product line is determined by **`laravel_live.product_type` (SOURCE OF TRUTH), NOT Odoo `product_category`**. Routing:

- **Candy & Snacks, Gourmet Goods & Spa, Hot Sauce, Dog Treats & Swag** → Englewood (EW).
- **Bakery & Cafe** → normally TY, but **OVERRIDE to EW if a sleeve/custom merch is attached**.
- **Mini Popcorn** → normally vendor "Poppin & Mixin," but **move to "CityPop" if a sleeve** is attached.
- **Custom Mug & Treats** → normally TY, but **override to EW if sleeve/merch**. This causes recurring pain: mug+treats orders split EW/TY → double shipping + manual tracking emails to recipient.
- **Forecast location attribution**: read the FIRST item in the order and its `location_id`. Physical mug production is in Taylor, but forecast usage **rolls up to ENGLEWOOD** ("custom mug usage should count as Englewood").
- **Bakery & Cafe EW/TY split**: `product_type 567` splits into `Bakery&Cafe@EW` / `Bakery&Cafe@TY` in the forecast (combined = "Bakery & Cafe"); mapping in `frontend/app/forecast/lib/formatters.ts`. Size projections split EW/TY by ratio of actual orders to each location over a rolling 30-day window, clamped to start no earlier than 2026-05-19. Low-stock alerts route by `receiver_product.location_id`; a "duo alert" @-mentions both location owners.

#### What Marks an Order Shipped / Finalizes Inventory

- **ShipStation LABEL generation** marks the order shipped and unreserves/finalizes inventory — **NOT** printing the production slip. Labels generate near-instantly on a recipient order, leaving little window to fix reserved-negatives before shipment.
- Odoo "Reserved" should equal unshipped in ShipStation; Odoo sends (on_hand − reserved) to Laravel as available.

#### Production Slips

- **Physical batching** via production-slip BATCHES: `preselect_orders.production_slip_batch`, `master_id` groups; `ec_order.component_imported`/`vendor_imported` flags; `production_slip_batch_orders` records per-order PDF generation/merge results (`pdf_fetch_success`, `pdf_merge_success`, `error_message`).
- **Slip print is HARD-GATED to EW/TY only**: `validate_slip_rows` `ALLOWED_LOCATIONS` raises "Print blocked" for any non-Englewood/Taylor `location_name`.
- **GenerateReceiverOrderPdf** Artisan command sets `receiver_production_slips.is_printed` (0=queued, 1=printed, 2=issue, 3=on hold, 5=in print group).
- **Slip silently skips** (no row, invisible to generator) when: `ecard_design.inserts` is NULL, missing `ecard_designs` row, or `highResolutionImageFound()` is false (S3 check). Box-card / insert nullness → PDF cron sets `is_printed=2` and the order silently never prints/ships. Manual regen via the admin "Regen" button works.
- **Bug — `Item::mapForProductionSlip` non-deterministic `->first()`**: re-queries `receiver_products` by SKU with no `orderBy`; when duplicate SKUs exist (different `sort_key`), MySQL returns a non-deterministic row, overwriting `prod_slip_sku`. Fix: use stored `product_id` instead of re-querying by SKU.

#### Custom Branding / Sleeves

- **Sleeve matching**: keyed off `ec_order.size` (a `buyer_products.id`, e.g. 62=Small Popcorn) against `branding_records.physical_branding.entries[].buyer_product_ids[]`, keyed by box family (`a_mini`, `a_small`, `a_medium`, `a_large`, `a_xlarge`, `c_1`, `c_small`, `h_small`, etc.). Multiple products in the SAME box share ONE entry (e.g. `a_small` covers Dog S-Wag Small 42, Candy & Snacks Small 6978, Popcorn Small 62). **"Missing sleeve" bugs** = `buyer_product_id` absent from an entry's array → fix is to **ADD the id to the existing entry** (extend, don't create a new entry/box).
- `branding_records` JSON layers: **`physical_branding`** (sleeves — currently the only `type` in prod), **`digital_branding`** (awning, note_card_logo), **`merchandise`** (mugs/items). Approval columns `physical_branding_approval` / `digital_branding_approval` / `merchandise_approval` (tinyint 0-3: 0=default/unapproved, 1=needs review, 2=pending CS, 3=approved). Entries have **NO active/primary/status flag** — all entries are equal; fulfillment must filter to the entry whose `buyer_product_ids` contains the order's `ec_order.size`. `print_render_status`: `pending | not_required | rendered | failed`.
- **To remove a sleeve**: NULL `physical_branding`/`digital_branding`, set `approvals=0`, `print_render_status='not_required'` — AND the eCard/boxcard design on the giftcards card must ALSO be swapped, and the slip regenerated (especially if already redeemed). Removing branding alone is insufficient.
- **Multi-size proposals** intentionally carry one sleeve entry per box-size variant (e.g. `a_small`, `c_1`, `c_small`). Print pipeline MUST filter to the entry matching the order's `ec_order.size`, or it sends all PDFs (over-print).
- **Custom mug print**: SWOP/Livery reads the image from `ec_order.merchandise_selections.items[N].design_selected.print_image_url` (matched by `item_id`), **NOT** `branding_records.merchandise.items[0].designs[0]`. Recurring bug: `design_selected=NULL` or `item_id` mismatch → PDF build silently renders nothing. Patching `branding_records` alone is NOT enough; `ec_order.design_selected` must be populated. Redemption can write a fresh `ec_order` with `design_selected=null`.
- **Render pipeline** (`branding-print-render-cron.ts`, every 5 min prod / 30s dev, `MAX_RECORDS_PER_RUN=5`, `MAX_RENDER_ATTEMPTS=3`): picks `WHERE print_render_status='pending' AND cart.purchased=1`. Logo precedence (`resolveRenderLogoInput`): `entry.logo_override` → `entry.logo_url` (pinned at checkout) → `user_id` fallback (re-resolve; risk of placeholder if company logo changed). After 3 failures an entry is permanently abandoned unless manually reset to 0.
- **Print-quality footguns:** render cron (`ENABLE_BRANDING_RENDER_CRON`) was never set in live `.env` → `print_url=null` → fallback to 50-DPI JPEG thumbnail (`s3_url`). Mug print is hard-capped at 800×800px at every stage (preview 225×225 → pixelated when scaled); sleeves got the high-DPI `render_tier:'print'` fix, mugs never did. Production-slip PDF is NOT regenerated when CS re-uploads a logo (only the `mugs-live/{orderId}.png` print file is) → slip shows stale low-res image.
- **Image dimensions:** mug print target 800×800, preview 512×409 with a 225×225 printable area (topPercent 24.45%, leftPercent 28.03%); white-bg removal threshold 200 (245 for template). Multi-save: on save, upload to print bucket, update `accessory_images.print_image_url`, preserve `original_print_image_url`, then copy to EVERY linked order's bucket and log `additional_saves` count in `metadata.workflow_history`.
- **Custom Mug & Treats (bp 6950 sender / bp 6961 receiver) is EXCLUDED from `physical_branding` generation** → every sleeve-eligible Custom-Mug order mismatches at redemption (fires `slip-data.js` warn 2× per render).
- **Hot Sauce "2 sleeves" bug**: `design_boxes` `a_medium`/`a_mini`/`a_xlarge` still list `product_type_ids=[6,46,49]` (include type 46/Hot Sauce) while `a_small`/`a_large` were cleaned to `[6,49]`. A Hot Sauce Medium buyer_product (type 46, size 3) matches BOTH `a_medium` AND `h_medium` → 2 entries with the same `buyer_product_id` → Livery over-prints 2 sleeves. **Fix:** `UPDATE design_boxes SET product_type_ids=JSON_ARRAY(6,49) WHERE sku IN('a_mini','a_medium','a_xlarge')`. (Same shape on Gourmet Goods Medium 7026 across `c_1.25`/`c_1.5`.)
- **Livery/SWOP caching footgun:** Livery caches PDFs by `orderId` ONLY and NEVER invalidates on branding edits. After a data fix, operator MUST click "Regenerate" (`POST /reset-status/:orderId`) then re-run generate-batch. A `box_sku` missing from `SKU_TRIM_TABLE` (e.g. `c_3`, `h_*` keys) makes `normalizeSkuKey` THROW → whole PDF aborts silently (no sleeve). `render-at-size` admin button copies the source entry's `buyer_product_ids` verbatim — wrong for a different target box (should call `filterProductsForBox`).
- **Sales-with-sleeves metric** = **% of total ecard revenue that includes a sleeve**, NOT the dollar value of sleeves. Custom sleeves are described by Jason as the "biggest near-term revenue opportunity" (~$2-5 each, MOQ ~1000, 7-9 days after art approval).

#### Custom Box / Merch Pricing

MOQ 1500 units (8-10 week lead). Per-box: Small $8.50 / Medium $11.50 / Large $12.00 / XL $12.50 (incl. proof+setup). 1000-1499 units: same pricing + $250 setup charge.

---

### Forecasting

#### Core SKU Availability Goal

Keep **≥90% of core SKUs live** (having inventory or ordered inventory) at all times.

- **3-tier classification** on `receiver_products`: `sku_type` VARCHAR(16) ∈ `core | seasonal | legacy` (default `legacy`; counts ≈ core 456, seasonal 8, legacy 4699) + `is_core` tinyint(1). **Business rule: `is_core` must equal (`sku_type=='core'`)** — enforced in **app code only** (helper `core_flag_for_sku_type`), **NO DB trigger**. One live exception: `product_id 4177` (SA-46-033) has `sku_type='core'` but `is_core=0`. ~220 SA SKUs flagged core. SERP is the canonical system (decided at Jack's L10, Matt confirmed); `kelleymax`/Kelley tags seasonal/legacy.
- Classification lives **only on PARENT SKUs** (`parent_sku IS NULL`) and propagates parent→child **only in the forecast READ pipeline** (display), never written to children. Child SKU = `LEFT(sku,2) IN ('SA','FG')` AND >4 dash-segments.
- There is **NO `make_for` column** — "make for" = toggling `is_core`/`sku_type`.
- **`drop_level`** (int, nullable) = floor at/below which a SKU is disabled. **`threshold`** ≈ 2× `drop_level` = alert trigger. When cloning a SKU to a new location variant, `drop_levels` do NOT auto-copy correctly.
- **Serpy `update-receiver-product` whitelist** (`RECEIVER_PRODUCT_WRITABLE`) must include `sku_type` + `is_core` (writes to MANAGE MySQL, not prod `laravel_live`); when Serpy sets `sku_type` the handler must also set `is_core` to match.

#### "Days of Inventory" — Three NON-Interchangeable Metrics

1. **`/forecast/live-products` SA/Total Days** = `inventory / daily_rate`, where `daily_rate` = last-7-day actual orders / 7. Per Jason: **SA Days = packing goal, Total Days = purchase goal**. Runout Days = MIN runout across ALL of an SA's materials (bulk RM + every packaging label/carton), not just the first component.
2. **`/forecast/dashboard` supplier `total_inventory`** = `rm_inventory + sa_inventory(BOM-converted) + rm_ordered(open PO qty) − drop_level`; demand = 25-week FORECASTED weekly demand from Retool `size_projections`.
3. **`/forecast/ecard-inventory`** = simulation-based days-until-90%-threshold.

Jason's metric definitions: **packing_goal** = min SA-days for core SKUs with RM available; **purchase_goal** = min total-days for core SKUs by product line; **Inventory Days** = current inventory / (L7D Use / 7).

#### Forecast Color Code (Volume & Supplier Forecasting App, `serp.sugarwish.com/forecast/live-products`)

GREEN = inventory available; ORANGE = manufactured (SA) runs out but raw material (RM) remains; YELLOW = on-hand runs out but incoming PO hasn't arrived; RED = all runs out. Predicts SKU/size popularity, weekly order quantities, runout week.

#### Product Type Key (PTK)

PTK = `'ProductType|Size'` string. **Dashboard and `sa_projections.sql` must produce IDENTICAL strings** or demand won't roll up. Popcorn sub-brands "City Pop"/"Poppin & Mixin" normalize to "Popcorn"; **explicitly NO Popcorn collapse** in the EW/TY-style split (CityPop vs Poppin split type-keys pass through). Custom Mug & Treats "mug" and "treats" are NOT separate SKUs (separate `size_name` rows under `CUSTOM_MUG_PRODUCT_TYPE`). `sku_product_type_key` has base SKUs AND `<sku>-bakerycafe` variants (base SKU maps to the _wrong_ type for Bakery & Cafe — a known data gap). Forecast HIDES an RM when ALL its SAs are archived.

#### Popularity Data

Popularity scores (`sku_projections`: `popularity_3_weeks`, `popularity_8_weeks`, `popularity_1_year`) come from **real recipient survey data, NOT code** — a brand-new SKU/product type has ZERO popularity until surveys arrive. `sku_supplier.lookback_period` selects which window per-SKU. `size_projections_copy` holds per-SA per-week `popularity_pct` (sums to 1.0 within a `product_type_key` — a market-share mechanism). `sa_projections_cache` feeds `rm_weekly_demand_cache` explosion (via `bom_components_cache` to explode SA→RM). `redemption_curve` (~82% day 0 → ~41% day 11) drives probabilistic forecasting (not all gifts redeemed).

#### Buyer Product = "Size"

"**Buyer product**" is a SYNONYM for "**size**" (a `size_projections_copy` row). It is NOT a separate buyer-level allocation. Forecasting applies `projection = order_qty × size_percentage × number_of_candies`. **`number_of_candies`** (integer 2/4/6/8/12 on `buyer_products`) = item count per package; a legacy cost-analysis scaling factor.

#### Outstanding eCard Quantity

In forecasts = items expected to redeem from already-placed ecard orders not-yet-shipped (the redemption backlog), computed from `volume25` demand.

#### Equivalency Ratio (Cost Normalization)

To compare costs across product lines (candy has many items, popcorn few), each product type gets an equivalency ratio: **Candy & Snacks = 1.0 (baseline), Popcorn = 0.5, Gourmet Pantry ≈ 0.75, Spa ≈ 0.75**, Wine/Gift Sets TBD. Cost-per-equivalent = dollars / units (NOT `dollars×ratio / units×ratio`, which cancels). Used for one normalized executive-scorecard number. The weekly cost automation (n8n, Sundays) computes avg cost/item shipped (~$1.75-$1.83) into the scorecard.

#### Archived-SKU Forecast Policy (Neal/Mike/Jack decision)

Archived SKUs are **HIDDEN from forecasts EXCEPT when they have positive inventory** (to track for write-off/destruction), and must be marked "archived" when shown; no demand is forecasted for them. **Footgun:** `sa_inventory.sql` correctly filters `pp.active = true`, but `rm_inventory.sql` and `packaging_component_inventory.sql` are MISSING that filter → archived RMs leak into the forecast. Also `sku_projections` has NO archive flag — must join Odoo `product_product.active`. Archived status does NOT sync Laravel→Odoo (RM stays `active=true` in Odoo even when its SA is archived in Laravel).

#### Forecast Footguns

- **Two still-live orchestration paths**: dashboard `/api/forecast` uses `SupplierForecastPipeline`; CSV `export.py` still calls legacy `ForecastService.generate_forecast()`. **Bug fixes don't propagate between them** (e.g. the date_utils W52/year-boundary fix landed in the pipeline but not the export path → CSV shows zeros at the W52→2027 cliff while the dashboard is correct).
- **Year-boundary zero-cliff**: `size_projections_copy`/`week_settings` only cover through 2026 → any 2027 forecast week INNER-JOINs to nothing → ZERO demand. Several PTKs broken for lack of `product_type_key_sizes` mapping (Wine|Small Wine; Gift Sets|Deluxe/Large/X-Large; Candles).
- **`sa_projections.sql`** is a 437-line, 20+ CTE query, ~7-10 min runtime (far over the 30s timeout), ~210K-492K rows from a CROSS JOIN of `week_settings` × SKUs; its `current_skus` parameter is IGNORED (it builds its own CTE → returns ALL projections). Timeout raised to 120s + indexes added.
- **Wine special case**: SKU churn (opportunistic buys) → should be NON-core (cleanup still needed: ~29 type-10 + ~29 type-14 rows had `sku_type='core'` as of 2026-06-01); uses a **CATEGORY-GOAL, not per-SKU** (`operation_levels` keyed `"CategoryName|product_type_id"`, e.g. "Bold Reds|10"); has NO real BOM (self-maps SA-14→SA-14 → Bulk-vs-Packed double-count of the same `stock_quant`; fix = zero out packed inventory); replenished outside Odoo POs (WCC gravity racks, ~1-week lead). Wine FC = `location_id 5` (WCC). Exclude `product_type 25` (12 Nights) and `550` (Vinebox) from wine. Tasting-kit pack sizes map via Odoo category ids — SERP `wine_dashboard.py` includes only {55=3-pack, 56=6-pack, 57=9-pack} and is MISSING 165 (12-pack) and 190 (4-pack).

---

### Kits & BOMs

#### THREE Parallel Kit/BOM Systems (drift independently, separate & COLLIDING id namespaces — coordinate ALL edits)

1. **Laravel `component_kits`** (box SKUs `B-*`, `S-*`): `buyer_products.default_kit`/`.seasonal_kit` FK → `kits.id`; line rows carry a **`hide` flag** (1=archived, 0=active) + `recipe_key`. Edited via Serpy `laravel_update_kit` (add/remove/update_qty component). 89% of kits have exactly ONE component (the box). SERP phantom-BOM does NOT track boxes — pure `B-*` SKUs MUST use Laravel kits.
2. **SERP `serp_mrp_bom` phantom BOMs** (`type='phantom'`): shippers `S-*`, inserts `I-*`, production paper `P-*`, cups `E-*`/`C-*`, merch recipe_keys. Edited via Serpy `serp_update_kit` / "Update SERP Kit". **STALE one-time April-2026 snapshot** (~224 rows, identical `create_date` 2026-04-03, **NO `odoo_id` links**, only `type='phantom'`, ~29% coverage of Odoo's phantom BOMs) — a known source of kit-sync divergence when Serpy routes edits there instead of Laravel.
3. **Odoo `mrp_bom`** (manufacturing recipes; ~2,078 total: ~1,303 normal + ~775 phantom): live in Odoo, mirrored to `serp_mrp_bom`. Jack is building a SERP "BOMs" page (mirroring the "Kits" page) that edits Odoo `normal` BOMs via Serpy ops.

**Carolyn's confirmed split (ADDITIVE, not overlapping):** Odoo phantom BOMs cover EVERYTHING EXCEPT the colored box (`S-*`, `P-*`, `I-*`, `E-*`, `L-*`, `T-*`, `C-*`); Laravel kits cover ONLY the colored box (`B-*`). An order needs BOTH sources for its full component list. **Documented double-count incident:** soap dish appeared in both a Laravel kit AND an Odoo BOM. `/boms` page filters `type='normal'`; `/kits` filters `type='phantom'`.

#### Phantom vs Normal

- **Phantom BOM** = a kit that EXPLODES into component moves **at SALE/delivery time** (no separate MO). It creates ZERO `mrp_production` records. ~265-775 active phantom BOMs in Odoo. ~97.9% of Odoo BOMs have `product_id=NULL` (linked via `product_tmpl_id` only) → causes "no BOM found" in `serp_find_kits` which matches by `product_id`. SERP's `bom_find()` only searches `product_id` with **no `product_tmpl_id` fallback** (docstring claims one; code doesn't implement it).
- **Normal BOM** = real manufacturing via a Manufacturing Order (MO), converting RM→SA. ~1,061-1,303 active.
- Phantom-kit BOMs map to Laravel via `product_template.sugarwish_id = buyer_products.odoo_id` (where `odoo_id = '500' + buyer_products.id`, e.g. bp 60 → 50060). 220/263 active phantom BOMs have `sugarwish_id` set; 43 have `sugarwish_id=0` (old duplicates).

#### ID-Namespace Trap

`kits.id` and `serp_mrp_bom.id` collide numerically (e.g. `682` is a `serp_mrp_bom` id, NOT a `kits.id`). `serp_find_kits_by_sku` returns `serp_mrp_bom` ids; the `archive_impact_check` rule then passes those as `kit_id` to `laravel_update_kit` → `component_kits WHERE kit_id=:kit_id` finds nothing → "removes fail not-found, adds fail already-exists." **Real failure: draft #860 (Carolyn, 2026-05-12)** failed on `kit_id ∈ {682,683,684}`. Fix: the rule must call `find_laravel_kits` for the Laravel arm and `serp_find_kits_by_sku` only for the SERP arm.

#### Replacing / Discontinuing a Component

Fan the change across all three systems: emit `remove_component(old)` + `add_component(new)` for kits/BOMs; for Laravel set `hide=1` on old, `hide=0` on new. A component archived in one system while still referenced by a live kit = sync failure. Serpy "Replace SKU X with Y" SHOULD mean a kit COMPONENT SWAP (remove old + add new across every kit), NOT archive-old + activate-new — intent is only implicitly encoded in commit `34bd6da9` and Serpy sometimes mis-resolves it.

#### Kit Explosion Routing (SOURCE TABLE matters)

- Delivery-path kit explosion is scoped to **`items`-origin (gift-selection) lines ONLY**; `component_orders` box/buyer-product kits must NOT explode (prevents double-booking). `items` = explode; `component_orders` = don't.
- **Legacy receiver/popcorn pickings are NOT built via BOM explosion at all**: every `stock.move` has `bom_line_id=NULL` and a populated `sale_line_id` (flat 1:1 `sale.order.line`→`stock.move`). Expansion into bulk-flavor+sticker+box+cups+inserts+production-paper happens at order-BUILD time in Odoo's Sugarwish import (`ec_order`→`sale.order`), not via manufacturing BOMs.
- Newer SERP Laravel flow: `insertComponentOrdersFromRecipeBom` → `SerpBomService` (gated by `hasMerchandise()`) DOES use SERP phantom BOMs; legacy receiver orders use `component_kits` plus additive SERP phantom-BOM components.
- `ReceiverOrderService::updateInsertKit()` creates a `ComponentOrder` per `component_kit` automatically and deducts inventory by location — adding phantom-BOM components to a kit auto-generates component_orders, no code change needed. `giftCard.seasonal_kit_until` decides seasonal vs default kit.
- **BOM line gotcha:** ~30-48 `mrp_bom_line` rows have `product_qty=0` (optional/conditional packaging) → division-by-zero in RM→SA conversions and `inventory_variance.py`. Always filter `product_qty > 0`. BOM conversion rate = `mrp_production.product_qty ÷ SUM(mrp_bom_line.product_qty)` and MUST filter `stock_move.state='done'` (cancelled moves inflated SA-45-008-A to 27.17× vs the true 1.0).

#### April 2026 Combo-Line Migration (long-tail bug source)

Jack's SQL migrations CONSOLIDATED legacy combo-line `product_types`; Phase 2 ARCHIVED now-redundant child variant SKUs (`archive=1`, `status='disabled'`, `inventory_link=NULL`). Resulting bugs: (1) receiver/redemption flow kept resolving to disabled child SKUs → Odoo "product not found" → orders stuck at `oddo_synchronized=3`; (2) ~14K giftcard `card_id`s had `product_id` pointing at the CORE product (type 51) instead of sweetshoppe (Jaypee corrected); (3) ~14K active ecards with old standalone product selections showed empty "no items" redemption screens. **Lesson: redemption resolves products at REDEMPTION time, so consolidation has a long tail of orphaned-SKU/stale-`product_id` bugs — historical cards must be backfilled.**

---

### Popcorn Special Handling

- **Popcorn identity mechanism** (NO BOM; ops-approved by Carolyn 2025-07-03): an `SA-02-*` flavor (e.g. SA-02-017-A) is created **LARAVEL-ONLY as a $0 selection token, ARCHIVED in Odoo** (`sugarwish_id` removed). The costed STICKER SKU (`L-B02-REG-23-0NN-COX`) + a 32oz cup are created in Odoo and carry the cost. **KEY TRICK:** the flavor's `receiver_products.product_id` IS the sticker's id, and the SAME `sugarwish_id` is placed on the sticker's `product_template.sugarwish_id` (e.g. flavor SA-02-017-A `product_id`/`sugarwish_id=2082`; sticker L-B02-REG-23-017-COX `sugarwish_id=2082`). The `/api/odoo` payload sends `order_line` entries keyed by `receiver_products.product_id` → Odoo resolves (via `sugarwish_id`) onto the costed sticker, creating sticker SO lines, NOT bare popcorn. Sticker count caps sellable tubs. A multi-pick popcorn box carries, per flavor, BOTH a bulk-flavor line AND a separate per-flavor sticker line. Vendor-fulfilled (City Pop / Poppin & Mixin).
- **SERP phantom flip** (`feature/popcorn-phantom-explode`): Odoo's live BOMs are `type='normal'`; the SERP seeder `make_popcorn_boms_phantom()` flips `SA-02-*` to phantom **IN THE LOCAL/darklaunch SEED ONLY, never written back to Odoo**, letting the SERP delivery path auto-explode the kit into costed cup+sticker leaf moves (no parent flavor move) — an APPROVED divergence (`ODOO_APPROVED_DIFFERENCES.md` 2.6, fixed 2026-06-02).
- **COGS bug fix**: the SERP worker initially resolved items by `product_sku` (the bare $0 bulk flavor) instead of `product_id` (the sticker), omitting flavor-sticker lines → ~$0.17-0.18 COGS undercount per flavor. Faithful fix = mirror Odoo's `sugarwish_id` line resolution (seed a `sugarwish_id→product` map), NOT SKU string-munging / row-merge / a real BOM.
- **Hardcoded popcorn costs** live in `backend/schemas/cost_tracker.py` `POPCORN_COSTS` (160 SA-02-\* SKUs; tiers $3.00 premium / $2.40-2.44 standard / $2.37-2.24 sweet-cheese / $1.80 savory / $1.24 basic / $0.00 FL-variants). Synthetic BOMs map SA-02→RM-02 and SA-14→RM-14 because popcorn and wine have no real Odoo BOMs.
- **Operational rule:** a popcorn order should NOT carry merch or a sleeve (recurring City Pop bug WW-964). Mini Popcorn moves vendor "Poppin & Mixin" → "CityPop" when a sleeve is attached. "popcorn-phantom-explode" also informally refers to mixed-direction shipment pickings; the 2026-05 "popcorn bombs" edge case had to be "added back into Odoo."

---

### Prepay Programs (HHS / PPS)

**HHS (Holiday Head Start)** and **PPS (Pre-Pay)** are seasonal prepay-for-bonus-credit programs (alternatives to a flat % discount):

- Client pre-pays a lump sum → receives tiered BONUS credit (e.g. $5k+$2k tiers → stacked bonuses like $2200+$1000+$300+$100). Published in PDFs (e.g. `PPSWinter2025.pdf`).
- Each HHS/PPS purchase triggers/renews "Sugarwish Premium" status.
- Can be paid by PO/invoice (not immediate card); bonus granted on PO receipt. The "Purchase Credit" link is gated to active HHS/PPS windows; outside windows clients add credit via a pay-now invoice.
- Effective discount ≈ **18%** vs the standard 15% large-order discount.
- **Incompatible with redeem-only accounts.**

---

### WishLink

- WishLinks were originally **NON-refundable**; CHANGED in **2024** to "cancel and credit −10%" like eCards.
- Pricing: ~$2/link + redemptions.
- Multi-use links can carry domain restrictions (clients often ask to remove them).
- Common cases: bought single-use but wanted multi-use (one-time exception waiving the 10% fee); expired link needing reactivation/credit (handled through billing).

---

### Discount / Enterprise Rules

- **Standing volume tiers**: ~5% ($10k-$20k), ~8% (push-room concession), 10% (above ~$20k), 15% (very large, ~$250k+), ~20% (single-location shipping).
- **Promo codes** (`Enterprise5` / `Enterprise8` / `Enterprise15`): **CRITICAL GOTCHA — promo codes do NOT work on pre-pick orders.** Billing applies the discount MANUALLY by deducting from the final invoice AFTER the order is entered.
- **Redemption-based products**: estimate using **~70% redemption** to choose the discount tier.
- **Discount approval is a gated human-judgment process** (`#enterprise` channel): AMs request approval before any non-standard discount; approvers reason explicitly about quantity-vs-margin (e.g. "I'd rather not do 10%, big drop in quantity") and instruct AMs to "publish" a higher price with room to discount down. Authority = enterprise/sales leadership (historically deb/jen_connelly), CEO Jason Kiefer final escalation.

---

### Negative Inventory / Oversell

- **Negative quants are NORMAL in virtual locations** (Vendors id=4, Production id=15, Inventory-adjustment id=14) — these are double-entry accounting offsets, not physical stock. **Only negatives in INTERNAL locations (Stock/Fulfillment) are real problems.** As of early 2026: ~482-5,918 quants carry negatives totaling ~−37.8M units; breakdown ≈ Vendors −25.2M, Production −7.2M, Inventory-adjustment −5.2M, Stock −81K, Fulfillment −20K. Only the ~54-259 internal-location negatives need cleanup.
- **Root cause of negative West Coast / internal Qty: cycle count does NOT drop reservations** — a `stock_quant` with `quantity=0` but `reserved_quantity>0` yields negative available (`available = quantity − reserved_quantity`).
- **Oversell mechanism**: the Odoo→Laravel inventory sync **floors negative values to 0** (`sugarwish_integration/wizards/sugarwish_stock.py` ~lines 75-77), HIDING backorder depth → products stay enabled when oversold. Proposed fix: send `(available − unreserved demand)` instead of raw inventory; include unreserved demand in the calc. (Temp workaround: nudge inventory ±1 to force re-sync.)
- **Truth is split**: Odoo is canonical for on-hand/available and RM inventory; **Laravel is the source of truth for what's AVAILABLE TO SELL** (it deducts pending orders Odoo doesn't know about). Available-to-sell must deduct `items` where `odoo_sync IN (0,1)` (orders placed but not yet imported to Odoo). The daily inventory report has a bug: it reads the STALE `receiver_products.odoo_inventory` column (can be 180× off, e.g. `inventory_qty=1,974` vs `odoo_inventory=11`) and only sums the "Fulfillment" location instead of all internal locations — use `inventory_qty`.
- **Auto-disable / drop-level**: n8n `Disable_Unreserved_Products` (runs ~every 1 min) queries Odoo directly and disables `receiver_products` where `final_available < drop_level`. It is **disable-only — there is no auto re-enable**, and there is **no cooldown**, so a manual re-enable on a still-below-drop SKU is re-disabled within seconds. It is a known DEADLOCK source competing with Laravel/Retool writers on `receiver_products`. Low-inventory warnings post to `#live-product-warnings`/`#inventorymanagement` at ~2× drop level, tagging the responsible owner.
- **Stuck reservations block availability**: tens of thousands of `stock_move` rows are stranded in `assigned`/`confirmed`/`waiting` (counts ranged 600 → 3,915 → ~48,909 across snapshots; oldest from May 2023; top offender `B-CCC-REG-22-MUG-XXX`), mostly from cancelled orders whose moves were never transitioned to `cancel`/unreserved. They lock `reserved_quantity` permanently. **Must unreserve via Odoo ORM (`stock.move._do_unreserve()` / `stock.picking.do_unreserve()`), NEVER direct SQL** (direct SQL desyncs `stock_move_line.reserved_qty` ↔ `stock_quant.reserved_quantity` → "Cannot unreserve more than in stock"). **Odoo bug:** `do_unreserve()` on a move with `qty_done>0` sets `product_uom_qty=0` but skips `_recompute_state()`, leaving a "zombie" move stuck in `assigned`.

---

## Gotchas, Footguns & AI Misconceptions

This is the highest-value section for an AI assistant working in SugarWish's stack. SugarWish runs five overlapping systems (**Odoo**, **Laravel**, **SERP**, **WishDesk/SWAC**, **Retool**) wired together with fabricated IDs, typo'd column names, dual-write shadow systems, and intentional divergences. Almost every "obvious" assumption is wrong. Read this before touching data, writing SQL, debugging sync, or "fixing" a drift alert.

---

### Cross-System Architecture & Source of Truth

#### Source of truth is split per-entity, not uniform

❌ **AI assumes** there is one uniform sync direction and one source of truth (e.g. "Odoo always wins; all SERP writes go to one place").
✅ **Reality:** Source of truth is split by entity:

- **Odoo-owned:** manufacturing/normal BOMs (`mrp_bom` type='normal'), manufacturing orders, product creation, purchase orders. SERP reads live Odoo, writes back via `odoo_sync_queue` → XML-RPC.
- **SERP-owned (phantom):** kits are phantom BOMs (`serp_mrp_bom` type='phantom'), edited via `serp_update_kit`.
- **Laravel/SugarWish-owned:** `receiver_products` classification, `component_kits` — Serpy writes to the **manage** MySQL DB.
- On natural-key conflict during the SERP overlay seed, **SERP-origin data usually wins** (users matched by **email**), but exceptions exist.

❌ **AI assumes** either Laravel or Odoo is the single inventory source of truth (or relies on the old Jan-2023 "Odoo is source" statement).
✅ **Reality:** Truth is split: **Odoo** is canonical for on-hand/available; **Laravel** is source of truth for what is **available to sell** (it deducts pending orders Odoo doesn't know about). **RM inventory lives ONLY in Odoo.**

#### The Laravel↔Odoo integration is PULL-based, not push

❌ **AI assumes** Laravel pushes orders to Odoo.
✅ **Reality:** **Odoo is the puller.** Odoo crons authenticate to Laravel's `/api/odoo/*` endpoints (Bearer token) and pull unsynced orders, then call back to mark passed/failed. Laravel has **no XML-RPC client**. Cron `Sugarwish: Update Failed Orders` re-pulls every 10 min; `Update Orders` every 6 min; `Update Prepicks` every 120 min; `Update Failed Prepicks` every 15 min. SERP's dual-write XML-RPC capability is **new** and must be built; Laravel never had it.

#### WishDesk is downstream, not a source

❌ **AI assumes** customer/order master data lives in WishDesk, or that WishDesk integrates directly with Odoo.
✅ **Reality:** WishDesk is **downstream**. Truth lives in SugarWish (Laravel/Odoo). WishDesk stores only **ids + cached snapshots**. The chain is **WishDesk → reads → Sugarwish DB ← syncs ← Laravel API ← polls ← Odoo**. WishDesk accesses Odoo data only via Sugarwish fields (`odoo_sync`, `odoo_id`, `bypass_odoo`, `ship_date_odoo_synchronized`).

#### Retool is NOT SERP-owned and mixes mirror data with live config

❌ **AI assumes** Retool is SERP's database, or that QuickBooks/Stripe/Shopify tables in Retool are live transactional sources.
✅ **Reality:** Retool is a shared multi-app PostgreSQL DB (~123–165 tables; SERP touches ~40). Those finance tables are **reporting/reconciliation mirrors** — source systems are external. Worse, several are **stale mock/demo tables** (all-text numerics, 2022 dates): `quickbooks_dashboard`, `stripe_dashboard`, `mock_*`, `sample_users`, `test_table`, `jasonTest`, `Sheet1/Sheet3`, `workflow_test`. Real QB sync state is `QuickbooksLastUpdates` / `QuickbooksMismatchReportLastUpdates` / `ManageToLiveLogs`.

#### Retool table suffixes are the environment switch (no separate DBs)

⚠️ Environment separation is by **table-name SUFFIX**, not separate databases:

- Draft-ops / inventory-counts / prompt-logs: **base** name locally, `_live` in prod (`serp_draft_operations` vs `serp_draft_operations_live`).
- AI message/turn tables: `_dev` locally, `_live` in prod (`serp_ai_messages_dev` / `_live`).
- Sync queue: plain / `_dev` / `_live` (`odoo_sync_queue`, `odoo_sync_queue_dev`, `odoo_sync_queue_live`).
- Auth/user/forecast tables: **NO suffix**.
- `_live` tables hold real prod data with **far higher row counts**.

❌ **AI assumes** `serp_refresh_tokens` and `serp_password_reset_tokens` live in Retool (they are documented there).
✅ **Reality:** They actually live in **MySQL** (serp ORM, via `env.cr` / `cr.execute()`), not Retool. `crud_refresh_token.py` / `crud_password_reset.py` use the MySQL cursor.

#### Auth is dual-system, matched by email, lazy-synced

❌ **AI assumes** SERP's ORM (`serp_res_users`, MySQL) is the auth source of truth, or that Retool user IDs equal ORM user IDs.
✅ **Reality:** Auth identity lives in **Retool PostgreSQL `serp_users`**; roles/RBAC live in **MySQL ORM** (`serp_res_users` + `serp_res_groups`). They're bridged lazily on each login via `ensure_orm_user()`, **matched by EMAIL not ID** (Retool serial ID ≠ ORM bigint ID). Passwords live in Retool only; MySQL has placeholder `'synced-from-retool'`. The `retool.serp_users` bridge (4 cols: id, created_at, updated_at, orm_user_id) is hit on **every authenticated request**; old columns (name/email/password/roles) moved to `_backup_serp_users`.

❌ **AI queries** `retool.serp_users` expecting `name`/`email`/`role` columns.
✅ **Reality:** Removed — it's now a 4-column bridge. Live schema is in `_backup_serp_users`.

❌ **AI assumes** SERP's `.env` `TEST_AUTH_DB_*` (PostgreSQL localhost:5432) is the auth DB.
✅ **Reality:** **Dead config, never used.** `auth_database.py` imports engines directly from `database.py` (the same MySQL). Startup error "Cannot connect to main database for auth on 127.0.0.1" means it's hitting local MySQL (127.0.0.1:3307), not a separate PG.

---

### Stale Deploys, Servers & Deployment Gotchas

#### SERP does NOT auto-deploy

⚠️ **SERP auto-deploy myth:** AI assumes SERP auto-deploys from `main` via Jenkins. **Wrong** — GitHub Actions CI runs on push but does **NOT** deploy. Deploy is a manual SSH step on the Hetzner K3s node:

```
ssh jack@5.161.95.56 'cd /opt/SERP && bash deploy-k8s.sh main'
```

A push/merge to `main` is **not live** until `deploy-k8s.sh main` runs on the node. (The old AWS path `ssh ubuntu@34.203.231.65 ... bash deploy.sh` is **frozen legacy — NOT the deploy target**.)

⚠️ **Two SERP machines, not one:** the **production SERP app server is the Hetzner K3s cluster** (node `5.161.95.56`, namespace `serp`, `/opt/SERP`; deploy `bash deploy-k8s.sh main`). The old **AWS EC2 `34.203.231.65`** (`/opt/SERP`, PM2 + nginx) is retained **frozen legacy — NOT deployed to**. The darklaunch MySQL is a **separate Hetzner machine `5.161.233.240` / `serp_test`** (unchanged).

⚠️ **PM2 over SSH:** Inline `pm2 reload` fails — must export `PATH=/home/ubuntu/.nvm/versions/node/v20.20.1/bin:$PATH; PM2_HOME=/home/ubuntu/.pm2`. **Before rebuilding the darklaunch DB you MUST `pm2 stop serp-workers`** or you get MySQL 1412 "table definition changed" errors that kill in-flight shipments; resume after.

⚠️ **SERP `deploy.sh` does NOT run schema migrations against the prod manage cluster (now on Hetzner, not AWS RDS).** `npm run migrate` is local-only; `seeding/migrations/*.sql` are deleted at HEAD; deploy hardcodes the docker `serp_staging_darklaunch`. New `serp_*` tables/columns need a **manual migration of the live manage DB BEFORE code ships** (Manish + DBA) or you get "table doesn't exist" in production.

⚠️ **SERP `serp_*` tables exist ONLY in `laravel_local`** (local dev). `laravel_staging` and `live_staging` have only `serp_audit_logs` and `serp_users` — **no Alembic migrations were ever applied to staging.** The full ORM table set is local-only.

#### SWAC / WishDesk MCP and staging deploy gotchas

⚠️ **SWAC MCP server stale code bug:** Jenkins deploy did **not** restart the MCP server (~Oct–Nov 2025), so it served stale code/tool counts (Jason saw 28 local tools, only 23 on desk2). Standing rule: "when we make MCP changes we also request Seth restart the MCP server." Now fixed by moving to PM2. There is **one** MCP server (~port 3001 at `/mcp`), **not** per-env.

⚠️ **SWAC `desk3` (staging) points at LIVE databases** — data is NOT isolated. Branch flow is `feature → development → staging → live` (**NOT `main`**). `desk2`=dev, `desk3`=staging (live data), `desk`=live.

#### Connection / pool / event-loop footguns

⚠️ **Retool PG has THREE separate pools** (15+5+5 = 25 max conns) and Odoo has TWO; the SERP ORM pool connection is held idle during entire 200–320s forecast requests — only **13 concurrent requests exhaust the ORM pool**. Pool size 5 + overflow 8 = 13 max; `pool_recycle=60s` is aggressive for MySQL stability.

⚠️ **Gunicorn restart loses in-flight sync items:** the sync worker is an asyncio Task in the FastAPI lifespan; on restart, items in `processing` state are **never recovered** (no heartbeat/TTL/startup sweeper). Typical sync 20–70s; gunicorn timeout 120s, `max_requests=1000`.

⚠️ **SERP backend resource exhaustion (historical, on the now-frozen AWS EC2 `i-0a0de24d0845c6341`):** under load the SERP backend returned 504s; forecast 500s correlated with ~3.7GB RAM exhaustion + `sa_projections` timeout + missing indexes. _(Symptoms recorded pre-Hetzner; production now runs on the Hetzner K3s cluster — the AWS box is frozen, so the `t3.medium+` resize is no longer the remediation. The query/index footguns still apply.)_

---

### Darklaunch, Drift Monitor & Shadow Systems

#### Most "drift" is NOT a bug

⚠️ **AI assumes** SERP/Laravel is the source being diffed and any drift alert is a real defect.
✅ **Reality:** The Drift Monitor diffs **Odoo prod (the PG source of truth)** column-by-column against `serp_*` shadows, joining on `odoo_id`. Most flagged "drift" is expected:

- **Post-seed/post-reseed Odoo staleness** (Odoo crons/users edited rows AFTER the seed snapshot; cleared by reseed — drift count often equals post-cutover write count).
- **By-design worker-row divergence** on create-time columns (suppressed in `WORKER_ROW_DIVERGENT_COLUMNS`): `sale_order.name`='S'+ec_order_id vs Odoo `ir.sequence`; `sale_order_line.sequence`=10 always vs Odoo's 10/300/301; worker skips Odoo's NULL-product separator lines; `write_uid`/`create_uid`; picking name drift; float precision noise.
- **~6h DATETIME drift** from Denver↔UTC conversion (seeder stored Odoo naive-UTC as MT wall-clock).
- **Reservation timing lag** and **stock_quant freshness gap** (Odoo reserves continuously faster than the worker polls; converges next poll).
- Benign value drifts: `invoice_status` (odoo=`invoiced` vs dl=`to invoice`), date/tz ISO-Z vs local, NULL commitment_date/effective_date.

**The ONLY signal that matters** is the per-table `values:` line: "K rows, C columns — clean" = faithful; "X/Y rows diverge" = real drift; ":red_circle: N rows 30m+ old in Odoo MISSING from darklaunch" = genuine sync gap. Real bugs are a minority: dropped order lines when `product.default_code` is NULL, seeder collapsing `partially_available`→`assigned`, bin-level `location_id` divergence (SERP doesn't replicate Odoo putaway/removal strategy).

#### Drift workflow is code-generated — do NOT hand-edit

⚠️ The n8n "Darklaunch Drift Monitor" JSON is **CODE-GENERATED by `scripts/build_darklaunch_drift_n8n.py`** — regenerate via the script, never hand-edit. It's loop-free (no SplitInBatches; SplitInBatches stalled ~14/42 tables and never fired Slack), uses a **Merge barrier** (Wait For Both — without it, fires on the first branch only → false flags), `_equiv` normalization (date-only vs datetime tolerance, NULL↔'0.0000', float ±0.01, bool↔0/1), runs hourly cron `0 6-18 * * 1-5` (6am–6pm MT Mon–Fri), windows latest ~1000 ids per table across ~42 tables, alerts to `#jack-test` (`C083M27KU8L`) for rows 30m+ old that are missing or settled-drift (`GRACE_MINUTES=30`, `WINDOW=1000`). Slack `messageType:block` blocksUi-only throws a `no_text` error — use `messageType:text` with `mrkdwn`.

#### Darklaunch isolation rule — NEVER read Odoo values at runtime to "fix" drift

⚠️ **AI tries** to fix a worker discrepancy by reading the "correct" value from live Odoo at runtime.
✅ **Reality:** **Forbidden.** The worker queries Odoo **only to resolve IDs to stamp into `odoo_id`** — it never reads Odoo VALUES at runtime. Everything (products by SKU/`default_code`, locations) resolves against the **local seeded darklaunch DB**. Consequence: many drift/cost bugs trace to the **SEED, not runtime**. If local `serp_product_product.default_code` is NULL, the worker **drops that order line** (fix: backfill `default_code` / seed `sugarwish_id→product` map / fix worker resolution — **not** suppress drift or add Odoo reads).

#### odoo_id stamping is fragile

⚠️ **AI assumes** `odoo_id` is reliably populated.
✅ **Reality:** `odoo_id_stamper` (`workers/odoo_id_stamper.py`) is a separate post-create step on its OWN darklaunch pool connection; it's the **only** place the worker touches Odoo PG. Failure modes:

- Runs while the worker's txn is still uncommitted under REPEATABLE READ → stamper's snapshot can't see the worker's own picking → falls back to natural-key matching that **mis-stamps a committed neighbor picking** (adjacent qty=1 orders share product_id → non-unique keys; observed batch ~84% NULL, ~16% mis-stamped).
- Must stamp **VARIANT** id on `serp_product_product` and **TEMPLATE** id on `serp_product_template` (was a bug).
- A dead idle Odoo PG connection (SSL closed) silently breaks it → rows land `odoo_id=NULL` → Drift Monitor reports them "missing" though they physically exist. **Signature:** `MAX(odoo_id)` frontier FROZEN while `MAX(id)` climbs; latest rows ~100% `odoo_id=NULL`. Fixed with a liveness-pinging pool (`_acquire_live_sync_conn()`: `SELECT 1`, drain dead handles, capped exponential backoff 0.25s→2s, recycle at 120s, `keepalives_idle 30`, `connect_timeout 10`).
- `/compare-darklaunch` only diffs rows where `odoo_id IS NOT NULL` — unstamped children (stock_move/move_line/quant with `odoo_id=NULL`) are silently EXCLUDED (false "no overlap"). **The stamper must be wired into EVERY write-path.** Real prod bug fixed 2026-06-03: `stamp_child_odoo_ids` was wired only into the Serpy sync-queue path, not the order path → thousands of `odoo_id=NULL` move/line rows.

#### SERP-origin signal & ID-space join footgun

⚠️ **NEVER join `serp_*` tables on `id = id`.** Join on the **`odoo_id`** column.

- Odoo-origin rows: `id = odoo_id` (`<1B`). SERP-runtime post-seed rows: small ids above `MAX(odoo_id)`, `odoo_id=NULL`. SERP-merge rows: `id >= 1B`, `odoo_id=NULL` (seeder bumps AUTO_INCREMENT to 1B during seed, then resets to `MAX(odoo_id)+1` at finalize).
- The **durable** "SERP-origin" signal is `odoo_id IS NULL`, **NOT** `id >= 1B` (old code filtering `id < 1B` broke after finalize).
- `id = odoo_id` holds **only** for Odoo-seeded rows; child rows (move/move_line/quant) leave `odoo_id=NULL` until stamped.

⚠️ **`isWorkerRow = (id != odoo_id)` misclassifies AUTO_INCREMENT-collision worker rows as seed rows** (when a worker id coincidentally equals its resolved odoo_id, suppressions get skipped). **Better worker-row signal:** `name = 'S' + ec_order_id`, or odoo_id origin — **not** `id != odoo_id`.

#### Four distinct shadow/replica DBs — don't conflate them

⚠️ They are NOT one thing:
| DB | What it is | Flag |
|---|---|---|
| `serp_*_replica` (staging/prod) | Clean row-for-row mirror of manage/laravel*live, **zero Odoo overlay**, nearly empty shells | — |
| `serp*\*\_darklaunch`(staging/prod) | Replica **plus** Odoo overlay (normal BOMs, MOs, SVL, POs) where the worker dual-writes |`SERP_DARKLAUNCH_ENABLED`|
|`serp_shadow`(Hetzner) | Predecessor prod-traffic handler validation |`SERP_SHADOW_WRITES_ENABLED`|
|`serp_test`(Hetzner`5.161.233.240`) | **REAL live PRODUCTION darklaunch mirror** (not a throwaway), MCP key `live_darklaunch_db`, consistently ~ahead of `serp_prod_darklaunch` | — |

- **Fingerprints:** darklaunch has `_migrations` + `serp_darklaunch_meta`; replicas have neither and no Odoo-owned/manufacturing tables.
- "**compare-replica**" tooling actually compares **darklaunch**, not the replica.
- `darklaunch_cutover_at` is **per-env** in `serp_darklaunch_meta` (prod `2026-06-04 09:27:20`, staging `2026-06-03 11:52:27`; primary cutover ts `2026-05-30 14:14`). When SERP_DARKLAUNCH_ENABLED=false, behavior must be identical to before ("if dark launch is false, then don't set anything").

#### Darklaunch worker is intentionally slow — do NOT "optimize"

⚠️ **AI tries** to batch/parallelize the darklaunch worker to speed it up.
✅ **Reality:** Slowness is **deliberate** for costing parity. ~27s local / 47–66s prod per shipment, serial, ~130 per-move UPDATEs, to match Odoo's `account_move.sequence_number` ordering. Batching breaks `/compare-costing` parity. Throughput ceiling ~72 shipments/hr (~1,728/day) — **6–7× below** the Dec-2025 peak (peak day shipments 11,433 on 2025-12-29; peak hour 1,877 orders).

⚠️ **Darklaunch worker blocks the shared asyncio event loop.** All workers run in ONE process on ONE loop; `darklaunch._poll_cycle` is `async def` but does synchronous blocking PyMySQL work with no `asyncio.to_thread` and no yield — it **starves the odoo-sync worker** (live 2026-05-29: odoo-sync stalled ~95 pending, synced once per darklaunch cycle). Fix: wrap processing in `asyncio.to_thread` like `order_queue_worker` does. Separate incident: odoo-sync "Sync cycle wedged: 3 consecutive timeouts at 180s" is transient/self-recovering (idle-dropped socket), distinct from this starvation.

⚠️ **Newest-first windowing permanently starves the backlog tail.** Detectors (`detect_shipped_orders_odoo`, `detect_cancelled_orders_odoo`) had a vestigial `ORDER BY ... DESC LIMIT 50`; with ~883 in-flight candidates (765 receiver + 118 preselect) the oldest low-id tail is **never re-checked** and stays `confirmed` forever. Fix: **oldest-first** ordering (by replica `serp_stock_picking.create_date`, NOT live DATE-granular `ship_date`) + a per-cycle processing cap. (`serp_stock_picking.state` has no `partially_available` value — that filter element is dead.)

#### Odoo "approved differences" — intentional, not bugs

⚠️ SERP **intentionally does NOT replicate** (documented in `docs/ODOO_APPROVED_DIFFERENCES.md` / `KNOWN_BUGS.md`): invoicing flow (`invoice_status`/`commitment_date`/`effective_date` — worker creates SO with default `invoice_status='to invoice'`, never advances); `res.partner._increase_rank` supplier_rank bumps on PO confirm; PO-receipt/vendor-bill recompute fields; Odoo crons (reservation/prepick/ship) that move state post-create; `procurement.group` model; lot/serial tracking; package/owner tracking; `ir.model.data`/`env.ref()`; line-level chatter; `sale.order.action_confirm` deliberately does NOT trigger procurement or create a delivery picking (the darklaunch worker is the **SINGLE** picking creator via `stock.picking.action_process_new_order` — adding a second creator yields two pickings per order).

---

### Order Pipelines & Sync Flags

#### Two (really three) separate order pipelines

⚠️ **AI assumes** one unified order queue, that both workers behave identically, that all SERP sale orders have a populated `odoo_id`, or that PO receipts flow through the darklaunch order worker.
✅ **Reality:**

- **Odoo Sync Queue** (`odoo_sync_worker.py`, `odoo_sync_queue_dev/_live` in Retool PG): triggered when a Serpy draft is approved; executes warehouse ops against live Odoo via XML-RPC and mirrors to darklaunch. **PO receipts flow HERE.**
- **Darklaunch Order Worker** (`darklaunch_order_worker.py`): **no queue** — polls live MySQL directly (`ec_order WHERE oddo_synchronized=1`, `POLL_INTERVAL 300s`, `BATCH_LIMIT 50`, single-threaded), dual-writes receiver/preselect rows into `serp_prod_darklaunch` ONLY.
- **Merchandise Order Queue** (`order_queue_worker.py`, gated by `ORDER_QUEUE_WORKER_ENABLED`, default False): polls `component_orders WHERE order_type='merchandise' AND inventory_source='serp'`, writes the main/live SERP DB. Disabled until `ec_order.merchandise_selections` is populated.
- **Asymmetry:** orders that never reach Odoo intentionally get `NULL` odoo_ids ("shouldn't resolve odoo ids since they don't reach odoo").

#### The Odoo-sync flag is a TYPO and value 3 doesn't exist

⚠️ The column is **`oddo_synchronized`** (double-d, missing the second o) — **NOT** `odoo_synchronized`. Values: `0`=not synced (~77K), `1`=synced (~3.88M), `2`=in-flight/partial (~64–166), `5`=vendor/special (~17.5K). **Value `3` does NOT exist in production** (contrary to the WW-510 bug report; `3` is a Laravel-side errored/retry state on other flags). Stuck orders are usually `oddo_synchronized=2`.

#### items.odoo_sync and pending-inventory deduction

⚠️ `items.odoo_sync`: `0`=not synced, `1`=syncing, `2`=synced (~14M), `5`=unknown (~22K). **Items with `odoo_sync IN (0,1)` are orders NOT yet imported to Odoo** and must be **deducted from available inventory** when deciding whether to disable a product. `inventory_qty` alone does NOT reflect availability.

#### Orders mark synced BEFORE confirmation (no transactional integrity)

⚠️ Order sync has **no transactional integrity** — orders are marked `oddo_synchronized=1` **before** Odoo confirms. Dec 23, 2024: **906 ec_orders marked synced but never sent to Odoo** (ghosts). Fix requires marking synced **only after** Odoo returns success.

#### Shipping label, not the production slip, finalizes inventory

⚠️ Printing a production slip does **NOT** mark an order shipped or finalize inventory — **ShipStation LABEL generation** does. "Reserved" in Odoo should equal unshipped in ShipStation. Labels generate near-instantly on a recipient order, so there's a tiny window to fix negative-reserved before shipment (which is exactly why the negative-inventory bug bites).

#### sw_fulfill is in-house-vs-vendor, not shipment status

⚠️ **AI guesses** `sw_fulfill` means shipping-label/shipment status.
✅ **Reality:** It's the in-house-vs-vendor flag: `1`=SugarWish's own fulfillment center assembles & ships; `0`=vendor drop-ships (`vendor_id` on receiver_products, `vendor_order_number` on ec_order); `NULL`=legacy/unknown (~74%).

#### `ec_order.size` is a buyer_products.id, not a size

⚠️ `ec_order.size` is **MISNAMED** — it holds **`buyer_products.id`**, not a physical size. Join: `ec_order.product_type = buyer_products.product_type AND ec_order.size = buyer_products.id`. Real size is `buyer_products.size_name_id`. **For GC orders this collides** with disabled `receiver_products` (low buyer_product ids overlap; affected values include 41, 61–65, 90–91, 116, 137, 353, 923) — custom-shop slips read the wrong candy SKU. Fix: read the `items` table, not `receiver_products` by `ec_order.size`. **There is NO `recipient_email` column on `ec_order`** — querying it errors; sender/receiver email comes from `giftcards_card`.

#### giftcards_card ↔ ec_order is one-to-MANY; join on card_id

⚠️ `ec_order.giftcards_card_id = giftcards_card.**card_id**` (NOT `giftcards_card.id`). One gift fans out to MANY shipments via reships (one card observed with **13,719** ec_order rows). `ec_order.increment_id` is the order number sent to Odoo. Chain to Odoo: `giftcards_card → ec_order (increment_id) → Odoo sale_order`. Also note `ec_order` "pending" status is ~99% (= giftcard issued, not redeemed) — **NOT** "awaiting payment."

#### Two different "reserved" meanings

⚠️ "Reserved" means different things: **Odoo `stock_quant.reserved_quantity`** (picking allocation) vs **Laravel reserved** (large order in cart / `inventory_reservations` for preselect holds). Distinguish which system before debugging a "reserved" discrepancy.

#### "orders" / order_type / move_type all mean multiple things

⚠️ Distinct lifecycle objects, NOT one "order": `giftcards_card` (pre-redemption ecard), `ec_order` (redeemed receiver shipment, one per recipient, many per gift), `preselect_orders` (buyer-preselected, order numbers 6000+ vs receiver 200+), `items` (chosen gift selections), `component_orders` (exploded packaging lines). `items.order_type`: `receiver-order` / `preselect-order` / `sweet-shoppe-order`. `component_orders.order_type`: `receiver-order` / `preselect-order` / `merchandise`. Odoo `account_move.move_type`: `entry` (~13.2M auto inventory/COGS — NOT invoices), `in_invoice` (~1.7K vendor bills), `in_refund`, `out_invoice` (only 1, unused). `buyer_orders.status` and `buyer_orders.preselect_status` are **two independent state machines**.

---

### Performance Footguns (the ones that time out)

#### Negated predicates on multi-million-row tables

⚠️ **CRITICAL:** Never filter `state` with a **negated predicate** (`NOT IN` / `!=` / `<>`) on huge Odoo/SERP tables — `stock_move` (~14.5–15.8M rows), `stock_move_line` (~14.5M), `stock_valuation_layer` (~13.4M). It forces a seq scan and blows the **Odoo.sh 330s statement timeout**. Use a **positive IN-list** with all states: `state IN ('draft','confirmed','waiting','partially_available','assigned')`. (Forecast Odoo timeouts are usually **external n8n load** — e.g. an oversell workflow re-firing a 330s query with no backoff — not SERP's own queries.)

#### sa_projections / forecast query is a 7–10 minute cartesian bomb

⚠️ `sa_projections.sql` is 437 lines / 15–20+ CTEs and processes ~3.3M intermediate rows (a **CROSS JOIN** of `week_settings` × `final_sku_popularity`) to emit ~210K–492K rows; takes **7–10 minutes** — far past the 30s API timeout (later raised to 120s). It also **ignores** its `current_skus` parameter and always returns ALL projections. Fixes: pre-compute nightly / materialize CTEs / add composite indexes (`product_type_key_sizes(product_type, size_name)`, `sku_product_type_key(sku, product_type)`, `size_projections_copy(year, week, product_type)`). Missing index on `mrp_bom_line(bom_id)` is also CRITICAL.

#### Forecast has TWO orchestration paths that drift

⚠️ Dashboard `/api/forecast` uses `SupplierForecastPipeline`; CSV export (`export.py`) calls the legacy `forecast_service.generate_forecast()`. **Fixes don't propagate between them** (e.g. the `date_utils.py` Mode-4 W52/year-boundary fix landed in the pipeline but not legacy export → CSV showed zeros at the W52→2027 cliff while the dashboard was correct). Also: `utils/forecast_cache.py`'s docstring points at non-existent files; the real impl is the `cache/` package. When a forecast number is right in one place and wrong in another, suspect pipeline-vs-legacy divergence.

#### Forecast TTLs and caching surprises

⚠️ `TTL_STATIC_DATA` and `TTL_DYNAMIC_DATA` are **both 600s** despite the names (`TTL_VOLATILE_DATA`=120s). Only ~1 of ~18 cache keys is warmed (hit rate ~20%). There are **three** cache layers (SharedForecastDataCache, ResponseCache, CrudCache); `CostTrackerService` and `ComponentForecastService` **bypass** caching entirely. Forecast `Decimal` columns serialize to JSON **strings**, so frontend `.toFixed()` throws — converters must `float()` them.

#### Historical inventory reconstruction is O(all transactions)

⚠️ Odoo `stock_quant` stores **current state only**. Reconstructing historical inventory means scanning `stock_move_line` (8.8M+ rows before a cutoff) with 4-way JOINs → 60–90s timeouts. No single index fixes it; cache/pre-compute snapshots/limit date range instead.

#### Retool/MySQL query timeout & engine quirks

⚠️ The db MCP server enforces a **30s query timeout** (MySQL `SET SESSION max_execution_time=30000`; PostgreSQL `SET statement_timeout=30000` — **NOT** a startup parameter, that errors with "unsupported startup parameter"). MySQL `ON DUPLICATE KEY UPDATE` only updates the **first** unique index (don't use on multi-index tables); `INSERT IGNORE` swallows **all** errors, unlike PG `ON CONFLICT`.

---

### ID Strategy & Join Footguns

#### Odoo↔Laravel IDs are FABRICATED, not foreign keys

⚠️ **`components.odoo_id` is SYNTHETIC = `'800' + components.id`** (varchar), NOT a real `product_product.id`. `buyer_products.odoo_id = '500' + buyer_products.id`. Joining either directly to Odoo PKs **matches the wrong rows**. Real Odoo PK is a different range (1789–29210). The real bridge is **`product_template.sugarwish_id`** (matched by SKU = `product_product.default_code`). Failed-products email "800611" → component 611 → real Odoo product via `sugarwish_id`.

#### sugarwish_id prefix decoding

⚠️ `product_template.sugarwish_id` (lives on TEMPLATE, **not** `product_product`): prefix `'800'` → strip → `components.id`; prefix `'500'` → strip → `buyer_products.id`; other int → `receiver_products.product_id` OR `buyer_products.id`; `0`/`NULL` → no mapping (~1,371 templates). Don't assume non-800 means receiver — could be buyer. `sugarwish-odoo` `sale.py` filters `startswith('500')`/`startswith('800')`.

#### serp_purchase_order_line FK points at the pre-rename table

⚠️ `serp_purchase_order_line.order_id` references the old `purchase_order` table (pre-migration-008), **not** `serp_purchase_order`. Any INSERT with a non-null `order_id` fails with an FK violation. `serp_purchase_order`/`_line` exist **only** in `laravel_local`.

#### Stock-picking↔PO link is a string `origin`, not an FK (in Odoo)

⚠️ Odoo links picking→PO via `stock_picking.origin = 'P01906'` (text), **not** an FK. SERP extends with a real `purchase_order_id` FK. Don't assume a relational constraint in Odoo.

#### `ec_order` has TWO id columns

⚠️ `ec_order.order_id` (short numeric, the `component_orders.order_id` join key) ≠ `ec_order.increment_id` (public-facing, e.g. `20019722440`, the Odoo `sale_id` / `serp_stock_picking.sale_id`). Join `component_orders` on `order_id`; chain to Odoo on `increment_id`.

#### SKU is NOT unique; SKU/name fields are sometimes swapped

⚠️ **13 component SKUs are duplicated across multiple ids** (use `component.id` for linking, not SKU). **`receiver_products` SKU `SA-01-026-A` exists twice** (product_ids 1706 & 4499 — one deleted). **58 components have SKU and name swapped** (e.g. `sku="Halloween-XLARGE-Candy..."`, `name="B-AAA-HAL-22-001-XLG"`) — Halloween/Winter/Valentine seasonal rows. Code detects via `looks_like_component_sku()` and fixes/dedupes.

---

### Inventory, Stock & Valuation

#### Negative inventory is mostly normal — but watch internal locations

⚠️ ~482–5,918 quants carry negative quantities (totaling tens of millions of units). Most are in **virtual** locations (Vendors/Production/Inventory-adjustment) where negatives are normal Odoo double-entry accounting. **Only negatives in INTERNAL locations** (Stock/Fulfillment) are real problems. A cycle count does **not** drop reservations — `quantity=0` with `reserved_quantity>0` yields negative available (root cause of negative West Coast Qty in Laravel).

#### Only usage='internal' is real inventory; inventory_date filter is wrong

⚠️ Only `stock_location.usage='internal'` holds real stock. Outbound moves go to virtual Customers (id 5), inbound from virtual Vendors (id 4). Several SQL files historically filtered `sq.inventory_date IS NOT NULL` to "find real stock" — that's **fragile and wrong** (it's Odoo's scheduled-count field). Use `usage='internal'`.

#### Only `state='done'` moves change inventory; `quantity_done` is computed

⚠️ Only `stock_move.state='done'` actually changes inventory. In SERP, `quantity_done` is a **computed, store=False** field summed from `stock_move.line.qty_done` — writing it silently no-ops (no inverse method); the misleading error "Set quantity_done on at least one move" means you must create/update `stock_move_line` rows instead. `_action_done` historically used `product_uom_qty` (ordered) instead of actual completed qty (a bug).

#### 48,909 stuck stock_moves block allocation

⚠️ **48,909 stock_moves stuck in `assigned`/`confirmed`/`waiting`** with active `sale_line_id` (27,044 assigned + 8,842 confirmed in 2026; ~15K from pre-2024, oldest May 2023). Top product `B-CCC-REG-22-MUG-XXX` ~2,404 stuck moves. They permanently lock `reserved_quantity`. **Odoo's `do_unreserve()` is buggy:** when `qty_done > 0` it sets `product_uom_qty=0` but **skips `_recompute_state()`**, leaving "zombie" moves stuck in `assigned`. **NEVER unreserve via direct SQL** — it desyncs `stock_move_line.reserved_qty` from `stock_quant.reserved_quantity` and triggers "Cannot unreserve more than in stock." Must use `stock.move._do_unreserve()` / `stock.picking.do_unreserve()`. Cleanup: `scripts/odoo_cleanup_stuck_moves.py`. (Note: Server Action 376 referenced in old notes — chunk 18 found it as `ir_act_server` id 376 `do_unreserve()` for `stock.picking`, plus id 426 for `mrp.production` and id 617 "Correct inconsistencies"; another chunk found NO such action — version-dependent, verify before relying.)

#### SVL FIFO order, sequence_number, landed cost

⚠️ `stock_valuation_layer` has **NO `sequence_number` column** (nor does the SERP mirror) — FIFO order is by **layer id / `create_date` ascending**. Value **sign** is source of truth (positive=in, negative=out); `remaining_qty`/`remaining_value` only meaningful on positive inbound layers (~3,705 with `remaining_qty>0` = current inventory $). **Landed cost adds VALUE only** — it does NOT create on-hand quantity; it changes `unit_cost`/`value`, not `stock_quant.quantity`. Common split method in prod is `by_current_cost_price` (54 cases), not equal.

#### `_gather()` does NOT expand child locations (SERP)

⚠️ SERP's `_gather()` uses an exact `location_id` match, while Odoo uses the `child_of` domain operator. If an MO source is `TY/Stock` but quants sit in `TY/Stock/REEFER`, **SERP won't find them**. SERP does not replicate Odoo bin-level putaway/removal strategy (a known intentional divergence that also drives bin-level drift).

#### Negative inventory floored to 0 on sync (hides backorders)

⚠️ Odoo→Laravel inventory sync **floors negatives to 0** (`sugarwish_stock.py` lines 75–77), hiding backorder depth and keeping oversold products enabled. Proposed fix sends `(available − unreserved demand)` instead of raw inventory.

#### `odoo_inventory` is stale; daily report uses the wrong column AND wrong location

⚠️ `receiver_products.odoo_inventory` is a stale cache (76–86% of records >30 days old). The Daily Operations inventory report wrongly reads `odoo_inventory` instead of `inventory_qty` (off by up to **180×**: e.g. `inventory_qty=1,974` vs `odoo_inventory=11`) AND only sums the **Fulfillment** location, missing Stock/Production/etc. — massively underreporting (SA-03-050-A real Fulfillment 1,732, report showed 11).

#### Inventory counts live in Retool, verified by 2-user agreement

⚠️ Physical counts live in **Retool** (`serp_inventory_counts` / `_live`), NOT Odoo or manage. A count is **VERIFIED** only when **2+ different users** record the same `sku + location_id + fulfillment_entry_index` with matching quantity (single count = unverified; **vendor counts do NOT satisfy** the 2-user rule). `fulfillment_entry_index` is NULL for ~75% of records (general stock). Uncounted SKUs are **zeroed on sync** by design. Test location IDs **2001/2002** appear in `serp_inventory_counts` but **don't exist** in Odoo `stock_location` — sync validation now blocks them.

#### `qty_received` / `qty_invoiced` never auto-update in SERP

⚠️ In SERP, `purchase_order_line.qty_received` and `qty_invoiced` are **static columns that never update** (`StockMoveService._action_done` doesn't bump received; `AccountMoveService.action_post` doesn't bump invoiced; `update_invoice_status()` exists but is never auto-called). In **Odoo** they DO auto-update from validated stock_moves / posted bills. (Odoo data quality: 20 over-received lines where `qty_received > product_qty`, e.g. P01654 +30K; 266 partially received; 10 cancelled POs with 2–18 active moves.)

#### PO date fields: use effective_date for arrival

⚠️ **Three distinct PO dates:** `date_order` = CREATED (not arrival), `date_planned` = expected (user guess), **`effective_date` = ACTUAL arrival** (NULL until the receipt picking is validated `state='done'`). **Use `effective_date` for inventory variance** — using `date_order` makes variance reports wrong by months. PO `state='purchase'` means **approved**, not received; `invoice_status='invoiced'` ("Fully Billed") means received-so-far qty is billed, **not** that the whole PO is settled (a partially-received PO with an open backorder still reads `invoiced`).

#### product_qty=0 BOM lines cause division-by-zero

⚠️ **~30–48 active BOM lines have `product_qty=0`** (optional/conditional packaging — labels/tape), causing PostgreSQL "division by zero" in RM→SA conversions and `inventory_variance.py`. **Always filter `product_qty > 0`** before using it as a denominator. (~437 lines also have qty=0 in `mrp_bom_line`.)

#### BOM conversion rate must exclude cancelled moves

⚠️ BOM conversion rate (`mrp_production.product_qty / SUM(mrp_bom_line.product_qty)`) breaks if cancelled moves are included — SA-45-008-A showed **27.17×** instead of 1.0 because 2,500 cancelled units were counted. **Filter `state='done'`.**

#### Archived products still hold stock & reservations

⚠️ Archived variants (`product_product.active=false`) **retain `stock_quant` and `assigned` reservations** even while the template is active. Filter `pp.active=true` for LIVE inventory but **NOT** when auditing history. **Archive status does NOT sync from Laravel to Odoo** — an RM can be archived in Laravel (`receiver_products.archive=1`) yet `active=true` in Odoo, so it keeps appearing in forecasts. `rm_inventory.sql` and `packaging_component_inventory.sql` are **MISSING** the `pp.active=true` filter (`sa_inventory.sql` has it correctly). ~483 `product_product` rows have **NULL `default_code`** and must be excluded from sync (`WHERE default_code IS NOT NULL`).

---

### Kits, BOMs & Phantom Explosion

#### THREE parallel kit/BOM systems with colliding id namespaces

⚠️ **AI assumes ONE unified kit/BOM system.** There are **three**, drifting independently with **separate, numerically-colliding id namespaces**:

1. **Laravel `component_kits`** (box SKUs `B-*`, `S-*`) — `buyer_products.default_kit`/`seasonal_kit` → `kits.id`; lines carry `hide` (1=archived, 0=active); edited via `laravel_update_kit`. Pure box SKUs MUST use Laravel kits.
2. **SERP `serp_mrp_bom` phantom BOMs** (shippers `S-*`, inserts `I-*`, production paper `P-*`, cups `E-*`/`C-*`, merch) — edited via `serp_update_kit` / "Update SERP Kit". **STALE one-time April-2026 snapshot** (~224 phantom rows, identical `create_date 2026-04-03`, **no `odoo_id`**, only `type='phantom'`) — covers ~29% of Odoo's phantom BOMs.
3. **Odoo `mrp_bom`** (manufacturing recipes), mirrored to `serp_mrp_bom`.

⚠️ **ID namespace trap:** `kits.id` and `serp_mrp_bom.id` collide numerically (e.g. 682 is a `serp_mrp_bom` id, NOT a `kits.id`). `serp_find_kits_by_sku` returns `serp_mrp_bom` ids; passing one as `kit_id` to `laravel_update_kit` → all ops fail "not found"/"already exists" (live failure: draft #860, kit_ids 682/683/684). The `archive_impact_check` rule must call `find_laravel_kits` for the Laravel arm and `serp_find_kits_by_sku` only for the SERP arm.

⚠️ Laravel kits and Odoo phantom BOMs are **ADDITIVE, not overlapping** (Carolyn confirmed): "Kits in Odoo are used for everything but the colored box." Laravel = colored box only (89% of kits have exactly one `B-*` component); Odoo phantom = shippers/inserts/labels/contents. **Double-counting happens when a component (e.g. a soap dish) exists in both** — both sources must merge correctly at cutover. To replace/discontinue a component, fan the change across all three (emit `remove_component(old)`+`add_component(new)`; for Laravel set `hide=1` old / `hide=0` new).

#### Phantom BOMs don't manufacture — and aren't all live

⚠️ `type='phantom'` BOMs do NOT create manufacturing orders (zero `mrp_production` rows reference a phantom `bom_id`) — they **explode into delivery-order component moves at SALE time**, not MO time. **97.9% of Odoo BOMs have `product_id=NULL`** (linked via `product_tmpl_id` only) — SERP's `bom_find()` only searches `product_id` with **no fallback**, causing "No active BOM found" errors. `/boms` must filter `type='normal'`; `/kits` filters `type='phantom'`. **Safe to archive Odoo phantom BOMs** — all SERP runtime paths explicitly exclude phantoms (`boms.py`, `manufacturing.py` raises, `expander/odoo.py` raises); `/compare-darklaunch` excludes phantoms (`KNOWN_FILTERED_TABLES`).

#### Kit explosion is scoped by SOURCE TABLE

⚠️ Delivery-path kit explosion is scoped to **`items`-origin (gift-selection) lines ONLY**; `component_orders` box/buyer-product kits must **NOT** explode (prevents double-booking). Legacy receiver/popcorn pickings aren't built via BOM explosion at all — every `stock.move` has `bom_line_id=NULL` and a populated `sale_line_id` (flat 1:1), expanded at order-BUILD time in Odoo's import, not via manufacturing BOMs.

#### serp_mrp_bom seed gaps & FK nullability

⚠️ `serp_mrp_bom` was a frozen import; ~62 of 121 distinct phantom-BOM component product_ids (all packaging `B/S/I/L/P/T-*`) are **missing from `serp_product_product`** → BOM creation FK-fails unless products are imported first. Odoo BOM `product_id` is 99.8% NULL (template-level) but SERP's `serp_mrp_bom.product_id` is NOT NULL (required) — schema divergence blocks sync-back.

---

### Popcorn, Wine & Product-Line Special Cases

#### Popcorn flavor is a $0 token; cost lives on the sticker

⚠️ **AI assumes** popcorn flavors map 1:1 to costed Odoo products or manufacture via BOM.
✅ **Reality:** A flavor SKU (`SA-02-017-A`) is a **$0 selection token created in LARAVEL only, ARCHIVED in Odoo**. The cost lives on the **City-Pop sticker** (`L-B02-REG-23-0NN-COX`) + 32oz cup. **Key trick:** the flavor's `receiver_products.product_id` **equals the sticker's `sugarwish_id`** (e.g. both 2082), so the `/api/odoo` payload resolves onto the costed sticker, creating sticker SO lines, not bare popcorn. COGS bug: SERP worker resolved by `product_sku` (bare $0 flavor) instead of `product_id` (sticker), undercounting ~$0.17–0.18/flavor — **fix is to mirror Odoo's `sugarwish_id` resolution (seed the map), NOT add a BOM or string-munge SKUs.** SERP flips SA-02 BOMs to phantom **in the local seed only** (`make_popcorn_boms_phantom()`), never in live Odoo (an approved divergence). Popcorn costs for ~160 SKUs are **hardcoded** in `POPCORN_COSTS` (no Odoo BOM). **Popcorn orders should NOT carry merch/sleeve** (recurring City Pop bug WW-964). In forecast, popcorn is split CityPop vs Poppin and **explicitly NOT collapsed** (unlike other splits).

#### Wine is category-goal, churns SKUs, has no real BOM

⚠️ **AI treats** wine like fixed-SKU core products with per-SKU PO replenishment.
✅ **Reality:** Wine churns SKUs (opportunistic buys), should be **NON-core**, uses **category-level goals** (`operation_levels` keyed `"CategoryName|product_type_id"`, product_type 10 'Wine Tastings' & 14 'Wine'; exclude 25 '12 Nights', 550 'Vinebox'), fulfills at WCC (location_id 5), replenishes **outside Odoo POs** (gravity racks, ~1-week lead). It has **no real BOM** — self-maps `SA-14→SA-14`, causing a Bulk-vs-Packed double-count of the same `stock_quant` (fix: zero out packed inventory for them). Brand-new wines correctly show **zero** weekly projections. As of 2026-06-01, 29 type-10 + 29 type-14 rows still wrongly flagged `sku_type='core'` — needs cleanup. Wine SERP only tracks tasting-kit categories {55, 56, 57} — **missing 165 (12-pack) and 190 (4-pack)**. Wine size ratios are hardcoded but `shipped_items_for_avg_cost.sql` returns no `size_tier`, so all wine defaults to the Large ratio (0.125).

---

### Branding, Sleeves, Merch & Print

#### Sleeve matching: EXTEND the existing entry, don't create new

⚠️ **AI creates a new branding entry** (or assumes each product gets its own).
✅ **Reality:** Sleeves match `ec_order.size` (a `buyer_products.id`) against `branding_records.physical_branding.entries[].buyer_product_ids[]`, keyed by **box family** (`a_small`, `a_medium`, `c_medium`, …). Multiple products in the SAME box **share ONE entry** (e.g. `a_small` covers Dog 42, Candy 6978, Popcorn 62). "Missing sleeve" = `buyer_product_id` absent from the entry's array → **fix is to ADD the id to the existing entry**, not create a new one. The admin `render-at-size` button copies the source entry's `buyer_product_ids` **verbatim** (wrong) → ghost entries that never match real orders; it should call `filterProductsForBox()`.

#### Hot Sauce "2 sleeves" over-print

⚠️ `design_boxes` `a_medium`/`a_mini`/`a_xlarge` still list `product_type_ids=[6,46,49]` (includes 46/Hot Sauce) while `a_small`/`a_large` were cleaned to `[6,49]`. A Hot Sauce Medium buyer_product (type 46, size 3) matches BOTH `a_medium` AND `h_medium` → two entries with the same `buyer_product_id` → Livery prints 2 sleeves. Fix: `UPDATE design_boxes SET product_type_ids=JSON_ARRAY(6,49) WHERE sku IN('a_mini','a_medium','a_xlarge')`. Same shape on Gourmet Goods Medium (7026, `c_1.25`/`c_1.5`).

#### Removing a sleeve isn't enough — swap the eCard/boxcard too

⚠️ NULLing `branding_records` (physical/digital_branding=NULL, approvals=0, `print_render_status='not_required'`) does NOT fully fix a bad sleeve order — the **eCard/boxcard design on the giftcards card must ALSO be swapped and the slip regenerated** (esp. if already redeemed). WW-841: a logo-source filter applied to only 1 of 8 endpoints shipped a placeholder.

#### Custom mug print reads ec_order.merchandise_selections, not branding_records

⚠️ SWOP/Livery reads the mug image from `ec_order.merchandise_selections.items[N].design_selected.print_image_url` (matched by `item_id`), **NOT** `branding_records.merchandise.items[0].designs[0]`. Patching `branding_records` alone is NOT enough — `ec_order.design_selected` must be populated (redemption can write a fresh ec_order with `design_selected=null`). Custom Mug & Treats (bp 6950→6961) is **excluded from physical_branding generation** entirely, so every sleeve-eligible mug order mismatches at redemption.

#### Box card / insert nullness silently blocks printing

⚠️ `ecard_design.inserts` drives the printed note card. `inserts=NULL` or a missing `ecard_designs` row **breaks the PDF cron** (`is_printed=2`) and silently prevents the order from printing/shipping.

#### Print files silently fall back to low-res

⚠️ Print files are NOT always high-res. Silent fallbacks: render cron (`ENABLE_BRANDING_RENDER_CRON`) never set in live `.env` → `print_url=null` → falls back to a **50 DPI JPEG thumbnail** (`s3_url`); `findPendingRecords()` once paginated `LIMIT 10` and missed newer branding; mug preview is **225×225** vs real **800×800** print (`PRINT_IMAGE_SIZE`) so the printer pulls the pixelated preview; slips can show low-res after Creative re-uploads. **Mug print is hard-capped at 800×800 everywhere** while sleeves got a high-DPI (`render_tier:'print'`, 1200+ DPI) path — mugs never did. After ANY data fix, Livery **caches PDFs by orderId and never invalidates on branding edits** — the operator MUST click "Regenerate" (`POST /reset-status/:orderId`) then re-run generate-batch. Production slip PDFs do NOT regenerate when CS uploads a replacement logo (only the `mugs-live` print file does) → slip shows old low-res image.

#### `physical_branding` entries are all equal — filter by order's size

⚠️ One `branding_record.physical_branding.entries[]` can have **2–7** entries (one per box-size variant from a multi-size proposal). There is **NO active/primary/status flag** — all entries are equal. The print pipeline MUST filter to the entry whose `buyer_product_ids` CONTAINS `ec_order.size`, or it sends ALL PDFs (e.g. order 19777198 got 3). `print_render_status='rendered'` is NOT a reliable health check — broken records with missing `print_image_url` still show `rendered`; check the JSON path directly.

#### Livery sleeve SKU table throws on unknown keys

⚠️ Livery's `SKU_TRIM_TABLE` (`sleeve-pdf.js`) maps `box_sku`→trim spec. A missing key (e.g. `c_3` "Cube System Triple", or `h_*` hot-sauce keys) makes `normalizeSkuKey` **throw**, aborting the whole PDF silently (`ok:true` returned, no sleeve PDF written; stuck rows with `print_url=NULL`). Fix = add the trim spec.

---

### Serpy (AI Ops Agent)

#### "x/y synced" partial is NOT a SERP failure

⚠️ A Serpy draft showing "x/y synced" (e.g. "Draft #683: 2/3 synced to Odoo") means **x succeeded into Odoo, y = total ops; the partial count = Odoo-side validation REJECTED some ops** — it is NOT a SERP failure.

#### Serpy is an AI tool, not a person, and not "SERP"

⚠️ Don't read SERPY Slack messages as written by a person, and don't assume SERPY is a typo for SERP. It's Jack's AI inventory-ops tool (Slack bot `U096P936NQ7`).

#### Product write-routing is hardcoded per op type

⚠️ **AI assumes** Serpy decides product write-routing at runtime per attribute.
✅ **Reality:** Routing is **hardcoded per op type**; the AI only chooses the op type. A single op can write Odoo + SERP + Laravel and keep IDs wired. Provenance bounds (creation-path go-lives): `product_template` 2026-03-24, `create_product` 2026-04-13, `create_receiver_product_everywhere` 2026-05-05 — anything before its path's go-live **cannot** have been Serpy. `create_uid=55` (jack@sugarwish.com) is NOT a reliable Serpy signal (it's both Serpy writes AND Jack's manual edits) — confirm via `odoo_sync_queue_live`; `ir_model_data.module='__export__'` = manual CSV import, not Serpy.

#### Serpy guards are fact-triggered, not semantic search

⚠️ **AI designs** rule retrieval as semantic search over the user's message.
✅ **Reality:** Serpy's guards are **fact-triggered** to catch what the user fails to mention; embeddings may add examples but never gate rules.

#### "Replace SKU" = component swap, not archive+activate

⚠️ Serpy "Replace SKU X with Y" for a box SKU should mean a **kit COMPONENT SWAP** (remove old + add new across every kit), NOT archive-old + activate-new. Intent is only implicitly encoded in commit `34bd6da9`; Serpy sometimes mis-resolves.

#### Odoo XML-RPC blocks private methods; rejects consu/service quants

⚠️ Odoo XML-RPC rejects any method starting with `_` ("Private methods cannot be called remotely") — hit when calling `stock.move._action_confirm`/`_action_done`/`_action_assign`. Use public equivalents (`stock.picking.button_validate`, `purchase.order.button_confirm`) or create child records directly. Odoo also rejects quant creation on consumable/service products ("Quants cannot be created for consumables or services"), so Serpy inventory adjustments on consu/service fail at sync. **Do NOT call `button_mark_done` via XML-RPC** for MOs — it cancels component moves and creates a zero-qty backorder; use the `mrp.immediate.production` wizard's `process()` instead. Inventory adjustments must use a direct `stock.move` in `done` state via virtual location id **14**.

#### Serpy images never reach the model; bulk creation trips loop detection

⚠️ Serpy transcribes images via an Opus vision pass **before** the agent loop (`transcribe.py`) — the agent only sees structured text, never image bytes (`parser.py` appends a `[image: path]` placeholder). `find_laravel_receiver_products` / `find_components` accept a **single `query` string** (no batching), so bulk product creation (~35 SKUs) forces 35+ sequential calls and trips `loop_detected` (threshold=3). Serpy approval flow has no permission check per op type, never captures a rejection reason (`reason=None` hardcoded), and never notifies the submitter. Serpy writes `receiver_products` to **manage** (not prod laravel_live) — must add `sku_type`/`is_core` to the `RECEIVER_PRODUCT_WRITABLE` whitelist, and `is_core` MUST be set to match `sku_type=='core'`.

#### PO-receipt handler silently drops unmatched lines

⚠️ Serpy's `_execute_po_receipt` silently drops any payload item whose `product_id` doesn't match an existing `stock.move.line` (happens when a PO line was zeroed and its move set to cancel). The `matched_count==0` guard only fires if EVERY item is unmatched, so a partial drop passes silently (`partial=False`, no Slack). Real example: PO P01982, RM-05-064-A 60 lbs vanished while the handler logged "12 of 13 matched, synced." `po_receipt` also threw false "Sync Failed" on a successful receive (socket timeout + retry found the picking already `done`) — fixed with `_already_received_result()`. Genuinely unguarded handlers (idempotency footguns on replay): `mrp_unbuild`, PO line edit/add, `stock_picking_correction`, `bom_change` remove_component.

---

### Product Classification & Forecasting Keys

#### is_core ⇔ sku_type=='core', enforced only in app code

⚠️ `receiver_products`: `sku_type` VARCHAR ∈ {`core`~456, `seasonal`~8, `legacy`~4699}, default `legacy`; `is_core` tinyint. **Rule: `is_core` MUST equal `(sku_type=='core')`, enforced in APP CODE ONLY** (helper `core_flag_for_sku_type`) — **no DB trigger** (one live exception: product_id 4177 `SA-46-033`). "core" is a CEO-driven commitment on ~220 specific SA SKUs, not an arbitrary flag. **There is no `make_for` column** — "make for" = toggle is_core/sku_type. Classification belongs only on PARENT SKUs (`parent_sku IS NULL`) and propagates parent→child only in the forecast READ pipeline (display), **never written to children**. When cloning a SKU to a new location variant, `drop_level`s do NOT auto-copy. `drop_level`=floor (disable at/below); `threshold`≈2× drop_level=alert.

#### product line comes from Laravel product_type, NOT Odoo category

⚠️ **AI assumes** Odoo `product_category` determines product line.
✅ **Reality:** Source of truth is **`laravel_live.product_type`** (int) + the `SA-NN-` SKU prefix. Odoo categories scatter the same products across multiple categories (unreliable). A category/`receiver-product` `product_type` mismatch makes a product **invisible despite being enabled & stocked** (daily Retool + n8n alert ~7am MDT flags conflicts). Types: 1=Candy, 2=Popcorn, 3/45=Cookies/Brownies, 5=Snacks, 6=Dog Swag, 10=Wine Tastings, 14=Wine, 16/40=Candles/Spa, 19/20=Coffee/Tea, 25=12 Nights, 39=Gourmet Pantry, 49=Candy & Snacks, 51=Gourmet Goods & Spa, 550=Vinebox, 567=Bakery & Cafe.

#### product_type column means different things in different tables

⚠️ `ec_order.product_type` classifies the **order context**; `receiver_products.product_type` classifies the **physical product**. The same cookie can be `567` (Bakery & Cafe) on one order and `47` (Custom Mug & Treats) on another. Route by `ec_order.product_type`. SA SKUs are context-dependent in cost reporting — a SKU may show blank for a product-type week even though it shipped under a different type.

#### product_type_key (PTK) strings must match EXACTLY across systems

⚠️ The dashboard and `sa_projections.sql` must produce **IDENTICAL** `product_type_key` ("ProductType|Size") strings or demand won't roll up. Popcorn sub-brands ('City Pop'/'Poppin & Mixin') normalize to 'Popcorn'; Custom Mug 'mug' and 'treats' are NOT separate SKUs (separate `size_name` rows). `sku_product_type_key` has base SKUs AND `'<sku>-bakerycafe'` variants — the base maps to the WRONG type for Bakery & Cafe (root cause of the 47,062 Bakery & Cafe orders with item-level cost gaps). `rm_weekly_demand_cache` uses **plural** `product_type_keys` (ARRAY), not singular. Note: `sku_projections.product_type` is **int** while `size_projections`/mapping tables use **text** — same semantic, different type. Several types are broken (exist in `size_projections_copy` but have no `product_type_key_sizes` mapping): Wine|Small Wine, Gift Sets|Deluxe/Large/X-Large, Candles, Gourmet Goods & Spa (51 has 0 `size_projections_copy` rows despite 61 SKUs). SKUs with no popularity row get **zero demand for ALL weeks** (popularity comes from REAL survey data, not code — new SKUs are zero until surveys arrive).

#### Forecast zero-cliff at the 2027 year boundary

⚠️ `size_projections_copy` / `week_settings` cover only through 2026. Any forecast week in 2027 INNER-JOINs to nothing → **ZERO demand** (CSV is real through W52 12/20/2026 then exactly 0 for all 2027 weeks). Fix: extend the projection tables forward, or cap the horizon. "Missing/buggy data" is often just a limit/filter slice or stale cache, not a real gap.

#### -A vs -E suffix and EW/TY fulfillment routing

⚠️ `-A` = standard/Taylor (location_id 2); `-E` = branded Englewood (EW, location_id 1). Branded (sleeve/merch) orders must use `-E`; non-branded must use `-A` (an hourly n8n workflow flags mismatches). Forecast rolls `-A` and `-E` as the **SAME** product. "Move quantity -A to -E" = a PAIR of inventory adjustments, never a stock_transfer. Fulfillment overrides: Bakery & Cafe is normally TY but **OVERRIDES to EW if sleeve/custom merch**; Mini Popcorn moves from Poppin & Mixin to CityPop if sleeved; Custom Mug & Treats is normally TY but overrides to EW if sleeve/merch (causing split EW/TY shipments, double shipping, manual tracking emails). Forecast location attribution reads the FIRST item's `location_id`; physical mug production is in Taylor but forecast usage **rolls up to Englewood**. Only EW/TY are valid for production-slip printing (`validate_slip_rows` ALLOWED_LOCATIONS raises "Print blocked" otherwise).

---

### Equivalency Ratio & Cost Tracking

⚠️ **Cost-per-equivalent is `dollars / units` (A·B/Z), NOT `dollars·ratio / units·ratio`** (the ratio cancels out). Popcorn ~$1.80–3.00 with equiv 0.5 → ~$0.90–1.50 per equivalent. The equivalency ratio normalizes cost across product types for the executive scorecard: Candy=1.0 (baseline), Popcorn=0.5, Gourmet Pantry/Spa ~0.75 (Wine/Gift Sets TBD). Cost method (per Ric Marquis) is **current/recent PO price ÷ BOM conversion (from MOs) × equivalency ratio, weighted-averaged — NOT FIFO accounting cost.** SA cost lookup REQUIRES a recent Manufacturing Order (no MO in last 6 months → "-" cost, even if the SKU shows popularity). Popcorn (no MO/BOM) uses the hardcoded `POPCORN_COSTS` dict. "Material Cost Rate" (actual fulfillments) and "Summary" (forecast-weighted by SKU popularity) tabs differ by source → expect small mismatches ($1.36 vs $1.32 for Candy). Cocktail Mixer SKUs 344–357 have **zero** cost data (no supplier/SVL/PO; `list_price=1.00` placeholder).

---

### FIFO / COGS / Accounting

⚠️ SugarWish uses **Continental (real-time) accounting, NOT Anglo-Saxon** — 0 anglo_saxon_lines out of 24.5M `account_move_line`s; COGS is recognized at receipt/production, not on customer invoice. All product categories are **FIFO + real_time** valuation (`cost_method` is an Odoo `ir_property`, NOT a column on `product_category`; keyed `res_id='product.category,<id>'`). Stock journal is **STJ (`journal_id=6`, ~12.2–13.2M entries)**; vendor bills are **BILL (`journal_id=2`, ~1.6K)**. **Payment tracking happens in QuickBooks, NOT Odoo** — 99.8% of vendor bills show `payment_state='not_paid'` despite being paid; the field is never reconciled. Vendor billing is **100% manual** — accountants (Nora Stein, James Emeric, Mike, Neal) create bills AFTER goods arrive and a vendor invoice is received. SERP COGS gaps: `account_move`/`account_move_line` use **Float not Decimal** (precision loss), have **no `stock_move_id`/`is_anglo_saxon_line`/`categ_id`**, `amount_residual` is a plain field (not computed), `action_reverse` references a non-existent `component_id` (should be `product_id`). One PO ↔ many bills and one bill ↔ many POs via `account_move_purchase_order_rel` (a SERP standalone can't enforce this — it stays in Odoo). The April-2026 BOM/kit expansion moved component explosion into Laravel/SERP, so Odoo SOs now receive **pre-expanded** components — buyer-product/packaging data **disappeared from Odoo sale orders**, breaking some finance reports (Ric flagged 2026-04-16).

---

### WishDesk / SWAC / CRM

#### Three "Wish" systems are NOT the same

⚠️ **WishDesk** = the CS/CRM product (= the `jasonbkiefer/SWAC` repo, "SugarWish Activity Coordinator" — take the literal name with a grain of salt). **WishWorks** = in-house WW-#### ticket tracker via the WishBot AI Slack bot (replaced glitch reports March 2026; `/ww` self-updates from Jason's private SWIRL repo + an n8n archival step; the ticket "track" field determines repo/team ownership). **SWIRL/swirl** is BOTH (1) the company-wide AI knowledge platform (docs + MCP + Slack bot) AND (2) the WishWorks datastore (auto-generated ticket commits) — and is **separate from Jack's sw-cortex**. **SWIM** is WishDesk's AI chatbot (kb-v2 powered).

#### Two Madisons

⚠️ Don't merge them: **Madison Parks** is a SWAC dev; **Madison Meilinger** is CS/ops management (handles substitutions, placeholder/custom orders, eCard swaps).

#### Gmail tables are personal-mailbox mirrors, not ticketing

⚠️ `swcrm_z_gmail_*` mirror reps' **personal Gmail** for sales/relationship work — separate from `orders_tickets`. Thread by `gmail_thread_id` (NOT subject); CRM linkage via `linked_sw_user_id`/`linked_swcrm_lead_id`. Gmail **labels are per-mailbox real Gmail labels** (vary by user, include Google SYSTEM labels) — NOT CRM categories. AI-draft `status` must be `SENT_AS_IS` (or edited-then-sent) to count as sent; `GENERATED`/`DISCARDED` were never sent. Draft greetings leak `{{firstname}}`/`{{agent_name}}` placeholders literally (fix exists on `fix/draft-placeholder-replacement` but isn't deployed — agents hand-replace; `{{Mustache}}` and `{single}` formats both need handling). `sync_status='ERROR'` is the latest run's state, **resets on next success** — not a permanent failure.

#### swcrm_links is a bidirectional polymorphic graph

⚠️ `swcrm_links` has **no per-pair FK tables**; rows are stored in **BOTH directions** (A→B and B→A — dedupe by direction). `role` gives semantics ('related' ~80% = generic activity history; also `assigned_to`, `owned_by`/`owner`, `assigned_by`, `follow_up`; NULL = legacy Insightly). To find everything attached to a company/opportunity, query on BOTH `(object_name,object_id)` AND `(link_object_name,link_object_id)`. CRM "user" object = SugarWish CUSTOMER (resolve via `user_cache.user_id`, NOT `wishdesk.users.id`).

#### Opportunities: use opportunity_state, not legacy state/status

⚠️ `swcrm_opportunities.opportunity_state` (OPEN|WON|LOST|INVALID|UNTAPPED) is AUTHORITATIVE. The legacy `state` enum and free-text `status` are NOT for reporting. `category` (SMALL|MEDIUM|LARGE|MEGA|NA) is a **deal-size bucket, NOT a product category**. Only one 'Default' pipeline is used (3 stages: 1 Expressed Interest, 2 Active Discussion, 3 Order Paid=WON).

#### WishDesk uses Mountain Time, cookie sessions, and points at LIVE data on staging

⚠️ WishDesk timestamps are stored in **Mountain Time, NOT UTC** (a `setUTCHours(0,0,0,0)` "advance to next day" set UTC midnight = 5/6pm MT, mis-marking overnight SLAs as 4h breached — fix uses `advanceToNextDayMidnightInTimezone()` for America/Denver). The React UI uses **cookie-based sessions, NOT JWT Bearer** (Bearer only for curl/API; local dev needs `ENABLE_LOCAL_AUTH_BYPASS=true`, `APP_ENV=local`). SLA settings are NOT per-priority (all priorities get the same 60min FRT / 120min resolution targets). Genie/router config and design images live in the **sw-design repo** — editing them directly in WishDesk gets **wiped by a full-overwrite sync**. Phone/SMS comms are logged via **RingCentral** (`swcrm_ringcentral_*`), not just email.

#### `ec_order.size` → `buyer_products.id` (again, from the WishDesk side)

⚠️ For product-size display, parse the size from `giftcards_card.product_sku` (contains "large"/"medium"/etc.) — the `ec_order.size → size_names` join is unreliable (high NULL rate; many size values like 6961 don't map). `ec_order.ship_date` is a MySQL **DATE** but returns as a UTC timestamp via mysql2 (`...T05:00:00.000Z`) — converting to MT shows the wrong day; use a date-only formatter.

#### WishDesk email threading must verify requester_email (security)

⚠️ `getChatSessionByThreadId()` matches by `thread_id` ALONE — bulk emails (surveys, notifications) share one Message-ID, so different customers replying get **merged into the first customer's ticket** (cross-customer contamination, 7+ prod cases). Fix: verify `requester_email == senderEmail` before merging threads.

---

### Proposals, Redemption & Migration

#### proposals.details_json is a multi-writer bug factory

⚠️ `proposals.details_json` is written by MANY paths (quiz, genie, agent, admin, merchandise, duplicate, repeating-order, MCP tool), each populating a different subset of ~25 keys with different defaults (root cause of WW-460/WW-650). **8 universally-required fields:** `sender_id, product_id, product_sku, product_configuration_id, quantity, delivery_method, price, product_selections (non-empty)`. **Validate at the CART-ADD boundary, NOT creation; never blanket-validate; any silent fallback MUST throw/alert** (silent `console.log` = the bug). The merchandise preview-flow bug let merch be purchased with empty `designs[]`/`print_image_url=NULL` → SWOP renders nothing silently (Jason hard-blocked add-to-cart with `designs.length===0` → HTTP 400 on 2026-05-15).

#### Redemption resolves products at REDEMPTION time — consolidation has a long tail

⚠️ **AI assumes** consolidation is safe because orders freeze the product at creation.
✅ **Reality:** Redemption/receiver resolves products at **REDEMPTION time**, so it hits **disabled child SKUs** after a consolidation. The April-2026 combo-line migration (Phase 2 archived child variant SKUs: `archive=1`, `status='disabled'`, `inventory_link=NULL`) caused: orders stuck `oddo_synchronized=3` ("product not found"); ~14K giftcard `card_id`s pointing at the CORE product (type 51) instead of sweetshoppe (Jaypee corrected); ~14K active ecards with old standalone selections showing empty "no items" redemption screens. **Lesson: consolidation needs historical-card backfill.** The WW-510 disabled-SKU bypass: the resume flow skips the choose-page localStorage filter, and the migration NULLed `inventory_link` removing the `linkedProduct()` safety net — add a pre-submission guard (`archive=0, status='enabled', deleted_at IS NULL`).

---

### Repos, Process & Team

#### Each repo has its own branch/promotion/ticket convention — `main` is rarely safe

⚠️ **AI assumes** uniform git-flow with `main` as the safe default.
✅ **Reality:** SERP: `dev → main`, manual deploy. SWAC/WishDesk: `feature → development → staging → live` (tickets WD-/WW-). sugarwish-laravel: `SUG-*`/`WW-*` feature branches → `manage` (staging) → `blue` (prod). sugarwish-odoo: `staging_new → main`. SWAC/Laravel deliberately **bundle unrelated features per PR**. Verify the table before assuming a branch.

#### WW-106 B-SKU filter regression: a failed blue deploy left split behavior

⚠️ A B-SKU filter added to `updateInsertKit()` (Apr 7-8) dropped receiver-order B- rows to zero, but preselect-order B- rows kept leaking 2–73/day because the **deploy-to-blue Jenkins jobs 3231-3232 FAILED** — blue ran pre-filter code while green/main had the filter, and load-balancing split traffic. Lesson: a "deployed" fix isn't live until ALL servers actually updated.

#### Devs are NOT interchangeable; glitch ≠ bug

⚠️ Offshore devs aren't interchangeable: **Manish** = lead / most Odoo-experienced / SERP secondary (owns migration scripts); **Subash** = Laravel-track; **Parish** = WishDesk/SWAC-track lead merger; **Aashish** = junior, low-risk only. Validation/product changes need sign-off from **Caley/Clare/Kelley**; **Anna** triages; **Seth** owns external API accounts/infra; **Munyr** owns Jenkins CI/CD + the AWS→Hetzner migration (Jack is a consumer, not infra owner). **Devs only REPLICATE glitches, never fix them directly** — a separate BUG ticket must be Product-prioritized; fixing a glitch directly violates process. Irreproducible bugs are NOT chased — "fixed" often means a one-off DATA PATCH for one customer while the systemic fix lags (e.g. the ecard-empty-redemption bug was patched customer-by-customer for weeks before Jaypee bulk-fixed ~14K).

---

### Concurrency, Deadlocks & Multiple Writers

⚠️ **Multiple systems write the same MySQL rows.** Laravel, Retool, and n8n all write `receiver_products` (and others), causing `ER_LOCK_DEADLOCK` and partial updates; Retool can overwrite the auto-managed `updated_at`. The n8n "Disable_Unreserved_Products" / "Auto-Disable Workflow" (runs every ~1 min via `UPDATE receiver_products WHERE inventory_link=parent`) is a known deadlock source competing with Laravel/Retool writers — and it **re-disables a product within seconds of a manual re-enable** if still below drop_level (no cooldown; disable-only, never re-enables). The Laravel inventory deadlock crisis (escalating to every ~2 min on >50-row batches, Jan 2025) comes from three check-then-act races: `ReceiverProduct::decrementInventory()` (SELECT-then-UPDATE without `lockForUpdate()`), `PrepickOrderJob` batch (decrements before order confirmation, no batch transaction), and `InventoryReservationService::canReReserveProducts()` (read-check without `FOR UPDATE`). SERP uses atomic `INSERT...ON DUPLICATE KEY UPDATE`; Laravel uses non-atomic SELECT-then-UPDATE — with **no cross-system coordination**, both can independently oversell the same inventory. `serp_stock_move` has **no row-level locking in workers**, enabling duplicates if run in parallel.

---

### Analytics, Reporting & Alert Hygiene

⚠️ **"Sales with sleeves"** is the **% of total ecard revenue that includes a sleeve**, NOT the dollar value of sleeves. `receiver_product_status.*_slack_ts` columns are **alert-dedup guards (already-sent markers), NOT message bodies**. Most `:rotating_light:`/`#api-autofix` posts are routine **auto-resolved noise** ("No action on data/APIs should be necessary from alerts in #api-autofix" — Seth); a single alert is usually not actionable unless it explicitly says the auto-fix failed. n8n workflow exports are **snapshots** — the `active` flag is unreliable and workflow IDs differ from live; check `n8n.sugarwish.com` for actual state. The Odoo→Google-Sheets export (`sw_excel_update`, hourly crons to sheet `1ESYinwhFztJfzo0Aec3BwafS9d7cHxWTUhh9vpVGGJA`) **logs errors but doesn't raise** — failures can be silent.

---

## Terminology / Glossary

This section defines SugarWish's internal vocabulary, SKU encoding scheme, product taxonomy, warehouse jargon, and system/product names. It is the authoritative decoder ring for the codes, prefixes, and names that appear throughout the data.

### SKU Prefix / Suffix Taxonomy

SKU prefixes and suffixes are **NOT arbitrary or opaque** — they encode role/stage, product line, location, and ownership. The explicit merge stub for this knowledge was `odoo-sku-prefix-taxonomy`.

#### Role / Stage Prefixes

| Prefix       | Meaning                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RM-**      | Raw Material                                                                        | Loose/bulk individual component as received; bought via POs; tracked **only in Odoo** (no Laravel RM). ~1,000–1,033 active. e.g. `RM-40-094-A`, `RM-19-044-A`                                                                                                                                                                                                                                                     |
| **SA-**      | Sub-Assembly / saleable stockable finished good                                     | Carries `sugarwish_id`; has an Odoo BOM; built from RMs. ~2,100 active. e.g. `SA-03-025-A`, `SA-15-014-A`                                                                                                                                                                                                                                                                                                         |
| **FG-**      | Finished-Goods kit                                                                  | Also a sellable receiver product. ~194. e.g. `FG-10-228-A-4PACK`, `FG-48-001-A` (Sweet Dreams Large)                                                                                                                                                                                                                                                                                                              |
| **B-**       | Box (inner colored retail box / gift box)                                           | Tracked by **Laravel kits**, NOT SERP phantom BOMs. Pattern `B-{TYPE}-{era}-{YY}-{SIZE}` (e.g. `B-A01-REG-24-RED-MIN`); winter pattern `B-{TYPE}-WTR-{YY}-001-{SIZE}`. `B-AAA`=Type A Candy, `B-B02`=Type B Popcorn, `B-CCC`=Type C Cookies/Coffee/Tea. **B-LLL cocktail boxes** (Odoo IDs 21929–21934, 6 sizes) have NO BOMs at all (standalone packaging) and are excluded from forecast via product_type 17/18 |
| **S-**       | Shipper (outer corrugated mailing box) OR sweets/food component (context-dependent) | In BOM-line context S- denotes shipper/sweets; cocktail shippers use S-LLL                                                                                                                                                                                                                                                                                                                                        |
| **C-**       | Carton / Cup / Card (context-dependent)                                             | Cups/cartons/cards packaging                                                                                                                                                                                                                                                                                                                                                                                      |
| **I-**       | Insert (cup/tray insert, packing tissue, foam insert, printed insert cards)         | e.g. hot-sauce foam `I-A46-REG-25-FOM-{MIN/SML/MED/LRG/XLG}`; year token matters (`I-GXX-REG-24-CAR-TON`)                                                                                                                                                                                                                                                                                                         |
| **L-**       | Label / Sticker                                                                     | e.g. popcorn sticker `L-B02-REG-23-0NN-COX`                                                                                                                                                                                                                                                                                                                                                                       |
| **P-**       | Production Paper / Sticker / Production paper                                       | Used in ~525–704 BOMs (≈1 per kit, virtually every order); e.g. `P-XXX-REG-22-SKR-XXX` (Odoo product 3572, Stephen Gould / Brad Hartt vendor)                                                                                                                                                                                                                                                                     |
| **M-**       | Mug (blank mug / custom branded mug)                                                | e.g. `M-CCC-WHT-26-MIR-S32`, `M-CCC-WHT-26`                                                                                                                                                                                                                                                                                                                                                                       |
| **T-**       | Tape                                                                                | BOM lines frequently `product_qty=0` (optional) → all currently inactive                                                                                                                                                                                                                                                                                                                                          |
| **E-**       | Extra (care cards, coasters, extras)                                                |                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **G-**       | Gift wrap / rare (1 row)                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **X-**       | Rare (11 rows)                                                                      |                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **V- / VB-** | Vendor / Wine packaging-components (Vinebox)                                        |                                                                                                                                                                                                                                                                                                                                                                                                                   |

#### SKU Numeric Segment & Tokens

- **Numeric segment 2 = product line / product_type** — extracted from SKU position 2 (e.g. `SA-`**`01`**`-025-A` → type 01 = Candy → maps to `product_type.id`). Packaging SKUs (B/C/I/L/S/M/P/E) do **NOT** get a product_type assigned.
- **Year token (22 vs 25)** signals a versioned box/packaging swap. Year-22 components are NOT obsolete — e.g. size 6916 (Grand Bakery Cafe) and 6962 (Large Custom Mug & Treats) consistently use year-22 packaging, so n8n "year-22 EXTRA" alerts are **false positives**.
- **System token (A/B/C)** is only meaningful for packaging SKUs; SA/RM/FG always show system as null/blank.

#### Location Suffixes: -A vs -E

| Suffix | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| **-A** | Standard / **Taylor** (location_id 2); the base SKU                             |
| **-E** | Branded **Englewood** (EW, location_id 1); used when a sleeve/merch is attached |

- Orders with a sleeve/merch **must** use `-E`; non-branded **must** use `-A` (an hourly n8n workflow flags mismatches).
- The forecast rolls `-A` and `-E` as the **same product**.
- A Serpy request "move quantity -A to -E" = a **PAIR of inventory adjustments**, never a stock_transfer.
- When `-E` lacks a BOM, the fix is a synthetic BOM pointing at `RM-XX-XXX-E` or a duplicated `-A` BOM with A→E swap.
- **EW Bakery Cafe rename convention** (James Emeric, 2026-04-30): change the trailing `A`→`E` to mark the EW version; 68 such SKUs (cookies SA-03, coffee SA-19, tea SA-20, hot cocoa SA-21, brownies SA-45), all initially disabled.
- ❌ **AI assumes** `-A`/`-E` are arbitrary variants → ✅ **Reality:** -A=Taylor/base, -E=Englewood/with-box; match new products and historical sales to -E for branded orders.
- ⚠️ **-E SKUs from the May-2026 -A→-E migration are valued at $0 in Odoo (~$28–37k stranded value; found 2026-06-24).** The "move -A to -E" pair (an -A _decrease_ + an -E _increase_) carried real value OUT of -A but the paired -E inbound `inventory-adjustment` move landed with `price_unit=NULL` while the -E product had no cost basis yet → FIFO stamped every inbound SVL layer at `unit_cost=0/value=0`. **Editing the product cost card / `standard_price` does NOT fix it** — `standard_price` only seeds the _next_ inbound layer, never revalues layers already on the books, and the Stock Valuation report sums `SVL.remaining_value`, not the cost card (proven: -E SKUs with a cost set still read $0). **The only fix that moves the report AND posts the GL is the Odoo 15 Product Revaluation wizard (`stock.valuation.layer.revaluation`, model id 580):** Inventory ▸ Products ▸ -E product ▸ Valuation smart button ▸ "+" ▸ Added Value = on-hand qty × matching -A FIFO unit cost, pick Counterpart Account (use COGS) + Journal, Validate → it creates a value-only SVL row, distributes value across open FIFO layers, and posts `debit Stock Valuation / credit counterpart`. ⚠️ Scripting it server-side must set `company_id` on the `stock_valuation_layer_revaluation` row (NOT-NULL; a wizard run via ORM defaults it, a raw insert does not). **RESOLVED 2026-06-24:** Jack ran the revaluation across the full -E cohort (counterpart = **Cost of Goods Sold**, confirmed by Erly/accounting) and the Stock Valuation report now reflects the matching -A FIFO cost — the ~$28k of stranded on-hand value is booked; the historical $0-COGS shipments remain a separate closed-period P&L item for accounting. Helper scripts live in SERP `scripts/odoo_revalue_e_skus*.py`.

#### Ownership Encoding via Prefix

- **SA-/RM-/FG-** live in **Odoo BOMs**.
- **B-/S-** (box/shipper) live in **Laravel kits**.
- ❌ **AI treats SKU prefixes as opaque** → ✅ **Reality:** they encode role/stage, product line, location, and which system owns the recipe.

### sugarwish_id / odoo_id Prefix Encoding

These are the cross-system identity bridges. They are **fabricated/encoded**, not raw foreign keys.

#### `product_template.sugarwish_id` (Odoo) — THE external sync key

Lives on **`product_template`, NOT `product_product`**. It is the authoritative bridge Odoo↔Laravel. Decode by prefix:

| sugarwish_id value    | Decodes to                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| starts with **`800`** | strip `800` → `components.id` (e.g. `800439` → component 439; `8002574` → component 2574). ~2,238 such                                           |
| starts with **`500`** | `buyer_products` — formula `sugarwish_id = "500" + buyer_products.id` (e.g. buyer_product id 60 → 50060; id 42 → 50042). For phantom-kit mapping |
| other integer         | `receiver_products.product_id` OR `buyer_products.id` (do NOT assume receiver without checking)                                                  |
| `0` / `NULL`          | no mapping (~1,371 templates)                                                                                                                    |

- `sugarwish-odoo` `sale.py` filters on `startswith('500')` / `startswith('800')`.
- SugarWish integration searches Odoo products **by `product_template.sugarwish_id`**.

#### `components.odoo_id` (Laravel) — FABRICATED, not a real Odoo PK

- Formula: `components.odoo_id = "800" + components.id` (string concat, varchar; e.g. id 439 → `'800439'`, id 8 → `'8008'`). Range observed ~8008–800644.
- ❌ **AI joins `components.odoo_id` directly to Odoo `product_product.id`** → ✅ **Reality:** it matches the WRONG rows. The real round-trip is via `product_template.sugarwish_id`; the real product match is by **SKU** (`components.sku` = `product_product.default_code`).
- The "Odoo Live: Failed Products List" email shows `800xxx` values that are Laravel synthetic IDs, resolved to the real Odoo product via `sugarwish_id`.

#### `buyer_products.odoo_id` (Laravel)

- Formula: `odoo_id = "500" + buyer_products.id`. Populated on **all** 1,215 buyer_products rows (~99% match the formula; ~12 outliers from re-mapped products). This is the SugarWish↔Odoo product link for buyer products.

#### `odoo_id` on SERP `serp_*` mirror tables — cross-system JOIN key

- ❌ **AI joins SERP↔Odoo on `id = id`** → ✅ **Reality:** join on the **`odoo_id` column**. The durable "SERP-origin" signal is **`odoo_id IS NULL`** (NOT `id >= 1B`). `id = odoo_id` holds ONLY for Odoo-seeded rows. Child rows (stock_move, stock_move_line, quants) created by the worker often have `odoo_id = NULL` until stamped.

#### `oddo_synchronized` — note the typo

- Column on Laravel `ec_order`/`preselect_orders` is misspelled **`oddo_synchronized`** (double-d, missing second-o), NOT `odoo_synchronized`. Values in prod: `0`=not synced (~77K), `1`=synced (~3.9M), `2`=in-flight/partial/retry (~64–166), `5`=vendor/special/bypass (~17K). **Value `3` (errored) appears in WishWorks bug reports but does NOT exist in prod** (per direct query). Companion flag: `ship_date_odoo_synchronized`.

### Product Types & Product Lines

#### `laravel_live.product_type` — SOURCE OF TRUTH for product line

Product line is determined by **`laravel_live.product_type` (integer)**, NOT Odoo `product_category` (which scatters the same SA across multiple categories and is unreliable).

| ID      | Product Type                                        |
| ------- | --------------------------------------------------- |
| 1       | Candy                                               |
| 2       | Popcorn                                             |
| 3 / 45  | Cookies / Brownies                                  |
| 5       | Snacks                                              |
| 6       | Dog Swag (Dog Treats & Swag)                        |
| 7       | Cotton Candy                                        |
| 10      | Wine Tastings                                       |
| 13      | "Customize a Sugarwish" / Custom Mug sender side    |
| 14      | Wine                                                |
| 16 / 40 | Candles / Spa                                       |
| 17 / 18 | Cocktail / Mocktail Mixers (excluded from forecast) |
| 19 / 20 | Coffee / Tea                                        |
| 25      | 12 Nights                                           |
| 39      | Gourmet Pantry                                      |
| 43      | Gift Cards (location_id NULL)                       |
| 46      | Hot Sauce                                           |
| 47      | Custom Mug & Treats (recipient side)                |
| 49      | Candy & Snacks (merged, launched 2025-07-14)        |
| 51      | Gourmet Goods & Spa (merged spa)                    |
| 550     | Vinebox                                             |
| 567     | Bakery & Cafe (launched 2025-04-14)                 |

- ❌ **AI assumes Odoo `product_category` determines product line** → ✅ **Reality:** use `laravel_live.product_type` and the SA-NN- SKU prefix number.
- **`product_type` is context-dependent**: `ec_order.product_type` classifies the _order context_ while `receiver_products.product_type` classifies the _physical product_. Same cookie ships as type 567 (Bakery & Cafe) on one order and 47 (Custom Mug & Treats) on another. For routing/fulfillment, classify by `ec_order.product_type`.
- Dashboard product-line buckets: `Cubes`=16/40/51/39, `Cups`=candy/snacks, `Cookie cartons`=cookies/brownies, `cartons`=coffee/tea.

#### Product Line (concept)

A **Product Line** is a grouping of product_types (Laravel `product_lines` table: Treats, Drinks, The Selects, Plants, Experiences, Lifestyle, etc.).

### Gift Sizes & Size Categories

- **Size tiers (ascending price):** Mini, Small, Medium, Large, Larger, X-Large, Deluxe, Grand (plus shipping fees).
- **Categories (2026 SKU rationalization — 5 core + niche):** Candy & Snacks, Bakery & Cafe, Gourmet Goods & Spa, Wine & Cheers, Popcorn; plus niche Hot Sauce, Dog Treats & Swag, Custom Mug & Treats.
- **Pick count** = number of product selections a recipient gets ("Pick 2", "Pick 4", "Pick 6", etc.). Also the box/shipper size grouping (2-pick, 4-pick, 8-pick, 12-pick/XL, "grand", "mini").
- **`buyer_products` = "size"**: the term **"buyer product" is a SYNONYM for "size"** (refers to `size_projections_copy` rows), NOT a separate buyer-level allocation.
- **`ec_order.size` is MISNAMED**: it holds a `buyer_products.id` (the box/product the recipient chose), NOT a physical size string and NOT a `size_names.id`. Correct join: `ec_order.product_type = buyer_products.product_type AND ec_order.size = buyer_products.id`. Real size lookup is `buyer_products.size_name_id`. Low buyer_product IDs collide with disabled receiver_products (e.g. 41, 61–65, 90–91, 116, 137, 353, 923) → "wrong candy on slip" bug.
- **`number_of_candies`** = integer count (2,4,6,8,12) of individual items per package — a legacy ecommerce field used as a cost-analysis/forecast scaling metric.
- **Grand orders ship as 3 boxes** via `kit_id=917` (component quantity=2 → 1 outer + 2 junior), **NOT** via `item_multiplier` (which is 1 for grands). Grand buyer_product IDs: 210, 213, 248, 262, 599, 601, 6864, 6916.
- **Tasting-kit pack size** is encoded in Odoo `product_category` id: 55=3-pack, 56=6-pack, 57=9-pack, 165=12-pack, 190=4-pack, 202/203/205/206=monthly boxes (6-pack). ⚠️ SERP `wine_dashboard.py` only includes {55,56,57} — **MISSING 165 (12-pack) and 190 (4-pack)**.

### Product Types: Odoo-Tracked vs SERP-Tracked

A core ownership distinction — which system owns the inventory:

- **Odoo-tracked** = standard products. Inventory in Odoo stock_quant; flows Odoo→SERP/Laravel via sync.
- **SERP-tracked** = custom-branded merchandise (mugs, sleeves, apparel, water bottles, hats, client-provided items). Lives in the `components` table with variants/sizes, uses `component_orders` (bypassing the kit system), SERP `stock_quant`/`stock_move`, auto-PO from `buyer_orders`. **Never in Odoo** (Jason Kiefer decision, 2026-02-08: custom branding 100% through SERP, never Odoo).
- `components.inventory_source` enum (`'odoo'` / `'serp'`) marks which system authoritatively tracks a component.
- Serpy auto-routes product-creation ops by Odoo-tracked vs SERP-tracked. "Create Odoo-Tracked Component/Receiver Product" writes Laravel+SERP+Odoo and wires IDs; "Create SERP-Tracked Component" is SERP-only (custom branding); "Create Product (Odoo Only)" skips Laravel.
- **RM SKUs sync ONLY to Odoo+SERP, NOT Laravel.**

### Recipe Keys

- **Recipe key** = an alternate lookup into a phantom BOM / kit, format `"{N}cube-bp{buyer_product_id}"` (e.g. `"1cube-bp6978"`, `"1cube-bp41"`). Stored in `merchandise_packaging_recipes.recipe_key` (UNIQUE) in WishDesk.
- Ties a buyer_product to `outer_box_sku` (e.g. `c_2`, `c_3`), `cube_size` / `merchandise_cube_size`, and add/remove component lists (`additional_components` JSON `{add:[], remove:[]}`).
- Stored snapshot lives in `ec_order.merchandise_selections` JSON as `recipe_snapshot` (`recipe_id`, `recipe_key`, `outer_box_sku`, `buyer_product_id`, `merchandise_cube_size`, add/remove arrays).
- `recipe_key` resolves component composition via `recipe_id` + key → `mrp.bom` → `serp_product_product`.
- ❌ **AI assumes a standalone `recipes` table exists** → ✅ **Reality:** no `recipes` table; recipe data is embedded as `recipe_snapshot` inside `branding_records.merchandise` / `ec_order.merchandise_selections` JSON. `serp_product_product` has **no `recipe_key` column** (a migration is needed for custom-branding work, WW-465).
- **`recipe_key` is distinct from the Laravel "default kit"**: the default kit (`sugarwish.kits`/`component_kits`) is the colored-box layer, while recipe-key lookup resolves the packaging/merchandise composition layer.

### Box Vocabularies (two distinct systems)

There are **two different box-SKU vocabularies** — do not conflate them:

1. **RECIPE box SKUs** (`merchandise_packaging_recipes`, `merchandise_cube_size`): `c_1`, `c_1.25`, `c_1.5`, `c_2`, `c_3`, `c_4` — a packaging decision.
2. **LIVERY / SLEEVE box SKUs** (`design_boxes`, `branding_records.physical_branding.entries[].box_sku`): `a_mini`, `a_small`, `a_medium`, `a_large`, `a_xlarge`, `c_1`, `c_small`, `c_medium`, `c_large`, `c_3`, `h_small`, `h_medium` — sleeve/print sizing. Livery `SKU_TRIM_TABLE` maps box*sku → print dims; a missing entry (e.g. `c_3`, `h*\*`hot-sauce keys) makes`normalizeSkuKey` THROW and silently aborts the whole sleeve PDF.

### System & Product Names

| Name               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SERP**           | SugarWish's in-house ERP (Jack Kiefer's build, Next.js + FastAPI/Python or Laravel-MySQL Odoo-mirror depending on layer), incrementally replacing Odoo. Live transactional data lives in `*_darklaunch` DBs, not the embedded `serp_*` tables in laravel_live/manage. App reads/writes the manage cluster. NOT the same as "Serpy".                                                                                                                                                                                                                                                                                                                                                      |
| **Serpy**          | SERP's **AI ops agent** (Slack bot `U096P936NQ7` "SERPY Dev" + web UI `serp.sugarwish.com/serpy/<draft_id>`). Plain-language ops → JSON operations → Odoo/SERP/Laravel via XML-RPC behind a Slack approval flow. Generates numbered "Drafts" (e.g. "Draft #683"). "x/y synced" = x succeeded INTO Odoo, y = total ops (partial = Odoo-side validation rejected some, NOT a SERP failure). **NOT a person and NOT a typo for SERP.** "Replace SKU X with Y" should mean a kit **component swap** (remove old + add new across all kits), not archive-old/activate-new.                                                                                                                    |
| **darklaunch**     | SERP's parallel Odoo-shadow validation system. SERP and Odoo run side-by-side, dual-write via Serpy + one-way Odoo→SERP sync, gated for cutover at "<1% drift, stable 2 weeks." Live prod darklaunch DB = `serp_test` on Hetzner `5.161.233.240`. Cutover timestamp in `serp_darklaunch_meta.darklaunch_cutover_at` (prod 2026-06-04 09:27:20, staging 2026-06-03 11:52). The worker is **isolated** — never reads Odoo _values_ at runtime (only ID resolution for `odoo_id` stamping). "compare-replica" tooling actually compares darklaunch.                                                                                                                                         |
| **manage**         | The Laravel admin/management app **and** its staging MySQL database (`manage.sugarwish.com`). Renamed 2026-05-11 from "laravel staging". Near-identical schema to `laravel_live` (~8% of prod volume). Hosts SERP's upstream ORM tables; Serpy writes `receiver_products` here (NOT prod `laravel_live`). "Test on manage" = the Laravel staging environment. Its embedded `serp_*` tables are stale (NOT live SERP data).                                                                                                                                                                                                                                                               |
| **livery / SWOP**  | Cris (Criston) Sloan's repo (`csloan-sw/livery`, branded "SWOP"). Dual-natured: (1) the warehouse **custom-shop print station / sleeve imposition** backbone (generates sleeve & custom-shop-slip PDFs), and (2) an **MCP ops-tooling suite** (`mcp-db-tool`, `mcp-slack`, `mcp-wishdesk`, `swim-kb`, `custom-shop-slip`). **Reads the mug image from `ec_order.merchandise_selections.items[N].design_selected.print_image_url`** (matched by `item_id`), NOT `branding_records.merchandise`. Caches PDFs by `orderId` ONLY and never invalidates on branding edits — after a data fix the operator MUST click "Regenerate" (POST `/reset-status/:orderId`) then re-run generate-batch. |
| **WishDesk**       | SugarWish's CS/CRM/design/billing platform. The product brand for the **SWAC** repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **SWAC**           | GitHub repo `jasonbkiefer/SWAC` ("SugarWish Activity Coordinator") = **the WishDesk app** (React + Express + TypeScript + Drizzle + MySQL). NOT a separate system from WishDesk, and the literal "Activity Coordinator" name is misleading. Envs: `desk.sugarwish.com` (live, branch `live`), `desk2` (dev, branch `development`), `desk3` (staging — but points at LIVE databases, not isolated). Branch flow: feature → development → staging → live (NOT main). Times stored in **Mountain Time, not UTC**.                                                                                                                                                                           |
| **SWIM**           | WishDesk's AI customer-service chatbot, powered by the `kb-v2` Qdrant collection. Generates draft replies (acceptance rate ~1%).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **SWIRL**          | Two roles: (1) **Sugarwish Intelligence Reference Library** — company-wide AI knowledge platform (docs + MCP access + Slack bot); (2) the **WishWorks datastore** (auto-generated ticket commits, Jason's private `jasonbkiefer/SWIRL` repo). SEPARATE from Jack's `sw-cortex`.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WishWorks (WW)** | In-house ticket/glitch tracker (`WW-####` tickets), managed via the **WishBot** AI Slack bot; replaced glitch reports March 2026. The ticket "track" field determines repo/team ownership.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **WishLink**       | Shareable gift link ($2/link + redemptions); supports multi-use with optional domain restrictions. Was non-refundable; changed 2024 to "cancel and credit −10%" like eCards.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Odoo**           | The PostgreSQL ERP (v15) — inventory/accounting/manufacturing source of truth, being replaced by SERP. Cloud-hosted on Odoo.sh (no shell access).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Laravel**        | The main e-commerce app & order domain (`sugarwish-laravel`); `laravel_live` is the production orders DB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Retool**         | Low-code analytics/ops platform (PostgreSQL); hosts SERP sync queues, AI observability, auth bridge, and forecast caches; also a stale set of QuickBooks/Stripe/Shopify reporting mirrors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **n8n**            | Self-hosted automation platform (`n8n.sugarwish.com`); runs Slack alerts, inventory sync, and the code-generated Darklaunch Drift Monitor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Forecast / Inventory Terms

- **Forecast / Supplier Forecast** = the 25-week (some sources ~60-week) RM-demand planner (SERP Forecast app, teal sidebar, `serp.sugarwish.com/forecast/live-products`).
- **PTK / product_type_key** = a `"ProductType|Size"` grouping string; dashboard and `sa_projections.sql` must produce IDENTICAL strings or demand won't roll up. Popcorn sub-brands "City Pop"/"Poppin & Mixin" normalize to "Popcorn". `rm_weekly_demand_cache` uses plural `product_type_keys`.
- **Drop level** = inventory floor at/below which a SKU is auto-disabled. **Threshold** = alert trigger, typically ≈2× drop_level.
- **Core SKU** = must stay live (`receiver_products.sku_type='core'`, `is_core=1`, ~220–275 SA SKUs). **Seasonal** (`sku_type='seasonal'`) and **Legacy** (`sku_type='legacy'`, default) run out and are not reordered; legacy is excluded from the core %. Business rule: `is_core` must equal `(sku_type=='core')`, enforced in app code only (helper `core_flag_for_sku_type`), no DB trigger; one live exception (product_id 4177, SA-46-033).
- **Equivalency ratio** = cost-normalization multiplier per product type so executives can compare across lines (Candy & Snacks = 1.0 baseline, Popcorn = 0.5, Gourmet Pantry / Spa ≈ 0.75, Wine/Gift Sets TBD).
- **Inventory Days** = current inventory / (L7D Use / 7). **packing_goal** = min SA-days for core SKUs with RM available; **purchase_goal** = min total-days for core SKUs by product line.
- **Forecast color code (live-products):** GREEN=inventory available; ORANGE=manufactured (SA) runs out but raw material (RM) remains; YELLOW=on-hand runs out but incoming PO hasn't arrived; RED=all runs out.
- **EW** = Englewood, CO warehouse (location_id 1, default; HQ 8450 Highfield Pkwy Ste 100, Englewood CO 80112). **TY** = Taylor, MI warehouse (location_id 2; 21740 Trolley Industrial Dr Ste 5, Taylor MI 48180). EW/Stock/Fulfillment = location_id 2008, TY/Stock/Fulfillment = 2006, Wine/WCC = 5. 8 Laravel fulfillment "locations": 1=Englewood, 2=Taylor, 3=City Pop, 4=Simple Times, 5=WCC, 6=Vista, 7=Becket and Quill, 8=Poppin & Mixin.
- **Shipper** = the corrugated **outer** mailing box (sizes by pick-count: 2-/4-/8-/12-pick(XL)/grand/mini); chronic stockouts are tracked separately from product stockouts.
- **sw_fulfill** = SugarWish-in-house vs vendor fulfillment flag (1 = in-house assembles & ships, 0 = vendor/dropship, NULL = legacy/unknown). NOT a shipping/label status.
- **is_printed** = production-slip/label state (0/1 normal printed states; 2 = "Issue" from PDF-cron failure / missing boxcard or hi-res image; 3 = address/label-blocked or On Hold queue; 5 = added to print group). Multi-state integer, not a boolean.
- **Production slip** = the warehouse pick/pack sheet (PDF), batch-printed/merged; custom items get a 2-page slip (product slip + sleeve slip).
- **Sleeve** = printed cardboard wrap around a gift box (`branding_records.physical_branding`); matched by `buyer_product_id` (= `ec_order.size`) against `entries[].buyer_product_ids[]`. Jason calls custom sleeves "the biggest near-term revenue opportunity." Launched as a consumable with NO inventory tracking (Feb 2026); ~$2–5 each, MOQ ~1000, ~7–9 days after art approval.

### Kit / BOM Vocabulary

- **Kit** = a bundle/assortment. In Laravel = phantom-BOM-equivalent recipe (`kits` + `component_kits`); 89% of kits contain just 1 component (the colored box B-\*).
- **BOM (Bill of Materials)** = component recipe. **Normal BOM** = real manufacturing via a Manufacturing Order (MO); **Phantom BOM** = kit that explodes into components at sale/delivery (no MO). Carolyn Pardee: "Kits and BOMs are the same thing when it comes to Odoo" — but architecturally **additive/complementary**: Odoo phantom BOMs cover everything EXCEPT the colored box (S-/P-/I-/E-/L-/T-/C-), Laravel kits cover ONLY the colored box (B-).
- **MO (Manufacturing Order)** = `mrp.production`; instruction to produce a qty via a normal BOM (RM→SA). Phantom BOMs create zero MOs.
- **Prelist** = a "soft"/intent MO — a product SugarWish has the raw material (RM) for and wants to make sellable (SA) live on the website **before the real MO is actually cut**. It records the build intent (product + qty against the exact BOM) so the SA can go live now; a real `mrp.production` MO is cut later, and the PO-create flow offers to unbuild matching prelists alongside MOs. Tracked in a `serp_app` prelist table (SERPY op + serp_app feature, branch `feature/coverage-goal-na`, June 2026).
- **Component** = an individual item in a recipe (raw material or packaging). **Receiver product** = an individual flavor/item the recipient picks. **Buyer product** = the box/credit/SKU the sender buys.
- **City Pop / Poppin & Mixin** = popcorn vendor sub-brands; normalize to "Popcorn" in PTK but split as `Popcorn@CityPop` vs `Popcorn@Poppin` in forecast (Jack explicitly does NOT collapse Popcorn).
- **Bakery & Cafe split** = product_type 567 split into `Bakery&Cafe@EW` / `Bakery&Cafe@TY` in SERP forecast (location-driven).

### Order / Fulfillment Terms

- **Receiver order** = recipient redeems an eCard and chooses treats (order numbers start with **200**; `sw_id < 600,000,000`; bridges to Odoo via `ec_order`).
- **Preselect / Prepick / wholesale** = buyer pre-selects contents AND recipient address up front (order numbers start with **6000**; `sw_id ≥ 600,000,000`; bridges via `preselect_order_id`, NOT `ec_order`).
- **Sweet-shoppe / Sweetificate order** = self-purchase / recipient-selectable types (`items.order_type='sweet-shoppe-order'`; `preselect_orders.type` enum `preselect`/`sweet-shoppe`/`sweetificate`).
- **Merchandise order** = a distinct `order_type` SERP handles natively (`inventory_source='serp'`), JSON-driven (branding_record = offered, `ec_order.merchandise_selections` = chosen).
- **eCard** = the digital gift sent to a recipient (`giftcards_card` row, pre-redemption). **Redemption** = recipient picks the gift (creates `ec_order`); products are resolved at **redemption time**, not creation — so historical/consolidated SKUs must be backfilled.
- **Cancel and credit** = the default "undo" — 90% account credit (minus 10%), NOT a card refund. **Refund** = the rarer money-back-to-card path. **Redeem only** = pay 10% upfront, 90% on redemption only (not eligible for 90% credit if cancelled before redemption).
- **Placeholder order** = a pre-picked order parked because its SKU is OOS, auto-filed to `#placeholder-orders` for manual warehouse placement. **Replacement order** = reshipment of a lost/damaged/wrong item via `sugarwish.com/products/replacement`.
- **Shop / Shopped** = warehouse jargon for picking/packing a gift order (NOT customer-facing shopping).
- **Glitch** = an operational incident (non-dev staff file it; devs replicate, then a separate **Bug** ticket must be Product-prioritized). **Feature** = a new-capability request.
