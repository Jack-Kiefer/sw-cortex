# Command: shutdown

Sweep **all writable repos** (SERP, SWAC, sw-cortex) and shut down every worktree that **isn't in use** — kill its dev server, remove the worktree, delete its branch — leaving anything still in use untouched. The global, cross-repo version of SERP's per-worktree `/shutdown-worktree`. **Fully non-interactive: never ask Jack questions.** Safety comes from defaults, not prompts: anything in use is kept and reported.

## Usage

/shutdown # sweep SERP + SWAC + sw-cortex, remove all not-in-use worktrees
/shutdown <repo> # limit the sweep to one repo (serp | swac | cortex)

---

# Task: $ARGUMENTS

Set the tab title as you go (`🔍 scanning worktrees` → `🔨 shutting down` → `✅ done`) with `~/.claude/scripts/set-tab-title.sh`.

## 1. Build the worktree list — across writable repos, hard-skip the protected set

Writable repo roots:

- SERP → `/Users/jackkief/Desktop/Projects/SERP`
- SWAC → `/Users/jackkief/Desktop/Projects/SWAC`
- sw-cortex → `/Users/jackkief/Desktop/Projects/sw-cortex`

If `$ARGUMENTS` names one repo (serp / swac / cortex / sw-cortex, case-insensitive) limit to that root; otherwise sweep all three.

For each root, enumerate `git -C <root> worktree list --porcelain`. A worktree is a **candidate** only if ALL of these hold — otherwise **never touch it**:

- It is **not** the main clone (its path ≠ the repo root itself).
- It is **not** `locked` (git reports `locked` for the `wf_817b7ab1-*` set).
- Its path is **not** in the protected list — hard-skip, no exceptions:
  - `…/SERP/.claude/worktrees/wf_817b7ab1-a1b-*` (the locked workflow worktrees)
  - `…/SERP/.claude/worktrees/agent-*` (the agent worktree)
  - `…/serp-hotfix-mo-grounding` (sibling hotfix worktree)
- Its path is under the repo (a real managed worktree, not a stray external checkout).

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
- **Protected (always skipped):** count of `wf_817b7ab1-*` + `agent-*` + `serp-hotfix-mo-grounding` left untouched.

Set the tab to `✅ done` at the end.
