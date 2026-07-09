---
name: workflow-authoring
description: How Jack wants Workflow scripts built — a large CHEAP agent fleet (haiku/sonnet at low effort) for fan-out, Opus reserved for synthesis only, pipeline-not-barrier so one slow agent never stalls the rest, and straggler-dropping so nothing hangs. Use whenever authoring a Workflow script (the analyze-command research fan-out, or any ad-hoc workflow) — it is the source of truth for model/effort choice, control-flow shape, and fleet sizing.
disable-model-invocation: false
---

# Workflow Authoring — cheap fleet, no stalls, Opus only for synthesis

The point of a Workflow here is **more coverage per token**: many cheap agents doing
the fan-out, one expensive agent doing the thinking. A naive workflow does the opposite —
every `agent()` inherits the main-loop model (Opus), so an all-Opus fleet burns the budget
on grunt work. These rules make cheap-fan-out / expensive-synthesis the default.

Follow this whenever you write a Workflow script — the analyze research phase
(`/serp-analyze`, `/swac-analyze`) or any ad-hoc workflow.

## 1. Cheap by default — Opus ONLY for synthesis

`agent()` with no `model`/`effort` inherits the session model (Opus). That is the trap.

- **Pass `model` AND `effort` on every researcher/verifier `agent()` call.** The ONLY
  call that omits them (and thus inherits Opus) is the **final synthesis/judgment** agent.
- **Model per role:**
  - `haiku` — MCP-bound / mechanical: `describe_table`, KB search, Slack search, grep,
    reading a known file, structured extraction. This is most of the fleet.
  - `sonnet` — heavier reasoning or external docs: web research, tracing an unfamiliar
    code path, cross-file synthesis of one angle.
  - `opus` — the **one** synthesis agent that reasons over ALL findings to produce the
    plan/answer. Give it `effort: 'high'` (or `xhigh` for the hardest calls).
- **Effort:** researchers `effort: 'low'`. Low effort on haiku both costs less and
  **finishes faster** — which shortens the tail (see §3). Reserve `high`/`xhigh` for
  synthesis and any genuinely hard verify.

## 2. Structured output, not prose, from the fleet

Give every researcher a `schema` (JSON Schema) so it returns a validated object, not free
text. Then the synthesizer gets clean data (`JSON.stringify(findings)`) and spends its
expensive Opus tokens **reasoning**, not re-extracting facts from prose. Validation retries
happen at the tool layer, so you never hand-parse.

## 3. Never let one slow agent hold up the rest

This is the rule Jack cares about most: **more parallel at once, no stalls.**

- **DEFAULT TO `pipeline()`, not `parallel()`.** `parallel()` is a **barrier** — it waits
  for the slowest member before returning, so one stuck agent stalls everything.
  `pipeline()` has **no barrier between stages**: item A can be in stage 3 while item B is
  still in stage 1, so a slow researcher delays only its own chain. Wall-clock = slowest
  single item, not slowest-per-stage summed.
- **`.catch(() => null)` every researcher thunk.** A thrown or dead agent then resolves to
  `null` instead of rejecting — `parallel()`/`pipeline()` already turn a throw into `null`,
  but the explicit catch documents intent and lets you drop cleanly. Always
  `.filter(Boolean)` before synthesizing.
- **Over-provision and drop the tail.** Spawn more small agents than you strictly need and
  synthesize on the survivors — don't wait for every straggler. Note any dropped angle in
  the synthesis output's Risks/gaps so nothing silently vanishes.

**Use `parallel()` (barrier) ONLY when synthesis genuinely needs ALL findings at once** —
e.g. dedup across the whole set, or a plan that reasons over everything together. Even
then, keep the tail short (small cheap agents, drop stragglers). If synthesis can run
per-item, it's a pipeline, not a barrier.

## 4. Many small cheap agents > few fat ones

Splitting an angle into several small haiku agents beats one big agent: **lower variance,
shorter tail, more coverage per token.** This is the actual "more agents, same tokens"
mechanism — not one Opus agent doing everything serially. When an angle is broad, add
another small agent rather than widening one.

## 5. Size the fleet (optionally to budget)

- Default to a generous cheap fleet — the old 4-agent cap was about Opus coordination
  cost; cheap agents don't have it. 6–12 researchers is normal.
- **Scale to a token target when Jack sets one** (a `+500k`-style directive):
  ```js
  const FLEET = budget.total ? Math.max(6, Math.floor(budget.total / 100_000)) : 8;
  ```
  Guard any budget loop on `budget.total` — with no target, `budget.remaining()` is
  `Infinity` and a `while` loop runs to the agent cap.

## Canonical skeleton — cheap pipeline research → one Opus synthesis

```js
export const meta = {
  name: 'research-fanout',
  description: 'Cheap parallel research over independent angles, one Opus synthesis',
  phases: [{ title: 'Research' }, { title: 'Synthesize' }],
};

const FINDINGS = {
  /* JSON Schema: { angle, conclusions[], files[], risks[] } */
};
const REPORT = {
  /* JSON Schema: the plan/answer object the command consumes */
};

// One entry per angle. Split a broad angle into two small agents rather than one fat one.
const ANGLES = [
  { key: 'codebase', prompt: '…map where X is implemented…', model: 'haiku' },
  { key: 'schema', prompt: '…describe_table the relevant tables…', model: 'haiku' },
  { key: 'history', prompt: '…KB + Slack for prior decisions…', model: 'haiku' },
  { key: 'web', prompt: '…external lib/API docs…', model: 'sonnet' },
];

phase('Research');
// pipeline: each angle researches then self-verifies independently — no barrier.
const found = (
  await pipeline(
    ANGLES,
    (a) =>
      agent(a.prompt, {
        label: `research:${a.key}`,
        phase: 'Research',
        model: a.model,
        effort: 'low',
        schema: FINDINGS,
      }).catch(() => null),
    (r, a) =>
      r &&
      agent(
        `Sanity-check these ${a.key} findings, flag anything unsupported:\n${JSON.stringify(r)}`,
        {
          label: `verify:${a.key}`,
          phase: 'Research',
          model: 'haiku',
          effort: 'low',
          schema: FINDINGS,
        }
      ).catch(() => r) // verify failure → keep the raw finding, don't drop
  )
).filter(Boolean);

phase('Synthesize');
// The ONE Opus call — no model/effort override means it inherits Opus; make effort explicit.
const report = await agent(
  `Synthesize into a plan. Note any missing angle in risks.\n${JSON.stringify(found)}`,
  { label: 'synthesize', phase: 'Synthesize', model: 'opus', effort: 'high', schema: REPORT }
);
return report;
```

## When NOT to use a Workflow

A Workflow runs **headless start-to-finish** — it can't pause for Jack's approval or hand an
interactive build back to the session. So use it for the **research/fan-out** phase only;
keep present-for-approval and the interactive worktree build in the calling command. If the
Workflow tool is unavailable in the session, fall back to the `research-team` skill (same
cheap-fleet philosophy, Task-team primitives instead of a script).
