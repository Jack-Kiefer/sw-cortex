# Command: analyze

The **single entry point** for cross-repo work from the sw-cortex hub. Auto-detects which repo(s) a task touches, loads ONLY those repos' rules, presents a plan, then executes in the writable repos and hands off the rest. There is no `/work` — `/analyze` does the routing itself.

## Usage

/analyze <task description>

---

# Task: $ARGUMENTS

This session runs from `sw-cortex` (the hub). cwd never changes. Work on other repos by **absolute path**; never `cd` a long-lived terminal into another repo or a worktree. Run all VCS ops with `git -C <repo-root> …`.

## Repo table (absolute roots)

| Repo                     | Root                                                        | Writable?    | Has `.claude/rules/`?    |
| ------------------------ | ----------------------------------------------------------- | ------------ | ------------------------ |
| SERP                     | `/Users/jackkief/Desktop/Projects/SERP`                     | ✅ yes       | yes (8 files)            |
| SWAC                     | `/Users/jackkief/Desktop/Projects/SWAC`                     | ✅ yes       | no — CLAUDE.md only      |
| sw-cortex                | `/Users/jackkief/Desktop/Projects/sw-cortex`                | ✅ yes       | yes                      |
| sugarwish-laravel        | `/Users/jackkief/Desktop/Projects/sugarwish-laravel`        | ❌ read-only | no                       |
| livery                   | `/Users/jackkief/Desktop/Projects/livery`                   | ❌ read-only | no                       |
| sw-design                | `/Users/jackkief/Desktop/Projects/sw-design`                | ❌ read-only | no                       |
| swirl                    | `/Users/jackkief/Desktop/Projects/swirl`                    | ❌ read-only | no                       |
| sugarwish-infrastructure | `/Users/jackkief/Desktop/Projects/sugarwish-infrastructure` | ❌ read-only | no (no CLAUDE.md either) |

**Writable = SERP, SWAC, sw-cortex only.** A PreToolUse guard (`repo-write-guard.sh`) hard-blocks edits/commits/pushes to any other repo — so even if routing misreads, you cannot write the wrong repo. Everything else is read-to-diagnose, hand-off-to-fix.

## Phase R — Route (auto, no confirmation)

Detect EVERY involved repo from: (a) repo names in the task, (b) file paths mentioned, (c) the system→repo map below (and the ownership/system tables in the global CLAUDE.md / DICTIONARY). Proceed without asking which repo — routing is automatic. You may READ/search across ALL detected repos to diagnose; reads are never blocked.

System→repo quick map (consult the DICTIONARY for the full picture):

- forecast / supplier / kits / Odoo BOM / darklaunch / SERPY / inventory ERP → **SERP**
- sleeve **resolution** / proposals / WishDesk CS / CRM / receiver app → **SWAC**
- sleeve/slip **PDF imposition & printing** / LogoJet / mug PDF render → **livery** (read-only → hand off)
- e-commerce orders / checkout / `ec_order` / Laravel app logic → **sugarwish-laravel** (read-only → hand off)
- ecard/box/genie design assets, `design_*` → **sw-design** (read-only → hand off)
- org knowledge / WishWorks tickets → **swirl** (read-only → hand off)
- this tooling, MCP servers, global config, n8n exports → **sw-cortex**

A single task may span repos (e.g. a missing-sleeve bug spans SWAC _resolution_ + livery _rendering_). Detect all of them.

## Phase L — Load rules (just-in-time, enumerate-or-skip)

For each detected repo, in order:

1. Read `<root>/CLAUDE.md`.
2. If `<root>/.claude/rules/` exists, read each file in it; otherwise state explicitly **"<repo>: no rules dir — CLAUDE.md only"** (do not silently imply rules were loaded).
3. Echo a one-line ACK per repo naming the exact files read, e.g. `Loaded SERP: CLAUDE.md + 8 rules (databases.md, …)`.

Load ONLY the detected repos' rules — discard any previously-loaded repo's rules when the task changes. Do not apply one repo's conventions to another (e.g. SWAC username-branches, SERP Odoo-parity, sw-cortex plan-mode/verify-app each apply only to their own repo).

DB note: from the hub, all DB access goes through `mcp__db` with the correct `database` name. A spoke CLAUDE.md may instruct a tool that isn't loaded here — translate it: swirl's `sugarwish` DB → `laravel_live`; SWAC's `mcp-db-tool` → `mcp__db` (wishdesk / laravel*live); SERP's `serp-db` → `mcp__db` with the right serp*\* database. Never run write queries against live.

## Phase P — Plan first (then stop for approval)

Present a cross-repo plan BEFORE editing: for each repo — what changes, writable vs hand-off, the branch model, and the verification step. Stop and let Jack approve (advisory-by-default). Do not auto-edit.

## Phase X — Execute, per repo

- **SERP** (writable): from the hub do a **lighter analysis** — apply the loaded SERP rules and `git -C <SERP>` for quick, well-scoped fixes. SERP's full research-swarm (the `research-team` / `creating-worktree` / `spawning-implementer` skills under `SERP/.claude/skills/`) and its live tooling (`mcp__serp-prod`, `mcp__serp-orm`, `mcp__python`, playwright) only resolve from a SERP-cwd session — there is no longer a SERP-local `/analyze` command to delegate to. For anything substantial, or any run/test/verify, tell Jack to open a dedicated SERP session: `cd /Users/jackkief/Desktop/Projects/SERP && claude`, which auto-loads those skills/MCP. Do not create SERP worktrees from the hub.
- **SWAC** (writable): lighter inline analysis using loaded SWAC rules; honor `/pre-pr`, `<username>/<desc>` branches, dev→staging→live (never `main`). `git -C <SWAC>`.
- **sw-cortex** (writable): its native flow (plan mode, `verify-app` before commit).
- **read-only repos** (laravel, livery, sw-design, swirl, infrastructure): NEVER edit. Produce a **hand-off note** printed in-session: what's wrong, file/line, and the owner to ask (from the ownership table — laravel→Seth/Manish, livery→Cris Sloan, sw-design→Jason/Clare, swirl→Jason/Anna, infra→Munyr). The guard hook backstops this if forgotten.

## Worktree safety

Resolve a worktree's owning repo with `git -C <path> rev-parse --git-common-dir`. NEVER `prune`/`remove`/`rm`/`reset` the locked SERP worktrees (`SERP/.claude/worktrees/wf_817b7ab1-a1b-*`, the agent worktree) or the sibling `serp-hotfix-mo-grounding` — they back active background jobs. Address worktrees by absolute path only.

## Tab status

At each transition run `~/.claude/scripts/set-tab-title.sh "<emoji> <status> · <slug>"` (🔍 researching / 🙋 approve? / 🔨 building / 🧪 verifying / ✅ done / ❓ blocked).
