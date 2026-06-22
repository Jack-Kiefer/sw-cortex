# Command: launch

`/launch` is **the fix-launcher that keeps the original tab open.** It opens a real Claude Code session in the right repo (new VS Code terminal tab, that repo's native commands + MCP tools) and kicks off the work there. It reuses all of `/go`'s routing/intake machinery, with three differences: it does **NOT** close the tab you ran it from, it can **launch several sessions at once**, and for SERP it fires **`/implement`** (build the scoped fix) by default — or **`/research`** when you only want to investigate in the new tab.

Use `/launch` when the fix is already scoped (typically right after a `/go` or `/research` pass) and you want to spin it off into its own tab while staying where you are. `/launch` runs **`/implement` by default** (build the scoped fix → PR), or **`/research`** when you say `research`/`investigate` (investigate in the new tab, report, stop — no build). (`/go` closes the originating tab once the new one opens; `/launch` leaves it open.)

## Usage

```
/launch <scoped fix>            # SERP → /implement (fix already researched → build → PR); THIS tab stays open
/launch research <task>         # SERP → /research (investigate in the new tab, report, stop — no build)
/launch serp                    # bare repo name → JUST open a SERP session, original tab stays
/launch swac
/launch cortex
/launch <task A> ; <task B>     # launch several at once — one new tab per task, original tab stays
```

## How it works — same as `/go`, three differences

Follow **the entire `/go` command spec** for classification, options-first intake, routing, and prompt-building — `/launch` reuses all of it. Specifically:

- **Step 0 (bare repo name)** — same: bare `serp`/`swac`/`cortex`/`wishdesk` just opens that repo's session.
- **Step 0.5 (options-first intake via `AskUserQuestion`)** — same: turn the task into pickable scope/approach options before launching, folding picks into the task string. (For a multi-launch, ask per task only where it's genuinely ambiguous — don't over-prompt.)
- **Step 1 / 1.6 (route to SERP/SWAC/sw-cortex; classify research vs implementation)** — same.
- **Step 1.5 (routed to sw-cortex)** — same: do it INLINE in this hub session, do NOT open a new terminal. (`/launch` on a sw-cortex task changes nothing — the hub already has everything; no tab to keep or close.)
- **Step 2 (build the first prompt)** — for SERP, pick the command by intent (see Difference 3): **`/implement <task>`** by default (the fix is already scoped) or **`/research <task>`** when the request says `research`/`investigate` (investigate in the new tab, stop — no build). SWAC impl → `/global-analyze <task>`. Pure research (any repo) → `/research <task>`.

### Difference 3 — SERP fires `/implement` by default, `/research` on the `research`/`investigate` keyword

`/launch` is primarily the **"the fix is already scoped, go build it"** entry point — you usually reach it after a `/go` or `/research` pass surfaced the issue(s). So for a **SERP** task, choose the first prompt by intent:

- **Default → `/implement <task>`.** `/launch fix the copier cap` → `/implement cap the copier…`. Skips the research swarm, goes straight to a quick approval gate → build → PR using the implementation skills. The research already happened upstream; don't pay for it twice.
- **`research`/`investigate` in the request → `/research <task>`.** `/launch research the forecast zeros` → `/research the forecast zeros…`. Runs the research swarm in the launched session, presents findings, and **stops** — no build, no PR. Use this when you want the deep investigation to happen **in the new tab** without bouncing back to the hub, and you're not ready to build yet. Strip the leading `research`/`investigate` keyword from the task text before passing it to `/research`. (`/launch` no longer fires `/analyze` — research-then-build-in-one-shot is `/go`'s `/analyze` path; `/launch` is build-the-scoped-fix or research-only.)

SWAC implementation always uses `/global-analyze` (SWAC has no separate `/implement`); a `research`/`investigate` SWAC task uses `/research` (the generic research command works in any repo session). Pure research tasks (a question, no fix) use `/research <task>` regardless of repo.

#### SWAC-only implement flow — worktree + dev server, NO auto-PR, wait for "ship it"

> ⚠️ **This is the SWAC implement contract and it differs from SERP on purpose.** SERP `/implement` builds → verifies → opens a PR in one shot. SWAC does NOT — a SWAC implement launch must work on an isolated worktree+branch, stand up a dev server so Jack can SEE the change, then STOP before any PR and wait for Jack to say "ship it" (then run `/ship-it`). Apply this to **every** SWAC implement launch (the `/global-analyze` "If User Says Implement" step), not just when asked.

