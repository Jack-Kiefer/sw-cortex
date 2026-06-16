# Command: deploy

Deploy a SugarWish app from the sw-cortex hub. **Currently only SERP has a deploy target here.**

## Usage

/deploy SERP

`$ARGUMENTS` MUST be `SERP`. If it is empty or names any other repo, STOP and reply: "Only `/deploy SERP` is supported from the hub. SWAC is promoted by Parish (dev→staging→live); Laravel ships via Jenkins (manage→blue→main). I don't deploy those." Do not improvise a deploy for another repo.

---

# Deploy: $ARGUMENTS

Promote SERP `dev` → `main` and deploy `main` to the **Hetzner K3s cluster** via SSH (`deploy-k8s.sh main`). Hetzner is the deploy target. The legacy AWS EC2 box (`34.203.231.65`, `deploy.sh`/PM2) is **frozen legacy** — NEVER deployed to. Do not add an AWS step.

**Runs against SERP by absolute path from the hub.** cwd is sw-cortex; every git command uses `git -C "$SERP" …` and the merge happens in a throwaway `/tmp` worktree. Your sw-cortex working tree and SERP's working tree are both untouched. This ships only what is already on `origin/dev`.

**Runs autonomously — no questions.** Stops only on a hard failure: a `dev`→`main` merge conflict it can't resolve, a push failure, or a non-zero `deploy-k8s.sh` / health-check exit.

## Implementation

### Step 0: Pin the SERP repo root

```bash
SERP="/Users/jackkief/Desktop/Projects/SERP"
```

Use `git -C "$SERP" …` for every git command below.

### Step 1: Set up an isolated worktree from origin/main

```bash
set -e
git -C "$SERP" fetch origin --prune
echo "Deploying origin/dev → main. dev SHA: $(git -C "$SERP" rev-parse --short origin/dev) | main SHA: $(git -C "$SERP" rev-parse --short origin/main)"

if git -C "$SERP" merge-base --is-ancestor origin/dev origin/main; then
  echo "origin/dev is already contained in origin/main — nothing new to deploy."
fi

WT="/tmp/serp-deploy-main"
git -C "$SERP" worktree remove --force "$WT" 2>/dev/null || true
git -C "$SERP" worktree add --force -B deploy/promote-main "$WT" origin/main
echo "WORKTREE=$WT"
```

Run every git command below with `git -C "$WT" …`. SERP's main repo is never `cd`'d into or mutated.

### Step 2: Merge `dev` into `main` (inside the worktree) and push

```bash
set -e
git -C "$WT" merge --no-edit origin/dev
git -C "$WT" push origin HEAD:main
```

- **Merge conflict?** STOP. Abort (`git -C "$WT" merge --abort`), clean up the worktree (Step 6), report the conflicting files. `main` is the deploy branch; never guess on it.
- **Push failure?** Report and STOP. Never force-push.

### Step 3: Deploy `main` to the Hetzner K3s cluster

Deploys to Hetzner (node `5.161.95.56`, namespace `serp`), NOT the legacy AWS box. `deploy-k8s.sh` deploys from git on the node, so it only sees the commit just pushed in Step 2.

```bash
ssh jack@5.161.95.56 "cd /opt/SERP && bash deploy-k8s.sh main"
```

Streams 7 phases: pull → build → import to containerd → serp-app migrations → apply manifests + roll → health check → image prune. `set -euo pipefail`; a non-zero exit = rollout/health failure — report full output and STOP.

**If `.env` changed** (not handled by the script): also refresh the secret and roll —

```bash
ssh jack@5.161.95.56 "kubectl delete secret serp-env -n serp; kubectl create secret generic serp-env --from-env-file=/opt/SERP/.env -n serp; kubectl rollout restart deployment -n serp"
```

### Step 4: Verify deployment

1. `ssh jack@5.161.95.56 "kubectl get pods -n serp"` — all `Running`, expected replicas, 0 recent restarts, no `OOMKilled`.
2. `ssh jack@5.161.95.56 "kubectl rollout status deployment/serp-backend -n serp && kubectl rollout status deployment/serp-frontend -n serp"` — both rolled out.
3. `ssh jack@5.161.95.56 "curl -fsS https://serp.sugarwish.com/api/health"` — run from the node (prod host DNS doesn't resolve from the Mac).
4. If off: `ssh jack@5.161.95.56 "kubectl logs -n serp deploy/serp-backend --tail=80"` (add `--previous` on a crashed pod).

### Step 5: Report — including "What shipped"

`<OLD_MAIN>` = the `main` SHA printed in Step 1. One Bash call (all `git -C "$SERP"`):

```bash
OLD_MAIN=<main SHA from Step 1>
echo "=== COMMITS (no merges) ==="
git -C "$SERP" log --format='%h %s' --no-merges "$OLD_MAIN"..origin/main
echo "=== MERGED PRs ==="
git -C "$SERP" log --merges --pretty='%s' "$OLD_MAIN"..origin/main | grep -oE '#[0-9]+' | tr -d '#' | sort -u | while read -r N; do
  gh pr view "$N" --repo Jack-Kiefer/SERP --json number,title -q '"#\(.number) — \(.title)"'
done 2>/dev/null
echo "=== DIFFSTAT ==="
git -C "$SERP" diff --stat "$OLD_MAIN"..origin/main | tail -1
echo "=== FILES ==="
git -C "$SERP" diff --name-status "$OLD_MAIN"..origin/main
echo "=== POST-DEPLOY CHECKS (from shipped changelog entries) ==="
for f in $(git -C "$SERP" diff --name-only "$OLD_MAIN"..origin/main -- docs/changelog/); do
  echo "--- $f ---"
  git -C "$SERP" show "origin/main:$f" 2>/dev/null | awk '/^## Post-deploy checks/{p=1;next} /^## /{p=0} p'
done
```

Then show: what merged (dev SHA → new main SHA); Hetzner deploy result; **What shipped** (PRs with titles, changes grouped by area, diffstat, anything deploy-sensitive — worker changes, auto-run migrations, dependency changes); **What to test now** (build primarily from the harvested authored `## Post-deploy checks`, fall back to the diff only for changes that declared none, tie each line to its PR/changelog); and the Step 4 verification output.

### Step 6: Clean up the worktree (always run — success, abort, or failure)

```bash
git -C "$SERP" worktree remove --force "$WT" 2>/dev/null || true
git -C "$SERP" branch -D deploy/promote-main 2>/dev/null || true
git -C "$SERP" worktree prune
```

## Notes

- **Safe from any branch / repo.** The merge runs in `$WT`; neither SERP's nor sw-cortex's working tree is touched. No `git checkout`, no `git add -A`, no `git stash`.
- **Autonomous.** Hard stops only: merge conflict, push failure, deploy/health non-zero exit. Never force-pushes.
- Ships **what is already on `origin/dev`** — does not commit or merge a feature branch. Land work on `dev` first.
- GitHub Actions CI runs on push to `main` but does NOT auto-deploy — this command handles deployment.
