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
  writeSkill(name, `Use when Jack invokes /${name}.`, readFileSync(join(commandsDir, entry.name), 'utf8'));
}

const skillsDir = join(globalConfig, 'skills');
for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
  const source = join(skillsDir, entry.name);
  if (!entry.isDirectory() || !existsSync(join(source, 'SKILL.md'))) continue;
  const target = join(targetRoot, entry.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  managedNames.add(entry.name);
}

writeFileSync(manifestPath, `${JSON.stringify([...managedNames].sort(), null, 2)}\n`);
console.log(`  Generated ${managedNames.size} Codex skills from global Claude commands and skills`);
