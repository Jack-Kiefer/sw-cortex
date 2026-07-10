---
name: codex-implementer
description: Delegate a build chunk to OpenAI Codex CLI (`codex exec`, GPT-5.6 Sol) as the bulk implementer inside an existing worktree — brief composition with full context parity (everything a Claude implementer teammate would have, pre-fetched), the exact sandboxed invocation, untrusted-result verification, and the no-silent-retries escalation tree. Use at the implementer step of /serp-analyze, /implement, or /swac-analyze when a chunk fits the routing criteria (frontend/UI/SVG chunks, or mechanical chunks ≥~150 changed lines / ≥3 files). Never for research, blocking review gates, commit/push/PR/merge, or chunks needing live DB/KB lookups mid-build.
---

# Codex as the Bulk Implementer

Codex (GPT-5.6 Sol via `codex exec`) writes the code; the Claude session stays the
lead — it composes the brief, supervises, reviews the **real** diff, runs the verify
gates, and owns commit/push/PR/merge. Codex never talks to Jack, never pushes, never
merges, never verifies on Claude's behalf. The economics: bulk write-tokens move to the
flat-rate ChatGPT plan; Fable/Claude spends only on judgment.

## Routing — which chunks go to Codex

After the plan split (per `spawning-implementer` / the SWAC impl-team step), route each
chunk:

**To Codex:**

- Frontend/UI/SVG chunks (component markup, styling, icons/illustrations, layout) — any
  size; Sol is strong here.
- Mechanical multi-file chunks: ≥ ~150 changed lines expected, or ≥ 3 files.

**Stays with a Claude teammate:**

- Single-file diffs under ~150 lines (subprocess overhead loses to a teammate).
- DB migrations / schema changes.
- Judgment-heavy chunks (API design, cross-system semantics, anything the plan flags
  as uncertain).
- **Anything that fails the context-parity gate below.**

Never let a Codex run and any other agent (Codex or Claude) touch the same file
concurrently — same disjoint-files rule as the teammate split. Parallel Codex runs on
disjoint chunks are fine.

## Context parity — the hard gate

**The brief must carry everything a Claude implementer teammate would have.** A teammate
gets the task description plus ambient access (CLAUDE.md, rules, MCP tools, KB). Codex
has none of that at runtime — no MCP, no KB, no DB, no Slack — so each item must be
**pre-fetched into the brief**:

