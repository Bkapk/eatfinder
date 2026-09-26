const path = require('path')

const APP_DIR = path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'eatfinder',
      cwd: APP_DIR,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010 -H 127.0.0.1', // bind loopback only — nginx is the public door
      instances: 1,
      // See pm2-dev.config.js — in-process rate limiters and SQLite both require
      // exactly one process.
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      // Opening hours are Prishtina wall-clock times; isOpenAt reads the server's
      // local clock, so the process has to live in that zone, not the VPS's UTC.
      env: { NODE_ENV: 'production', TZ: 'Europe/Belgrade' },
    },
  ],
}
