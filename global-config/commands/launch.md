# Command: launch

`/launch` is **the fix-launcher that keeps the original tab open.** It opens a real Claude Code session in the right repo (new VS Code terminal tab, that repo's native commands + MCP tools) and kicks off the work there. It reuses all of `/go`'s routing/intake machinery, with three differences: it does **NOT** close the tab you ran it from, it can **launch several sessions at once**, and for SERP it fires the **implement/analyze** pipeline (a change) rather than `/go`'s research-only pass.

Use `/launch` when the fix is already scoped (typically right after a `/go` research pass) and you want to spin it off into its own tab while staying where you are. `/go` finds the problem (research, then offers to launch fixes); `/launch` builds it — `/implement` by default, or `/analyze` when you say `analyze`. (`/go` closes the originating tab once the new one opens; `/launch` leaves it open.)

## Usage

```
/launch <scoped fix>            # SERP → /implement (fix already researched); THIS tab stays open
/launch analyze <task>          # SERP → /analyze (full research+approval+implement pipeline)
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
- **Step 2 (build the first prompt)** — for SERP, pick the command by intent (see Difference 3): **`/implement <task>`** by default (the fix is already scoped) or **`/analyze <task>`** when the request says `analyze` (full research+implement pipeline). SWAC impl → `/global-analyze <task>`. Pure research → the research/answer prompt.

### Difference 3 — SERP fires `/implement` by default, `/analyze` on the `analyze` keyword

`/launch` is primarily the **"the fix is already scoped, go build it"** entry point — you usually reach it after a `/go` research pass surfaced the issue(s). So for a **SERP** task, choose the first prompt by intent:

- **Default → `/implement <task>`.** `/launch fix the copier cap` → `/implement cap the copier…`. Skips the research swarm, goes straight to a quick approval gate → build → PR using the same implementation skills `/analyze` uses. The research already happened upstream; don't pay for it twice.
- **`analyze`/`research`/`investigate` in the request → `/analyze <task>`.** `/launch analyze the forecast zeros` → `/analyze the forecast zeros…`. Runs SERP's full research-swarm → approval gate → implement pipeline in the launched session. Use this when you want the deep investigation to happen **in the new tab** (rather than via `/go`) and then flow straight into the fix — e.g. you want it researched _and_ built without bouncing back to the hub. Strip the leading `analyze`/`research`/`investigate` keyword from the task text before passing it to `/analyze`.

SWAC implementation always uses `/global-analyze` (SWAC has no separate `/implement` or `/analyze`); the `analyze` keyword is a no-op there since `/global-analyze` already researches first. Pure research tasks (a question, no fix) still use the plain research/answer prompt regardless of repo.

### Difference 1 — pass `--keep-original` so this tab is NOT closed

When you call the launcher (Step 3), **add the `--keep-original` flag**:

```bash
~/.claude/scripts/launch-repo-session.sh <REPO_ROOT> --keep-original "<first-prompt>"
```

That flag tells the launcher to leave `CLOSE_TTY` empty, so the Go Launcher extension opens the new tab but leaves the originating tab open. Everything else (descriptive tab name derived from the prompt, the new session updating its own title `🔍→🙋→✅` then auto-closing itself) is unchanged. **Do NOT add `--label` or call `set-tab-title.sh` yourself** — same rule as `/go`.

### Difference 2 — one terminal PER fix when given multiple

When the request covers **several issues/fixes** — `/launch fixes for those`, `/launch fix X ; add Y`, "launch a session for each of these", "spin up sessions for A, B, and C" — the default is **one terminal per fix** (each gets its own tab so they build, PR, and merge independently). **But you do NOT launch straight away** — you first run the **file-overlap coalescing gate** below, which decides how many tabs there actually are. Only after the gate do you **route and classify each group on its own** (each may land in a different repo / mode) and **call the launcher once per group** (parallel `Bash` calls, don't babysit).

> ⚠️ The instinct to "combine two related fixes into one `/analyze` session" is **wrong here.** "Launch fixes for those" with N issues = **N terminals** — UNLESS two of them edit the same file(s), in which case those specific ones coalesce (the gate below).

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
