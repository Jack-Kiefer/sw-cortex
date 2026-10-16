#!/usr/bin/env python3
"""Tests for global-config/scripts/prod-guard.sh.

Every case is fed to the hook as PreToolUse JSON on stdin. Nothing is ever executed.
Run: python3 scripts/test-prod-guard.py   (exit 0 = all pass)
"""

import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOK = os.path.join(ROOT, "global-config", "scripts", "prod-guard.sh")
P = "jack@5.161.95.56"   # prod K3s node
D = "jack@5.161.51.208"  # non-prod node

TMP = tempfile.mkdtemp(prefix="prod-guard-test-")
SCRIPT = os.path.join(TMP, "nuke.sh")
with open(SCRIPT, "w") as fh:
    fh.write("#!/bin/bash\nset -e\nssh jack@5.161.95.56 'kubectl delete ns serp'\n")
SAFE_SCRIPT = os.path.join(TMP, "safe.sh")
with open(SAFE_SCRIPT, "w") as fh:
    fh.write("#!/bin/bash\nssh jack@5.161.95.56 'kubectl get pods -n serp'\n")
SQL_FILE = os.path.join(TMP, "evil.sql")
with open(SQL_FILE, "w") as fh:
    fh.write("SELECT 1;\nDELETE FROM serp_stock_quant WHERE id > 0;\n")
READ_SQL_FILE = os.path.join(TMP, "read.sql")
with open(READ_SQL_FILE, "w") as fh:
    fh.write("-- report\nSELECT id, name FROM serp_product LIMIT 10;\n")
PY_FILE = os.path.join(TMP, "evil.py")
with open(PY_FILE, "w") as fh:
    fh.write("import subprocess\nsubprocess.run(['bash','-c',\"ssh jack@5.161.95.56 'kubectl delete namespace serp'\"])\n")

