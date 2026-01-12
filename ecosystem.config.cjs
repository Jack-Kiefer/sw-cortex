/**
 * PM2 Ecosystem Configuration
 *
 * Start all services: pm2 start ecosystem.config.cjs
 * View logs: pm2 logs
 * Stop all: pm2 stop all
 */
const path = require('path');

// Project root - prefer env var, fallback to this file's directory
const PROJECT_ROOT = process.env.SW_CORTEX_ROOT || __dirname;
const LOGS_DIR = process.env.SW_CORTEX_LOGS || path.join(PROJECT_ROOT, 'logs');

module.exports = {
  apps: [
    // API Server (always running)
    {
      name: 'api',
      script: 'npx',
      args: 'tsx src/api/server.ts',
      cwd: PROJECT_ROOT,
      autorestart: true,
      watch: ['src'],
      ignore_watch: ['node_modules', 'logs', 'tasks', 'dist', '*.test.ts'],
      watch_delay: 1000,
      env: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(LOGS_DIR, 'api-error.log'),
      out_file: path.join(LOGS_DIR, 'api-out.log'),
      merge_logs: true,
      max_memory_restart: '500M',
    },
    // Slack sync (hourly cron)
    {
      name: 'slack-sync',
      script: 'npm',
      args: 'run slack:sync',
      cwd: PROJECT_ROOT,
      cron_restart: '0 * * * *', // Run every hour at :00
      autorestart: false, // Don't restart after sync completes
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(LOGS_DIR, 'slack-sync-error.log'),
      out_file: path.join(LOGS_DIR, 'slack-sync-out.log'),
      merge_logs: true,
      max_memory_restart: '500M',
    },
  ],
};
