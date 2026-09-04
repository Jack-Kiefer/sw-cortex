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
# HOW "TIGHT" IS MEASURED (revised 2026-09-04): NOT pure free RAM. macOS keeps
#   free RAM near zero BY DESIGN — it uses every spare page as reclaimable cache —
#   so a `free < 1.5GB` rule fired almost constantly and blocked heavy runs even
#   when the kernel had plenty of headroom (it just reclaims caches / compresses on
#   demand). That was "too scared": it refused to let a run pressure reclaimable
#   memory at all. The guard now trusts the KERNEL'S OWN verdict instead:
#     * kern.memorystatus_vm_pressure_level: 1=normal, 2=warn, 4=critical. We block
#       at >= 2 (warn or critical) — i.e. only once macOS itself says it is stressed,
#       having already reclaimed what it cheaply could.
#     * PLUS the hard swap-headroom floor (swap is the real wall that ran out on
#       Sept 2) and the concurrent-heavy-proc cap — either still blocks on its own.
#   Net effect: a heavy run is ALLOWED to push into reclaimable memory (healthy
#   pressure that makes macOS drop caches / compress), and is refused only when the
#   kernel flags warn/critical OR swap is nearly exhausted OR 2+ heavy runs are live.
#
# Exit 0 = allow. A deny is emitted as PreToolUse JSON on stdout.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -n "$cmd" ] || exit 0

# Is this a memory-heavy command? Cheap regex; skip everything else immediately.
printf '%s' "$cmd" | grep -qiE '(tsc|typecheck|type-check)|(jest|vitest|mocha)|(playwright|puppeteer|chromium|chrome.*--headless)|(webpack|vite build|esbuild|next build|npm run build)' || exit 0

# --- measure pressure ------------------------------------------------------
# The KERNEL'S real pressure verdict, not pure-free RAM. 1=normal, 2=warn,
# 4=critical. A missing/odd read -> treat as normal (1) so we fail OPEN.
pressure=$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null)
case "$pressure" in 1|2|4) : ;; *) pressure=1 ;; esac
# memorystatus_level is the kernel's free-percentage (higher = more free); purely
# informational, surfaced in the deny message so a human can gauge how tight it is.
mem_pct=$(sysctl -n kern.memorystatus_level 2>/dev/null)
[ -n "$mem_pct" ] || mem_pct="?"

# swap used/total in MB — swap headroom is the hard wall that ran out on Sept 2.
swap_used=$(sysctl -n vm.swapusage 2>/dev/null | sed -E 's/.*used = ([0-9.]+)M.*/\1/')
swap_total=$(sysctl -n vm.swapusage 2>/dev/null | sed -E 's/total = ([0-9.]+)M.*/\1/')

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
# Block ONLY on REAL pressure — let a heavy run push into reclaimable memory
# (that pressure is healthy: macOS drops caches / compresses in response), and
# refuse only when:
#   * the KERNEL says warn/critical (memorystatus_vm_pressure_level >= 2), OR
#   * swap is nearly exhausted (<800MB left) — the hard wall from Sept 2, OR
#   * two+ memory-heavy processes are already running.
# Any one is enough to make a third concurrent 7GB-ceiling process the thing that
# tips the machine over. (The old pure-free-RAM<1.5GB rule was removed — macOS keeps
# free near zero by design, so it fired constantly and blocked healthy runs.)
block=""
[ "${pressure:-1}" -ge 2 ] 2>/dev/null && block="the kernel reports memory pressure ($([ "$pressure" = 4 ] && echo CRITICAL || echo warn))"
[ "$swap_free" -lt 800 ] 2>/dev/null && block="swap nearly exhausted (${swap_free}MB free of ${swap_total}MB)"
[ "${heavy:-0}" -ge 2 ] 2>/dev/null && block="${heavy} memory-heavy processes are ALREADY running"

[ -n "$block" ] || exit 0

lvl=$([ "$pressure" = 4 ] && echo critical || { [ "$pressure" = 2 ] && echo warn || echo normal; })
jq -n --arg reason "$block" --arg lvl "$lvl" --arg mempct "$mem_pct" --arg swapfree "$swap_free" --arg heavy "$heavy" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("BLOCKED — machine is under memory pressure: " + $reason + ". (kernel pressure: " + $lvl + ", free " + $mempct + "%, swap free " + $swapfree + "MB, heavy procs running: " + $heavy + ")\n\nThis machine HARD-CRASHED on 2026-09-02 from exactly this: concurrent typecheck/jest runs with a 7-8GB per-process heap ceiling (SWAC package.json NODE_OPTIONS) on a 16GB box. jetsam killed ~360 processes, WindowServer was watchdog-killed, and 13 Claude sessions were lost.\n\nThis guard now trips only on REAL pressure (kernel warn/critical or swap near-empty), not on low free RAM — so a block means the machine is genuinely at the wall. DO NOT retry this command as-is, and do NOT route around the guard. Instead:\n  1. Run `herdr agent list` and see which peer is mid-typecheck/test.\n  2. Wait for it to finish, or message that peer to coordinate a slot (only ONE heavy run at a time across all sessions).\n  3. Re-run once memory recovers — check with `sysctl -n kern.memorystatus_vm_pressure_level` (want 1) and `sysctl -n vm.swapusage`.\n\nIf you genuinely must run it now, cap the heap yourself: NODE_OPTIONS=\"--max-old-space-size=3072\" prefixed on the command, and jest with --maxWorkers=2. Tell Jack why it could not wait.")
  }
}'
exit 0
