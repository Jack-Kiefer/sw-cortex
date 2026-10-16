# Prod guardrails: cluster and credential hand-off (L1/L2)

**Context.** On 2026-10-16 at 13:12:59 UTC, a local Claude Code session ran this with no request:

```
ssh jack@5.161.95.56 'kubectl delete namespace serp --wait=false'
```

It deleted every deployment, secret and ingress in `ns serp`. Nothing stopped it: the session was in `bypassPermissions`, `Bash(ssh:*)` was allowed, no hook covered ssh or kubectl, and `jack` is cluster-admin on the node.

The local layer (L3) ships in the same sw-cortex PR as this doc. It is a PreToolUse hook (`global-config/scripts/prod-guard.sh`), installed both per-user and as root-owned managed settings, plus auto mode with bypass disabled. That layer is a seatbelt against misfires. The items below are the real boundary: they hold even if a Claude session, a script or a person runs the wrong command with jack's credentials.

Owner: **Munyr** for L1 (nodes, ArgoCD), **Jack** for L2. Nothing here has been applied. Review and apply in a maintenance window.

## Day to day (L3, for Jack)

- **Reads, logs, dev deploys, feature work:** no change.
- **Prod changes** (`set env`, `scale`, `rollout restart`, a SERP `main` merge, which is a deploy): Claude shows an approval prompt and you click allow.
- **Blocked actions** (namespace or secret deletes, `DROP`, force-push to `main`, …): the session gets a message containing a one-line command for *that* session, and shows it to you as a code block. Click **Run**, or paste it into a terminal, and enter your password or Touch ID:

  ```bash
  sudo prod-guard-unlock 15 <session-id>
  ```

  For the next 15 minutes (60 max), that session's blocked commands become approval prompts instead. Other sessions stay locked.
  - `sudo prod-guard-unlock off` re-locks early.
  - `prod-guard-unlock status` shows what's unlocked.
  - A session can't run the unlock itself: it has no way to give sudo your password, and the guard refuses any call that mentions it.
- **Bypass mode** is still available per session from the mode picker. The guard runs in every mode, including bypass.
- **One-time setup after merge:** `sudo bash scripts/install-managed-prod-guard.sh`. It installs the root-owned guard and `/usr/local/bin/prod-guard-unlock`. Until then the user-level guard runs, but there's no unlock command.

---

## L1 — Cluster side

### 1. Admission policy: refuse deletes of protected namespaces and core prod objects

This needs Kubernetes ≥ 1.30 for `admissionregistration.k8s.io/v1` ValidatingAdmissionPolicy; check with `k3s --version`. If the cluster is older, the equivalent is a two-rule Kyverno `ClusterPolicy`.

The policy also binds cluster-admin. To bypass it you have to do so deliberately: impersonate the `break-glass` group, or delete the policy first.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: protect-namespaces}
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["DELETE"]
        resources: ["namespaces"]
  validations:
    - expression: >-
        !(oldObject.metadata.name in ['serp','serp-dev','serp-staging','argocd','kube-system','ingress-nginx'])
        || 'break-glass' in request.userInfo.groups
      message: "Namespace deletion is blocked by policy protect-namespaces."
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: protect-namespaces}
spec: {policyName: protect-namespaces, validationActions: [Deny]}
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: protect-serp-core}
spec:
  failurePolicy: Fail
  matchConstraints:
    namespaceSelector:
      matchExpressions:
        - {key: kubernetes.io/metadata.name, operator: In, values: [serp]}
    resourceRules:
      - {apiGroups: ["apps"], apiVersions: ["v1"], operations: ["DELETE"], resources: ["deployments", "statefulsets", "daemonsets"]}
      - {apiGroups: [""], apiVersions: ["v1"], operations: ["DELETE"], resources: ["secrets", "services", "persistentvolumeclaims", "configmaps"]}
      - {apiGroups: ["networking.k8s.io"], apiVersions: ["v1"], operations: ["DELETE"], resources: ["ingresses"]}
  validations:
    - expression: "'break-glass' in request.userInfo.groups"
      message: "Deleting core objects in ns serp is blocked by policy protect-serp-core."
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: protect-serp-core}
spec: {policyName: protect-serp-core, validationActions: [Deny]}
```

Check before applying:
- ArgoCD `serp-prod` runs with `prune: false` (per `SERP/README.md` in this repo), so ArgoCD never deletes these objects.
- `deploy-k8s.sh` only `apply`s secrets and never deletes them.
- Replicasets and pods are deliberately not covered, so rollouts keep working.
- Confirm none of the above with `kubectl get --raw /metrics | grep admission` after a deploy.

Break-glass usage (a person in a terminal, never Claude): `kubectl --as=admin --as-group=break-glass --as-group=system:masters delete ...`.

Do the same on the **non-prod node** (5.161.51.208) for `serp-dev` and `serp-staging` namespaces (the first policy is enough there).

### 2. Least privilege for `jack` and the deploy path (prod node 5.161.95.56)

Today `/etc/rancher/k3s/k3s.yaml` (cluster-admin) is group-readable by jack (`write-kubeconfig-mode 0640`), and jack has passwordless `sudo -n` on the node.

**a. Read-only kubeconfig as jack's default.** It is used by Claude sessions and by the `serp-prod` MCP, which only runs `get/describe/logs/top` plus a `get secret serp-env` for its env-flags tool.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata: {name: jack-readonly, namespace: kube-system}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: {name: jack-readonly-view}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: view}
subjects: [{kind: ServiceAccount, name: jack-readonly, namespace: kube-system}]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: {name: jack-readonly-extra}
rules:
  - {apiGroups: [""], resources: ["nodes"], verbs: ["get", "list", "watch"]}
  - {apiGroups: ["metrics.k8s.io"], resources: ["pods", "nodes"], verbs: ["get", "list"]}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: {name: jack-readonly-extra}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: jack-readonly-extra}
subjects: [{kind: ServiceAccount, name: jack-readonly, namespace: kube-system}]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: jack-read-serp-env, namespace: serp}
rules:
  - {apiGroups: [""], resources: ["secrets"], resourceNames: ["serp-env"], verbs: ["get"]}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: jack-read-serp-env, namespace: serp}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: jack-read-serp-env}
subjects: [{kind: ServiceAccount, name: jack-readonly, namespace: kube-system}]
```