# (expected, command)
BASH = [
    # ---- the incident, and every wrapper around it ----------------------------------------
    ("deny", "ssh %s 'kubectl delete namespace serp --wait=false'" % P),
    ("deny", "ssh -o ConnectTimeout=15 -o BatchMode=yes -p 22 %s \"kubectl -n serp delete namespace serp\"" % P),
    ("deny", "ssh %s kubectl delete ns serp" % P),
    ("deny", "ssh %s 'kubectl delete ns/serp'" % P),
    ("deny", "ssh %s 'sudo -n kubectl delete namespaces serp'" % P),
    ("deny", "ssh %s 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml /usr/local/bin/kubectl --context default delete namespace serp'" % P),
    ("deny", "ssh %s \"bash -c 'kubectl delete ns serp'\"" % P),
    ("deny", "ssh %s 'eval \"kubectl delete ns serp\"'" % P),
    ("deny", "ssh %s 'timeout 30 nohup kubectl delete ns serp &'" % P),
    ("deny", "ssh -o HostName=5.161.95.56 innocent-alias 'kubectl delete deploy serp-backend -n serp'"),
    ("deny", "ssh -tt %s <<'EOF'\nkubectl get pods -n serp\nkubectl delete namespace serp\nEOF" % P),
    ("deny", "ssh %s bash -s <<EOF\nkubectl delete ns serp\nEOF" % P),
    ("deny", "echo 'kubectl delete ns serp' | ssh %s bash" % P),
    ("deny", "ssh %s 'kubectl get ns' && ssh %s 'kubectl delete ns serp'" % (P, P)),
    ("deny", "bash -c \"ssh %s 'kubectl delete ns serp'\"" % P),
    ("deny", "sh -c 'ssh %s \"kubectl delete namespace serp\"'" % P),
    ("deny", "eval \"ssh %s kubectl delete ns serp\"" % P),
    ("deny", "x=$(ssh %s 'kubectl delete ns serp')" % P),
    ("deny", "echo `ssh %s kubectl delete ns serp`" % P),
    ("deny", "bash %s" % SCRIPT),
    ("deny", "source %s" % SCRIPT),
    ("ask", "python3 %s" % PY_FILE),
    ("ask", "python3 -c \"import os; os.system('kubectl delete namespace serp')\""),
    ("deny", "kubectl delete namespace serp"),                       # local kubeconfig = prod API
    ("deny", "kubectl --kubeconfig ~/.kube/config delete ns serp"),
    ("deny", "ssh %s 'kubectl delete ns serp-dev'" % D),               # catastrophic on non-prod too
    # ---- other catastrophic kubectl ----------------------------------------------------------
    ("deny", "ssh %s 'kubectl -n serp delete deploy --all'" % P),
    ("deny", "ssh %s 'kubectl delete deployment serp-backend -n serp'" % P),
    ("deny", "ssh %s 'kubectl delete secret serp-env -n serp'" % P),
    ("deny", "ssh %s 'kubectl delete -n serp secret/serp-tls-prod'" % P),
    ("deny", "ssh %s 'kubectl delete pods -n serp -l app=serp-backend'" % P),
    ("deny", "ssh %s 'kubectl delete -f /opt/sugarwish-infrastructure/SERP/serp-prod/'" % P),
    ("deny", "ssh %s 'kubectl delete ingress,svc -n serp --all'" % P),
    ("deny", "ssh %s 'kubectl -n argocd delete application serp-prod'" % P),
    ("deny", "ssh %s 'kubectl delete pvc -n serp redis-data'" % P),
    ("deny", "ssh %s 'kubectl drain serp-node --ignore-daemonsets'" % P),
    ("deny", "ssh %s 'kubectl cordon serp-node'" % P),
    ("deny", "ssh %s 'kubectl replace --force -f deploy.yaml'" % P),
    ("deny", "ssh %s 'kubectl patch ns serp -p {\"metadata\":{\"finalizers\":null}}'" % P),
    ("deny", "ssh %s 'kubectl apply --prune -l app=serp -f dir/'" % P),
    ("deny", "ssh %s 'helm uninstall ingress-nginx -n ingress-nginx'" % P),
    ("deny", "ssh %s 'sudo /usr/local/bin/k3s-uninstall.sh'" % P),
    ("deny", "ssh %s 'sudo k3s-killall.sh'" % P),
    ("deny", "ssh %s 'sudo k3s etcd-snapshot delete snap1'" % P),
    ("deny", "ssh %s 'sudo systemctl stop k3s'" % P),
    ("deny", "ssh %s 'sudo reboot'" % P),
    ("deny", "ssh jack@deploy.sugarwish.com 'argocd app delete serp-prod'"),
    ("deny", "ssh jack@deploy.sugarwish.com 'kubectl delete application serp-prod -n argocd'"),
    ("deny", "curl -k -X DELETE https://5.161.95.56:6443/api/v1/namespaces/serp"),
    # ---- rm over ssh --------------------------------------------------------------------------
    ("deny", "ssh %s 'sudo rm -rf /opt/SERP'" % P),
    ("deny", "ssh %s 'rm -rf /var/lib/rancher/k3s'" % P),
    ("deny", "ssh %s 'rm -rf /'" % P),
    ("deny", "ssh %s 'cd /tmp && rm -fr ~'" % P),
    ("deny", "rsync -av --delete ./build/ %s:/opt/SERP/" % P),
    # ---- SQL ----------------------------------------------------------------------------------
    ("deny", "mysql -h 5.161.233.240 -u x serp_app -e 'DROP TABLE serp_stock_quant'"),
    ("deny", "mysql -h 5.161.233.240 -D serp_app -e \"TRUNCATE serp_stock_move\""),
    ("deny", "mysql -h 5.161.233.240 serp_app -e '/* harmless */ DELETE FROM serp_product'"),
    ("deny", "mysql -h 5.161.233.240 serp_app -e 'WITH t AS (SELECT 1) DELETE FROM serp_product WHERE id IN (SELECT * FROM t)'"),
    ("deny", "mysql -h 5.161.233.240 serp_app -e 'SELECT 1; ALTER TABLE serp_product DROP COLUMN name'"),
    ("deny", "mysql -h 5.161.233.240 serp_app <<'SQL'\nSELECT 1;\nDROP DATABASE serp_app;\nSQL"),
    ("deny", "mysql -h 5.161.233.240 serp_app < %s" % SQL_FILE),
    ("deny", "ssh root@5.161.233.240 \"mysql serp_app -e 'DELETE FROM serp_sale_order'\""),
    ("deny", "ssh %s 'kubectl exec -n serp deploy/serp-backend -- mysql -h 5.161.233.240 serp_app -e \"DROP TABLE x\"'" % P),
    ("deny", "mysql -h database-1.cqqg1tfyyubp.us-east-1.rds.amazonaws.com laravel_live -e 'DELETE FROM ec_order'"),
    ("deny", "mysql -h 5.161.233.240 serp_app -e 'GRANT ALL ON *.* TO x'"),
    ("deny", "mysql -h 5.161.233.240 serp_app -e '/*!50000 DROP TABLE x */'"),
    ("deny", "mysql -h 5.161.233.240 serp_app -e 'SET GLOBAL read_only=0'"),
    # ---- git / gh -----------------------------------------------------------------------------
    ("deny", "git push -f origin main"),
    ("deny", "git push --force-with-lease origin HEAD:main"),
    ("deny", "git push origin +main"),
    ("deny", "git push origin :main"),
    ("deny", "git push origin --delete main"),
    ("deny", "git -C /Users/jackkief/Desktop/Projects/SERP push --mirror origin"),
    ("deny", "gh repo delete Jack-Kiefer/SERP --yes"),
    ("deny", "gh api -X DELETE repos/Jack-Kiefer/SERP/git/refs/heads/main"),
    # ---- aws ----------------------------------------------------------------------------------
    ("deny", "aws ecr batch-delete-image --repository-name serp-backend --image-ids imageTag=x"),
    ("deny", "aws rds delete-db-instance --db-instance-identifier database-1"),
    ("deny", "aws ec2 terminate-instances --instance-ids i-123"),
    ("deny", "aws s3 rm s3://sugarwish-serp-db-backups --recursive"),
    ("deny", "ssh %s 'sudo -n env AWS_PROFILE=ecr aws ecr delete-repository --repository-name serp-backend'" % P),

    # ---- prod mutations Jack sometimes asks for -> ask -----------------------------------------
    ("ask", "ssh -o ConnectTimeout=15 %s 'kubectl -n serp set env deploy/serp-workers ORDER_QUEUE_WORKER_ENABLED=true && kubectl -n serp rollout status deploy/serp-workers'" % P),
    ("ask", "ssh -o ConnectTimeout=15 %s 'kubectl -n serp scale deploy/serp-workers --replicas=0'" % P),
    ("ask", "ssh %s 'kubectl -n serp rollout restart deploy/serp-backend'" % P),
    ("ask", "ssh %s 'kubectl -n serp rollout undo deploy/serp-backend'" % P),
    ("ask", "ssh %s 'kubectl apply -f /tmp/x.yaml'" % P),
    ("ask", "ssh %s 'kubectl -n serp exec deploy/serp-backend -- python manage.py shell'" % P),
    ("ask", "ssh %s 'kubectl -n serp delete pod serp-backend-9459f7c89-gvpgd'" % P),
    ("ask", "ssh %s 'kubectl -n serp patch deploy serp-backend -p {}'" % P),
    ("ask", "kubectl -n serp scale deploy/serp-workers --replicas=1"),
    ("ask", "ssh %s 'cd /opt/SERP && bash deploy-k8s.sh main'" % P),
    ("ask", "scp .env %s:/opt/SERP/.env" % P),
    ("ask", "ssh %s 'sudo systemctl restart k3s'" % P),
    ("ask", "ssh %s 'rm -rf /opt/SERP/tmp/cache'" % P),
    ("ask", "mysql -h 5.161.233.240 serp_app -e 'UPDATE serp_product SET active=0 WHERE id=5'"),
    ("ask", "mysql -h 5.161.233.240 serp_app -e 'INSERT INTO serp_x VALUES (1)'"),
    ("ask", "mysql -h 5.161.233.240 serp_app -e 'SELECT * FROM t INTO OUTFILE \"/tmp/x\"'"),
    ("ask", "mysql -h 5.161.233.240 -u jack -p serp_app"),
    ("ask", "cat changes.sql | mysql -h 5.161.233.240 serp_app"),
    ("ask", "git push origin main"),
    ("ask", "git -C /tmp/serp-hotfix push origin hotfix/x:main"),
    ("ask", "git push origin --all"),
    ("ask", "gh pr merge 1234 --merge"),
    ("ask", "gh pr merge 1234 --squash --admin"),
    ("ask", "aws ecr put-lifecycle-policy --repository-name x --lifecycle-policy-text file://p.json"),
    ("ask", "curl -X POST https://serp.sugarwish.com/api/purchase-orders -d '{}'"),
    ("ask", "ssh jack@deploy.sugarwish.com 'argocd app sync serp-prod'"),
    ("ask", "ssh %s 'sudo -n bash -c \"kubectl -n serp set image deploy/serp-backend serp-backend=x:1\"'" % P),

    # ---- allow: reads and non-prod work (drawn from real 30-day history) -----------------------
    ("allow", "ssh -o ConnectTimeout=15 %s 'kubectl get pods -n serp -o wide'" % P),
    ("allow", "ssh -o ConnectTimeout=15 %s 'kubectl get pod serp-backend-9459f7c89-gvpgd -n serp -o jsonpath={.status.phase}'" % P),
    ("allow", "ssh %s 'for d in serp-workers serp-backend; do kubectl logs -n serp deploy/$d --since=10m | tail -50; done'" % P),
    ("allow", "ssh %s 'kubectl -n serp rollout status deploy/serp-backend --timeout=300s'" % P),
    ("allow", "ssh %s 'kubectl describe node | grep -A6 Allocated'" % P),
    ("allow", "ssh %s 'timeout 20 kubectl top pods -n serp'" % P),
    ("allow", "ssh -o BatchMode=yes %s \"kubectl auth can-i '*' '*' --all-namespaces\"" % P),
    ("allow", "ssh %s 'kubectl get events -n serp --sort-by=.lastTimestamp | tail -20'" % P),
    ("allow", "ssh %s 'kubectl get secret serp-env -n serp -o jsonpath={.data}'" % P),
    ("allow", "ssh %s 'df -h / && free -m && uptime'" % P),
    ("allow", "ssh %s 'cat /opt/SERP/deploy-k8s.sh | head -40'" % P),
    ("allow", "ssh -o BatchMode=yes %s 'sudo -n kubectl exec -n serp-dev deploy/serp-dev-backend -- python -c \"print(1)\"'" % D),
    ("allow", "ssh %s 'kubectl rollout restart -n serp-dev deploy/serp-dev-backend'" % D),
    ("allow", "ssh %s 'kubectl set env deploy/serp-dev-workers -n serp-dev X=1'" % D),
    ("allow", "ssh %s 'kubectl -n serp-dev scale deploy/serp-dev-workers --replicas=0'" % D),
    ("allow", "kubectl get pods -n serp"),
    ("allow", "kubectl config get-contexts"),
    ("allow", "mysql -h 5.161.233.240 serp_app -e 'SELECT id, name FROM serp_product LIMIT 5'"),
    ("allow", "mysql -h 5.161.233.240 serp_app -e 'SHOW TABLES; DESCRIBE serp_product'"),
    ("allow", "mysql -h 5.161.233.240 serp_test -e 'UPDATE serp_product SET active=0 WHERE id=5'"),
    ("allow", "mysql -h 127.0.0.1 -P 3307 serp_local_prod -e 'DROP TABLE scratch'"),
    ("allow", "mysql -h 5.161.233.240 serp_app < %s" % READ_SQL_FILE),
    ("allow", "git push -u origin prod-guard"),
    ("allow", "git push origin feature/x:feature/x"),
    ("allow", "git -C /tmp/cortex-pr-prod-guard push -u origin prod-guard"),
    ("allow", "git status && git diff HEAD"),
    ("allow", "gh pr create --base main --head prod-guard --title x --body y"),
    ("allow", "gh pr view 123 --json state"),
    ("allow", "gh api repos/Jack-Kiefer/SERP/pulls/12"),
    ("allow", "curl -s https://serp.sugarwish.com/health"),
    ("allow", "bash %s" % SAFE_SCRIPT),
    ("allow", "rm -rf node_modules dist"),
    ("allow", "grep -rn 'kubectl delete' docs/ | head"),
    ("allow", "echo 'never run: kubectl get pods'"),
    ("allow", "npm run typecheck && npm run lint"),
    ("allow", "python3 -c 'print(1+1)'"),
    ("allow", "ls -la ~/.kube && which kubectl helm"),
    ("allow", "docker compose up -d"),
    # ---- regressions from the 30-day replay (false positives that must stay allowed) --------
    ("allow", "cat > /tmp/nuke-doc.sh <<'EOF'\nssh jack@5.161.95.56 'kubectl delete ns serp'\nEOF"),
    ("allow", "bash -n %s" % SCRIPT),
    ("allow", "printf '%s' '{\"command\":\"ssh jack@5.161.95.56 kubectl delete ns serp\"}' | jq ."),
    ("allow", "# don't touch prod here\nssh %s 'kubectl get pods -n serp' # it's read-only" % P),
    ("allow", "gh pr create --base dev --title x --body \"$(cat <<'EOF'\n## Summary\n1) don't delete\n2) kubectl delete ns is bad\nEOF\n)\""),
    ("allow", "ssh -o ConnectTimeout=15 %s 'set -e\nkubectl delete secret serp-dev-env -n serp-dev && kubectl create secret generic serp-dev-env --from-env-file=/opt/SERP-dev/.env -n serp-dev'" % D),
    # inline code cannot be told from data: a namespace-delete string inside it asks, never denies
    ("ask", "python3 - <<'PY'\np='docs/runbook.md'; s=open(p).read()\ns=s.replace('kubectl get ns','kubectl delete ns serp  # never')\nopen(p,'w').write(s)\nPY"),
    ("ask", "ssh %s \"mysql -h5.161.233.240 serp_app -e 'KILL 9058'\"" % P),
    ("ask", "gh api -X DELETE repos/Jack-Kiefer/SERP/deployments/123"),
    ("deny", "gh api -X DELETE repos/Jack-Kiefer/SERP"),
    ("deny", "ssh %s \"kubectl delete secret serp-env -n serp && kubectl create secret generic serp-env --from-env-file=/opt/SERP/.env -n serp\"" % P),
    ("allow", "ssh %s 'docker images | head'" % D),
]

