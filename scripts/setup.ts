#!/usr/bin/env npx tsx
/**
 * sw-cortex Setup Script
 *
 * Interactive setup for first-time configuration.
 * Run: npm run setup
 *
 * This script:
 * 1. Creates .env from .env.example if needed
 * 2. Generates ~/.mcp.json with correct paths
 * 3. Generates ~/CLAUDE.md from template
 * 4. Initializes the task database
 */

import { existsSync, copyFileSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

const projectRoot = process.cwd();

// Create readline interface for prompts
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createReadline();
  const displayQuestion = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${suffix}`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

function printHeader(text: string) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60) + '\n');
}

function printStep(step: number, text: string) {
  console.log(`\n[${step}] ${text}`);
}

async function main() {
  printHeader('sw-cortex Setup');
  console.log('This script will configure sw-cortex for your environment.\n');
  console.log(`Project root: ${projectRoot}`);

  // Step 1: Check/create .env
  printStep(1, 'Environment Configuration');

  const envPath = resolve(projectRoot, '.env');
  const envExamplePath = resolve(projectRoot, '.env.example');

  if (!existsSync(envPath)) {
    if (existsSync(envExamplePath)) {
      console.log('Creating .env from .env.example...');
      copyFileSync(envExamplePath, envPath);
      console.log('  Created .env');
      console.log('  ⚠️  Remember to edit .env with your actual credentials');
    } else {
      console.log('  Warning: No .env.example found');
    }
  } else {
    console.log('  .env already exists');
  }

  // Step 2: Get user name for personalization
  printStep(2, 'User Configuration');

  const userName = await prompt('Your name (for personalized docs)', 'User');

  // Step 3: Generate MCP config
  printStep(3, 'MCP Server Configuration');

  const mcpServers: Record<string, object> = {};
  const serverDirs = ['db', 'github', 'discoveries', 'slack-search', 'logs'];

  for (const server of serverDirs) {
    const serverPath = resolve(projectRoot, `src/mcp-servers/${server}/index.ts`);
    if (existsSync(serverPath)) {
      mcpServers[server] = {
        command: 'npx',
        args: ['tsx', serverPath],
        cwd: projectRoot,
        env: {
          DOTENV_CONFIG_PATH: envPath,
        },
      };
      console.log(`  Found: ${server}`);
    }
  }

  const mcpConfig = { mcpServers };
  const mcpPath = resolve(homedir(), '.mcp.json');

  if (existsSync(mcpPath)) {
    const overwrite = await confirm('~/.mcp.json exists. Overwrite?', false);
    if (!overwrite) {
      console.log('  Skipped MCP config');
    } else {
      writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
      console.log(`  Written to ${mcpPath}`);
    }
  } else {
    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
    console.log(`  Written to ${mcpPath}`);
  }

  // Step 4: Generate global CLAUDE.md
  printStep(4, 'Global Claude Configuration');

  const claudeTemplatePath = resolve(projectRoot, 'global-config/CLAUDE.md.template');
  const claudeSourcePath = resolve(projectRoot, 'global-config/CLAUDE.md');
  const claudeDestPath = resolve(homedir(), 'CLAUDE.md');

  // Use template if it exists, otherwise use the source file
  const claudeSource = existsSync(claudeTemplatePath) ? claudeTemplatePath : claudeSourcePath;

  if (existsSync(claudeSource)) {
    let claudeContent = readFileSync(claudeSource, 'utf-8');
    // Replace template variables
    claudeContent = claudeContent.replace(/\{\{USER_NAME\}\}/g, userName);
    claudeContent = claudeContent.replace(/Jack's/g, `${userName}'s`);
    claudeContent = claudeContent.replace(/Jack/g, userName);

    if (existsSync(claudeDestPath)) {
      const overwrite = await confirm('~/CLAUDE.md exists. Overwrite?', false);
      if (!overwrite) {
        console.log('  Skipped CLAUDE.md');
      } else {
        writeFileSync(claudeDestPath, claudeContent);
        console.log(`  Written to ${claudeDestPath}`);
      }
    } else {
      writeFileSync(claudeDestPath, claudeContent);
      console.log(`  Written to ${claudeDestPath}`);
    }
  } else {
    console.log('  Warning: No CLAUDE.md template found');
  }

  // Step 5: Ensure directories exist
  printStep(5, 'Directory Setup');

  const dirs = ['logs', 'tasks', 'workflows/n8n'];
  for (const dir of dirs) {
    const dirPath = resolve(projectRoot, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log(`  Created ${dir}/`);
    } else {
      console.log(`  Exists: ${dir}/`);
    }
  }

  // Step 6: Database initialization note
  printStep(6, 'Database Setup');
  console.log('  Run `npm run db:migrate` to initialize the task database');

  // Summary
  printHeader('Setup Complete!');

  console.log('Next steps:\n');
  console.log('1. Edit .env with your credentials:');
  console.log('   - Database connections (if using)');
  console.log('   - Slack tokens (if using Slack integration)');
  console.log('   - Qdrant credentials (if using vector search)');
  console.log('   - GitHub token (if using GitHub integration)');
  console.log('');
  console.log('2. Configure GitHub repos (optional):');
  console.log('   Add to .env:');
  console.log('   GITHUB_REPOS=[{"owner":"yourorg","repo":"yourrepo","description":"..."}]');
  console.log('');
  console.log('3. Initialize database:');
  console.log('   npm run db:migrate');
  console.log('');
  console.log('4. Restart Claude Code to pick up MCP configuration');
  console.log('');
  console.log('5. Start development:');
  console.log('   npm run dev');
  console.log('');
  console.log('Optional:');
  console.log('  - Run `bash scripts/install-systemd.sh` for background services');
  console.log('  - Run `pm2 start ecosystem.config.cjs` for PM2 services');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