When the launched SWAC session reaches the **implement** step (after its `/global-analyze` research + Jack approving the build), it MUST:

1. **Make a worktree + feature branch** off `development` (do NOT edit the main SWAC checkout). Branch name is `<username>/<desc>` per SWAC convention (`jack/<kebab-desc>` — derive `<desc>` from the task; use SWAC's `/create-worktree` convention). **If a WishWorks ticket ID (`WW-###`) was carried in** (a `/go <ticket>` launch — see `/go` Step 0.1), put it in the branch name: `jack/WW-###-<desc>`:
   ```bash
   # with a ticket:    BR=jack/WW-065-ideas-web-ui ; WT=../SWAC-WW-065
   # without a ticket:  BR=jack/<desc>             ; WT=../SWAC-<desc>
   git -C /Users/jackkief/Desktop/Projects/SWAC worktree add "$WT" -b "$BR" origin/development
   cd "$WT"
   cp /Users/jackkief/Desktop/Projects/SWAC/.env .env && npm install
   ```
2. **Implement the change in that worktree** (all edits land on the new branch, never on `development` or the main checkout).
3. **Start a dev server in the background on a free port** so Jack can see it, then print the URL:
   ```bash
   PORT=$(node -e 'const n=require("net");const s=n.createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')
   PORT=$PORT npm run dev   # run in the background; SWAC reads PORT from validated env (default 5004)
   ```
   Report the live URL (`http://localhost:<PORT>`) and tell Jack to open it to review the change.
4. **STOP. Do NOT commit a PR, do NOT run `/ship-it`, do NOT push.** Set the tab title to `🙋 review · <desc>` and wait. Present what changed + the localhost URL and say: _"Review it at the URL — say **ship it** when you're happy and I'll run `/ship-it`."_
5. **Only when Jack says "ship it"** (or "ship", "ship-it", "lgtm ship") does the session run SWAC's existing **`/ship-it`** command from the worktree — which commits everything, writes the change log, runs PR review, and opens the PR. Nothing ships before Jack says so. **If a `WW-###` ticket was carried in, make sure the PR title/body references it** (and `/ship-it`'s change log cites it under "Documentation / Jira tickets") — the branch already carries `WW-###`, so the PR should too.

So the SWAC implement first-prompt Jack's launch builds should explicitly carry this flow. Append this rider to the SWAC implement prompt:

> Implement on a NEW worktree+branch (`jack/<desc>` off `origin/development` — if this work has a `WW-###` ticket, name the branch `jack/WW-###-<desc>` and reference `WW-###` in the eventual PR), not the main SWAC checkout. After implementing, start `PORT=<free> npm run dev` in the background and give me the localhost URL so I can see it. Then STOP — do NOT open a PR, do NOT run /ship-it, do NOT push. Wait for me to say "ship it"; only then run the /ship-it command from the worktree.

### Difference 1 — pass `--keep-original` so this tab is NOT closed

