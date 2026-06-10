#!/usr/bin/env python3
"""Stamp the knowledge-refresh watermark after a successful /refresh-knowledge run.

Records `lastRun = <now>` (or a provided epoch) in <doc-dir>/.knowledge-refresh.json
so the next incremental run only mines transcripts modified after this point.

Usage:
  knowledge-refresh-stamp.py --doc <SUPPLEMENTARY_KNOWLEDGE.md> [--at <epoch>]

IMPORTANT: stamp with the `now` value the prep step returned (pass it via --at),
not the wall clock at the end of the run — otherwise transcripts written DURING
the run are skipped next time. The command passes prep's `now` through.
"""
import argparse, json, os, time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True)
    ap.add_argument("--at", type=int, default=None,
                    help="epoch seconds to record as lastRun (default: prep-time / now)")
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

    at = args.at if args.at is not None else int(time.time())
    state["lastRun"] = at
    state["lastRunISO"] = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(at))
    state["docPath"] = doc
    history = state.get("runHistory", [])
    history.append(state["lastRunISO"])
    state["runHistory"] = history[-20:]

    with open(state_path, "w") as fh:
        json.dump(state, fh, indent=2)
    print(f"Watermark stamped: lastRun={state['lastRunISO']} ({at}) -> {state_path}")


if __name__ == "__main__":
    main()