MCP = [
    ("deny", "mcp__db__query_database", {"database": "serp_app", "query": "DELETE FROM serp_product"}),
    ("deny", "mcp__db__query_database", {"database": "serp_app", "query": "/* x */ DELETE FROM serp_product"}),
    ("deny", "mcp__db__query_database", {"database": "serp_app", "query": "WITH a AS (SELECT 1) DELETE FROM t"}),
    ("deny", "mcp__db__query_database", {"database": "serp_app", "query": "SELECT 1; DROP TABLE t"}),
    ("deny", "mcp__db__query_database", {"database": "serp_test", "query": "UPDATE serp_product SET x=1"}),
    ("deny", "mcp__db__query_database", {"database": "serp_app", "query": "SELECT * FROM t INTO OUTFILE '/tmp/x'"}),
    ("deny", "mcp__db__query_database_from_file", {"database": "serp_app", "path": SQL_FILE}),
    ("allow", "mcp__db__query_database", {"database": "serp_app", "query": "SELECT id FROM serp_product LIMIT 5"}),
    ("allow", "mcp__db__query_database", {"database": "serp_app", "query": "-- note\nWITH x AS (SELECT 1) SELECT * FROM x"}),
    ("allow", "mcp__db__query_database", {"database": "serp_app", "query": "SHOW GRANTS"}),
    ("allow", "mcp__db__query_database", {"database": "laravel_live", "query": "SELECT 'DELETE FROM x' AS s"}),
    ("allow", "mcp__db__query_database_from_file", {"database": "serp_app", "path": READ_SQL_FILE}),
    ("ask", "mcp__serp-orm__serp_sql", {"query": "DELETE FROM serp_product WHERE id=1"}),
    ("allow", "mcp__serp-orm__serp_sql", {"query": "SELECT 1"}),
    ("ask", "mcp__serp-orm__serp_unlink", {"model": "serp.product", "ids": [1]}),
    ("ask", "mcp__serp-api__api_call", {"method": "DELETE", "endpoint": "/api/x/1", "base_url": "https://serp.sugarwish.com"}),
    ("ask", "mcp__serp-api__api_call", {"method": "POST", "endpoint": "https://serp.sugarwish.com/api/x"}),
    ("allow", "mcp__serp-api__api_call", {"method": "POST", "endpoint": "/api/x"}),
    ("allow", "mcp__serp-api__api_call", {"method": "GET", "endpoint": "/api/x", "base_url": "https://serp.sugarwish.com"}),
    ("ask", "mcp__serpy__serpy_approve", {"draft_id": 1}),
    ("allow", "mcp__serpy-dev__serpy_approve", {"draft_id": 1}),
    ("ask", "mcp__python__run_python", {"code": "import subprocess\nsubprocess.run(\"ssh jack@5.161.95.56 'kubectl delete ns serp'\", shell=True)"}),
    ("allow", "mcp__python__run_python", {"code": "print(sum(range(10)))"}),
    ("allow", "mcp__serp-prod__pod_status", {"env": "prod"}),
]


