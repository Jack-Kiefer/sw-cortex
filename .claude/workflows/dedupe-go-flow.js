export const meta = {
  name: 'dedupe-go-flow-commands',
  description:
    'Find duplicated instructions across the go/analyze/launch/implement flow and propose shared skills',
  phases: [
    { title: 'Map', detail: 'deep-read each command/skill in the flow' },
    { title: 'Detect', detail: 'cluster duplication detection by topic' },
    { title: 'Plan', detail: 'synthesize a shared-skill de-duplication plan' },
  ],
};

const ROOT = '/Users/jackkief/Desktop/Projects';
const FILES = [
  {
    key: 'go',
    path: ROOT + '/sw-cortex/global-config/commands/go.md',
    role: 'hub research entry point',
  },
  {
    key: 'launch',
    path: ROOT + '/sw-cortex/global-config/commands/launch.md',
    role: 'hub fix-launcher, fires /implement per fix',
  },
  {
    key: 'global-analyze',
    path: ROOT + '/sw-cortex/global-config/commands/global-analyze.md',
    role: 'SWAC research+implement swarm',
  },
  {
    key: 'global-quick-analyze',
    path: ROOT + '/sw-cortex/global-config/commands/global-quick-analyze.md',
    role: 'quick assessment',
  },
  {
    key: 'serp-analyze',
    path: ROOT + '/SERP/.claude/commands/analyze.md',
    role: 'SERP research+approval+implement',
  },
  {
    key: 'serp-implement',
    path: ROOT + '/SERP/.claude/commands/implement.md',
    role: 'SERP implement-only, copied Phase 2A/2B/3 from analyze',
  },
  {
    key: 'serp-quick-analyze',
    path: ROOT + '/SERP/.claude/commands/quick-analyze.md',
    role: 'SERP quick assessment',
  },
  {
    key: 'sk-approval-block',
    path: ROOT + '/SERP/.claude/skills/approval-block/SKILL.md',
    role: 'skill: approval gate',
  },
  {
    key: 'sk-creating-worktree',
    path: ROOT + '/SERP/.claude/skills/creating-worktree/SKILL.md',
    role: 'skill: worktree+server',
  },
  {
    key: 'sk-spawning-implementer',
    path: ROOT + '/SERP/.claude/skills/spawning-implementer/SKILL.md',
    role: 'skill: implementer team',
  },
  {
    key: 'sk-implementing-in-worktree',
    path: ROOT + '/SERP/.claude/skills/implementing-in-worktree/SKILL.md',
    role: 'skill: implementer rulebook',
  },
  {
    key: 'sk-creating-pr',
    path: ROOT + '/SERP/.claude/skills/creating-pr/SKILL.md',
    role: 'skill: PR mechanics',
  },
  {
    key: 'sk-changelog-entry',
    path: ROOT + '/SERP/.claude/skills/changelog-entry/SKILL.md',
    role: 'skill: changelog',
  },
  {
    key: 'sk-task-resume',
    path: ROOT + '/SERP/.claude/skills/task-resume/SKILL.md',
    role: 'skill: resume audit',
  },
  {
    key: 'sk-presenting-analysis',
    path: ROOT + '/SERP/.claude/skills/presenting-analysis/SKILL.md',
    role: 'skill: presentation template',
  },
  {
    key: 'sk-research-team',
    path: ROOT + '/SERP/.claude/skills/research-team/SKILL.md',
    role: 'skill: research swarm',
  },
  {
    key: 'sk-landmine-check',
    path: ROOT + '/SERP/.claude/skills/landmine-check/SKILL.md',
    role: 'skill: rules+memory+KB sweep',
  },
];

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'exists', 'purpose', 'sections', 'blocks'],
  properties: {
    key: { type: 'string' },
    exists: { type: 'boolean' },
    purpose: { type: 'string' },
    lineCount: { type: 'number' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'lines', 'gist'],
        properties: {
          heading: { type: 'string' },
          lines: { type: 'string' },
          gist: { type: 'string' },
        },
      },
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'lines', 'excerpt'],
        properties: {
          topic: { type: 'string' },
          lines: { type: 'string' },
          excerpt: { type: 'string' },
        },
      },
    },
  },
};

