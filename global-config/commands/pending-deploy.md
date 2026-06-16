# Command: pending-deploy

Show what's sitting on a repo's `dev` that hasn't shipped to `main` yet — the queue for the next deploy — **and prove it's ready** by running lint + the full test suite, auto-fixing what it can. The readiness gate lives here because `/deploy` does NOT run tests.

**Currently only SERP is supported from the hub** (it's the only repo that deploys via `/deploy SERP`, and the readiness gate runs SERP's npm lint/test suite).

## Usage

```
/pending-deploy SERP            # Summary + readiness gate (lint + tests, auto-fix)
/pending-deploy SERP --full     # Also include the full diff review (per-file breakdown)
/pending-deploy SERP --no-test  # Summary + lint only; skip the (slow) test suite
```

`$ARGUMENTS` must start with `SERP`. If it's empty or names another repo, STOP and reply: "Only `/pending-deploy SERP` is supported from the hub (it gates `/deploy SERP`). SWAC/Laravel ship through their own promotion flows." Do not improvise.

---

# Pending deploy: $ARGUMENTS

Runs against SERP by absolute path from the sw-cortex hub. cwd is sw-cortex; every git command uses `git -C "$SERP"`, and the readiness worktree + npm runs are anchored to SERP's tree. Your sw-cortex and SERP working trees and current branches are never touched. `main` is never written here.

### Step 0: Pin the SERP repo root

```bash
SERP="/Users/jackkief/Desktop/Projects/SERP"
```

## Implementation

**SPEED RULE for the inventory: run exactly ONE Bash call.** The script below gathers everything informational (counts, commits, merges, diffstat, deploy-sensitive flags, PR resolution) in a single invocation — including the `gh` lookups, run in parallel inside the script. Do NOT split it. (`--full` adds at most one more call for the diff.) The readiness gate that follows is a separate multi-step phase.

```bash
SERP="/Users/jackkief/Desktop/Projects/SERP"
git -C "$SERP" fetch origin --prune --quiet

AHEAD=$(git -C "$SERP" rev-list --count origin/main..origin/dev)
BEHIND=$(git -C "$SERP" rev-list --count origin/dev..origin/main)
echo "AHEAD=$AHEAD BEHIND=$BEHIND"
[ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ] && echo "IN SYNC — nothing pending" && exit 0
[ "$BEHIND" -gt 0 ] && echo "=== DRIFT: main commits NOT on dev ===" && git -C "$SERP" log --oneline origin/dev..origin/main

echo "=== COMMITS (no merges) ==="
git -C "$SERP" log --format='%h %ci %s' --no-merges origin/main..origin/dev

echo "=== MERGE SUBJECTS ==="
git -C "$SERP" log --merges --pretty='%s' origin/main..origin/dev

echo "=== PR RESOLUTION ==="
{
  git -C "$SERP" log --merges --pretty='%s' origin/main..origin/dev | grep -oE '#[0-9]+' | tr -d '#' | sort -u | while read -r N; do
    gh pr view "$N" --repo Jack-Kiefer/SERP --json number,title -q '"#\(.number) — \(.title)"' &
  done
  git -C "$SERP" log --merges --pretty='%s' origin/main..origin/dev | grep -oE "origin/[^']+" | sed 's#^origin/##' | sort -u | while read -r BR; do
    gh pr list --repo Jack-Kiefer/SERP --head "$BR" --state merged --limit 1 --json number,title -q '.[0] | "#\(.number) — \(.title)"' &
  done
  wait
} 2>/dev/null

echo "=== DIFFSTAT ==="
git -C "$SERP" diff --stat origin/main...origin/dev | tail -1

echo "=== FILES ==="
git -C "$SERP" diff --name-status origin/main...origin/dev

echo "=== DEPLOY-SENSITIVE ==="
FILES=$(git -C "$SERP" diff --name-only origin/main...origin/dev)
echo "$FILES" | grep -E '^serp_app/migrations/.*\.sql$' | sed 's/^/AUTO-RUN ON DEPLOY: /'
echo "$FILES" | grep -E '^migrations/.*\.sql$' | sed 's/^/MANUAL SCRIPT (run by hand): /'
echo "$FILES" | grep -E '^seeding/migrations/.*\.sql$' | sed 's/^/LOCAL-ONLY MIGRATION (no deploy effect): /'
echo "$FILES" | grep -E 'Dockerfile|^k8s/|deploy-k8s\.sh|ecosystem\.config' | sed 's/^/DEPLOY MECHANICS CHANGED: /'
echo "$FILES" | grep -E 'package\.json$|requirements.*\.txt$|pyproject\.toml$' | sed 's/^/DEPENDENCY CHANGE: /'
echo "$FILES" | grep -E '^backend/workers/' | sed 's/^/WORKER CHANGE: /'
git -C "$SERP" diff origin/main...origin/dev -- backend/ ':(exclude)backend/tests' | grep -E '^\+.*\b(os\.environ|getenv)\(' | sed 's/^/POSSIBLE NEW ENV VAR: /'
echo "=== DONE ==="
```

If the script printed `IN SYNC`: report "**dev and main are in sync — nothing pending.**" and stop (no readiness gate — nothing to ship).

## Readiness gate (lint + tests, auto-fix)

Run ONLY when the inventory showed something pending (`AHEAD > 0`). Skip the test step if `--no-test` (still run lint). This is what makes `/pending-deploy` a real gate.

**Why a worktree:** lint `--fix` and any test-fix edits mutate files, and the suite must run against exactly what would ship (`origin/dev`). The worktree gives a clean `origin/dev` checkout that can't disturb anything.

### Step R1 — isolated worktree off SERP's origin/dev