# Bash / terminal-panel commands that touch the guard itself: always denied, even when unlocked.
TAMPER = [
    ("deny", "Bash", "sudo prod-guard-unlock 15 abcdef12-3456"),
    ("deny", "Bash", "prod-guard-unlock 60 all"),
    ("deny", "mcp__terminal__run_in_terminal", "sudo prod-guard-unlock 15 abcdef12-3456"),
    ("deny", "Bash", "sudo rm -rf '/Library/Application Support/ClaudeCode/prod-guard'"),
    ("deny", "Bash", "echo '{}' > '/Library/Application Support/ClaudeCode/managed-settings.d/50-prod-guard.json'"),
    ("deny", "Bash", "sudo touch '/Library/Application Support/ClaudeCode/prod-guard/unlock/_all'"),
    ("allow", "Bash", "prod-guard-unlock status"),
    ("allow", "Bash", "cat '/Library/Application Support/ClaudeCode/managed-settings.d/50-prod-guard.json'"),
    ("deny", "mcp__terminal__run_in_terminal", "ssh jack@5.161.95.56 'kubectl delete namespace serp'"),
    ("ask", "mcp__terminal__run_in_terminal", "ssh jack@5.161.95.56 'kubectl -n serp rollout restart deploy/serp-backend'"),
    ("allow", "mcp__terminal__run_in_terminal", "ssh jack@5.161.95.56 'kubectl logs -n serp deploy/serp-backend -f'"),
]