phase('Map');
const rawMaps = await parallel(
  FILES.map(
    (f) => () =>
      agent(
        'Deep-read this file and produce a structural map of its instructions for a de-duplication audit.\n\n' +
          'FILE: ' +
          f.path +
          '\nKEY: ' +
          f.key +
          '\nROLE: ' +
          f.role +
          '\n\n' +
          'Read the ENTIRE file. Return its purpose, an ordered list of sections (heading + line range + gist), ' +
          'and a list of self-contained "blocks" that are the kind of instruction commonly duplicated across these files. ' +
          'Use these canonical topic labels when a block matches: ' +
          '"options-first-intake", "tab-status-table", "phase-0-resume", "kb-search-gate", "phase-2A-worktree", ' +
          '"phase-2B-local-on-dev", "phase-3-pr-merge-teardown", "approval-gate", "data-access-mcp-only", ' +
          '"research-swarm-roster", "presenting-analysis-template", "multi-launch", "fire-and-forget", "changelog", "say-it-once". ' +
          'For each block give the topic label, line range, and first ~200 chars verbatim for cross-file matching. ' +
          'If the file does not exist, set exists=false.',
        { label: 'map:' + f.key, phase: 'Map', schema: MAP_SCHEMA, agentType: 'Explore' }
      )
  )
);
const maps = rawMaps.map(
  (m, i) =>
    m || { key: FILES[i].key, exists: false, purpose: 'AGENT FAILED', sections: [], blocks: [] }
);

const byTopic = {};
for (const m of maps) {
  if (!m || !m.exists) continue;
  const blocks = m.blocks || [];
  for (const b of blocks) {
    if (!byTopic[b.topic]) byTopic[b.topic] = [];
    byTopic[b.topic].push({ file: m.key, lines: b.lines, excerpt: b.excerpt });
  }
}
const dupTopics = Object.keys(byTopic)
  .map((topic) => ({ topic, occ: byTopic[topic] }))
  .filter((d) => d.occ.length >= 2)
  .sort((a, b) => b.occ.length - a.occ.length);

log(
  'Mapped ' +
    maps.filter((m) => m.exists).length +
    '/' +
    FILES.length +
    ' files. ' +
    dupTopics.length +
    ' topics in 2+ files: ' +
    dupTopics.map((d) => d.topic + '(' + d.occ.length + ')').join(', ')
);

const DETECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'verdict', 'occurrences', 'divergence', 'canonicalHome', 'recommendation'],
  properties: {
    topic: { type: 'string' },
    verdict: {
      type: 'string',
      enum: [
        'true-duplicate',
        'near-duplicate-with-drift',
        'same-topic-different-content',
        'not-really-duplicated',
      ],
    },
    occurrences: { type: 'array', items: { type: 'string' } },
    divergence: { type: 'string' },
    canonicalHome: { type: 'string' },
    recommendation: { type: 'string' },
  },
};

