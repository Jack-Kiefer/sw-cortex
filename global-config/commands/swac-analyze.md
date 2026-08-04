# Command: swac-analyze

Deep **WishDesk (SWAC)** research → build using agent teams (swarms). This is SWAC's research-then-build pipeline — the SWAC counterpart to SERP's `/serp-analyze`. It researches the WishDesk codebase + data, presents a plan for approval, then (on "implement") builds on an isolated worktree, stands up a dev server so Jack can SEE the change, and **stops for "ship it"** rather than opening a PR itself.

---

description: WishDesk research → build using agent teams — parallel teammates over the desk/proposal/sleeve/CRM subsystems, then a worktree+dev-server build that waits for "ship it".

---

# WishDesk Research Request: $ARGUMENTS

This command is **SWAC-only** — it assumes a WishDesk session (root `…/SWAC`; `SWAC` IS WishDesk). It is the command `/go` and `/launch` fire for an actionable SWAC task. For a pure SWAC question (nothing to build) use `/research` instead; for SERP work use SERP's own `/serp-analyze`.

## Step 0: Options-first intake (ALWAYS, before spawning the team)

**Invoke the `options-first-intake` skill** and follow it (the AskUserQuestion mechanics + the 5 shared rules + fold-picks into `$ARGUMENTS`). The second axis here is **APPROACH** — distinct candidate angles/fixes as separate options, alongside SCOPE (the real WishDesk area/page/system/table/file). Do the cheap recon first (a KB search, a glance at the relevant code/tables) so the options are concrete, and **scope it against the WishDesk subsystem map below** — name the actual desk/proposal/sleeve/CRM area, not a generic "the app".

### WishDesk subsystem map (use this to scope)

| Area                   | What lives there                                                                | Typical tables / files                                             |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Desk / CS / CRM**    | WishDesk admin console, agents, tickets, the email/SWIM assistant               | `swcrm_*`, `orders_tickets`, `sw_billing_tickets`, `swcrm_actions` |
| **Proposals**          | proposal builder, revision chains, locked versions                              | `proposals`, proposal builder UI                                   |
| **Sleeves / branding** | sleeve **resolution** + branding data (the side that feeds livery's PDF render) | `branding_records`, `physical_branding`, `sleeve-resolution.ts`    |
| **Receiver app**       | customer-facing receiver flows, redemption, quiz                                | receiver app, `system_settings`, quiz-config                       |
| **Auth / app shell**   | cookie sessions, agent-vs-admin route guards, Drizzle/Express backend           | `server/auth-middleware.ts`, route guards                          |
| **Design consumption** | how WishDesk consumes sw-design assets (ecard/box/genie)                        | `system_settings`, sync-in, quiz-config                            |

> Read-only neighbors: **livery** RENDERS the sleeve/slip PDF and **sw-design** owns the design pipeline — both are read-only. When a SWAC task points at one of them, the part you actually change is the SWAC-side resolution/consumption, not the neighbor.

## WishDesk environments & data

- **Local app:** from `…/SWAC`, `npm run dev` → `http://localhost:5003` (cookie sessions, NOT JWT). Dev fixture login `admin` / `swdev123`, or set `APP_ENV=local` + `ENABLE_LOCAL_AUTH_BYPASS=true` to skip login. Helper scripts: `./start-local.sh`, `./restart-dev.sh`.
- **Hosted tiers:** `desk.sugarwish.com` (live, branch `live`), `desk3.sugarwish.com` (staging, `staging`), `desk2.sugarwish.com` (dev, `development`). SWAC ships **dev → staging → live**; branches are `<username>/<desc>` (e.g. `jack/WW-065-ideas-web-ui`).
- **Timestamps are Mountain Time**, not UTC (true everywhere in WishDesk).

## Model Strategy

- **Lead (you)**: Opus — for coordination and synthesis.
- **Teammates**: cost-efficient models per the `research-team` skill's roster table (haiku for fast MCP-bound researchers, sonnet for web/codebase). The skill owns the per-role model choice — follow it rather than forcing one model.

---

## Step 1: Run the WishDesk research swarm — as a cheap-fleet Workflow

**Fan the research out as a `Workflow`, built per the `workflow-authoring` skill** — a large CHEAP fleet (haiku for MCP/schema/KB-bound angles, sonnet for heavier ones) at `effort: 'low'`, structured as a `pipeline()` so one slow researcher never stalls the rest (`.catch(() => null)` each, synthesize on the survivors), with Opus reserved for the single synthesis pass. Fan out over the WishDesk angles the scope named (desk/CRM, proposals, sleeve resolution, receiver app, auth/app-shell, design consumption) — one small agent per angle, split a broad angle into two rather than widening one. The Workflow returns a structured findings object; you (Opus) then synthesize + present exactly as below. The Workflow does **research only** — it can't pause for approval or build, so the approval gate (Step 5) and the worktree+dev-server build stay in this interactive session unchanged.

**Fallback:** if the `Workflow` tool isn't available in this session, **invoke the `research-team` skill** instead and follow it — same cheap-fleet philosophy via Task-team primitives: parallelize by default (≥2, cap 4), roster chosen from what THIS task needs (codebase-researcher always, +context/db/web as warranted), time-box every researcher, poll via `TaskList`/`TaskGet`, `TaskStop` any that overruns.

**Also invoke the `wishdesk-analyze-extras` skill** (it lives in the SWAC repo) alongside it — it supplies WishDesk's tools (`mcp-db-tool`/`mcp-db-tool-live`, **not** the hub's generic `mcp__db`), the env tiers above, and the desk/proposal/sleeve subsystem detail the researchers should use. If that skill isn't available in this session (e.g. you're running from the hub rather than a real SWAC session), fall back to the generic core — the hub's `mcp__db` (database `wishdesk` / `wishdesk_dev`), `mcp__knowledge`, and `mcp__slack-search` — and lean on the subsystem map above.