def unlock_tests():
    """Exercise the timed unlock in-process against a temp unlock dir (root ownership can't be
    faked in a test, so that one check is switched off here; the hook always enforces it)."""
    import importlib.util
    import time
    spec = importlib.util.spec_from_file_location("prod_guard", os.path.join(ROOT, "global-config", "scripts", "prod_guard.py"))
    pg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pg)
    d = tempfile.mkdtemp(prefix="pg-unlock-")
    pg.UNLOCK_DIR = d
    sid, other = "sess-aaaa1111", "sess-bbbb2222"
    nuke = {"tool_name": "Bash", "session_id": sid, "cwd": ROOT,
            "tool_input": {"command": "ssh jack@5.161.95.56 'kubectl delete namespace serp'"}}
    tamper = dict(nuke, tool_input={"command": "sudo prod-guard-unlock 60 all"})
    read = dict(nuke, tool_input={"command": "ssh jack@5.161.95.56 'kubectl get pods -n serp'"})

    def decision(payload):
        out = pg.respond(payload)
        return (out or {}).get("hookSpecificOutput", {}).get("permissionDecision", "allow"), out

    def put(name, exp):
        with open(os.path.join(d, name), "w") as fh:
            fh.write(str(exp))

    def clear():
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))

    now = int(time.time())
    results = []

    pg._REQUIRE_ROOT_OWNED = True
    put(sid, now + 600)
    results.append(("user-owned unlock file is ignored", decision(nuke)[0], "deny"))
    pg._REQUIRE_ROOT_OWNED = False
    clear()
    got, out = decision(nuke)
    results.append(("locked: deny", got, "deny"))
    reason = out["hookSpecificOutput"]["permissionDecisionReason"]
    results.append(("deny message names this session's unlock command",
                    "sudo prod-guard-unlock 15 %s" % sid in reason and "```bash" in reason, True))
    put(sid, now + 900)
    got, out = decision(nuke)
    results.append(("unlocked session: deny becomes ask", got, "ask"))
    results.append(("ask says it is normally blocked", "normally BLOCKED" in out["hookSpecificOutput"]["permissionDecisionReason"], True))
    results.append(("unlock does not cover another session", decision(dict(nuke, session_id=other))[0], "deny"))
    results.append(("unlock never covers tampering", decision(tamper)[0], "deny"))
    results.append(("reads unaffected while unlocked", decision(read)[0], "allow"))
    clear()
    put("_all", now + 900)
    results.append(("unlock all covers any session", decision(dict(nuke, session_id=other))[0], "ask"))
    clear()
    put(sid, now - 5)
    results.append(("expired unlock: deny", decision(nuke)[0], "deny"))
    clear()
    put(sid, now + 5 * 3600)
    results.append(("forged >60 min expiry is ignored", decision(nuke)[0], "deny"))
    clear()
    put(sid, "garbage")
    results.append(("malformed unlock file is ignored", decision(nuke)[0], "deny"))
    clear()
    put("x", now + 600)
    results.append(("path-like session id cannot match", decision(dict(nuke, session_id="../" + os.path.basename(d) + "/x"))[0], "deny"))
    return results


