# Command: shutdown

> **Effort:** this command is mechanical — run it at **low reasoning effort**. Sweeping worktrees is a deterministic, non-interactive script. Escalate only if something genuinely ambiguous comes up.

Sweep **all writable repos** (SERP, SWAC, sw-cortex) and shut down every worktree that **isn't in use** — kill its dev server, remove the worktree, delete its branch — leaving anything still in use untouched. The global, cross-repo version of SERP's per-worktree `/shutdown-worktree`. **Fully non-interactive: never ask Jack questions.** Safety comes from defaults, not prompts: anything in use is kept and reported.

## Usage

/shutdown # sweep SERP + SWAC + sw-cortex, remove all not-in-use worktrees
/shutdown <repo> # limit the sweep to one repo (serp | swac | cortex)

---

# Task: $ARGUMENTS

Set the title as you go (`🔍 scanning worktrees` → `🔨 shutting down` → `✅ done`): in Claude Desktop with `mcp__ccd_session_mgmt__set_session_title { session_id: "self" }`, in a terminal with `~/.claude/scripts/set-tab-title.sh`. Skip it when run as a subagent.

## 1. Build the worktree list — across writable repos, hard-skip the protected set

Writable repo roots:

- SERP → `/Users/jackkief/Desktop/Projects/SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex`
- sw-design → `/Users/jackkief/Desktop/Projects/sw-design`
- livery → `/Users/jackkief/Desktop/Projects/livery`

Skip a root whose folder doesn't exist. If `$ARGUMENTS` names one repo (serp / swac / cortex / sw-cortex / sw-design / livery, case-insensitive) limit to that root; otherwise sweep all of them.

For each root, enumerate `git -C <root> worktree list --porcelain`. A worktree is a **candidate** only if ALL of these hold — otherwise **never touch it**:

- It is **not** the main clone (its path ≠ the repo root itself).
- It is **not** `locked` (git reports `locked` for the `wf_817b7ab1-*` set).
- Its path is **not** in the protected list — hard-skip, no exceptions:
  - `…/SERP/.claude/worktrees/wf_817b7ab1-a1b-*` (the locked workflow worktrees)
  - `…/SERP/.claude/worktrees/agent-*` (the agent worktree)
  - `…/serp-hotfix-mo-grounding` (sibling hotfix worktree)
- Its path is under the repo **or** under `/tmp` / `/private/tmp` (the standard place the hub makes
  worktrees). Most worktrees live in `/tmp`, so skipping them let 3 GB sw-design worktrees pile up
  for weeks after their PRs merged.
- It is **not** the worktree the current session is working in (e.g. this run's
  `/tmp/cortex-pr-startday-<date>`).

```bash
# protected-path guard (return 0 = skip)
is_protected() {
  case "$1" in
    */.claude/worktrees/wf_817b7ab1-*|*/.claude/worktrees/agent-*|*/serp-hotfix-mo-grounding) return 0 ;;
    *) return 1 ;;
  esac
}
```

Collect the surviving candidate paths. If none, report "no removable worktrees" and stop.

## 2. For each candidate, capture state BEFORE deciding

```bash
git -C <path> status --porcelain                          # uncommitted changes?
base=$(git -C <path> rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null) # upstream
git -C <path> log --oneline @{u}..HEAD 2>/dev/null        # unpushed commits (vs its own upstream)
fe=$(grep -E '^FRONTEND_PORT=' <path>/.env 2>/dev/null | tail -1 | cut -d= -f2)
be=$(grep -E '^BACKEND_PORT='  <path>/.env 2>/dev/null | tail -1 | cut -d= -f2)
# live process/session whose cwd is inside this worktree (claude session OR dev server):
lsof -a -d cwd -p "$(pgrep -d, . 2>/dev/null)" 2>/dev/null | grep -F "<path>"   # any hit = in use
# simpler/robust: list cwd of all procs, match the path
lsof -a -d cwd 2>/dev/null | awk -v p="<path>" '$NF ~ p {print}' | head
```

## 3. "In use" gate — keep if ANY of these; never ask

A candidate is **IN USE** (keep it, do nothing to it) if ANY hold:

