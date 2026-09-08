# EatFinder

Pick a restaurant in Prishtina by mood rather than by category. You set three
sliders — how heavy, how hungry, how fancy — and the app ranks what fits.

## Stack

TypeScript · Next.js 16 (App Router, Turbopack) · React 19 · Prisma 5 · SQLite · Tailwind 3

SQLite is a deliberate choice: one file, trivial backup, and plenty for a single
city of restaurants. Swap the `provider` in `prisma/schema.prisma` to `postgresql`
if that stops being true.

## Setup

Requires Node 18+ (developed on 24).

```bash
npm install
cp .env.example .env          # then fill in SESSION_SECRET and ADMIN_PASSWORD
npm run db:migrate
npm run create-admin          # creates/updates the admin from .env
npm run db:seed               # 10 sample restaurants
npm run dev
```

- Public page: http://localhost:3000/eat
- Admin: http://localhost:3000/admin

`SESSION_SECRET` must be at least 32 characters. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` then `next build` |
| `npm start` | Production server |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm test` | Jest |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Admin user + 10 sample restaurants |
| `npm run db:studio` | Prisma Studio |
| `npm run create-admin` | Upsert the admin user from `.env` |

## Layout

```
app/
  api/
    auth/          login (throttled), logout, me
    recommend/     public scoring endpoint
    restaurants/   CRUD, import, export, seed
    upload/        image upload, magic-byte sniffed
  admin/           dashboard, add, edit, CSV import
  eat/             public slider page
lib/
  types.ts         RestaurantDTO, toDTO, slugify, isOpenAt, openHoursSchema
  scoring.ts       SearchFilters, passesFilters, calculateScore, search
  auth.ts          HMAC session, bcrypt, requireAuth
  csv.ts           import/export
  storage.ts       local disk uploads
  prisma.ts        client singleton
middleware.ts      gates /admin/* on the session cookie
prisma/
  schema.prisma
  sample-restaurants.ts   shared by db:seed and the admin seed button
  sample.csv              example import, current column set
```

## How ranking works

Two separate passes, in `lib/scoring.ts`.

**`passesFilters`** — hard filters. Failing one means "not a result", not "a worse
result": price range, prep time, cuisines, tags, neighbourhoods, free-text query,
Wolt availability, distance, and open-now. A restaurant with *unknown* hours is
never excluded by `openNow` — only a confirmed-closed one is.

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

Mood match dominates (max 300) so a great match still beats a mediocre one that
happens to be well rated. Tune the constants in `lib/scoring.ts`.

## `GET /api/recommend`

Public, returns `{ items: ScoredRestaurant[] }` over active restaurants only.

| Param | Type | Default |
| --- | --- | --- |
| `heavy` `hungry` `fine` | 0-100 | 50 |
| `cuisines` `tags` `neighborhoods` | comma-separated | — |
| `query` | free text over name/description/neighbourhood/cuisines/tags | — |
| `minPrice` `maxPrice` | 1-4 | — |
| `maxPrepTime` | minutes | — |
| `openNow` `woltOnly` | `true` (any other value is off) | off |
| `lat` `lng` `maxDistanceKm` | distance filter, needs all three | — |

## CSV

`prisma/sample.csv` is a working example of the current column set. Export from
the admin panel to get the exact same shape back — export and import round-trip.

**Required:** `name`, `heaviness`, `portionSize`, `fineDining`, `priceLevel`.

**Optional:** `description`, `spiceLevel` (0-100, default 0), `avgPrepTime`
(default 30), `cuisines` and `tags` (JSON array or comma-separated),
`neighborhood`, `address`, `websiteUrl`, `gmapsUrl`, `woltUrl`, `instagramUrl`,
`phone`, `image`, `lat`, `lng`, `rating` (0-5), `openHours`.

`slug` is derived from `name` — never put it in the CSV.

`openHours` is validated JSON keyed by `mon`–`sun`, with `null` for a closed day:

```json
{"mon": ["09:00", "23:00"], "fri": ["09:00", "01:00"], "sun": null}
```

A closing time earlier than the opening time means past midnight. A day that is
absent means *unknown*, which is treated differently from closed. Anything that
does not parse is rejected at import rather than silently read as closed.

## Security

- Sessions are a signed HMAC token (`<userId>.<expiry>.<hmac>`), verified with
  `timingSafeEqual`, in an httpOnly cookie. `secure` is on in production.
- Passwords are bcrypt, cost 10.
- Login is throttled: 10 failures per username per 15 minutes. A wrong username
  and a wrong password cost the same and return the same response.
- Every mutating API route calls `requireAuth()`. `middleware.ts` additionally
  keeps the admin shell away from unauthenticated visitors.
- Uploads are sniffed by magic bytes, not by `Content-Type` or filename, and are
  stored under a random name. `public/uploads` is served from our own origin, so
  a mislabelled `.html` would otherwise be stored XSS.

Not yet done: security headers and a CSP. Add them at the reverse proxy or in
`next.config.js` before this faces the public internet.

## Testing

```bash
npm test
```

Covers the scoring pass (`__tests__/scoring.test.ts`) and the recommend route
(`__tests__/api.test.ts`). The API suite runs under the `node` environment —
`next/server` needs a real global `Request`, which jsdom does not provide.

## Deployment

`next.config.js` sets `output: 'standalone'`, so the target is a Node process
behind a reverse proxy (Nginx + PM2 on a VPS). Set `DATABASE_URL`,
`SESSION_SECRET` and `NODE_ENV=production`, run `npm run build`, then
`npm start`.

If you deploy somewhere with an ephemeral filesystem, `lib/storage.ts` writes
uploads to local disk — swap its two functions for object storage first.