def run(tool, tool_input):
    payload = {"session_id": "t", "cwd": ROOT, "permission_mode": "auto", "hook_event_name": "PreToolUse",
               "tool_name": tool, "tool_input": tool_input}
    p = subprocess.run([HOOK], input=json.dumps(payload), capture_output=True, text=True, timeout=30)
    if p.returncode != 0:
        return "error(rc=%d): %s" % (p.returncode, p.stderr.strip()[:200]), ""
    out = p.stdout.strip()
    if not out:
        return "allow", ""
    d = json.loads(out)["hookSpecificOutput"]
    return d["permissionDecision"], d.get("permissionDecisionReason", "")


def main():
    fails = 0
    total = 0
    cases = [(e, "Bash", {"command": c}) for e, c in BASH] + MCP + [(e, t, {"command": c}) for e, t, c in TAMPER]
    for expected, tool, ti in cases:
        total += 1
        got, reason = run(tool, ti)
        if got != expected:
            fails += 1
            print("FAIL expected=%s got=%s  %s %s\n     %s" % (expected, got, tool, json.dumps(ti)[:220], reason[:220]))
    counts = {}
    for e, _, _ in cases:
        counts[e] = counts.get(e, 0) + 1
    print("%d/%d passed (deny %d, ask %d, allow %d)" % (total - fails, total, counts.get("deny", 0),
                                                        counts.get("ask", 0), counts.get("allow", 0)))
    ufails = 0
    ures = unlock_tests()
    for name, got, want in ures:
        if got != want:
            ufails += 1
            print("FAIL unlock: %s (got %r, want %r)" % (name, got, want))
    print("%d/%d unlock tests passed" % (len(ures) - ufails, len(ures)))
    fails += ufails
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