phase('Detect');
const rawDetections = await parallel(
  dupTopics.map(
    (d) => () =>
      agent(
        'Audit whether a block of instruction is genuinely DUPLICATED across the go/analyze/launch/implement flow, ' +
          'and where its single source of truth should live.\n\n' +
          'TOPIC: ' +
          d.topic +
          '\nOCCURRENCES (' +
          d.occ.length +
          '):\n' +
          d.occ
            .map((o) => '  - ' + o.file + ' @ ' + o.lines + '\n    excerpt: ' + o.excerpt)
            .join('\n') +
          '\n\nFile paths: go=' +
          ROOT +
          '/sw-cortex/global-config/commands/go.md, launch=' +
          ROOT +
          '/sw-cortex/global-config/commands/launch.md, ' +
          'global-analyze=' +
          ROOT +
          '/sw-cortex/global-config/commands/global-analyze.md, global-quick-analyze=' +
          ROOT +
          '/sw-cortex/global-config/commands/global-quick-analyze.md, ' +
          'serp-analyze=' +
          ROOT +
          '/SERP/.claude/commands/analyze.md, serp-implement=' +
          ROOT +
          '/SERP/.claude/commands/implement.md, ' +
          'serp-quick-analyze=' +
          ROOT +
          '/SERP/.claude/commands/quick-analyze.md, sk-*=' +
          ROOT +
          '/SERP/.claude/skills/<name>/SKILL.md\n\n' +
          'Read the actual blocks in each file and compare precisely. Decide: TRUE duplicate / NEAR-duplicate that has DRIFTED (flag canonical) / ' +
          'same-topic-but-legitimately-different / not-really-duplicated. ' +
          'CONSTRAINTS for the recommendation: (1) Jack wants minimal ADDITIVE change AND is open to NEW shared skills if they make the flow work better together; ' +
          'prefer extracting a duplicated block into a shared skill that all consumers reference, over leaving N drifting copies. ' +
          '(2) global-config commands (go/launch/global-analyze/quick-analyze) run in the HUB or non-SERP repos and CANNOT invoke SERP repo-local skills — ' +
          'so a block shared between a global-config command and a SERP command needs a home reachable by both (a global-config skill synced to ~/.claude/skills, OR duplicated-by-necessity-but-flagged). ' +
          '(3) a command intro that re-explains a skill it then invokes is pure redundancy to cut. ' +
          'Name the canonical home (existing skill name / new skill to create + where it must live / "keep inline + reference") and give a concrete recommendation.',
        { label: 'detect:' + d.topic, phase: 'Detect', schema: DETECT_SCHEMA, effort: 'high' }
      )
  )
);
const detections = rawDetections.filter(Boolean);

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'biggestWins', 'newSkills', 'actions', 'risks'],
  properties: {
    summary: { type: 'string' },
    biggestWins: { type: 'array', items: { type: 'string' } },
    newSkills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'home', 'absorbs', 'consumers'],
        properties: {
          name: { type: 'string' },
          home: {
            type: 'string',
            description: 'global-config/skills (synced to ~/.claude/skills) or SERP/.claude/skills',
          },
          absorbs: { type: 'string', description: 'which duplicated blocks it absorbs' },
          consumers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'files', 'detail', 'effort', 'savesLines'],
        properties: {
          action: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          detail: { type: 'string' },
          effort: { type: 'string', enum: ['trivial', 'small', 'medium', 'large'] },
          savesLines: { type: 'string' },
        },
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

phase('Plan');
const plan = await agent(
  'Synthesize a de-duplication + shared-skill plan for the go -> analyze -> launch -> implement command/skill flow.\n\n' +
    'Given: (A) structural maps of every file, (B) per-topic duplication verdicts.\n\n' +
    '=== FILE MAPS ===\n' +
    JSON.stringify(
      maps.map((m) => ({
        key: m.key,
        exists: m.exists,
        purpose: m.purpose,
        sections: (m.sections || []).map((s) => s.heading + ' [' + s.lines + ']'),
      })),
      null,
      2
    ) +
    '\n\n' +
    '=== DUPLICATION VERDICTS ===\n' +
    JSON.stringify(detections, null, 2) +
    '\n\n' +
    'Produce a concrete ORDERED plan. Jack EXPLICITLY wants MORE shared skills so the whole flow "works well together" — so DO propose new shared skills where they collapse duplication, ' +
    'but still honor: prefer referencing an existing skill when one already fits; do not break the rule that global-config commands cannot call SERP repo-local skills ' +
    '(a block shared across that boundary must live in global-config/skills which syncs to ~/.claude/skills, reachable everywhere); do not rebuild working behavior. ' +
    'Known biggest instance: serp-implement.md was authored by COPYING analyze.md Phase 2A/2B/3 verbatim — collapse those into shared implementation skills both reference. ' +
    'Also: options-first-intake pasted across go/launch/global-analyze/quick-analyze/analyze; the tab-status table; data-access-MCP-only; the resume table; command intros re-explaining skills. ' +
    'List proposed new skills (name, where it must live, what it absorbs, who consumes it), then ordered actions (files, exact change, effort, lines saved), then risks / what NOT to over-extract.',
  { label: 'synthesize-plan', phase: 'Plan', schema: PLAN_SCHEMA, effort: 'xhigh' }
);

return { dupTopicCount: dupTopics.length, detections, plan };
