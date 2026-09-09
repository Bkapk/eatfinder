# Deploying EatFinder to Virtualmin

Two branches, one box. `dev` auto-deploys on push; `main` is manual and deliberate.

```
branch  →  directory                                          →  PM2            →  port  →  vhost
dev     →  /home/<user>/domains/dev.<domain>/public_html      →  eatfinder-dev  →  3006  →  dev.<domain>  (basic auth)
main    →  /home/<user>/public_html                           →  eatfinder      →  3005  →  <domain>
```

**This app is SQLite, not Postgres.** There is no database to create. The database is a
single file living *outside* the checkout, and it is the only thing here that cannot be
rebuilt from git.

---

## Step 0 — fill in `deploy/config.sh`

Four values: `VM_USER`, `APP_DOMAIN`, and the two ports. Check the ports are free first:

```bash
pm2 list
ss -ltnp | grep -E ':30[0-9][0-9]'
```

The nginx confs and `pm2*.config.js` have the same values written into them — grep for
`CHANGEME` and for the port numbers and make them agree. This is the single most common
cause of a 502.

## Step 1 — create the dev sub-server in Virtualmin

Create `dev.<domain>` as a **sub-server** of the main domain, with SSL (Let's Encrypt).
Virtualmin puts it at `/home/<user>/domains/dev.<domain>/public_html`.

## Step 2 — persistent data, outside the checkout

```bash
mkdir -p /home/<user>/eatfinder-data/dev/uploads
mkdir -p /home/<user>/eatfinder-data/prod/uploads
```

The deploy scripts symlink `public/uploads` here. **Back up this directory and the `.db`
files in it.** A reclone of the checkout destroys nothing; a `rm -rf` of this directory
destroys everything.

If you configure Cloudflare R2, uploads stop being written here and only the `.db` file
matters. Until then, both do.

## Step 3 — clone

```bash
cd /home/<user>/domains/dev.<domain>/public_html
git clone https://github.com/Bkapk/eatfinder.git .
git checkout dev
```

## Step 4 — `.env.local` (untracked, per environment)

Next.js loads this automatically. Copy `.env.example` and fill it in. Minimum to boot:

```bash
DATABASE_URL="file:/home/<user>/eatfinder-data/dev/eatfinder-dev.db"
SESSION_SECRET="<node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\">"
NEXT_PUBLIC_APP_URL="https://dev.<domain>"
```

Everything else is optional and the app degrades cleanly without it: no `MAPBOX_TOKEN`
gives a disabled map pane, no `GOOGLE_PLACES_API_KEY` disables Discover, no
`GEMINI_API_KEY` makes enrichment answer 503 and sends every photo to manual review, and
no `R2_*` falls back to local disk.

Start with `PHOTO_AUTOPUBLISH_CONFIDENCE=1` so nothing auto-publishes until you have
watched the moderation queue for a while.

`DATABASE_URL` must be an **absolute** path. A relative one resolves against the process
working directory and you will end up with two different databases without noticing.

## Step 5 — first build, migrate, and an admin account

```bash
npm ci
npx prisma migrate deploy
npm run build
npm run create-admin          # or: npm run db:seed
```

`prisma migrate deploy` only applies pending migrations. It never resets and never
prompts — that is why it is the deploy-safe verb, and why `migrate dev` must never run
on a server.

## Step 6 — PM2

```bash
pm2 start deploy/pm2-dev.config.js
pm2 save && pm2 startup       # run the command it prints
```

Both apps run `exec_mode: 'fork'` with one instance, deliberately. SQLite wants a single
writer, and `lib/ratelimit.ts` keeps the login lockout and Places search limit in
process memory — under a cluster those silently multiply by the worker count. The two
limiters that guard money (AI enrichment, photo submission) count database rows and are
safe either way.

## Step 7 — Nginx

Paste the location blocks from `nginx-dev.conf` into Virtualmin's generated SSL vhost
rather than replacing the file, so its Let's Encrypt renewal wiring survives.

```bash
nginx -t && systemctl reload nginx
```

Two settings there are load-bearing, not decoration: `client_max_body_size 8M` (the app
caps uploads at 5 MB, nginx defaults to 1 MB and would 413 them first), and
`X-Forwarded-For` (the rate limiters key on it — without it every visitor shares one
bucket and the first burst locks out everybody).

## Step 8 — the webhook

```bash
openssl rand -hex 32 > deploy/.webhook-secret
chmod 600 deploy/.webhook-secret
pm2 start deploy/pm2-webhook.config.js && pm2 save
```

Paste the `/webhook` block into the **production** vhost — the dev vhost's `auth_basic`
would 401 every delivery. Then in GitHub: Settings → Webhooks → Add,
`https://<domain>/webhook`, content type `application/json`, the same secret, event
`push` only.

Only `dev` deploys. `main` is present in the listener but disabled.

---

## Daily use

```bash
git push origin dev     # dev.<domain> rebuilds itself

# production, when you mean it
git checkout main && git merge dev && git push origin main
ssh <user>@server "cd /home/<user>/public_html && bash deploy/deploy-prod.sh"
```

## When it breaks

| Symptom | Cause |
| --- | --- |
| Pushed, nothing changed | GitHub → Webhooks → Recent Deliveries. Then `pm2 logs eatfinder-webhook`. |
| Webhook 401 | Secret differs between GitHub and `deploy/.webhook-secret`. |
| 502 Bad Gateway | `pm2 status`; the `-p` port must match nginx `proxy_pass`. |
| Deploy ran, old code serves | `npm run build` failed but `pm2 restart` still ran. Read the deploy output. |
| Uploads 404 after redeploy | The `public/uploads` symlink is missing, or nginx `alias` points at the wrong data dir. |
| "Deploy already in progress" | Lockfile doing its job. If stale >10 min: `rm /tmp/eatfinder-deploy.lock`. |
| Login works, `/admin` bounces | The account has `role: 'user'`. `npm run db:seed` promotes it. |
