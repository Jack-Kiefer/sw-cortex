#!/usr/bin/env python3
"""Extract Jack's (human) messages from Claude Code JSONL transcripts.

Usage: python3 .extract_user_msgs.py <file1.jsonl> [file2.jsonl ...]
Prints only genuine user-typed text (skips tool_result payloads, command stdout,
system reminders, and meta entries). These are where Jack corrects the AI,
repeats himself, or explains how things really work.
"""
import json, sys, re

SKIP_PREFIXES = (
    "<command-name>", "<local-command", "Caveat:", "<system-reminder>",
    "[Request interrupted", "<command-message>", "<command-args>",
)

def text_of(msg):
    c = msg.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for blk in c:
            if isinstance(blk, dict):
                # skip tool_result blocks (these are tool output, not Jack)
                if blk.get("type") == "tool_result":
                    continue
                if blk.get("type") == "text":
                    parts.append(blk.get("text", ""))
            elif isinstance(blk, str):
                parts.append(blk)
        return "\n".join(parts)
    return ""

for fn in sys.argv[1:]:
    try:
        fh = open(fn)
    except OSError:
        continue
    short = fn.split("/")[-1][:8]
    for line in fh:
        try:
            d = json.loads(line)
        except Exception:
            continue
        if d.get("type") != "user":
            continue
        if d.get("isSidechain"):   # subagent-internal, not Jack
            continue
        msg = d.get("message", {})
        if msg.get("role") != "user":
            continue
        t = text_of(msg).strip()
        if not t:
            continue
        if any(t.startswith(p) for p in SKIP_PREFIXES):
            continue
        # Drop pasted terminal-log dumps (from `! cmd` runs / autopaste): lines
        # dominated by [frontend]/[backend]/timestamp/log-level markers are not Jack.
        lines = t.splitlines()
        if lines:
            log_like = sum(
                1 for ln in lines
                if re.search(r"^\s*(\[(frontend|backend)\]|\d{1,2}:\d{2}:\d{2}\s|GET |POST |PUT |DELETE |WARNING|INFO|ERROR|DEBUG|─{3,})", ln)
                or re.search(r"\b(took \d+ms|in \d+ms|next\.js:|application-code:)\b", ln)
            )
            if len(lines) >= 4 and log_like / len(lines) > 0.5:
                continue
        # collapse whitespace, keep it readable
        t = re.sub(r"\n{3,}", "\n\n", t)
        if len(t) < 2:
            continue
        # truncate any single very long paste so one blob can't dominate a shard
        if len(t) > 4000:
            t = t[:4000] + " …[truncated]"
        ts = d.get("timestamp", "")[:10]
        br = d.get("gitBranch", "")
        print(f"\n[{short} {ts} {br}] {t}")
    fh.close()
