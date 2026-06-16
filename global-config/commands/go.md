# Command: go

The **one command for everything.** `/go` opens a **real Claude Code session in the right project** (a new VS Code terminal tab, labeled for the project, with that repo's full native commands + MCP tools) and — unless you only named a repo — kicks off the proper analysis on your task there.

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. Tasks that are really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure) route to the writable repo where you'd actually make the change.

## Usage

```
/go <task description>   # detect repo → open its session → run the repo's analyze on the task
/go serp                 # bare repo name → JUST open a SERP session, no analyze, no task
/go swac                 # JUST open a SWAC session
/go cortex               # JUST open a sw-cortex session
```

Examples:

- `/go fix the forecast zeros on live-products` → opens SERP, runs `/analyze fix the forecast zeros…`
- `/go the proposal sleeve isn't resolving for medium boxes` → opens SWAC, runs `/global-analyze …`
- `/go serp` → opens a bare SERP session, nothing else

---

# Route & launch: $ARGUMENTS

## Step 0 — Bare repo name? Just launch it.

If `$ARGUMENTS` is ONLY a repo name (serp / swac / wishdesk / cortex / sw-cortex, case-insensitive) with no task, open that repo's session **bare — no analyze, no prompt**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --label <LABEL>
```

(`wishdesk` → SWAC.) Report which repo opened, tell Jack to switch to the new tab, done. Skip the rest.

## Step 1 — Otherwise, pick the writable repo (no questions; decide and go)

Choose exactly ONE of SERP / SWAC / sw-cortex from the task. Read-only repos resolve to the writable repo that owns the change:

| Task is about…                                                                                                               | Repo          |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| forecast, supplier, kits, Odoo BOM/parity, darklaunch, SERPY, inventory ERP, sync queue, MO/PO/costing                       | **SERP**      |
| anything in **Odoo** or **sugarwish-laravel** (read-only) you'd fix on your side — order sync, `serp_*` ingestion, ERP logic | **SERP**      |
| sleeve **resolution**, proposals, WishDesk CS/CRM, receiver app, mug-image review                                            | **SWAC**      |
| sleeve/slip **PDF imposition/printing** in **livery** (read-only) — the part you'd touch is the data/resolution feeding it   | **SWAC**      |
| ecard/box/genie design assets in **sw-design** (read-only) — the part you'd touch is how SWAC consumes them                  | **SWAC**      |
| this tooling, the hub, MCP servers, global config, n8n exports, the slash commands themselves                                | **sw-cortex** |

If genuinely split across two writable repos, pick the primary and mention the other in your one-line note. Only ask Jack if it's truly 50/50 and consequential.

Repo roots & labels:

- SERP → `/Users/jackkief/Desktop/Projects/SERP` · label `SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC` · label `SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex` · label `sw-cortex`

## Step 2 — Build the analyze prompt for that repo

The new session should START by analyzing the task. The analyze command DIFFERS by repo:

| Repo                | First prompt the session runs                           |
| ------------------- | ------------------------------------------------------- |
| **SERP**            | `/analyze <task>` (SERP's local research-swarm analyze) |
| **SWAC** (WishDesk) | `/global-analyze <task>`                                |
| **sw-cortex**       | `/analyze <task>` (sw-cortex's local analyze)           |

So the initial prompt passed to the launcher is the analyze command + the task, e.g. for a SERP task: `/analyze fix the forecast zeros on live-products`.

## Step 3 — Launch

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --label <LABEL> "<analyze-command> <task>"
```

It opens a new VS Code terminal tab titled `[<repo>]` and starts `claude` there with that prompt — so the session comes up and immediately runs the repo-appropriate analyze on your task.

## Step 4 — Report

- **One line**: which repo you routed to and why (e.g. "Routed to **SERP** — forecast/darklaunch; opening a SERP tab running `/analyze`.").
- **On success** ("Opened a new VS Code terminal tab (…)"): tell Jack to switch to the new `[<repo>]` tab — that's where it's analyzing, with full native tooling. This hub session stays put.
- **On failure** (Accessibility fallback printed): relay the paste-able command verbatim; note he can grant VS Code Accessibility (System Settings → Privacy & Security → Accessibility) and re-run, or paste it himself. Never claim it launched if it didn't.

`/go` does NOT do the work itself — it routes, launches, and starts the analyze. The real work happens in the project session.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally — "fix X in a new go", "spin up a session for X", "open a session to do X", "just open serp" — treat it EXACTLY like `/go`: same routing, same bare-vs-task logic, same per-repo analyze, run the launcher immediately, no confirmation.

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off and continue" mean: run the launcher AND immediately resume whatever you were doing in THIS session — don't block on or babysit the new session. It works in parallel; the hub stays on its thread. Acknowledge in one line, carry on.
