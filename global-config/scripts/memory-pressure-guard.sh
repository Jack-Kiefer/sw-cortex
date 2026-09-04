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
#     * PLUS the hard swap floor and the concurrent-heavy-proc cap.
#   Revised again 2026-09-04 (headroom-first): the pressure_level/swap-free signals
#   proved too twitchy to use alone — pressure_level flaps to 2 (warn) transiently
#   and swap runs near-full as a steady state, so the guard blocked while the machine
#   still had ~half its RAM free. The PRIMARY gate is now the kernel's free-percentage
#   (kern.memorystatus_level): >= 25% free ALWAYS allows, and only genuine starvation
#   (free-% low AND kernel CRITICAL, or free-% low AND swap <400MB) blocks.
#   Net effect: a heavy run is ALLOWED to pressure reclaimable memory whenever there
#   is real headroom, and refused only when the machine is actually low on free memory
#   AND hitting a hard wall — or when 2+ heavy runs are already live.
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
# HEADROOM IS THE PRIMARY GATE. kern.memorystatus_level is the kernel's own
# free-percentage — the honest "how much can I still hand out" number (it counts
# reclaimable cache + inactive pages, which macOS gives up on demand). When that is
# healthy, the machine is NOT starved no matter what the other signals say, so we
# ALLOW unconditionally and let the heavy run pressure reclaimable memory (healthy —
# macOS drops caches / compresses in response).
#
# Why this gate exists: the pressure_level and swap-free signals are too twitchy on
# a busy 16GB box to use alone. pressure_level flaps to 2 (warn) transiently even at
# ~44% free, and swap runs near-full as a STEADY STATE (macOS parks cold anonymous
# pages there and leaves them) — so "level>=2" and "swap-free<800MB" both fired while
# the machine had ~half its RAM free. Gating on free-% first fixes that: a transient
# warn or a steady-full swap no longer blocks when there is real headroom.
#
# ALLOW immediately when free-% >= 25 (plenty of headroom). Only past that do the
# hard signals get a vote, and only GENUINE starvation blocks:
#   * kernel CRITICAL (pressure_level == 4) — not mere warn, and
#   * swap almost gone (<400MB) — a much lower floor than before.
# The concurrent-heavy-proc cap (>=2) is independent of pressure — it stops piling a
# 3rd 7GB-ceiling run on top of two already live, which is the Sept-2 pile-up.
HEADROOM_PCT=25      # >= this free-% ALWAYS allows
SWAP_FLOOR_MB=400    # only a vote when headroom is already low

block=""
# free-% low AND a hard starvation signal → block
if [ "${mem_pct:-100}" != "?" ] && [ "${mem_pct:-100}" -lt "$HEADROOM_PCT" ] 2>/dev/null; then
  [ "${pressure:-1}" = 4 ] 2>/dev/null && block="the kernel reports CRITICAL memory pressure at ${mem_pct}% free"
  [ "$swap_free" -lt "$SWAP_FLOOR_MB" ] 2>/dev/null && block="only ${mem_pct}% RAM free and swap nearly exhausted (${swap_free}MB of ${swap_total}MB)"
fi
# concurrent-heavy cap is independent of current headroom
[ "${heavy:-0}" -ge 2 ] 2>/dev/null && block="${heavy} memory-heavy processes are ALREADY running"

[ -n "$block" ] || exit 0

lvl=$([ "$pressure" = 4 ] && echo critical || { [ "$pressure" = 2 ] && echo warn || echo normal; })

# Build the full reason as a shell string (real newlines via printf), then hand it
# to jq as a SINGLE --arg so jq escapes it into valid JSON. (Concatenating "\n"
# inside a jq expression emitted raw control chars that strict parsers reject.)
reason=$(printf '%s' "BLOCKED — machine is genuinely low on memory: ${block}. (free ${mem_pct}%, kernel pressure: ${lvl}, swap free ${swap_free}MB, heavy procs running: ${heavy})

This machine HARD-CRASHED on 2026-09-02 from exactly this: concurrent typecheck/jest runs with a 7-8GB per-process heap ceiling (SWAC package.json NODE_OPTIONS) on a 16GB box. jetsam killed ~360 processes, WindowServer was watchdog-killed, and 13 Claude sessions were lost.

This guard gates on real free-percentage headroom — it allows whenever >=25% RAM is free, so a block means free memory is genuinely low AND the machine is hitting a hard wall (kernel critical or swap almost gone), or 2+ heavy runs are already live. DO NOT retry this command as-is, and do NOT route around the guard. Instead:
  1. Run \`herdr agent list\` and see which peer is mid heavy run.
  2. Wait for it to finish, or message that peer to coordinate a slot (only ONE heavy run at a time across all sessions).
  3. Re-run once memory recovers — check \`sysctl -n kern.memorystatus_level\` (want >=25) and \`sysctl -n vm.swapusage\`. Freeing a heavy non-Claude app (Chrome/Docker/Spotify) or a detached session unblocks it fastest.

If you genuinely must run it now, cap the heap yourself: NODE_OPTIONS=\"--max-old-space-size=3072\" prefixed on the command, and workers limited (e.g. --maxWorkers=2). Tell Jack why it could not wait.")

jq -n --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
exit 0
