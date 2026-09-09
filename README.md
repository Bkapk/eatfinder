# EatFinder

A map-first restaurant discovery app for Prishtina. Map on the left, results on
the right, filter chips on top. The three original mood sliders (heaviness,
portion size, fine-dining-ness) survive as one filter among several, not the
front door.

Businesses are pulled from Google Places, described and scored by Gemini
under owner approval, and signed-in users can contribute photos that are
AI-moderated before they appear. Everything degrades gracefully when a key is
missing — see "Running without API keys" below, which is the app's most
useful property right now.

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Prisma 5 · SQLite · Tailwind 3
· Mapbox GL (`react-map-gl`) · Google Places API (New) v1 · Google Gemini
(`@google/genai`) · Cloudflare R2 (optional, `@aws-sdk/client-s3`)

SQLite is a deliberate choice: one file, trivial backup, plenty for one city.
Deployment target is a single Node process on a VPS (see `docs/DEPLOY.md`),
not a serverless host — several pieces of this app assume that.

## Setup

Requires Node 18+ (developed on 24).

```bash
npm install
cp .env.example .env          # then fill in at least SESSION_SECRET and ADMIN_PASSWORD
npm run db:migrate
npm run create-admin          # creates/updates the admin user, role=admin, from .env
npm run db:seed               # sample restaurants; skips the admin user if create-admin already ran
npm run dev
```

- Public site: http://localhost:3000/
- Admin: http://localhost:3000/admin
- Community accounts: http://localhost:3000/account

Run `create-admin` before `db:seed`. `db:seed` also creates an admin user if
none exists yet, but it does not set `role: 'admin'` on that path (see Known
gaps) — running `create-admin` first avoids ever hitting that.

