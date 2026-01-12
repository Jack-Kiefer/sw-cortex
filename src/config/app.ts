/**
 * Application Configuration
 *
 * Central configuration module for sw-cortex.
 * All paths and user-specific settings are loaded from environment variables.
 */

import { z } from 'zod';
import { resolve } from 'path';

// Repository configuration schema
const RepoConfigSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  description: z.string().optional(),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;

// n8n credential configuration schema
const N8nCredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const N8nCredentialsSchema = z
  .object({
    odooPostgres: N8nCredentialSchema.optional(),
    sugarwishMysql: N8nCredentialSchema.optional(),
    slackApi: N8nCredentialSchema.optional(),
  })
  .optional();

// Main application configuration schema
const AppConfigSchema = z.object({
  // Paths
  projectRoot: z.string(),
  logsDir: z.string(),
  tasksDbPath: z.string(),
  workflowsDir: z.string(),

  // User info
  userName: z.string().default('User'),

  // GitHub repos
  githubRepos: z.array(RepoConfigSchema).default([]),

  // n8n credentials (optional)
  n8nCredentials: N8nCredentialsSchema,
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Parse GitHub repos from environment variable
 */
function parseGithubRepos(): RepoConfig[] {
  const reposJson = process.env.GITHUB_REPOS;
  if (!reposJson || reposJson === '[]') {
    return [];
  }
  try {
    const parsed = JSON.parse(reposJson);
    return z.array(RepoConfigSchema).parse(parsed);
  } catch (e) {
    console.warn('[config] Failed to parse GITHUB_REPOS:', e);
    return [];
  }
}

/**
 * Parse n8n credentials from environment variable
 */
function parseN8nCredentials() {
  const credsJson = process.env.N8N_CREDENTIALS;
  if (!credsJson) {
    return undefined;
  }
  try {
    return N8nCredentialsSchema.parse(JSON.parse(credsJson));
  } catch (e) {
    console.warn('[config] Failed to parse N8N_CREDENTIALS:', e);
    return undefined;
  }
}

/**
 * Load and validate application configuration
 */
function loadConfig(): AppConfig {
  // Detect project root - prefer env var, fallback to cwd
  const projectRoot = process.env.SW_CORTEX_ROOT || process.cwd();

  return AppConfigSchema.parse({
    projectRoot,
    logsDir: process.env.SW_CORTEX_LOGS || resolve(projectRoot, 'logs'),
    tasksDbPath: process.env.TASK_DB_PATH || resolve(projectRoot, 'tasks/tasks.db'),
    workflowsDir: process.env.SW_CORTEX_WORKFLOWS || resolve(projectRoot, 'workflows/n8n'),
    userName: process.env.SW_CORTEX_USER || 'User',
    githubRepos: parseGithubRepos(),
    n8nCredentials: parseN8nCredentials(),
  });
}

// Lazy-loaded config (validated on first access)
let _config: AppConfig | null = null;

/**
 * Get application configuration
 * Validates and caches config on first access
 */
export function getAppConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  return getAppConfig().projectRoot;
}

/**
 * Get user name for personalization
 */
export function getUserName(): string {
  return getAppConfig().userName;
}

/**
 * Get configured GitHub repositories
 */
export function getGithubRepos(): RepoConfig[] {
  return getAppConfig().githubRepos;
}

/**
 * Get n8n credentials if configured
 */
export function getN8nCredentials() {
  return getAppConfig().n8nCredentials;
}

/**
 * Reset config cache (useful for testing)
 */
export function resetConfig(): void {
  _config = null;
}
