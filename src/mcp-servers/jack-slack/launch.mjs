#!/usr/bin/env node
/**
 * jack-slack MCP launcher.
 *
 * The upstream @modelcontextprotocol/server-slack package reads SLACK_BOT_TOKEN
 * and SLACK_TEAM_ID straight from process.env and does not load any .env file.
 * To keep the bot token out of ~/.mcp.json, this launcher loads sw-cortex's
 * .env (via DOTENV_CONFIG_PATH), maps JACK_SLACK_BOT_TOKEN -> SLACK_BOT_TOKEN
 * (the .env keeps the jack-slack token under its own name so it doesn't clash
 * with the other SLACK_BOT_TOKEN used elsewhere), then execs the package via
 * npx with that environment inherited.
 */
import { config as loadEnv } from 'dotenv';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
loadEnv({ path: process.env.DOTENV_CONFIG_PATH || resolve(here, '../../../.env') });

const env = { ...process.env };
// Always run as jackbot: JACK_SLACK_BOT_TOKEN wins unconditionally. The .env
// also defines a different SLACK_BOT_TOKEN (another bot) and dotenv/the shell
// may set it first — so we must OVERRIDE it here, not just fill it in when
// empty. Without this, jack-slack would silently post as the other bot (which
// isn't in the same channels), causing channel_not_found.
if (env.JACK_SLACK_BOT_TOKEN) {
  env.SLACK_BOT_TOKEN = env.JACK_SLACK_BOT_TOKEN;
}

if (!env.SLACK_BOT_TOKEN || !env.SLACK_TEAM_ID) {
  console.error(
    'jack-slack: missing SLACK_BOT_TOKEN (JACK_SLACK_BOT_TOKEN) or SLACK_TEAM_ID in .env'
  );
  process.exit(1);
}

const child = spawn('npx', ['-y', '@modelcontextprotocol/server-slack'], {
  stdio: 'inherit',
  env,
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error(`jack-slack: failed to launch server-slack: ${err.message}`);
  process.exit(1);
});