- `git status --porcelain` is non-empty (**uncommitted/untracked work**).
- It has commits **not on its upstream** (`git log @{u}..HEAD` non-empty), or it has **no upstream at all** (never pushed) and has its own commits vs the base branch.
- A **dev server is running** in it (a pm2/node process whose cwd is inside `<path>` — see step 2's `lsof` cwd match).
- A **live claude session** has its cwd inside `<path>` (same `lsof` cwd match catches a `claude` process there too).

Otherwise it is **NOT IN USE** → proceed to tear it down (steps 4–6). When in doubt, keep — and say why in the report.

### 3b. Stale dev server — stop it, keep the worktree

A running pm2 server alone must not keep a worktree "in use" forever: that is circular, and
week-old SERP servers (~1–3 GB each) are what push this 16 GB Mac into swap exhaustion. For a
worktree that is kept, check whether its only live-use signal is an **idle pm2 server**:

- no live `claude` process has its cwd inside `<path>`, **and**
- no unpushed commits (`git log @{u}..HEAD` empty), **and**
- the pm2 app for `<path>` (matched by `pm_cwd`) has been up **≥ 5 days**.

If all three are true, run `pm2 stop <app>` (**stop, never `delete`**, so `pm2 start <app>` brings it back), and leave the
worktree and branch alone. Report it as `stopped stale server: <app> (up Nd)`. When
unsure whether a peer session is using the server, keep it running.

### 3c. Idle kept worktree — delete its `node_modules`, keep the work

Each worktree carries its own `node_modules` (~1 GB for SERP, ~3 GB for sw-design), and kept
worktrees are mostly kept for a few uncommitted files, not for the install. For a kept worktree
where:

- no live process has its cwd inside `<path>` and no pm2 app runs from it, **and**
- nothing in the worktree (excluding `node_modules`) has changed in **≥ 7 days**
  (`find <path> -path '*/node_modules' -prune -o -type f -mtime -7 -print -quit` prints nothing),

remove every `node_modules` directory inside it
(`find <path> -name node_modules -type d -prune -exec rm -rf {} +`). This only deletes installed
packages; `npm ci` rebuilds them. Never touch tracked or untracked source files. Report it as
`pruned node_modules: <repo>/<name> (<size>)`.

### 3d. Stale dirty worktree — report it so Jack decides

A worktree kept only because it has uncommitted files, with nothing changed in **≥ 14 days**, is
probably abandoned work. Don't remove it. List it in the report under **Stale (needs Jack)**
with its age, dirty-file count, branch and PR state (`gh pr list --head <branch> --state all`),
so Jack can commit or drop it. Without this list, these worktrees pile up unseen (22 in SERP on
2026-11-18).

## 4. Kill the dev server — match by cwd, verify ports freed

Only for not-in-use worktrees (by definition no live session here, but a stale/orphaned server may still hold ports):

```bash
app=$(pm2 jlist 2>/dev/null | jq -r --arg p "<path>" '.[] | select(.pm2_env.pm_cwd == $p) | .name')
[ -n "$app" ] && pm2 delete "$app"
# free any leftover listeners on its ports
[ -n "$fe" ] && lsof -nP -iTCP:$fe -sTCP:LISTEN
[ -n "$be" ] && lsof -nP -iTCP:$be -sTCP:LISTEN
# kill leftover PIDs only if they're clearly this worktree's stray server
```

Never leave an orphaned server holding ports.

## 5. Remove the worktree

From the **main clone** of that repo (never run the removal from inside the worktree):

```bash
git -C <root> worktree remove <path>     # never --force — step 3 guarantees it's clean
```

If `worktree remove` refuses (it found local changes step 3 missed), treat the worktree as in-use: keep it, skip step 6, and note it in the report. Do **not** add `--force`.

## 6. Delete the branch — deterministic rule, no asking

Delete the worktree's branch automatically ONLY if it has **zero commits of its own** vs its base (`git -C <root> rev-list --count <base>..<branch>` is 0 — nothing exists that isn't already on the base). Otherwise keep it and say so (it may back a PR or unfinished work).

```bash
git -C <root> rev-list --count <base>..<branch>   # 0 → safe to delete
git -C <root> branch -d <branch>                   # -d (not -D): refuses if unmerged, as a backstop
```

## 7. Report

One combined summary across all repos swept:

- **Removed:** `<repo>/<name>` — server stopped (ports `<fe>/<be>` freed), worktree removed, branch deleted/kept.
- **Kept (in use):** `<repo>/<name>` — why (dirty / unpushed commits / live server / live session).
- **Pruned node_modules:** `<repo>/<name>` — size freed (step 3c).
- **Stale (needs Jack):** `<repo>/<name>` — idle Nd, N dirty files, branch, PR state (step 3d).
- **Disk:** free space before → after (`df -h /`).
- **Protected (always skipped):** count of `wf_817b7ab1-*` + `agent-*` + `serp-hotfix-mo-grounding` left untouched.

Set the tab to `✅ done` at the end.
