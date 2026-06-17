#!/usr/bin/env python3
"""Mine Claude Code JSONL transcripts for *setup/tooling friction* — the inverse of
knowledge-extract-user-msgs.py (which mines Jack's typed corrections).

This finds where Claude Code's SETUP got in the way over the last few days: denied
tool calls, hook blocks, MCP errors, missing-module / env errors, OS-permission
gaps, API/overload errors, and user rejections. The /start-day "Claude-setup
diagnostic" step reads this output and turns the clusters into concrete fixes.

Usage:
  claude-setup-friction.py [--days N] [--root DIR] [--json]
    --days N   look back N days (default 3)
    --root DIR projects dir (default ~/.claude/projects)
    --json     emit machine-readable JSON (default: human summary)

Read-only. Stdlib only — deliberately no third-party imports, since a missing
module is one of the very failures this script diagnoses.
"""
import json, sys, os, glob, time, re, argparse
from collections import Counter, defaultdict

# ── friction taxonomy ──────────────────────────────────────────────────────
# Each bucket: (key, label, matcher). Order matters — first match wins, so the
# most specific / most-correct-guardrail buckets come before generic ones.
# `guardrail=True` means a deny here is WORKING AS INTENDED — the fix is a
# behavioral note ("stop doing X"), NEVER loosening the guard.
BUCKETS = [
    # working-as-intended guardrails — do NOT recommend disabling these
    ("git_stash", "git stash blocked (forbidden by hook)", True,
     lambda s: "git stash" in s and ("blocked" in s or "forbidden" in s or "denied" in s)),
    ("repo_write_guard", "write/git denied in a read-only repo (repo-write-guard)", True,
     lambda s: "repo-write-guard" in s or "read-only" in s and "repo" in s
               or ("not serp/swac/sw-cortex" in s)),
    # broken-setup signals — these are fixable
    ("mcp_roots", "MCP file access outside allowed roots", False,
     lambda s: "outside allowed roots" in s or "allowed roots:" in s),
    ("os_accessibility", "macOS Accessibility / VS Code tab automation", False,
     lambda s: "accessibility permission" in s or "could not open a vs code terminal" in s),
    ("missing_module", "missing Python module / env not set up", False,
     lambda s: "modulenotfounderror" in s or "no module named" in s
               or "externally-managed-environment" in s),
    ("mcp_error", "MCP server error / unreachable", False,
     lambda s: "mcp" in s and ("error" in s or "timed out" in s or "not connected" in s
                               or "failed to connect" in s)),
    ("db_pool", "DB connection / pool error", False,
     lambda s: "overflow connection" in s or "failed to create" in s and "connection" in s
               or "lock_deadlock" in s or "connection refused" in s),
    ("api_overload", "API overloaded / rate-limited / transient", False,
     lambda s: "overloaded" in s or "rate limit" in s or "rate_limit" in s
               or "529" in s or "too many requests" in s),
    # behavioral — user said no
    ("user_reject", "user rejected the tool use", True,
     lambda s: "user doesn't want to proceed" in s or "tool use was rejected" in s),
    ("permission_prompt", "permission prompt denied", False,
     lambda s: ("permission to use" in s and "denied" in s) or "has been denied" in s
               or "requested permissions" in s),
    # generic catch-all for any remaining is_error
    ("other_error", "other tool error", False,
     lambda s: True),
]


def signature(text, bucket_key):
    """Collapse a message to a dedupe key: bucket + first error-ish line, with
    volatile bits (paths, ids, timestamps, hashes) normalized out."""
    first = ""
    for ln in text.splitlines():
        ln = ln.strip()
        if ln:
            first = ln
            break
    first = first.lower()[:160]
    first = re.sub(r"req_[a-z0-9]+", "REQID", first)        # anthropic request ids
    first = re.sub(r'"request_id"\s*:\s*"[^"]*"', '"request_id":"REQID"', first)
    first = re.sub(r"[0-9a-f]{8}-[0-9a-f-]{20,}", "UUID", first)  # uuids
    first = re.sub(r"/[\w./-]+", "/PATH", first)
    first = re.sub(r"\b[0-9a-f]{7,}\b", "HASH", first)
    first = re.sub(r"\b\d+\b", "N", first)
    first = re.sub(r"\d{1,2}:\d{2}:\d{2}", "TIME", first)
    return (bucket_key, first)


def classify(text):
    low = text.lower()
    for key, label, guard, fn in BUCKETS:
        try:
            if fn(low):
                return key, label, guard
        except Exception:
            continue
    return "other_error", "other tool error", False