```bash
set -e
SERP="/Users/jackkief/Desktop/Projects/SERP"
WT="/tmp/serp-pending-deploy"
git -C "$SERP" worktree remove --force "$WT" 2>/dev/null || true
git -C "$SERP" worktree add --force -B pending/readiness "$WT" origin/dev
echo "READINESS_WORKTREE=$WT"
```

Run every command below with `git -C "$WT" …` / `cd "$WT" && …`. SERP's main clone is never mutated.

### Step R2 — lint, auto-fix, re-run

```bash
cd "$WT" && npm run lint 2>&1 | tail -40 || LINT_FAILED=1
[ -n "$LINT_FAILED" ] && echo "=== LINT FAILED — attempting auto-fix ===" && \
  (cd "$WT" && npm run lint -- --fix 2>&1 | tail -20; npm run lint 2>&1 | tail -40)
```

After a fix pass, re-run plain `npm run lint`; if clean, the gate passed with fixes. If lint still fails, those aren't auto-fixable — capture the output for the report.

### Step R3 — full test suite, fix root causes, re-run

```bash
cd "$WT" && npm run test 2>&1 | tail -60 || TEST_FAILED=1
```

If tests fail: **diagnose and fix the root cause** in the worktree (real debugging per the `debugging` skill — correct layer, no fallbacks, fix the source not the test unless the test is wrong). Re-run failing tests, then the full suite once green.

- **Auto-fixable** (lint, stale assertion, trivial import) → fix, re-run, note it.
- **NOT confidently fixable** (real behavioral failure, ambiguous root cause, prod logic you're unsure about) → STOP fixing. Report the failing tests + diagnosis and let Jack decide. A red deploy branch hard-blocks the deploy prompt.

### Step R4 — commit & push fixes to origin/dev (only if you made fixes AND all green)

```bash
git -C "$WT" diff --stat   # show exactly what the auto-fix changed
```

Present that diff to Jack and ask permission before pushing (auto-fixes are commits to `dev` — never push without explicit per-action OK). On approval:

```bash
git -C "$WT" add -- <only the files you fixed>   # NEVER git add -A
git -C "$WT" commit -m "fix(pending-deploy): auto-fix lint/test before deploy"
git -C "$WT" push origin HEAD:dev
```

Then re-fetch so the report reflects the new `dev` tip.

### Step R5 — always clean up the readiness worktree (every exit path)

```bash
SERP="/Users/jackkief/Desktop/Projects/SERP"
git -C "$SERP" worktree remove --force "$WT" 2>/dev/null || true
git -C "$SERP" branch -D pending/readiness 2>/dev/null || true
git -C "$SERP" worktree prune
```

Record the gate result: **`READINESS = PASS` / `PASS (with auto-fixes)` / `FAIL`**, plus lint and test summaries.

## Report format

Format the script output into this — no extra tool calls, short and scannable:

```markdown
# Pending Deploy: SERP dev → main

**{N} commits / {M} files / +{add} −{del}** (last dev activity: {date of newest commit})

## PRs included

- #132 — feat(pack-tomorrow): tag Tracy on the Taylor daily Slack post

## Other direct commits (no PR)

- {oneline} ...

## Changes

- `{file}` — {one line: what this change does}
- ... (every changed file; if >60 files, group by directory with counts)

## ⚠️ Deploy notes

- {lines from DEPLOY-SENSITIVE, explained — or "None — plain code changes"}

## ✅ Readiness

- lint: PASS | PASS (auto-fixed N files) | FAIL ({what's still failing})
- tests: PASS (N passed) | PASS (auto-fixed N) | FAIL ({which tests}) | SKIPPED (--no-test)
- {if auto-fixes pushed to dev: "↳ committed fixes to dev as {sha} — included in this deploy queue"}

## ⚠️ Drift

- {only if BEHIND > 0: main has commits not on dev — hotfix not merged back?}
```

If `--full`: ONE additional call — `git -C "$SERP" diff origin/main...origin/dev` — then describe each file's change from the actual hunks.

## Final step: offer to deploy

**Order matters: the full report — including Changes — must be presented as text BEFORE the deploy question.** Never ask off a bare stats summary.

Immediately before asking, end with a 2–3 sentence plain-English TLDR of what this deploy ships — runtime-affecting changes first, docs/config noise last.

**Hard gate:** if `READINESS = FAIL`, do NOT offer to deploy. State that it's blocked, list the failing lint/tests, and stop. `/deploy SERP` runs no tests, so a red gate here is the only thing between broken code and prod.

Only if there IS something pending AND `READINESS` is PASS (or PASS with auto-fixes), ask via AskUserQuestion:

- **Question:** "Deploy these {N} commits to main now?"
- **Options:** "Yes — run /deploy SERP" | "No — just wanted to look"

On yes, invoke the `deploy` command with the `SERP` argument. On no (or nothing pending, or gate failed), end. Never run the deploy without the explicit yes, and never on a failed readiness gate.

## Notes

- **Inventory phase modifies nothing; readiness phase may.** The only writes are (a) auto-fix commits pushed to `origin/dev` from the `/tmp` worktree — gated on Jack's explicit OK — and (b) choosing deploy at the end. Your working trees, current branches, and `main` are never touched here.
- The readiness gate is the slow part (full test suite). Worth it: `/deploy SERP` runs no tests and there's no GitHub Actions CI, so this is the sole automated check before prod. Use `--no-test` only when you've already run the suite.
- `origin/main...origin/dev` (three dots) for diffs; `origin/main..origin/dev` (two dots) for commit lists.
- `gh` failures are silenced — if PR resolution prints nothing, fall back to merge subjects/branch names.
- Don't truncate the changed-file list unless >~60 files; then group by directory with counts.
