#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [globalConfig, targetRoot] = process.argv.slice(2);
if (!globalConfig || !targetRoot) {
  console.error('usage: sync-codex-skills.mjs <global-config> <target-root>');
  process.exit(2);
}

const managedNames = new Set();
const writeSkill = (name, description, body) => {
  const dir = join(targetRoot, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body.trim()}\n`);
  managedNames.add(name);
};

const genericAdaptation = '## Codex adaptation (generated)\n\nThis workflow comes from Claude Code. Preserve its intent, translate Claude-only tool and agent names to available Codex capabilities, never claim an unavailable tool ran, and give explicit user instructions precedence.\n\n';
const codexAdaptation = (name, body) => name === 'go'
  ? `${genericAdaptation}This is a Codex session. Every invocation of \`launch-repo-session.sh\` in this workflow MUST pass \`--agent codex\` immediately after the repository path. Ignore references that say the new process is Claude; launch Codex while preserving the routing, prompt, tab, and close behavior.\n\n${body}`
  : `${genericAdaptation}${body}`;

mkdirSync(targetRoot, { recursive: true });
const manifestPath = join(targetRoot, '.sugarwish-global-skills.json');
if (existsSync(manifestPath)) {
  for (const name of JSON.parse(readFileSync(manifestPath, 'utf8'))) {
    rmSync(join(targetRoot, name), { recursive: true, force: true });
  }
}
const commandsDir = join(globalConfig, 'commands');
for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
  const name = basename(entry.name, '.md');
  const body = readFileSync(join(commandsDir, entry.name), 'utf8');
  writeSkill(name, `Use when Jack invokes /${name}.`, codexAdaptation(name, body));
}

const skillsDir = join(globalConfig, 'skills');
for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
  const source = join(skillsDir, entry.name);
  if (!entry.isDirectory() || !existsSync(join(source, 'SKILL.md'))) continue;
  const target = join(targetRoot, entry.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  const skillPath = join(target, 'SKILL.md');
  const skill = readFileSync(skillPath, 'utf8')
    .replace(/^disable-model-invocation:.*\n/m, '')
    .replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n${genericAdaptation}`);
  writeFileSync(skillPath, skill);
  managedNames.add(entry.name);
}

writeFileSync(manifestPath, `${JSON.stringify([...managedNames].sort(), null, 2)}\n`);
console.log(`  Generated ${managedNames.size} Codex skills from global Claude commands and skills`);