`SESSION_SECRET` must be at least 32 characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Commands (`package.json`)

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` then `next build` (`output: 'standalone'`) |
| `npm start` | Production server, `next start` |
| `npm run lint` | ESLint, flat config (`eslint.config.mjs`) |
| `npm test` | Jest |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | `tsx prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run create-admin` | `tsx scripts/create-admin.ts` — upsert the admin from `.env`, always `role: 'admin'` |

## Admin vs community accounts

One `User` table, one `role` column (`"admin"` or `"user"`), one login
endpoint. `requireAuth()` (`lib/auth.ts`) accepts any signed-in, non-banned
user; `requireAdmin()` additionally checks `role === 'admin'` and is what
every catalogue-editing route calls. There is exactly one admin account in
practice — it is created by `create-admin`/`db:seed`, never by
`/api/auth/register`, which hardcodes `role: 'user'` and never reads a role
from the request body.

- **Admin** (`/admin/**`): manage the restaurant catalogue, run Google Places
  import (`/admin/discover`), review AI enrichment proposals
  (`/admin/queue`), moderate community photos (`/admin/photos`), CSV
  import/export.
- **Community** (`/account/**`): register/login with email, submit photos to
  a restaurant page, favourite restaurants. Cannot create, edit or delete a
  restaurant — those fields are not even present in the request schemas the
  community routes accept.

`middleware.ts` only checks that the session cookie is present (edge runtime,
no `node:crypto`, so it cannot verify the HMAC or read the role). A signed-in
community user's cookie passes that gate and can load the empty `/admin`
shell; `app/admin/layout.tsx` then calls `/api/auth/me` and redirects away
from `/admin` if `role !== 'admin'`, and every actual data route independently
calls `requireAdmin()` and returns 403. The middleware is a UX nicety, not the
security boundary.

## Running without API keys

No key exists yet for Mapbox, Google Places or Gemini in a fresh setup, and
the app runs anyway:

| Missing env var | What degrades |
| --- | --- |
| `MAPBOX_TOKEN` | The map pane on `/` renders a static disabled panel (`components/map/MapPane.tsx`); the grid/list results still work fully. |
| `GOOGLE_PLACES_API_KEY` | `/admin/discover` shows a disabled banner instead of a search box. `POST /api/admin/places/search` and `/import` answer `503` with a readable message (`lib/places.ts` → `PlacesDisabledError`). |
| `GEMINI_API_KEY` | `POST /api/admin/ai/enrich` answers `503` (`lib/gemini.ts` → `AiDisabledError`). Community photo submission still succeeds — moderation fails closed to `status: 'pending'`, `wasAutoDecision: false`, and the photo lands in the manual review queue instead of being auto-published. |
| R2 vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`) | `lib/storage.ts` falls back to local disk (`public/uploads/`) whenever any of the five is unset. All five must be set together to switch to R2; existing local URLs keep working and still delete correctly afterwards. |

Every key is read lazily, inside the function that needs it, never at module
load — a missing key fails the request that needs it, never the build.

## Env vars

See `.env.example` for the full annotated list: `DATABASE_URL`,
`SESSION_SECRET`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL`,
`MAPBOX_TOKEN` (deliberately **not** `NEXT_PUBLIC_*` — that prefix inlines at
build time; it is read server-side per request and passed down as a prop),
`GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`PHOTO_AUTOPUBLISH_CONFIDENCE`, and the five `R2_*` vars.

## Layout

```
app/
  page.tsx              map-first front door (server component, reads MAPBOX_TOKEN + locale)
  eat/page.tsx           redirect('/') — the old slider page URL still resolves
  r/[slug]/page.tsx       restaurant detail, gallery, favourite, photo submit CTA
  admin/                 dashboard, new/edit, import/export, discover (Places), queue (AI), photos (moderation)
  account/                community login/register/profile
  api/
    auth/                 login (throttled + username-or-email), register, logout, me
    recommend/             public scoring endpoint, returns { items, points, total, facets }
    restaurants/            admin CRUD, import, export, seed — requireAdmin()
    upload/                 admin image upload
    admin/places/            Places search/import/refresh — requireAdmin()
    admin/ai/enrich/         Gemini scoring — requireAdmin()
    admin/proposals/         AI proposal review queue — requireAdmin()
    admin/photos/            photo moderation queue — requireAdmin()
    community/photos/        community photo submission — requireAuth()
    community/favorites/     requireAuth()
components/
  search/  map/  results/    the map-first shell (SearchShell owns filter state, syncs to the URL)
  community/                  photo upload widget
lib/
  types.ts        RestaurantDTO, RestaurantPhotoDTO, CUISINE_VOCAB, TAG_VOCAB, toDTO, slugify, isOpenAt
  scoring.ts      SearchFilters, passesFilters, calculateScore, search
  filters.ts      single URL <-> SearchFilters parser, shared by the client shell and /api/recommend
  auth.ts         HMAC session, bcrypt, requireAuth, requireAdmin
  storage.ts      saveImage/deleteUpload — R2 or local disk, opaque URLs
  places.ts       Google Places (New) v1 client + field masks
  gemini.ts       Gemini calls, retry-once-then-fail, auto-publish rule
  aiSchemas.ts    Gemini responseSchema + mirror zod schemas
  ratelimit.ts    DB-counted limiters (money endpoints) + in-process Map limiter (quota endpoints)
  i18n.ts         t()/tVocab(), Albanian default, English toggle, no i18n dependency
middleware.ts     cookie-presence gate on /admin/*, not a security boundary
prisma/
  schema.prisma
  migrations/      three applied: init, rebuild_restaurant_model, v2_places_ai_community
  seed.ts, sample-restaurants.ts, sample.csv
docs/
  PLAN.md          the v2 rebuild plan and decisions log — historical record, do not edit
  DEPLOY.md        VPS runbook
  OPERATIONS.md    owner-facing workflows
```

## How ranking works

Two passes in `lib/scoring.ts`, unchanged in shape from v1.

**`passesFilters`** — hard filters: price range, prep time, spice max, Wolt
availability, cuisines, tags, neighbourhoods, free-text query, distance, map
bounding box, and open-now (unknown hours are never treated as closed — only
a confirmed-closed restaurant is excluded).

**`calculateScore`** — soft score, higher is better:

```
  axis match on heaviness    0..100
+ axis match on portionSize  0..100    each: 100 * (1 - |want - actual| / 100)
+ axis match on fineDining   0..100
+ rating / 5 * 25                      editorial rating
+ 10                                   if featured
+ 30 * max(0, 1 - km / 5)              if a location was supplied
+ 15                                   if open right now
+ 5                                    if orderable on Wolt
```

Mood match dominates (max 300), so a great match still beats a mediocre one
that happens to be well rated. `sort` (`match`/`rating`/`distance`/
`price-asc`/`price-desc`) overrides the score ordering when set.

## `GET /api/recommend`

Public. Parses the URL through `lib/filters.ts` (the same parser the client
uses to build the URL, so a shared link and this endpoint cannot disagree).
Returns `{ items, points, total, facets }` over active restaurants only —
`items` paged at 24, `points` (map pins) capped at 500, `facets` are counts
per cuisine/tag/neighbourhood/price ignoring the dimension they describe.
Exactly one `prisma.restaurant.findMany({ where: { isActive: true } })`, no
joins — this is what `__tests__/api.test.ts` mocks.

## Data model

`Restaurant` carries everything: manual rows (`source: 'manual'`), Google
Places imports (`source: 'google'`, drafted `isActive: false` until an admin
publishes them), and AI enrichment state (`aiStatus`). `RestaurantPhoto` is
the gallery, one row per photo whoever produced it (`source`:
`admin`/`community`/`google`), separate from the denormalised hero
`Restaurant.image`. `AiProposal` holds one Gemini scoring run per restaurant,
pending an admin's approve/reject; nothing reaches `Restaurant` until
approved. `Favorite` is a plain `(userId, restaurantId)` join. Full schema:
`prisma/schema.prisma`. Design rationale and the rejected alternatives:
`docs/PLAN.md`.

## Security

- Sessions: signed HMAC token (`<userId>.<expiry>.<hmac>`), `timingSafeEqual`
  verification, httpOnly cookie, `secure` in production.
- Passwords: bcrypt, cost 10.
- Login: 10 failures per username/email per 15 minutes, in-process. A wrong
  username and a wrong password return the same response.
- Every catalogue-mutating route calls `requireAdmin()`; every
  community-mutating route calls `requireAuth()`.
- Uploads (admin, community, and Places photo downloads) all go through
  `lib/storage.ts`'s `saveImage()`, which sniffs the file's magic bytes —
  never the filename or client `Content-Type` — and rejects anything that
  doesn't match a known image format. `public/uploads` is served from our own
  origin, so a mislabelled `.html` would otherwise be stored XSS.
- Community photo submission and registration have no path to set
  privileged fields (`role`, `source`, `status`, `sortOrder`) — those keys
  are simply absent from the request schemas.

Not yet done: security headers and a CSP. Add them at the Nginx reverse proxy
or in `next.config.js` before this faces the public internet unauthenticated.

## Testing

```bash
npm test
```

`__tests__/scoring.test.ts` (pure, DTO fixtures) and `__tests__/api.test.ts`
(mocks `prisma.restaurant.findMany`, asserts on `data.items[0].score`, runs
under the `node` Jest environment because `next/server` needs a real global
`Request`).

## Deployment

See `docs/DEPLOY.md` for the full VPS runbook. Short version: `output:
'standalone'` targets a Node process behind Nginx, not a serverless host.
Two things there will bite if skipped: `public/uploads` must be excluded from
the redeploy's "clean checkout" step and included in the backup unless R2 is
configured, and the app assumes a single Node process — see `docs/DEPLOY.md`
for exactly which rate limiters that constrains.

## Known gaps

Genuinely unverified or deferred, not softened:

- **No API key in this repo has ever been exercised against a live Google
  Places or Gemini endpoint.** The 503-degradation paths are read from the
  code and are structurally sound, but the actual API calls (`lib/places.ts`,
  `lib/gemini.ts`), Gemini's `responseSchema` behaviour, and Places field
  mapping are unverified against real responses. Confirm this before trusting
  an import or an enrichment run in production.
- **The v2 migration's photo backfill matched zero rows.** The hand-written
  `INSERT INTO RestaurantPhoto ... SELECT ... FROM Restaurant WHERE image IS
  NOT NULL` in `prisma/migrations/20260908224644_v2_places_ai_community/migration.sql`
  is correct SQL, but whether the pre-v2 `Restaurant.image` values were
  actually populated at migration time — and therefore whether this path
  produced any rows — has not been confirmed against the live `dev.db`.
- **`prisma/seed.ts`'s own admin-creation branch never sets `role`,** so it
  defaults to `'user'` per the schema. This only stays safe because the
  documented setup order runs `create-admin` (which does set `role: 'admin'`)
  first, and `db:seed` skips creating a user that already exists. Running
  `db:seed` alone against an empty database creates an admin account that
  cannot pass `requireAdmin()`.
- **The admin area has had no design pass since the v2 rebuild.** It is still
  the pre-rebuild dark-era markup wearing the new light-mode Tailwind tokens;
  several buttons render at borderline contrast. `app/admin/layout.tsx`'s nav
  also does not link to `/admin/discover`, `/admin/queue` or `/admin/photos`
  even though all three pages exist and work — they're reachable only by
  typing the URL.
- **`CUISINE_VOCAB` / `TAG_VOCAB` in `lib/types.ts`** were seeded from
  existing data plus obvious Kosovo categories by the Phase 1 agent and have
  not been reviewed by the owner. Changing them after Gemini enrichment has
  run against real restaurants means re-running that enrichment.
- The remaining Phase 6 backlog items (mobile map/list collapse behaviour
  under load, keyboard/screen-reader passes, spinner de-duplication across
  four admin pages, the `middleware.ts` → `proxy` rename Next 16 warns about,
  the map popup falling back to a name+price card outside the 500-point cap,
  photo attribution rendered as stripped text rather than Google's anchor
  HTML) are listed with their trigger conditions in `docs/PLAN.md` under
  "Phase 6 backlog" — not fixed, not silently dropped.
