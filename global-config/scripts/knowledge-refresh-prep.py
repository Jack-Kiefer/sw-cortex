#!/usr/bin/env python3
"""Prep step for /refresh-knowledge.

Finds the inputs that changed since the last knowledge refresh and shards the
Claude Code transcripts so the refresh workflow can mine only what's NEW (fast,
incremental weekly runs) — or everything on a full rebuild.

State lives next to the output doc:  <doc-dir>/.knowledge-refresh.json
  { "lastRun": <epoch-seconds>, "lastRunISO": "...", "docPath": "..." }

Usage:
  knowledge-refresh-prep.py --doc <SUPPLEMENTARY_KNOWLEDGE.md> [--shards N] [--full] [--min-bytes 2000]

Outputs (printed as a single JSON object on stdout for the command to read):
  {
    "mode": "incremental" | "full",
    "since": <epoch or null>,
    "sinceISO": <str or null>,
    "now": <epoch>,
    "nowISO": <str>,
    "docExists": bool,
    "docPath": str,
    "shardManifest": "<path to .refresh_shards.json>",
    "shardCount": N,
    "newTranscripts": <count of transcripts in scope>,
    "totalTranscripts": <count of all top-level transcripts>,
    "statePath": str
  }

Only TOP-LEVEL transcripts (~/.claude/projects/<proj>/<uuid>.jsonl) are mined —
these are the conversations where the human participates. Files under
subagents/ and workflows/ are agent-internal (no human turns) and are skipped.
"""
import argparse, glob, json, os, sys, time

PROJECTS = os.path.expanduser("~/.claude/projects")


def top_level_transcripts():
    out = []
    for proj in glob.glob(os.path.join(PROJECTS, "*")):
        if not os.path.isdir(proj):
            continue
        # only direct children *.jsonl  (skip subagents/, workflows/ subdirs)
        for f in glob.glob(os.path.join(proj, "*.jsonl")):
            out.append(f)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True, help="path to SUPPLEMENTARY_KNOWLEDGE.md")
    ap.add_argument("--shards", type=int, default=12)
    ap.add_argument("--full", action="store_true", help="ignore watermark; mine everything")
    ap.add_argument("--min-bytes", type=int, default=2000,
                    help="skip transcripts smaller than this on a FULL run (tiny/aborted sessions)")
    args = ap.parse_args()

    doc = os.path.abspath(os.path.expanduser(args.doc))
    doc_dir = os.path.dirname(doc)
    state_path = os.path.join(doc_dir, ".knowledge-refresh.json")

    state = {}
    if os.path.exists(state_path):
        try:
            state = json.load(open(state_path))
        except Exception:
            state = {}

    now = int(time.time())
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now))
    since = state.get("lastRun")
    doc_exists = os.path.exists(doc)

    # Full run if: --full, no prior state, or the doc is missing.
    full = args.full or since is None or not doc_exists
    mode = "full" if full else "incremental"

    all_files = top_level_transcripts()
    if full:
        scope = [f for f in all_files if os.path.getsize(f) >= args.min_bytes]
    else:
        scope = [f for f in all_files if os.path.getmtime(f) > since]

    # size-balanced round-robin shards (largest-first into currently-smallest shard)
    nsh = max(1, min(args.shards, max(1, len(scope))))
    shards = [[] for _ in range(nsh)]
    sizes = [0] * nsh
    for f in sorted(scope, key=os.path.getsize, reverse=True):
        i = min(range(nsh), key=lambda k: sizes[k])
        shards[i].append(f)
        sizes[i] += os.path.getsize(f)

    manifest = os.path.join(doc_dir, ".refresh_shards.json")
    with open(manifest, "w") as fh:
        json.dump([{"shard": i, "files": s} for i, s in enumerate(shards) if s], fh)

    result = {
        "mode": mode,
        "since": since,
        "sinceISO": state.get("lastRunISO"),
        "now": now,
        "nowISO": now_iso,
        "docExists": doc_exists,
        "docPath": doc,
        "shardManifest": manifest,
        "shardCount": sum(1 for s in shards if s),
        "newTranscripts": len(scope),
        "totalTranscripts": len(all_files),
        "statePath": state_path,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
