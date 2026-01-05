# Command: commit-push-pr

Commit changes, push to remote, and create a pull request in one smooth workflow.

## Usage

```
/commit-push-pr
/commit-push-pr [optional PR title]
```

## Examples

```
/commit-push-pr
/commit-push-pr Add task snooze functionality
```

---

description: Commit, push, and create PR in one workflow
allowed-tools: Bash, Read, Grep

---

# Commit-Push-PR Workflow

```bash
# Pre-compute git info for speed
GIT_STATUS=$(git status --porcelain)
GIT_BRANCH=$(git branch --show-current)
GIT_DIFF_STAT=$(git diff --stat HEAD)
GIT_LOG=$(git log --oneline -5)
```

## Step 1: Verify Changes

Check git status. If no changes, inform user and stop.

Show:

- Current branch
- Changed files
- Diff summary

## Step 2: Run Verification

Before committing, run quick verification:

```bash
npm run typecheck && npm run lint
```

If verification fails, stop and show errors. Do not proceed with broken code.

## Step 3: Stage and Commit

Stage all changes:

```bash
git add -A
```

Generate commit message following conventional commits:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `refactor:` for refactoring
- `test:` for tests
- `chore:` for maintenance

Commit with generated message:

```bash
git commit -m "$(cat <<'EOF'
[commit message]

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Step 4: Push

Push to remote, creating upstream if needed:

```bash
git push -u origin $(git branch --show-current)
```

## Step 5: Create PR

If PR title provided in $ARGUMENTS, use it. Otherwise, generate from commit message.

Create PR using GitHub CLI:

```bash
gh pr create --title "[title]" --body "$(cat <<'EOF'
## Summary
[2-3 bullet points describing changes]

## Changes
[List of files changed]

## Testing
- [ ] TypeScript compiles
- [ ] Lint passes
- [ ] Manual verification done

---
Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Step 6: Report

Show:

- Commit SHA
- Branch name
- PR URL
- Next steps (review, merge, etc.)
