#!/usr/bin/env python3
"""Read Codex rate limits and print a normalized JSON summary.

There is no `codex usage` command (upstream issues #20310 / #15281 are open and
unanswered), so the live number comes from `codex app-server`, which speaks
JSON-RPC over stdio. The `account/rateLimits/read` method returns the same
figures the TUI renders.

That RPC is EXPERIMENTAL with no stability guarantee, so a schema change must
degrade rather than break the router: on any failure we fall back to the last
`rate_limits` block recorded in the newest session rollout under
~/.codex/sessions/, which carries the same data (snake_case there, camelCase
over RPC).

Output (stdout):
  {"ok": true, "used_percent": 23, "resets_at": 1789860399,
   "plan_type": "pro", "source": "rpc"|"rollout"}
  {"ok": false, "error": "..."}                       # both paths failed

Never estimate quota from token counts. Codex limits are request-based, not
token-based: a verified session burned 642k tokens while used_percent held flat
at 2.0%. Token sums do not map to this percentage.
"""

import glob
import json
import os
import queue
import subprocess
import sys
import threading
import time

WEEKLY_WINDOW_MINS = 10080

# Buckets are per-model-family and the weekly window is NOT always `primary`
# (it moved there in newer builds), so always match on window duration rather
# than on position.


def _pick_weekly(bucket):
    """Return the weekly sub-bucket of a rate-limit bucket, or None.

    Accepts both the RPC (camelCase) and rollout-file (snake_case) shapes.
    """
    if not isinstance(bucket, dict):
        return None
    for key in ("primary", "secondary"):
        sub = bucket.get(key)
        if not isinstance(sub, dict):
            continue
        window = sub.get("windowDurationMins", sub.get("window_minutes"))
        if window == WEEKLY_WINDOW_MINS:
            return sub
    return None


def _normalize(rate_limits):
    """Pull the weekly percent out of a rateLimits payload."""
    if not isinstance(rate_limits, dict):
        return None

    # `rateLimitsByLimitId` is authoritative; `rateLimits` is a back-compat
    # single-bucket view. Prefer the "codex" family, which is the one general
    # agent work consumes.
    by_id = rate_limits.get("rateLimitsByLimitId")
    candidates = []
    if isinstance(by_id, dict):
        if isinstance(by_id.get("codex"), dict):
            candidates.append(by_id["codex"])
        candidates.extend(v for k, v in by_id.items() if k != "codex")
    candidates.append(rate_limits)

    for bucket in candidates:
        weekly = _pick_weekly(bucket)
        if weekly is None:
            continue
        used = weekly.get("usedPercent", weekly.get("used_percent"))
        if used is None:
            continue
        return {
            "used_percent": float(used),
            "resets_at": weekly.get("resetsAt", weekly.get("resets_at")),
            "plan_type": rate_limits.get("planType", rate_limits.get("plan_type")),
        }
    return None


def _read_rpc(timeout=20):
    """Primary path: live JSON-RPC against `codex app-server`."""
    proc = subprocess.Popen(
        ["codex", "app-server", "--listen", "stdio://"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
    )
    lines = queue.Queue()

    def reader():
        for line in proc.stdout:
            lines.put(line)

    threading.Thread(target=reader, daemon=True).start()

    def send(obj):
        proc.stdin.write(json.dumps(obj) + "\n")
        proc.stdin.flush()

    def wait_for(req_id, deadline):
        while time.time() < deadline:
            try:
                line = lines.get(timeout=max(0.01, deadline - time.time()))
            except queue.Empty:
                return None
            try:
                obj = json.loads(line)
            except ValueError:
                continue
            if obj.get("id") == req_id:
                return obj
        return None

    try:
        deadline = time.time() + timeout
        send({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"clientInfo": {
                "name": "sw-cortex-budget", "title": "sw-cortex-budget",
                "version": "1.0.0",
            }},
        })
        if not wait_for(1, deadline):
            return None
        send({"jsonrpc": "2.0", "method": "initialized", "params": {}})
        send({"jsonrpc": "2.0", "id": 2,
              "method": "account/rateLimits/read", "params": {}})
        resp = wait_for(2, deadline)
    finally:
        proc.kill()

    if not resp or "result" not in resp:
        return None
    result = resp["result"]
    return _normalize(result.get("rateLimits", result)) or _normalize(result)


def _read_rollout():
    """Fallback: the last rate_limits block in the newest session rollout."""
    pattern = os.path.expanduser("~/.codex/sessions/**/rollout-*.jsonl")
    files = glob.glob(pattern, recursive=True)
    if not files:
        return None
    for path in sorted(files, key=os.path.getmtime, reverse=True)[:5]:
        found = None
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    if "rate_limits" not in line:
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        continue
                    info = obj.get("payload", obj)
                    limits = info.get("rate_limits")
                    if limits is None and isinstance(info.get("info"), dict):
                        limits = info["info"].get("rate_limits")
                    if isinstance(limits, dict):
                        found = limits  # keep the LAST one in the file
        except OSError:
            continue
        if found:
            normalized = _normalize(found)
            if normalized:
                normalized["stale_file"] = path
                return normalized
    return None


def main():
    for source, fn in (("rpc", _read_rpc), ("rollout", _read_rollout)):
        try:
            data = fn()
        except Exception:
            data = None
        if data:
            data["ok"] = True
            data["source"] = source
            print(json.dumps(data))
            return 0
    print(json.dumps({"ok": False, "error": "codex quota unavailable"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
