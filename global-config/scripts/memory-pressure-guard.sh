#!/bin/bash
# PreToolUse guard: block memory-heavy Bash commands while the machine is already
# under memory pressure.
#
# WHY THIS EXISTS — 2026-09-02, the Mac hard-crashed:
#   The VM compressor reached ~8.9GB on a 16GB machine. jetsam killed ~360 processes,
#   then started suspending real apps ("due to swap exhaustion": Chrome, Slack, Docker,
#   ghostty, Chrome for Testing), logged "System is unhealthy" and finally
#   "no victim found" — it had killed everything cheap and could not recover.
#   WindowServer went unresponsive and hit a userspace_watchdog_timeout. 13 Claude
#   sessions died with it.
#
#   Root cause was structural, not a fluke: SWAC's package.json sets
#   NODE_OPTIONS='--max-old-space-size=7168' on every jest script (and ~8192 on a
#   typecheck). That is a 7-8GB heap CEILING per process on a 16GB box, so two
#   concurrent runs can claim more RAM than physically exists. On the day, three
#   concurrent `tsc --noEmit` runs plus a Chromium were live at once.
#
#   SWAC is not ours to edit, so the cap cannot be fixed at the source. This guard
#   is the cortex-side mitigation: it refuses to START another heavy process when
#   there is no headroom left, which is precisely the moment the pile-up becomes fatal.
#
# WHAT IT BLOCKS: typecheck / tsc / jest / vitest / playwright / browser launches /
#   webpack / vite build / esbuild — but ONLY when memory is already tight.
#   Under normal conditions everything passes through untouched.
#
# Exit 0 = allow. A deny is emitted as PreToolUse JSON on stdout.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -n "$cmd" ] || exit 0

# Is this a memory-heavy command? Cheap regex; skip everything else immediately.
printf '%s' "$cmd" | grep -qiE '(tsc|typecheck|type-check)|(jest|vitest|mocha)|(playwright|puppeteer|chromium|chrome.*--headless)|(webpack|vite build|esbuild|next build|npm run build)' || exit 0

# --- measure pressure ------------------------------------------------------
# free pages + swap used. vm_stat page size is 16384 on Apple Silicon.
free_gb=$(vm_stat 2>/dev/null | awk '/Pages free/{gsub(/\./,"",$3); printf "%.2f", $3*16384/1073741824}')
swap_used=$(sysctl -n vm.swapusage 2>/dev/null | sed -E 's/.*used = ([0-9.]+)M.*/\1/')
swap_total=$(sysctl -n vm.swapusage 2>/dev/null | sed -E 's/total = ([0-9.]+)M.*/\1/')
[ -n "$free_gb" ] || exit 0          # can't measure -> never block

# swap_free in MB; treat a missing/odd read as "plenty" so we fail OPEN.
swap_free=$(awk -v t="${swap_total:-0}" -v u="${swap_used:-0}" 'BEGIN{printf "%.0f", t-u}' 2>/dev/null)
[ -n "$swap_free" ] || swap_free=99999

# Count heavy processes already running, so a 4th typecheck is refused even with headroom.
# NB: match on the EXECUTABLE basename via `ps -o comm=`, never the full command
# line — a full-line grep also matches this guard's own shell invocation (which
# contains these very words), which would make the count never drop below 2 and
# block every heavy command forever. Verified: comm= yields 0 on an idle machine.
heavy=$(ps ax -o comm= 2>/dev/null \
  | sed 's|.*/||' \
  | grep -cE '^(tsc|jest|vitest|Google Chrome for Testing)$' 2>/dev/null || true)
heavy=${heavy:-0}
# node-hosted runners show up as plain `node`; count those by their args instead,
# excluding any process whose args mention this guard.
node_heavy=$(pgrep -fl 'node' 2>/dev/null \
  | grep -vF 'memory-pressure-guard' \
  | grep -cE '(tsc --noEmit|jest|vitest)' 2>/dev/null || true)
heavy=$(( heavy + ${node_heavy:-0} ))

# --- thresholds ------------------------------------------------------------
# Block when free RAM is under 1.5GB, OR swap is nearly exhausted (<800MB left),
# OR two heavy processes are already running. Any one is enough to make a third
# concurrent 7GB-ceiling process the thing that tips the machine over.
block=""
awk -v f="$free_gb" 'BEGIN{exit !(f < 1.5)}' && block="only ${free_gb}GB of RAM free"
[ "$swap_free" -lt 800 ] 2>/dev/null && block="swap nearly exhausted (${swap_free}MB free of ${swap_total}MB)"
[ "${heavy:-0}" -ge 2 ] 2>/dev/null && block="${heavy} memory-heavy processes are ALREADY running"

[ -n "$block" ] || exit 0

jq -n --arg reason "$block" --arg free "$free_gb" --arg swapfree "$swap_free" --arg heavy "$heavy" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("BLOCKED — machine is under memory pressure: " + $reason + ". (free RAM " + $free + "GB, swap free " + $swapfree + "MB, heavy procs running: " + $heavy + ")\n\nThis machine HARD-CRASHED on 2026-09-02 from exactly this: concurrent typecheck/jest runs with a 7-8GB per-process heap ceiling (SWAC package.json NODE_OPTIONS) on a 16GB box. jetsam killed ~360 processes, WindowServer was watchdog-killed, and 13 Claude sessions were lost.\n\nDO NOT retry this command as-is, and do NOT route around the guard. Instead:\n  1. Run `herdr agent list` and see which peer is mid-typecheck/test.\n  2. Wait for it to finish, or message that peer to coordinate a slot (only ONE heavy run at a time across all sessions).\n  3. Re-run once memory recovers — check with `sysctl -n vm.swapusage`.\n\nIf you genuinely must run it now, cap the heap yourself: NODE_OPTIONS=\"--max-old-space-size=3072\" prefixed on the command, and jest with --maxWorkers=2. Tell Jack why it could not wait.")
  }
}'
exit 0