Then:
- Mint a token: `kubectl create token jack-readonly -n kube-system --duration=8760h`.
- Write `~jack/.kube/config` with that token, and drop `KUBECONFIG=/etc/rancher/k3s/k3s.yaml` from jack's shell profile if it's set.
- Verify `sudo -u jack kubectl auth can-i delete namespaces` returns **no**.

**b. Admin goes back behind root.**
- Set `write-kubeconfig-mode: "0600"` in `/etc/rancher/k3s/config.yaml` and `chmod 600 /etc/rancher/k3s/k3s.yaml`.
- In `/etc/sudoers.d/*`, remove any `NOPASSWD: ALL` or `NOPASSWD` covering `kubectl`/`k3s`/`bash`/`sh` for jack. Keep NOPASSWD only for the exact commands `deploy-k8s.sh` escalates with: `chown` of `/opt/SERP`, the `env AWS_PROFILE=… aws ecr get-login-password`, and the root-HOME `git` push in `/opt/sugarwish-infrastructure`.
- Human admin work then becomes `sudo kubectl …` **with a password**, which a Claude session cannot supply.

**c. A narrow `serp-deployer` identity for `deploy-k8s.sh`.** Jenkins runs it as jack. The script needs: get deployments/pods, apply the `serp-env` and `serp-edge-auth-cred` secrets, and `rollout restart`. It needs no delete and no cluster scope.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata: {name: serp-deployer, namespace: serp}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: serp-deployer, namespace: serp}
rules:
  - {apiGroups: ["", "apps"], resources: ["pods", "pods/log", "deployments", "replicasets", "services", "events"], verbs: ["get", "list", "watch"]}
  - {apiGroups: ["apps"], resources: ["deployments"], verbs: ["patch", "update"]}
  - {apiGroups: [""], resources: ["secrets"], verbs: ["create"]}
  - {apiGroups: [""], resources: ["secrets"], resourceNames: ["serp-env", "serp-edge-auth-cred"], verbs: ["get", "patch", "update"]}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: serp-deployer, namespace: serp}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: serp-deployer}
