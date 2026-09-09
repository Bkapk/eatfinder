const fs = require('fs')
const path = require('path')

// The secret is read from an untracked file, never written into this one.
// A WEBHOOK_SECRET hardcoded in a committed config is readable by anyone with
// repo access, and rotating it then means a commit.
//
// Create it once on the server:
//   openssl rand -hex 32 > deploy/.webhook-secret && chmod 600 deploy/.webhook-secret
// Then paste the same value into the GitHub webhook's Secret field.
const SECRET_FILE = path.join(__dirname, '.webhook-secret')

let secret
try {
  secret = fs.readFileSync(SECRET_FILE, 'utf8').trim()
} catch {
  throw new Error(`Missing ${SECRET_FILE}. Create it with: openssl rand -hex 32 > ${SECRET_FILE}`)
}
if (!secret) throw new Error(`${SECRET_FILE} is empty.`)

module.exports = {
  apps: [
    {
      name: 'eatfinder-webhook',
      cwd: __dirname,
      script: path.join(__dirname, 'webhook-listener.js'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '128M',
      env: { NODE_ENV: 'production', WEBHOOK_SECRET: secret },
    },
  ],
}
