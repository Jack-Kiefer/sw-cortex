# Command: go

The **one command for everything.** Describe a task; `/go` figures out which of your writable projects it belongs to, opens a **real Claude Code session in that project** (a new VS Code terminal tab, named for the project, with that repo's full native commands + MCP tools), and hands the task to it.

`/go` ALWAYS lands you in a writable repo — **SERP, SWAC, or sw-cortex**. If a task is really about a read-only repo (livery, sugarwish-laravel, sw-design, swirl, sugarwish-infrastructure), it routes to the writable repo where you'd actually make the change, because that's where the work lives.

## Usage

/go <task description>

Examples:

- `/go fix the forecast zeros on live-products` → SERP
- `/go the proposal sleeve isn't resolving for medium boxes` → SWAC (sleeve resolution is SWAC's; livery only renders)
- `/go add a column to the orchestrator command table` → sw-cortex

---

# Route & launch: $ARGUMENTS

## Step 1 — Pick the writable repo (no questions; decide and go)

Choose exactly ONE of SERP / SWAC / sw-cortex from the task text. Use this mapping (the read-only repos resolve to the writable repo that owns the change you'd make):

| Task is about…                                                                                                                    | Open this writable repo |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| forecast, supplier, kits, Odoo BOM/parity, darklaunch, SERPY, inventory ERP, sync queue, MO/PO/costing                            | **SERP**                |
| anything in **Odoo** or **sugarwish-laravel** (read-only) that you'd fix on your side — order sync, `serp_*` ingestion, ERP logic | **SERP**                |
| sleeve **resolution**, proposals, WishDesk CS/CRM, receiver app, mug-image review                                                 | **SWAC**                |
| sleeve/slip **PDF imposition/printing** in **livery** (read-only) — the part you'd touch is the resolution/data feeding it        | **SWAC**                |
| ecard/box/genie design assets in **sw-design** (read-only) — the part you'd touch is how SWAC consumes them                       | **SWAC**                |
| this tooling, the hub, MCP servers, global config, n8n exports, the slash commands themselves                                     | **sw-cortex**           |

If genuinely split across two writable repos, pick the one with the larger/primary change and mention the other in your one-line note. Only ask Jack if it's truly 50/50 and consequential.

Repo roots:

- SERP → `/Users/jackkief/Desktop/Projects/SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex`

## Step 2 — Launch a real session in that repo

Run the launcher with the chosen repo, its label, and the task as the initial prompt:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --label <SERP|SWAC|sw-cortex> "$ARGUMENTS"
```

It opens a new VS Code terminal tab, sets the tab title to `📁 <repo>`, and starts `claude` there with the task. That new session has the repo's native commands + MCP tools (which the hub doesn't).

## Step 3 — Report

- **One line** stating which repo you routed to and why (e.g. "Routed to **SERP** — forecast/darklaunch work; opening a SERP session tab.").
- **On launch success** ("Opened a new VS Code terminal tab (…)"): tell Jack to switch to the new `📁 <repo>` tab — that's where the work happens, with full native tooling. This hub session stays put.
- **On launch failure** (Accessibility fallback printed): relay the paste-able `cd … && claude …` command verbatim and note he can either grant VS Code Accessibility (System Settings → Privacy & Security → Accessibility) and re-run `/go`, or paste the command into a new terminal himself. Never claim it launched if it didn't.

`/go` does NOT do the work itself — it routes and launches. The real work happens in the project session it opens.

## Plain-English equivalent (no slash needed)

When Jack asks conversationally to "fix X in a new go", "spin up a session for X", "open a session to do X", or similar — treat it EXACTLY like `/go X`: detect the writable repo and run the launcher immediately, no confirmation. Then report which repo + tell him to switch to the new tab. This is standing hub behavior, not just a one-off.

**Fire-and-forget / parallel:** "launch that idea in a go and keep going", "spin that off in a go and continue", etc. mean: run the launcher for that idea AND immediately resume whatever you were doing in THIS session — do not block, do not wait on the new session, just hand the idea off as a parallel worker and continue your current task. The new tab works the idea on its own; the hub stays on its current thread. Acknowledge the launch in one line, then carry on.