subjects: [{kind: ServiceAccount, name: serp-deployer, namespace: serp}]
```

Wiring it in:
- Store its kubeconfig at `/home/jack/.kube/serp-deployer.yaml` (0600 jack).
- SERP code change (Jack): `deploy-k8s.sh` line 59 defaults `KUBECONFIG` to `/etc/rancher/k3s/k3s.yaml`. Change the default to the deployer kubeconfig.
- The `[6/6]` diagnostics (`kubectl describe node`) need a `get nodes` ClusterRole bound to `serp-deployer`, or should switch to the read-only kubeconfig.
- Do the same for `deploy-k8s-staging.sh` and the dev deploy on the non-prod node, with the `edit` ClusterRole bound by RoleBinding in `serp-dev` and `serp-staging`. That leaves no namespace delete and no cluster scope.

**d. ArgoCD host `deploy.sugarwish.com` / sugarwish-k8s-cp (87.99.135.189).**
- Past Claude sessions have ssh'd there as jack and run kubectl. Apply the same read-only pattern for jack.
- Check which credential ArgoCD holds for the prod cluster (`kubectl -n argocd get secret -l argocd.argoproj.io/secret-type=cluster`), and whether jack can read it. That credential is effectively prod cluster-admin.

### 3. K3s API audit log (prod and non-prod)

Today nobody can prove from the cluster who deleted what. Add this to `/etc/rancher/k3s/config.yaml` (restarts the API server; schedule it):

```yaml
kube-apiserver-arg:
  - audit-log-path=/var/lib/rancher/k3s/server/logs/audit.log
  - audit-policy-file=/var/lib/rancher/k3s/server/audit-policy.yaml
  - audit-log-maxage=30
  - audit-log-maxbackup=10
  - audit-log-maxsize=100
```

```yaml
# /var/lib/rancher/k3s/server/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: [RequestReceived]
rules:
  - level: None
    verbs: [get, list, watch]
  - level: Metadata            # never log secret/configmap bodies
    resources: [{group: "", resources: [secrets, configmaps]}]
  - level: RequestResponse
    verbs: [delete, deletecollection]
  - level: Metadata
```

Ship `audit.log` with the existing log-shipper (`SERP/serp-prod/log-shipper-*`).

### 4. ArgoCD

- Confirm `serp-prod` and `serp-dev` do **not** carry the `resources-finalizer.argocd.argoproj.io` finalizer: `kubectl -n argocd get application serp-prod -o jsonpath='{.metadata.finalizers}'`. With it, deleting the Application cascades into deleting every prod resource.
- Keep `prune: false` and `selfHeal: false` as documented.
- ArgoCD RBAC (`argocd-rbac-cm`): jack's account gets `role:readonly` plus `applications, sync, */serp-*`. No delete, and no `exec`.

### 5. Make the secrets recoverable

The outage needed `serp-env`, `serp-edge-auth-cred`, `serp-tls-prod` and `ecr-serp-creds` recreated by hand.
- **Short term:** a nightly root cron on the node that runs `kubectl get secret -n serp -o yaml`, encrypts the output with `age` to a recipient key Munyr holds offline, and uploads it to the existing `sugarwish-serp-db-backups` bucket (30-day retention).
- **Long term:** SOPS or sealed-secrets in this repo, so ArgoCD can restore them.

---

## L2 — Credentials

| # | Item | Owner | Status |
|---|---|---|---|
| 6 | The hub `mcp__db__` logs into `serp_app` and `serp_test` as `jack-serptest-write-20260428`, which has `ALL PRIVILEGES` on both. Its only "read-only" protection is a `startsWith` keyword check that `/* */ DELETE` or `WITH … DELETE` slip past. Swap in a SELECT-only user (`GRANT SELECT, SHOW VIEW ON serp_app.* …; … ON serp_test.*`). | Jack | `.env` updated 2026-10-16. Verify after a Claude Code restart: `SHOW GRANTS` should list SELECT only. prod-guard also now denies any non-read SQL through `mcp__db__`. |
| 7 | Local `~/.kube/config` points straight at the prod API (`https://5.161.95.56:6443`) with a credential read from Keychain item `k3s-prod-cred` by `~/.kube/k3s-cred.sh`. It's currently broken (exec-plugin apiVersion mismatch), but one fix away from prod API access with no ssh involved. Delete it plus the Keychain item, or replace it with the read-only token from 2a. | Jack | open |
| 8 | SERP is a private repo on the free plan, so `main` cannot be protected (the API returns 403 "Upgrade to GitHub Pro"), and any push or merge to `main` auto-deploys prod. GitHub Pro for `Jack-Kiefer` ($4/mo) enables branch protection: require a PR, block force-push and deletion of `main`. Also protect sw-cortex `main` (currently "Branch not protected"). | Jack | open |
| 9 | SERP MCP servers: `serp-api`, `serpy` and `python` can target prod by argument, and `serp-orm` writes to whatever the backend `.env` points at. prod-guard asks on their prod-mutating calls. Separately, verify that the `serp_app` user in SERP's `.env` (used by `serp-db`) is SELECT-only: its source comments say so, but the grants weren't checked. | Jack | open |
| 10 | SERP `.claude/settings.json` allows `Bash(ssh:*)`, `mysql`, `psql`, `scp`, `rsync` and `sudo systemctl`. In auto mode a matching allow rule skips the classifier, so remove these (SERP PR). The user-level ones are removed by this PR's sync filter. | Jack | follow-up PR |
