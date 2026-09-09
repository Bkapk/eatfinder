#!/usr/bin/env node
/**
 * GitHub push webhook -> deploy script.
 *
 * Binds 127.0.0.1 only. Nginx is the public door (<domain>/webhook -> 9876);
 * port 9876 is never exposed directly, so the HMAC check is the only auth and
 * it has to be right.
 */
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const PORT = 9884  // 9876-9883 taken by the other apps on this box
const HOST = '127.0.0.1'
const LOCKFILE = '/tmp/eatfinder-deploy.lock'
const LOCK_STALE_MS = 10 * 60 * 1000

const SECRET = process.env.WEBHOOK_SECRET
if (!SECRET) {
  console.error('WEBHOOK_SECRET is not set. Refusing to start — an unauthenticated')
  console.error('deploy endpoint is worse than no deploy endpoint.')
  process.exit(1)
}

// main is present but disabled on purpose: production stays a human decision.
const BRANCHES = {
  dev: { enabled: true, script: path.join(__dirname, 'deploy-dev.sh') },
  main: { enabled: false, script: path.join(__dirname, 'deploy-prod.sh') },
}

function signatureMatches(rawBody, header) {
  if (!header) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  // timingSafeEqual throws on a length mismatch, so check length first.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function lockHeld() {
  try {
    const age = Date.now() - fs.statSync(LOCKFILE).mtimeMs
    if (age < LOCK_STALE_MS) return true
    fs.unlinkSync(LOCKFILE) // stale: a previous deploy died without cleaning up
    return false
  } catch {
    return false
  }
}

function runDeploy(branch, cfg) {
  fs.writeFileSync(LOCKFILE, String(process.pid))
  console.log(`[deploy] ${branch} starting`)

  // execFile with an argv array, never a concatenated shell string — the branch
  // name comes from the request body.
  execFile('bash', [cfg.script], { cwd: path.dirname(cfg.script), timeout: 15 * 60 * 1000 },
    (err, stdout, stderr) => {
      try { fs.unlinkSync(LOCKFILE) } catch {}
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      console.log(err ? `[deploy] ${branch} FAILED: ${err.message}` : `[deploy] ${branch} ok`)
    })
}

http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed')
    return
  }

  const chunks = []
  let size = 0
  req.on('data', (c) => {
    size += c.length
    if (size > 5 * 1024 * 1024) { req.destroy(); return } // GitHub payloads are far smaller
    chunks.push(c)
  })

  req.on('end', () => {
    const raw = Buffer.concat(chunks)

    // Verify before parsing: never let unauthenticated input reach a parser.
    if (!signatureMatches(raw, req.headers['x-hub-signature-256'])) {
      console.warn('[webhook] rejected: bad signature')
      res.writeHead(401).end('Invalid signature')
      return
    }

    let payload
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      res.writeHead(400).end('Bad JSON')
      return
    }

    if (req.headers['x-github-event'] === 'ping') {
      res.writeHead(200).end('pong')
      return
    }

    const branch = (payload.ref || '').replace('refs/heads/', '')
    const cfg = BRANCHES[branch]

    if (!cfg || !cfg.enabled) {
      console.log(`[webhook] ignoring ${branch || '(no ref)'}`)
      res.writeHead(200).end(`Ignored: ${branch}`)
      return
    }

    if (lockHeld()) {
      console.log(`[webhook] ${branch} skipped, deploy already running`)
      res.writeHead(409).end('Deploy already in progress')
      return
    }

    // Answer immediately. GitHub times out at 10s and a build takes minutes.
    res.writeHead(202).end(`Deploying ${branch}`)
    runDeploy(branch, cfg)
  })
}).listen(PORT, HOST, () => {
  console.log(`webhook listener on http://${HOST}:${PORT} (dev auto-deploys, main does not)`)
})
