#!/usr/bin/env bash
# extract-session-images.sh — dump pasted images from THIS session's transcript to disk.
#
# Used by /go and /launch to pass along images Jack attached in the hub session:
# a pasted image ([Image #N] chip) exists only as a base64 block in the session
# JSONL — there is no file path to hand to the launched `claude` process. This
# script re-materializes those blocks as real files so the launch prompt can
# reference them by path (the launched session Reads them itself).
#
# Usage: extract-session-images.sh [--last N]
#   --last N   Only extract images from the last N user messages (default: 1,
#              i.e. the message that triggered this /go).
#
# Output: one absolute file path per line (nothing if no images found).
# Files land in ~/.claude/go-attachments/<session>-<msgidx>-<n>.<ext>.

set -euo pipefail

LAST=1
while [ $# -gt 0 ]; do
  case "$1" in
    --last) shift; LAST="${1:-1}"; shift || true ;;
    *) echo "extract-session-images: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

SESSION_ID="${CLAUDE_CODE_SESSION_ID:-}"
if [ -z "$SESSION_ID" ]; then
  echo "extract-session-images: CLAUDE_CODE_SESSION_ID not set (not inside a claude session?)" >&2
  exit 1
fi

# Transcript path: ~/.claude/projects/<cwd-slug>/<session-id>.jsonl. The slug is
# the cwd with / and . replaced by -; rather than re-derive it, just find the file.
TRANSCRIPT="$(ls "$HOME"/.claude/projects/*/"$SESSION_ID".jsonl 2>/dev/null | head -1 || true)"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "extract-session-images: no transcript found for session $SESSION_ID" >&2
  exit 1
fi

OUT_DIR="$HOME/.claude/go-attachments"
mkdir -p "$OUT_DIR"

TRANSCRIPT="$TRANSCRIPT" SESSION_ID="$SESSION_ID" OUT_DIR="$OUT_DIR" LAST="$LAST" python3 - <<'PY'
import base64, json, os, sys

transcript = os.environ["TRANSCRIPT"]
session = os.environ["SESSION_ID"]
out_dir = os.environ["OUT_DIR"]
last = int(os.environ["LAST"])

EXT = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"}

# Collect (msg_index, [image blocks]) for every real user message with images.
user_msgs = []
with open(transcript) as f:
    for line in f:
        if '"type":"image"' not in line and '"type": "image"' not in line:
            # cheap prefilter — only image-bearing messages count, so --last 1
            # = the most recent user message that actually had pasted images
            # (the triggering /go message in practice). Tool-result screenshots
            # are excluded below (top-level image blocks only).
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("type") != "user":
            continue
        msg = rec.get("message") or {}
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        imgs = [
            b for b in content
            if isinstance(b, dict) and b.get("type") == "image"
            and isinstance(b.get("source"), dict) and b["source"].get("type") == "base64"
        ]
        if imgs:
            user_msgs.append(imgs)

if not user_msgs:
    sys.exit(0)  # no images — empty output, success

paths = []
for mi, imgs in enumerate(user_msgs[-last:]):
    for ni, blk in enumerate(imgs, 1):
        src = blk["source"]
        ext = EXT.get(src.get("media_type", ""), "png")
        path = os.path.join(out_dir, f"{session}-{mi}-{ni}.{ext}")
        with open(path, "wb") as out:
            out.write(base64.b64decode(src["data"]))
        paths.append(path)

print("\n".join(paths))
PY
