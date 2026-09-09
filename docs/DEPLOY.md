# Deploy runbook — Hetzner VPS

Target: a Hetzner VPS under Virtualmin/Nginx, PHP-FPM/MariaDB coexisting for
other sites on the same box, this app run from `.next/standalone` behind a
process manager (PM2 or systemd — neither is checked into this repo; pick one
and keep it consistent). `next.config.js` sets `output: 'standalone'`
specifically for this: it is not a serverless target and nothing here assumes
one.

## 1. Env vars

Copy `.env.example` to `.env` on the server (never commit it — `.gitignore`
already excludes `.env`, `.env*.local`, `.env.production`). At minimum:

- `DATABASE_URL="file:./dev.db"` (or an absolute path — see §5)
- `SESSION_SECRET` — 32+ random chars, generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used once by `npm run create-admin`
- `NEXT_PUBLIC_APP_URL` — the real public origin. `app/api/admin/ai/enrich/route.ts`
  uses this to turn a local `/uploads/...` photo URL back into an absolute one
  when fetching photo bytes server-side for Gemini; a wrong value here means
  photo-backed enrichment reads nothing.
- `MAPBOX_TOKEN`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`,
  `PHOTO_AUTOPUBLISH_CONFIDENCE` — optional, see README "Running without API
  keys" for what degrades if any is absent.
- `R2_*` (five vars) — optional, see §5.

Set `NODE_ENV=production` in whatever launches the process (PM2 ecosystem
file, systemd unit env, or shell export) — it is not read from `.env` by
Next.js itself for this purpose, and `sessionCookieOptions` in `lib/auth.ts`
only sets the cookie's `secure` flag when `NODE_ENV === 'production'`.

## 2. Migrate

```bash
npx prisma migrate deploy
```

Not `prisma migrate dev` — that can prompt interactively and is meant for
local development. `migrate deploy` applies pending migrations
non-interactively and is what a deploy script should call. Three migrations
exist as of this writing:
`20260827131116_init`, `20260827134932_rebuild_restaurant_model`,
`20260908224644_v2_places_ai_community`. Back up `prisma/dev.db` before the
first run of a new migration on a production database (see §6).

## 3. Build and run

```bash
npm ci
npx prisma generate           # npm run build already does this, but do it before create-admin too
npm run create-admin          # idempotent upsert, role always 'admin'
npm run build                 # prisma generate && next build
```

`output: 'standalone'` produces `.next/standalone/server.js` plus a
`.next/standalone/.next/static` tree that does not include `public/` by
default — copy `public/` (and specifically `public/uploads` if you're on
local disk, see §4) alongside the standalone output, or point the process at
the repo root rather than a stripped-down deploy directory. Start it with:

```bash
node .next/standalone/server.js
```

behind a process manager so it survives a crash and a reboot. Nothing in this
repo commits a PM2 ecosystem file or a systemd unit — write one before first
production deploy; keep the process count at **one** (§7).

## 4. Nginx reverse proxy

Point Nginx at the Node process's port (Next defaults to `3000`; set `PORT`
in the environment if you need a different one). A minimal proxy block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

`app/api/recommend/route.ts` reads `x-forwarded-for` / `x-real-ip` for its own
in-process rate limiter — both headers above must be set for that limiter to
key on the real client rather than every request looking like the same IP.

**Cache headers for `/uploads`.** If you're on local-disk storage, serve
`public/uploads` directly from Nginx rather than proxying every image request
through Node:

```nginx
location /uploads/ {
    alias /path/to/app/public/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
```

Safe to mark `immutable`: `lib/storage.ts` names every upload with a random
16-byte hex filename and never overwrites one. If R2 is configured instead,
this block is unnecessary — photo URLs point straight at the R2 public
domain and Nginx never sees them.

Virtualmin manages the vhost config; add this as a custom Nginx directive
block for the domain rather than hand-editing outside Virtualmin's config
files, so it survives a Virtualmin-driven vhost regeneration.

## 5. Storage: local disk vs R2

`lib/storage.ts` checks all five `R2_*` vars at request time and falls back
to local disk (`public/uploads/`) if any is unset. Two cases:

- **All five `R2_*` vars are set** — every upload URL is an absolute R2 URL
  (`R2_PUBLIC_URL/<random-hex>.<ext>`). `public/uploads` is not written to at
  all going forward. It does **not** need to survive a redeploy or be in the
  backup, though any files already in it from before the R2 switch keep
  working (`deleteUpload()` routes on the URL's own shape, not the current
  config).
- **Any `R2_*` var is unset (the default, no key configured yet)** — uploads
  write to `public/uploads/` as `/uploads/<random-hex>.<ext>` and are served
  by Nginx or Next directly. **This directory must survive every redeploy and
  must be in the backup.** If your deploy process does a fresh `git clone` or
  a `git clean -fdx` into a new directory, `public/uploads` is not in version
  control (`.gitignore`: `public/uploads/*`) and every community photo,
  admin-uploaded image, and re-hosted Google Places photo is gone. Deploy by
  updating in place (`git pull` + rebuild) or explicitly copy
  `public/uploads` into the new build output before starting the process.

To tell which case you're in: check whether `.env` on the server has all five
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_URL` filled in, or query `isR2Configured()`'s underlying condition
directly — `ls public/uploads` growing over time is also a tell that you're
on the local-disk path.

## 6. SQLite backup

`prisma/dev.db` is the entire database — one file. Back it up with a plain
file copy; SQLite's own `.backup` command (via `sqlite3 dev.db ".backup
backup.db"`) is safer than `cp` while the process is live, since it takes a
consistent snapshot rather than risking a torn read mid-write. Put it on a
cron alongside whatever already backs up the VPS's other sites.

`prisma/dev.db.pre-v2.bak` in the working tree is a pre-v2-migration snapshot
taken before `20260908224644_v2_places_ai_community` was applied to local
dev data (`.gitignore` excludes `*.bak`, so this file is local-only, not
something a fresh clone will have). It can be deleted once the owner has
confirmed the v2 data looks right — it exists purely as a local rollback
point for that one migration, not an ongoing backup mechanism.

## 7. The single-process assumption

`docs/PLAN.md` calls this out as `[assumption]`: the app runs as one Node
process. Read `lib/ratelimit.ts` before running more than one:

- `aiProposalsLastHour()` and `photosByUser()` — the two limiters guarding
  **money** (Gemini calls: AI enrichment and photo moderation) — count rows
  in `AiProposal` and `RestaurantPhoto` via Prisma. These are durable across
  restarts and correct under any number of processes, because the database is
  the shared state.
- `createMapLimiter()` — an in-process `Map` keyed by attempt — backs the
  **login lockout** (`app/api/auth/login/route.ts`, 10 failures per
  username/email per 15 minutes) and the **Places search quota**
  (`app/api/admin/places/search/route.ts`, 100 searches per admin per hour).
  Both are explicitly commented in the code as fine for "a single-PM2-process
  VPS" and wrong otherwise: each process gets its own `Map`, so running N
  processes silently multiplies both limits by N and a restart resets them to
  zero. `/api/recommend`'s own request-count limiter (declared inline in that
  route, not in `lib/ratelimit.ts`) has the same shape and the same caveat.

None of this is a bug to fix before launch — it is a documented ceiling.
Stay on one process. If you ever need more than one (e.g. PM2 cluster mode
for CPU-bound load), the two money-guarding limiters need no change; the
quota-only ones need moving to the database or Redis first.

## 8. Post-deploy check

1. `curl https://<domain>/api/recommend` returns `{ items, points, total, facets }`.
2. Log in at `/admin/login`, confirm the restaurant list loads.
3. Load `/`, confirm the map renders (or the disabled panel, if
   `MAPBOX_TOKEN` isn't set yet) and results still populate either way.
4. If `public/uploads` was migrated, open a restaurant page with a photo and
   confirm the image actually loads through Nginx, not a 404.