def result_text(blk):
    c = blk.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for b in c:
            if isinstance(b, dict) and b.get("type") == "text":
                parts.append(b.get("text", ""))
            elif isinstance(b, str):
                parts.append(b)
        return "\n".join(parts)
    return json.dumps(c)[:500] if c else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--root", default=os.path.expanduser("~/.claude/projects"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--top", type=int, default=15,
                    help="max clusters in the human summary (default 15)")
    args = ap.parse_args()

    cutoff = time.time() - args.days * 86400
    files = []
    for d in glob.glob(os.path.join(args.root, "*")):
        if not os.path.isdir(d):
            continue
        # top-level transcripts only — skip subagents/ and workflows/ subdirs
        for f in glob.glob(os.path.join(d, "*.jsonl")):
            if os.path.getmtime(f) >= cutoff:
                files.append(f)

    clusters = defaultdict(lambda: {"count": 0, "label": "", "guardrail": False,
                                    "repos": Counter(), "sample": ""})
    totals = Counter()

    for fn in files:
        repo = os.path.basename(os.path.dirname(fn)).split("-")[-1] or "?"
        try:
            fh = open(fn)
        except OSError:
            continue
        for line in fh:
            try:
                d = json.loads(line)
            except Exception:
                continue
            t = d.get("type")
            errs = []
            # tool_result errors live in user-type messages
            msg = d.get("message")
            if isinstance(msg, dict):
                content = msg.get("content")
                if isinstance(content, list):
                    for blk in content:
                        if isinstance(blk, dict) and blk.get("type") == "tool_result" \
                           and blk.get("is_error"):
                            errs.append(result_text(blk))
            # API/overload markers carried on system lines. Pull out just the
            # error message (NOT the whole JSON line) so the per-message uuid
            # doesn't defeat dedupe and flood the output with near-identical rows.
            if t == "system":
                err = d.get("error")
                emsg = err.get("message", "") if isinstance(err, dict) else ""
                probe = (emsg or d.get("content") or "").lower()
                if ("overloaded" in probe or "rate_limit" in probe or "rate limit" in probe
                        or "529" in probe or "too many requests" in probe):
                    errs.append(emsg or d.get("content") or "api error")

            for e in errs:
                if not e or not e.strip():
                    continue
                totals["all"] += 1
                key, label, guard = classify(e)
                sig = signature(e, key)
                c = clusters[sig]
                c["count"] += 1
                c["label"] = label
                c["guardrail"] = guard
                c["repos"][repo] += 1
                if not c["sample"]:
                    c["sample"] = re.sub(r"\s+", " ", e.strip())[:240]
                totals[key] += 1
        fh.close()

    ordered = sorted(clusters.items(), key=lambda kv: kv[1]["count"], reverse=True)

    if args.json:
        out = {
            "window_days": args.days,
            "files_scanned": len(files),
            "total_friction_events": totals["all"],
            "by_bucket": {k: v for k, v in totals.items() if k != "all"},
            "clusters": [
                {
                    "bucket": sig[0],
                    "label": c["label"],
                    "guardrail": c["guardrail"],
                    "count": c["count"],
                    "repos": dict(c["repos"]),
                    "sample": c["sample"],
                }
                for sig, c in ordered
            ],
        }
        print(json.dumps(out, indent=2))
        return

    print(f"Claude-setup friction — last {args.days} day(s), {len(files)} transcript(s), "
          f"{totals['all']} friction events")
    print("=" * 72)
    if not ordered:
        print("No friction signals found. Setup looks clean.")
        return
    # one-line bucket rollup first, so the totals are visible even when capped
    roll = ", ".join(f"{k}={v}" for k, v in
                     sorted(((k, v) for k, v in totals.items() if k != "all"),
                            key=lambda kv: kv[1], reverse=True))
    print(f"by bucket: {roll}\n")
    top = len(ordered) if args.top <= 0 else args.top
    for sig, c in ordered[:top]:
        tag = "GUARDRAIL (working as intended)" if c["guardrail"] else "FIXABLE"
        repos = ", ".join(f"{r}×{n}" for r, n in c["repos"].most_common(4))
        print(f"\n[{c['count']:>3}] {c['label']}  — {tag}")
        print(f"      repos: {repos}")
        print(f"      e.g.:  {c['sample']}")
    if len(ordered) > top:
        tail = sum(c["count"] for _, c in ordered[top:])
        print(f"\n…and {len(ordered) - top} more cluster(s) "
              f"({tail} event(s)) — pass --top 0 or --json for all.")


if __name__ == "__main__":
    main()