| A Claude teammate has…                             | The brief must contain…                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Its task's slice of the plan + Implementation Map  | That slice **verbatim** (file + symbol anchors, exact lines, tests to extend/create)      |
| `landmine-check` sweep (rules + memories + KB)     | The Landmines list filtered to this chunk's files/tables, each with its "why"             |
| `mcp__db__describe_table` on touched tables        | The **actual describe_table output pasted in** for every table the chunk reads/writes     |
| KB facts (`mcp__knowledge__search_knowledge`)      | Any KB fact the chunk depends on, stated as text                                          |
| The WW-### ticket (SWAC)                           | Ticket id + the acceptance-criteria body text                                             |
| Sight of the worktree's current state              | A summary of uncommitted changes (`git status --porcelain` + `git diff --stat`) if any    |
| Repo conventions (CLAUDE.md / rules)               | `AGENTS.md` at the worktree root — **verify it exists** before invoking (it's auto-read)  |
| The verify commands                                | Acceptance criteria as exact shell commands                                               |

**If any required context cannot be pre-fetched into the brief (the chunk would need
mid-build DB introspection or KB searches), do NOT route it to Codex** — that's a Claude
teammate's chunk. This is the "gets all the context Claude would" rule; when in doubt,
over-include.

## The brief file — `.codex-brief.md` in the worktree root

```markdown
# CODEX BRIEF v1 — <chunk name>

## Task
<the chunk's slice of the approved plan, verbatim>

## Implementation Map
<file + symbol anchor per change site · test files to extend/create>

## Landmines
<each gotcha + why it matters — from landmine-check, filtered to this chunk>

## Schema facts (pre-fetched — the ONLY schema truth you have)
<describe_table output for every touched table; omit section if no data touched>

## Worktree state
<uncommitted-changes summary, or "clean">

## Acceptance criteria (run these; report real exit status)
<exact commands, e.g. npm run test:backend && npm run lint>

## Constraints
- You have NO MCP tools, NO knowledge base, NO database access, NO network beyond this
  repo. Everything you need is above — if something is missing, STOP and report the gap
  in your final message. Never guess column names, join keys, or config values.
- Do not commit, push, or touch git config. Do not start/stop servers. Do not edit
  files outside the list in the Implementation Map.
- AGENTS.md in this repo root is in force.

## Final message format (JSON)
{"status":"done|blocked","files_touched":[…],"commands_run":[{"cmd":"…","exit":0}],"open_questions":[…]}
```

## Invocation — every flag is load-bearing

Write the brief, then run from the Claude session as a **Bash tool call with
`timeout: 600000`** (macOS has no `timeout` binary — the Bash tool's timeout parameter
IS the wall-clock cap; use `run_in_background: true` for long chunks and wait for the
completion notification, never poll):

```bash
cd <worktree> && codex exec -s workspace-write -C <worktree> -m gpt-5.6-sol \
  -c 'sandbox_workspace_write.exclude_slash_tmp=true' \
  -o .codex-result.md - < .codex-brief.md
```

- `-s workspace-write` — never `danger-full-access`, never any `--dangerously-*` flag.
- `-c 'sandbox_workspace_write.exclude_slash_tmp=true'` — **required.** Default
  workspace-write allows writes to `/tmp`, and cortex PR worktrees live in `/tmp`
  (verified 2026-07-10: /tmp escape ALLOWED without the flag, blocked with it).
- `-C <worktree>` — the sandbox boundary; also where AGENTS.md is auto-read from.
- `-o .codex-result.md` — the self-report lands in a file, not scraped from stdout.
- The write-guard hook does NOT bind Codex's file writes — this sandbox config is the
  only fence. That's why the flags are non-negotiable.

## After the run — verify like it's untrusted (it is)

1. Read `.codex-result.md` — treat as a claim, never proof.
2. `git -C <worktree> status --porcelain` + `git -C <worktree> diff` — the **real**
   result. Every touched file must be in the brief's Implementation Map; anything
   outside it → treat the run as failed and revert those hunks.
3. Run the acceptance commands yourself (the pipeline's existing verify gates —
   test/lint/typecheck — run unchanged afterward; Codex's run doesn't substitute).
4. Delete `.codex-brief.md` / `.codex-result.md` before staging — strictly-scoped
   commits, and these are scratch.

## Escalation tree — no silent retries

- Result file missing/malformed, or the run hit the timeout → fall back to a Claude
  teammate for that chunk; note it in the wrap-up.
- Diff touches files outside the brief → revert those hunks, treat as failed.
- Tests fail on an otherwise-plausible diff → **Claude fixes the diff directly**; do
  NOT re-run Codex on the same brief.
- The brief itself was wrong/incomplete → fix the brief, re-run **once**, fresh
  (`codex exec`, not `resume`).
- Two failures on one chunk → it's a Claude teammate's chunk now.

## Optional second use: advisory cross-model review

After the verify gates pass, optionally get a second-model opinion on the final diff:

```bash
git -C <worktree> diff <base>...HEAD | codex exec -s read-only -C <worktree> \
  -m gpt-5.6-sol -o .codex-review.md - <<< "Adversarially review this diff for bugs, edge cases, and convention violations. Diff follows on stdin."
```

Findings go into the PR body under `## Cross-model review (Codex)` — **advisory only,
never a blocking gate** (no two-model consensus rituals; Jack's merge decision and the
existing gates are unchanged).

## One-time smoke tests (passed 2026-07-10, codex 0.144.1 / gpt-5.6 GA)

Re-run these three if the Codex CLI major/minor version changes:

1. **AGENTS.md auto-read** — canary instruction in a scratch repo's AGENTS.md is obeyed
   by `codex exec` with `-C` at that root. ✅
2. **Sandbox** — write attempts to `$HOME` and (with the exclude flag) `/tmp` from a
   workspace-write run are BLOCKED; workspace-internal writes succeed. ✅
   (Without `exclude_slash_tmp=true`, `/tmp` writes are ALLOWED — the flag is required.)
3. **Output plumbing** — `-o` file contains exactly the final message; `-m gpt-5.6-sol`
   is a valid model id (`gpt-5.6-luna` for cheap smoke runs). ✅
