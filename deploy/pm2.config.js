const path = require('path')

const APP_DIR = path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'eatfinder',
      cwd: APP_DIR,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010', // keep in sync with PROD_PORT in deploy/config.sh and nginx-prod.conf
      instances: 1,
      // See pm2-dev.config.js — in-process rate limiters and SQLite both require
      // exactly one process.
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
}
