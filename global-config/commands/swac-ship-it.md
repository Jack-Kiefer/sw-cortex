# Command: swac-ship-it

Jack's branch wrap-up pipeline for **SWAC**, adapted to his machine. Takes a completed SWAC
feature branch (in the main checkout **or a worktree**) from "done coding" to "PR created":
change log → PR review → fix issues → pre-PR audit → PR → Slack. This is the Jack-environment
sibling of the shared `/ship-it` (which is hardcoded for Jason's paths/identity).

## Usage

```
/swac-ship-it            # wrap up the current SWAC branch (auto-detects worktree)
```

## Environment (Jack's machine — the whole reason this command exists)

- **SWAC root:** `/Users/jackkief/Desktop/Projects/SWAC` (NOT Jason's `/Users/jasonkiefer/...`).
- **Worktree-aware:** work is often on a worktree under `SWAC/.claude/worktrees/<name>/`. Resolve
  the **actual working dir** first (see Phase 0) and run every `git` as `git -C "$REPO" …`. Never
  assume the main checkout.
- **Identity:** `Jack Kiefer` / `jack@sugarwish.com`. Branches are `jack/<desc>`.
- **Base branch:** `development` (SWAC flow is dev→staging→live).
- **SWAC-local commands** live in `SWAC/.claude/commands/`: `review-pr`, `pre-pr`, `change-log`.
  Use THESE (not a hand-rolled review) — they carry SWAC's `docs/PR_REVIEW_CHECKLIST.md`, a11y
  gate, etc.
- **Slack:** post via `mcp__jack-slack__slack_post_message` to `#devgroup_wishdesk`
  (`C08TDS7DRK2`), tagging Parish `<@U045FJ66K6K>`. **Lead with the WW ticket id**, and add **no**
  "posted on behalf of …" / "swirlbot" footer (see Phase 7). (jack-slack, NOT a `mcp__slack__*`
  tool.)

---

## Phase 0 — Resolve the repo dir + assess (do this FIRST)

```bash
# Resolve the SWAC working dir: prefer the current dir if it's a SWAC worktree/checkout,
# else fall back to the main checkout. (Run from wherever the session cwd is.)
REPO="$(git rev-parse --show-toplevel 2>/dev/null)"
case "$REPO" in
  *"/SWAC"*|*"/SWAC/.claude/worktrees/"*) : ;;       # ok, a SWAC checkout/worktree
  *) REPO="/Users/jackkief/Desktop/Projects/SWAC" ;; # fallback to main checkout
esac
echo "🚀 swac-ship-it on: $REPO"
BRANCH="$(git -C "$REPO" branch --show-current)"
echo "branch: $BRANCH"
git -C "$REPO" status --short
```

- If `BRANCH` is `development`: auto-create `jack/<feature-slug>` (kebab-case from the work/conv
  context; ask via AskUserQuestion only if the slug is unclear). `git -C "$REPO" checkout -b
jack/<slug>` carries the working tree along. Never push/modify `development` here.
- If on a `jack/<…>` branch already, proceed on it.

---

## Phase 1 — Commit (CAREFULLY — NOT a blanket `git add -A`)

> ⚠️ **The shared /ship-it does `git add -A`. DO NOT do that here.** A SWAC worktree often has
> non-committable session debris that `git add -A` would wrongly stage — most importantly a
> **`node_modules` symlink** added to run the dev server (`?? node_modules`). `.env` is gitignored
> so it won't show, but the symlink will. Stage **only real source changes.**

1. Show status, then stage deliberately:

```bash
git -C "$REPO" status --short
```

2. **Exclude** any of: `node_modules` (symlink), `.env*`, `*.cnf`, scratch/dump files, `pm2`
   artifacts. Stage the actual changed source files by path (or `git -C "$REPO" add -u` to stage
   tracked modifications only — which skips the untracked `node_modules` symlink — then add any
   genuinely new source files individually). Confirm with `git -C "$REPO" status --short` that the
   staged set is source-only before committing.
3. Commit with a ticket-prefixed message (SWAC uses WW-tickets; include the ticket id if known)
   and push:

```bash
git -C "$REPO" commit -m "WW-####: <describe the change>"
git -C "$REPO" push -u origin "$BRANCH"
```

4. Show the full branch overview vs `origin/development`:

```bash
git -C "$REPO" fetch origin
git -C "$REPO" log  --oneline origin/development..$BRANCH
git -C "$REPO" diff --name-only origin/development...$BRANCH
git -C "$REPO" diff --shortstat origin/development...$BRANCH
```

---

## Phase 2 — Change log · Sonnet subagent

Dispatch a `general-purpose` / `model: "sonnet"` agent. Prompt it with: repo path `$REPO`, the
branch, requester `jack@sugarwish.com`, today's date (`date "+%Y-%m-%d"`), and:

> Scope = the WHOLE branch vs `origin/development`. Read `git log --oneline
origin/development..<branch>`, the changed files, and any existing
> `docs/change_log/pending/` entries for this branch (incorporate, don't duplicate). Write
> `docs/change_log/pending/YYYY-MM-DD_Feature_Name.md` with: Title · Date (MDT) · Requested by
> (jack@sugarwish.com) · Type · Impact · Overview · Technical Details (files/functions/flags) ·
> Testing Notes · Documentation (WW ticket refs). If `server/swim/mcp-server/` changed, bump the
> minor version in `server/swim/mcp-server/MCP_VERSION`. Commit (`docs: add change log for
<feature>`) and push. Return the change-log path, a 2–3 sentence summary, and whether
> MCP_VERSION was bumped.

Capture the returned change-log path for Phase 6.

---

## Phase 3 — PR review · latest-Opus subagent running the REAL SWAC `/review-pr`

Dispatch `general-purpose` / `model: "opus"`. Same non-negotiables as the shared command:

- The verdict MUST come from actually running SWAC's `review-pr` skill — **not** an ad-hoc review.
- Prompt: repo `$REPO`, branch `<branch>`, and: _"Your only job: `Use the Skill tool to invoke the
skill named "review-pr" with args "<branch>"`. Follow SWAC's `review-pr.md` exactly — its
  mechanical checks, `docs/PR_REVIEW_CHECKLIST.md` (a11y is must-fix on frontend), tiering, verdict
  format. You are forbidden from inventing your own criteria. If you cannot invoke the skill, STOP
  and return the single line `REVIEW-PR-DID-NOT-RUN: <reason>`. Apply maximum (xhigh) effort."_
- **Return contract:** `REVIEW-PR-RAN: yes`, proof (the `Reviewing branch:` line, mechanical-check
  block, a `PR_REVIEW_CHECKLIST` reference), and the full categorized report (CRITICAL / CONCERN /
  PASS).

**Verification gate (all three or STOP):** output has `REVIEW-PR-RAN: yes` and NOT
`REVIEW-PR-DID-NOT-RUN`; it shows the command's own execution signals; a structured CRITICAL/
CONCERN/PASS verdict is present. If any fail: STOP the pipeline, quote what was missing, do not
improvise. One identical re-dispatch is allowed for a transient failure; a second failure STOPS.

For true xhigh, run `/swac-ship-it` from an xhigh session.

---

## Phase 4 — Fix issues (main Opus context)

- **CRITICAL** → must fix before PR. Read each file, fix, commit (`fix: <desc>`), push. (Same
  careful staging as Phase 1 — never `git add -A`.)
- **CONCERN** → fix the low-risk/straightforward ones; document any skipped in the PR body.

---

## Phase 5 — Pre-PR audit · run SWAC's `/pre-pr` (catches cross-session contamination)

SWAC has its own `pre-pr` command and CLAUDE.md rule #10 mandates it before any PR (multiple
Claude instances share the repo; stray commits leak). Run it for `$REPO` / `<branch>` — either
invoke the `pre-pr` skill directly, or dispatch a `general-purpose` / `model: "haiku"` agent told
to run it and return `CLEAN` or `CONTAMINATED` (with the suspect commits). If `CONTAMINATED`,
**STOP** and tell Jack before proceeding.

> Note: SWAC CLAUDE.md rule #11 — _multiple features per branch is expected and intentional._ So
> "unrelated-looking but plausibly Jack's" commits are NOT contamination; only flag commits that
> look like another instance's stray work. Don't suggest splitting the branch.

---

## Phase 6 — Create the PR (base `development`)

```bash
git -C "$REPO" fetch origin
git -C "$REPO" merge-tree $(git -C "$REPO" merge-base HEAD origin/development) HEAD origin/development > /tmp/swac-merge-test.txt 2>&1
grep -q "<<<<<<< " /tmp/swac-merge-test.txt && echo "⚠️ conflicts" || echo "✅ no conflicts"
```

Resolve any conflicts. Then build the PR body from the change log + all branch commits + the review
results, and create the PR (run `gh` from inside `$REPO` — `gh` has no `-C`, so use a subshell):

```bash
( cd "$REPO" && gh pr create --base development \
   --title "WW-####: <description>" \
   --body "$(cat <<'EOF'
## Summary
- <bullets covering all features/changes on the branch>

## Changes
- <files changed + why>

## PR Review Results
- <issues found & fixed; any skipped concerns>

## Testing
- <how to verify; e.g. the prepick image-review queue on localhost>

## Change Log
- <path to the change log entry>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" )
```

- If the PR is admin/non-customer-facing only (and not a bug ticket), add the `skip-qa` label.
- Move the change log from `docs/change_log/pending/` to `docs/change_log/completed/<YYYY-MM>/`.

---

## Phase 7 — Post-PR

1. **Slack** — post via `mcp__jack-slack__slack_post_message` to `C08TDS7DRK2`
   (`#devgroup_wishdesk`). **Lead with the WW ticket id**, and do **NOT** add any
   "posted on behalf of …" / "automatically posted by swirlbot" footer:

   ```
   [WW-#### — PR URL]
   [1–2 sentence summary]

   *What's in this PR:*
   • [major feature 1]
   • [major feature 2]

   <@U045FJ66K6K> - could you review when you get a chance?
   ```

   - **Always include the WW ticket** the PR is associated with (in the first line, before/with
     the PR URL — e.g. `WW-1493: <PR URL>`). If the branch maps to no ticket, say so explicitly.
   - **No footer** — drop "(posted on behalf of Jack)" and "automatically posted by swirlbot"
     entirely. The jack-slack bot already shows it's from Jack's bot.
   - One bullet per major feature; skip trivial cleanup. `<@U045FJ66K6K>` = Parish.

2. **Switch back** (only if you were in the MAIN checkout — if you shipped from a worktree, the
   worktree stays on its branch; just leave it): for the main checkout,
   `git -C "$REPO" checkout development && git -C "$REPO" pull origin development`.
3. **Knowledge registry · Sonnet subagent** (optional but matches /ship-it): for each significantly
   changed source file, `mcp__swim-kb__search_org_knowledge` then `upsert_org_knowledge` with what
   changed + branch + PR URL + repo SWAC. Skip trivial files. Return created-vs-updated counts.
4. **Final status:**
   ```
   🚀 swac-ship-it complete!
   📝 Change log: <path>
   🔍 PR review: <verdict from real /review-pr> (<N> critical fixed, <N> concerns)
   🔗 PR: <url>
   💬 Slack: posted to #devgroup_wishdesk (as Jack, tagged Parish)
   📚 Knowledge: <N> entries
   ```

## Notes

- **Never `git add -A` in a SWAC worktree** — the `node_modules` symlink (and any `.cnf`/dump/pm2
  debris from running the dev server) would get committed. Stage source files only.
- Each phase gates the next; if a phase fails critically, STOP and tell Jack.
- The PR base is **`development`**, never `main`/`live`.
- This command is Jack-specific; the shared `/ship-it` (Jason's) is unchanged.