Point researchers at the WishDesk subsystem(s) the scope named — desk/CRM, proposals, sleeve resolution, the receiver app, auth/app-shell, or design consumption — rather than the whole codebase.

## Step 3: Synthesize Progressively

Integrate findings as each researcher reports; start drafting after 2–3 core reports (the `research-team` skill governs the poll/stop loop and the "found it early → shut down silently" rule). Combine into: what was discovered per angle → recommendation → implementation steps → risks/open questions.

---

## Step 4: Save Key Insights

If the research surfaced durable SugarWish ground truth (a WishDesk gotcha, ownership fact,
schema quirk — e.g. a sleeve-resolution edge case or a `swcrm_*` quirk), add it to
`sw-cortex/DICTIONARY.md` — the knowledge MCP indexes it automatically. Skip this for
task-specific findings.

---

## Step 5: Shut Down Team & Present Results

**Invoke the `presenting-analysis` skill** and follow it — it owns the capped "Analysis Complete" template (Findings · Recommendation · Plan · Implementation Map · Risks), the say-it-once output discipline, and the closing `approval-block` gate (the LAST text of the turn, then STOP). Shut the team down **before** presenting (the `research-team` skill's silent-teardown rule — `TaskStop` each member, then `TeamDelete`; never narrate it).

Close on the `approval-block`, not a bare "Say implement" line — state what's being approved and end on `Ready to implement? Say "implement" and I'll build this.` as the action question.

---

## If User Says Implement — the SWAC build contract (worktree → dev server → STOP for "ship it")

⚠️ **SWAC's implement step differs from SERP on purpose. Do NOT open a PR here.** A SWAC build must run on an **isolated worktree+branch**, stand up a **dev server so Jack can SEE the change**, then **STOP and wait for Jack to say "ship it"** (which runs `/ship-it`). This is the SWAC worktree+dev-server+wait-for-"ship it" contract — apply it to every SWAC implement, not just when asked.

1. **Worktree + branch.** Build on an isolated SWAC worktree on a `<username>/<desc>` branch (carry any `WW-###` ticket into the branch name + PR, e.g. `jack/WW-065-ideas-web-ui`). Never build on the SWAC working copy's main checkout.

2. **Create the impl team** (only the roles the work actually needs):

   ```
   Create an agent team called "impl-team" to implement: $ARGUMENTS

   Use Sonnet for all teammates (model: "sonnet").
   ```

   - **backend-dev**: Drizzle/Express backend, API routes, server logic
   - **frontend-dev**: desk console / proposal builder / receiver UI
   - **db-dev**: schema / migrations (WishDesk MySQL)
   - **test-dev**: Jest tests (`npm run test:e2e` / `npm run test:fast` — already headless)

   Each teammate works in their own area (no file conflicts), uses `model: "sonnet"`, reports completion to the lead, and stops fast if their area has no work. Apply progressive synthesis — start integrating as work comes in, don't block on all teammates.

3. **Verify:** type checks, lint, and SWAC's Jest suite (`npm run test:e2e` / `npm run test:fast`) pass. Confirm login/behavior against the running dev server with curl if it's a backend/auth change (cookie-session login at `http://localhost:5003/api/login`).

4. **Stand up the dev server** (`npm run dev` from the worktree, or `./restart-dev.sh`) so Jack can SEE the change at `http://localhost:5003`, then **STOP**. Tell Jack what to look at and wait. Do **not** push or open a PR.

5. **On "ship it":** run `/ship-it` (`swac-ship-it`) — it handles the SWAC commit + PR (dev → staging → live) and cites any `WW-###` ticket in the branch/PR.