When you call the launcher (Step 3), **add the `--keep-original` flag**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --keep-original "<first-prompt>"
```

That flag tells the launcher to leave `CLOSE_TTY` empty, so the Go Launcher extension opens the new tab but leaves the originating tab open. Everything else (descriptive tab name derived from the prompt, the new session updating its own title `🔍→🙋→✅` then auto-closing itself) is unchanged. **Do NOT add `--label` or call `set-tab-title.sh` yourself** — same rule as `/go`.

### Difference 2 — one terminal PER fix when given multiple

When the request covers **several issues/fixes** — `/launch fixes for those`, `/launch fix X ; add Y`, "launch a session for each of these", "spin up sessions for A, B, and C" — the default is **one terminal per fix** (each gets its own tab so they build, PR, and merge independently). **But you do NOT launch straight away** — you first run the **file-overlap coalescing gate** below, which decides how many tabs there actually are. Only after the gate do you **route and classify each group on its own** (each may land in a different repo / mode) and **call the launcher once per group** (parallel `Bash` calls, don't babysit).

> ⚠️ The instinct to "combine two related fixes into one `/implement` session" is **wrong here.** "Launch fixes for those" with N issues = **N terminals** — UNLESS two of them edit the same file(s), in which case those specific ones coalesce (the gate below).

#### MANDATORY GATE — coalesce fixes that touch the same file(s) BEFORE launching

**This is not an optional exception — it is a required pre-launch step for EVERY multi-fix launch.** Skipping it is exactly what caused 6 concurrent `/implement` sessions to cross-apply edits onto each other's files (`stock_move.py`, `mrp_production_actions.py`, costing models) and contend on `.git/index.lock`. Fixes that edit the same file(s) **MUST NOT** be launched as separate parallel sessions — separate sessions edit in parallel and then both try to land on `dev`, colliding at merge (and, in a shared clone, mid-edit).

**Run this checklist before the first `launch-repo-session.sh` call. Emit each step's result so it's visible you did it:**

1. **List the file(s) each fix will touch.** From the research that produced these fixes you usually already have the `file:line` per issue. If a fix's target file is unknown, do a quick `grep`/read to resolve it — **do not guess, and do not launch a fix whose files you haven't named.**
2. **Union the fixes into groups** where any two fixes sharing **at least one file** land in the same group. (Transitively: A↔B share `stock_move.py`, B↔C share `mrp_production.py` → A, B, C are one group.) State the resulting groups explicitly.
3. **STOP-and-check:** if any two fixes you were about to launch as separate tabs share a file, they are in the same group — collapse them. The number of tabs = the number of groups, never the number of fixes.
4. **Launch one session per group.** A solo fix (no file overlap with any other) → its own tab. A group of 2+ overlapping fixes → **one tab** whose prompt lists all of them, done **sequentially in that one session** (one branch, one worktree, one PR — or staged commits). Disjoint groups still run in parallel tabs.
5. In a grouped prompt, tell the session to do the fixes **in sequence** and explain they were bundled because they share files (so it doesn't try to parallelize internally).

> Rule of thumb: **same file → same session (sequential); different files → different tabs (parallel).** This is exactly what prevents the 6-sessions-on-one-clone collision — overlapping edits never run concurrently.

So `/launch fixes for those` with fixes A (`stock_move.py`), B (`stock_move.py`), C (`stock_quant.py`) → **two** tabs: one session doing A then B (shared file), one doing C.

```bash
~/.claude/scripts/launch-repo-session.sh /Users/jackkief/Desktop/Projects/SERP --keep-original "/implement cap the darklaunch copier: ORDER BY ... DESC + COPY_LIMIT 2000→8000, regression test pinning cap > window and DESC ordering"
~/.claude/scripts/launch-repo-session.sh /Users/jackkief/Desktop/Projects/SERP --keep-original "/implement suppress product_product.create_uid/write_uid audit-column false positive in the drift classifier; test that real product drift still surfaces"
```

(A sw-cortex fix in the batch is still handled inline per Step 1.5 — no tab for it. A SWAC fix uses `/global-analyze`.)

Repo roots: SERP `/Users/jackkief/Desktop/Projects/SERP` · SWAC `/Users/jackkief/Desktop/Projects/SWAC` · sw-cortex `/Users/jackkief/Desktop/Projects/sw-cortex`.

## Step — Report

- **One line per launched session**: which repo, the mode (research/impl), and why — same format as `/go` Step 4. For a multi-launch, one line each.
- New tabs open **automatically**; each auto-closes ~5s after it reaches `✅ done`. **This tab stays open** — tell Jack to switch to the new tab(s) if he wants; this session stays put either way.
- If no tab appears, the extension may not be loaded — reload the VS Code window.

## Plain-English equivalent (no slash needed)

Treat these conversationally exactly like `/launch` — route/classify/launch like `/go`, but with `--keep-original` and don't close the current tab:

- "open a session for X **but keep this one**", "spin up X in a new tab without closing this", "launch X in the background and stay here"
- "launch a session for **each** of these", "fire off gos for A, B, and C" → multi-launch, one tab per task.

**Fire-and-forget:** these are inherently parallel — launch the session(s) AND immediately resume whatever you were doing in this session. Acknowledge in one line, carry on.

`/launch` does NOT do the work itself — it classifies, routes, and launches (keeping this tab open). The real work happens in the new session(s).
