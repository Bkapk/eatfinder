const path = require('path')

// cwd is derived from this file's own location rather than hardcoded, because
// this config ships inside the checkout it describes. That removes the most
// common drift in this setup: a config still pointing at the previous host's
// directory layout after a migration.
const APP_DIR = path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'eatfinder-dev',
      cwd: APP_DIR,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3009 -H 127.0.0.1', // bind loopback only — nginx is the public door
      instances: 1,
      // Must stay 1. lib/ratelimit.ts uses in-process Maps for the login lockout
      // and the Places search limit; under a cluster those silently multiply by
      // the worker count. SQLite also wants a single writer.
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      // Opening hours are Prishtina wall-clock times; isOpenAt reads the server's
      // local clock, so the process has to live in that zone, not the VPS's UTC.
      env: { NODE_ENV: 'production', TZ: 'Europe/Belgrade' },
      // Secrets are NOT here — they live in .env.local in APP_DIR, untracked.
      // Anything in this file is readable by anyone with repo access.
    },
  ],
}
