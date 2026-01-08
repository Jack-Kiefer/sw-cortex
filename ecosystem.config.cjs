/**
 * PM2 Ecosystem Configuration
 *
 * Start all services: pm2 start ecosystem.config.cjs
 * View logs: pm2 logs
 * Stop all: pm2 stop all
 */
module.exports = {
  apps: [
    // API Server (always running)
    {
      name: 'api',
      script: 'npx',
      args: 'tsx src/api/server.ts',
      cwd: '/home/jackk/sw-cortex',
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
      error_file: '/home/jackk/sw-cortex/logs/api-error.log',
      out_file: '/home/jackk/sw-cortex/logs/api-out.log',
      merge_logs: true,
      max_memory_restart: '500M',
    },
    // Slack sync (hourly cron)
    {
      name: 'slack-sync',
      script: 'npm',
      args: 'run slack:sync',
      cwd: '/home/jackk/sw-cortex',
      cron_restart: '0 * * * *', // Run every hour at :00
      autorestart: false, // Don't restart after sync completes
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/jackk/sw-cortex/logs/slack-sync-error.log',
      out_file: '/home/jackk/sw-cortex/logs/slack-sync-out.log',
      merge_logs: true,
      max_memory_restart: '500M',
    },
  ],
};
