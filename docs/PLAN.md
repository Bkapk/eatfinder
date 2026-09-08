# EatFinder v2 — Implementation Plan

Written 2026-09-09. Target repo: `D:\DESIGNS NEW\Claude DEV\Eat Finder`.
Executable by an agent with no memory of the conversation that produced it.

---

## Goal

Turn EatFinder from a three-slider mood toy into the primary way people find somewhere to eat in
Prishtina: a map-first portal (map left, results right, filter chips on top), stocked with real
businesses pulled from Google Places, described and scored by Gemini under owner approval, with
signed-in users able to contribute photos that are AI-moderated before they appear.

The three mood axes survive as *a filter*, not as the front door.

---

## Constraints and assumptions

### Verified from the repo

- Next.js `^16.0.7`, React `^19.2.1`, App Router. `output: 'standalone'` in `next.config.js`.
- Prisma `^5.7.1` on SQLite (`prisma/dev.db`). Two migrations applied; latest is
  `20260827134932_rebuild_restaurant_model`.
- Tailwind 3 with CSS-variable colours (`--primary: #59aadd`, dark surface palette) in
  `app/globals.css`, mapped in `tailwind.config.ts`. Content globs already include `./components/**`.
- Auth is `lib/auth.ts`: bcrypt + an HMAC token `<userId>.<expiryMs>.<hmac>` in the
  `eatfinder_session` cookie. `secret()` reads `SESSION_SECRET` lazily — the existing precedent for
  the "no keys at module load" rule.
- `middleware.ts` does a **cookie-presence check only** (edge runtime, no `node:crypto`), matcher
  `['/admin/((?!login).*)', '/admin']`. Real verification is `requireAuth()` inside each route.
- `lib/types.ts` holds `CITY` (Prishtina 42.6629 / 21.1655), `toDTO()`, `slugify()`, `haversineKm()`,
  `isOpenAt()`, `openHoursSchema`.
- `lib/scoring.ts` is pure and DTO-shaped: `passesFilters` / `calculateScore` / `search`. Mood axes
  cap at 300, plus rating +25, featured +10, distance +30, open-now +15, wolt +5.
- `lib/storage.ts` writes to `public/uploads` on local disk.
- `app/api/upload/route.ts` contains `sniffExt()` — magic-byte extension detection. This is the only
  correct image validator in the repo.
- Tests: `__tests__/scoring.test.ts` (pure, DTO fixtures) and `__tests__/api.test.ts`, which mocks
  **exactly one** Prisma call: `prisma.restaurant.findMany` and asserts `data.items[0].score`.
- Installed and usable: `zod@3`, `lucide-react`, `bcryptjs`, `csv-parse`/`csv-stringify`, `dotenv`.
- Repo has a large uncommitted working tree (see `git status`). Deleted deployment `.md` files and
  `vercel.json` are gone; `middleware.ts`, `lib/types.ts`, `.env.example` are new and untracked.

### Decided by the owner, not up for renegotiation

SQLite stays. The `toDTO()` JSON-string-column pattern stays. `lib/auth.ts` is extended with a role,
no auth library. `lib/scoring.ts` is extended, not replaced, and `__tests__` must stay green.
`lib/storage.ts` is the upload path. New deps limited to `mapbox-gl`, `react-map-gl`, `@google/genai`.
Every external key read at request time, absent key degrades instead of crashing.

### Assumptions

- `[assumption]` Deployment is the Hetzner VPS under Virtualmin/Nginx with the app run from
  `.next/standalone` behind a process manager, not a serverless host. Local disk uploads and
  in-process state are therefore safe. If this ever moves to Vercel, `lib/storage.ts` and every
  in-memory counter break together — one swap, noted in Risks.
- `[assumption]` The live dataset is small (order 10²–10³ restaurants for one city). Every search is
  therefore a single unfiltered `findMany` scored in JS, exactly as `/api/recommend` does today. No
  SQL-side filtering, no spatial index, no pagination cursor.
- `[assumption]` One owner, one admin account. Community accounts are the only multi-user surface.
- `[assumption]` Google Places (New) v1 and Gemini are billed to the owner's own project and quota
  is the owner's problem to raise, not something the app should silently absorb.

---

## Approaches considered

### A. Extend in place — additive schema, additive scoring, new UI on top of the existing API

Keep `Restaurant` as the single table for everything, manual or Google-sourced, live or draft.
Google import writes a **draft** `Restaurant` (`isActive: false`) plus an `AiProposal` row. The
public map calls the same `/api/recommend` with more query params. New verticals get new
directories; nothing existing is deleted, only `requireAuth` → `requireAdmin` is swapped.

- **Cost**: `Restaurant` gets ~10 more columns and carries a draft state it did not have before.
  Admin list must learn to separate drafts from live.
- **Benefit**: the migration is `ALTER TABLE ADD COLUMN` plus two data statements — no table
  rebuild, no risk to existing rows. CSV import/export, `toDTO()`, both test files and the whole
  admin CRUD keep working untouched. Phases can run concurrently because verticals do not overlap.

### B. Staging table — `PlaceCandidate` holds imported Places rows until approved, then promotes into `Restaurant`

Clean separation of "raw external data" from "our catalogue". `Restaurant` stays editorial-only.

- **Cost**: two shapes for the same thing. Every admin screen, the photo pipeline and the AI proposal
  queue must handle both. Promotion is a hand-written field-by-field copy that will drift from the
  schema within a month. Photos submitted against a candidate have nowhere to hang.
- **Benefit**: `Restaurant` stays tidy and a rejected candidate leaves no residue.

### C. Rebuild the schema — normalised `Cuisine` / `Tag` / `Neighborhood` tables, drop the JSON columns

The "do it properly" option. Real many-to-many, real facet counts from SQL.

- **Cost**: violates the stated constraint to keep the `toDTO()` JSON pattern. Rewrites `lib/csv.ts`,
  `lib/types.ts`, every route handler and both test files on day one, before a single new feature is
  visible. Buys query performance that a few hundred rows scored in JS does not need.
- **Benefit**: facet counts and tag renames become trivial. Correct at 10⁵ rows.

---

## Recommended approach

**A, extend in place.**

C is disallowed by constraint and unjustified by data volume — the recommender already loads every
active row into memory and scores it there, and that is fine at this size.

B loses to A on the one thing that actually matters here: **a draft `Restaurant` is a
`Restaurant`**. Photos, AI proposals, favourites and the admin edit form all want a stable
`restaurantId` from the moment of import. A separate candidate table means every one of those
relations needs a nullable second foreign key or a promotion step that copies fields by hand. The
"residue" B avoids is one `DELETE FROM Restaurant WHERE isActive = 0 AND source = 'google'`.

A also makes the concurrency work: Phase 1 lands the schema and the shared libs, then the map UI and
the Places ingest touch disjoint file sets and can be built by separate agents at the same time.

---

## Data model

### What changes to existing rows

Nothing is dropped, renamed or retyped. Consequences worth stating plainly:

- `Restaurant.image` **stays** as the denormalised hero image URL. It is what `toDTO()` returns, what
  `lib/csv.ts` exports and what `__tests__/api.test.ts` expects. `RestaurantPhoto` is the gallery; it
  does not replace `image`. Approving a community photo sets `image` **only if it is currently null
  or empty** — never overwrite an owner-chosen hero.
- `User.username` stays the unique login identifier for both roles. Community signup sets
  `username = lowercased email` and also stores `email`. One login endpoint serves both roles.
- `/api/recommend` keeps returning `{ items: [...] }`. It gains a sibling `points` key. The existing
  API test asserts on `items` only and stays green.

### Migration `20260909_v2_places_ai_community` must, in this order

1. `ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';`
2. **Hand-added, non-negotiable:** `UPDATE "User" SET "role" = 'admin';`
   Prisma will not generate this. Without it the existing admin row silently becomes a community
   user and locks the owner out of `/admin`. Run it before any signup exists.
3. `ALTER TABLE "User" ADD COLUMN "email" TEXT;`,
   `ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '';`,
   `ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;`, then
   `CREATE UNIQUE INDEX "User_email_key" ON "User"("email");` (SQLite permits many NULLs in a unique
   index, so existing rows with no email are fine).
4. All new `Restaurant` columns via `ADD COLUMN`, every one nullable or defaulted. `source TEXT NOT
   NULL DEFAULT 'manual'` correctly labels every row that exists today. No table rebuild — the
   `PRAGMA`-and-copy dance from the previous migration is not needed and must not be used, it would
   put the existing 20-odd rows at risk for no gain.
5. `CREATE TABLE` for `RestaurantPhoto`, `AiProposal`, `Favorite`.
6. **Hand-added data migration**, backfilling the gallery from existing heroes:
   ```sql
   INSERT INTO "RestaurantPhoto" ("id","restaurantId","url","source","status","createdAt","updatedAt")
   SELECT lower(hex(randomblob(16))), "id", "image", 'admin', 'approved',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
   FROM "Restaurant" WHERE "image" IS NOT NULL AND "image" != '';
   ```

Verification for the migration itself: copy `prisma/dev.db` aside, apply, then assert
`SELECT role, count(*) FROM User GROUP BY role` shows only `admin`, and
`SELECT count(*) FROM RestaurantPhoto` equals `SELECT count(*) FROM Restaurant WHERE image != ''`.

### `prisma/schema.prisma` (complete, post-migration)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  // SQLite: single file, trivial backup, plenty for one city of restaurants.
  // No native array/enum types here — list fields are JSON strings, see lib/types.ts.
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id       String @id @default(cuid())
  username String @unique // admin: a handle. community: the lowercased email.
  password String

  // "admin" | "user". New signups default to "user"; the migration backfills the
  // pre-existing row to "admin". Checked by requireAdmin(), never by middleware.
  role String @default("user")

  email       String? @unique
  displayName String  @default("")
  isBanned    Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  photos          RestaurantPhoto[] @relation("PhotoSubmitter")
  photoDecisions  RestaurantPhoto[] @relation("PhotoDecider")
  proposalReviews AiProposal[]      @relation("ProposalReviewer")
  favorites       Favorite[]

  @@index([role])
}

model Restaurant {
  id          String @id @default(cuid())
  slug        String @unique
  name        String @unique
  description String @default("")

  // Mood axes, 0-100. The three the recommender scores against.
  heaviness   Int @default(50) // light salad 0 <-> heavy comfort food 100
  portionSize Int @default(50) // small plates 0 <-> very filling 100
  fineDining  Int @default(50) // street food 0 <-> white tablecloth 100

  spiceLevel  Int @default(0)  // 0-100
  priceLevel  Int @default(2)  // 1-4, shown as $..$$$$
  avgPrepTime Int @default(30) // minutes

  // JSON string arrays (SQLite has no array type)
  cuisines String @default("[]")
  tags     String @default("[]") // "vegan-friendly", "outdoor-seating", "late-night", ...

  neighborhood String @default("")
  address      String @default("")
  lat          Float?
  lng          Float?

  // Links
  woltUrl      String?
  websiteUrl   String?
  instagramUrl String?
  gmapsUrl     String?
  phone        String?

  // Hero image. Denormalised on purpose: /api/recommend must stay a single
  // findMany with no joins, and lib/csv.ts round-trips this column.
  image String?

  // JSON: { "mon": ["09:00","23:00"], ..., "sun": null } — null means closed
  openHours String?

  rating     Float?  // 0-5, editorial
  isActive   Boolean @default(true)
  isFeatured Boolean @default(false)

  // --- v2: Google Places provenance ---
  // "manual" | "google". Everything that existed before this migration is "manual".
  source          String    @default("manual")
  placeId         String?   @unique // Places (New) v1 `places/ChIJ...` resource id
  placesSyncedAt  DateTime?
  placesRaw       String? // JSON: the trimmed Places payload we scored from. Audit trail.
  googleRating    Float?
  googleRatingCount Int?
  googlePriceLevel  Int? // 1-4, mapped from PRICE_LEVEL_* enum. Distinct from our editorial priceLevel.

  // --- v2: AI enrichment state ---
  // "none" | "pending" | "approved" | "rejected" | "failed". Mirrors the newest
  // AiProposal so the admin list can filter without a join.
  aiStatus     String    @default("none")
  aiApprovedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  photos    RestaurantPhoto[]
  proposals AiProposal[]
  favorites Favorite[]

  @@index([isActive])
  @@index([priceLevel])
  @@index([neighborhood])
  @@index([source])
  @@index([aiStatus])
}

/// Every photo we display, whoever produced it. One table, one status field —
/// a separate "submission" table would just be this with a different name.
model RestaurantPhoto {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  url    String // always a local /uploads/... path via lib/storage.ts
  width  Int?
  height Int?
  caption String @default("")

  // "admin" | "community" | "google"
  source String

  // Google Places photos carry mandatory attribution HTML. JSON string array.
  attributions String @default("[]")

  submittedById String?
  submittedBy   User?   @relation("PhotoSubmitter", fields: [submittedById], references: [id], onDelete: SetNull)

  // "pending" | "approved" | "rejected"
  status String @default("pending")

  // --- moderation record. Never mutated after it is written. ---
  aiVerdict     String? // JSON: the full PhotoModerationResult, exactly as parsed
  aiConfidence  Float?
  aiReason      String?
  wasAutoDecision Boolean @default(false) // true = published/held without a human looking

  // --- human override. Present iff an admin touched it. ---
  decidedById  String?
  decidedBy    User?     @relation("PhotoDecider", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt    DateTime?
  decisionNote String    @default("")

  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([restaurantId, status, sortOrder])
  @@index([status, createdAt])
  @@index([submittedById, createdAt]) // powers the per-user rate limit count
}

/// One Gemini enrichment run against one restaurant, awaiting the owner's verdict.
/// Nothing here reaches Restaurant until status becomes "approved".
model AiProposal {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  model  String // resolved from GEMINI_MODEL at call time, recorded for audit
  // "pending" | "approved" | "rejected" | "failed"
  status String @default("pending")

  /// JSON: the validated RestaurantScoringResult. Null when status = "failed".
  payload String?
  /// Raw model text, kept only when parsing failed, so the owner can see what it said.
  rawResponse String?
  errorMessage String?

  overallConfidence Float?
  /// JSON string array of the input kinds actually sent: ["photos","reviews","description"].
  inputsUsed String @default("[]")
  photoCount Int    @default(0)

  reviewedById String?
  reviewedBy   User?     @relation("ProposalReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt   DateTime?
  reviewNote   String    @default("")
  /// JSON: what was ACTUALLY written to Restaurant on approval, after the owner's
  /// edits. Diff this against `payload` to see where the human disagreed.
  appliedFields String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt]) // queue listing + the hourly spend counter
  @@index([restaurantId, createdAt])
}

/// Cheap enough to include. A named-lists feature is not (see Out of scope).
model Favorite {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([userId, restaurantId])
  @@index([userId, createdAt])
}
```

Note there is **no** `PlaceCandidate` and **no** `RateLimit` table. Places search results are never
persisted — the admin picks from a live response and the pick creates a draft `Restaurant`. Rate
limiting counts existing rows (`AiProposal.createdAt`, `RestaurantPhoto.createdAt`), which is
durable across restarts for free and needs no schema of its own.

---

## Module map

Grouped by vertical. `[new]` / `[modify]`.

### Foundation (Phase 1 — everything else depends on this)

| File | Holds |
| --- | --- |
| `prisma/schema.prisma` `[modify]` | The schema above. |
| `prisma/migrations/2026…_v2_places_ai_community/migration.sql` `[modify after generate]` | Prisma's output plus the two hand-added statements (`UPDATE User SET role='admin'`, the photo backfill). |
| `lib/types.ts` `[modify]` | Add `RestaurantPhotoDTO`, `photoToDTO()`, `MapPoint`, `CUISINE_VOCAB`, `TAG_VOCAB` (the controlled lists the AI must choose from and the chips render), `SORTS` (`match`/`rating`/`distance`/`price-asc`/`price-desc`), `VIEWS`. `toDTO()` gains nothing — the DTO shape the tests fixture stays byte-identical. |
| `lib/auth.ts` `[modify]` | `getCurrentUser()` also selects `role`, `displayName`, `isBanned`; a banned user resolves to `null`. Add `requireAdmin()` (throws `'Forbidden'`) and keep `requireAuth()` meaning *any* signed-in user. Add `createUser({username,password,role})` used by both `scripts/create-admin.ts` and the register route. |
| `lib/scoring.ts` `[modify]` | `SearchFilters` gains optional `bbox?: [number,number,number,number]`, `sort?: Sort`, `spiceMax?: number`. `passesFilters` gains a bbox test. `search()` applies `filters.sort` after scoring. **Signature unchanged** — all new state rides inside `SearchFilters`, so both existing test files compile and pass without edits. |
| `lib/storage.ts` `[modify]` | `sniffExt()` moves here from `app/api/upload/route.ts`, plus `saveImage(buffer): Promise<{url, ext}>` that sniffs, rejects, names randomly and writes. One validator, three callers (admin upload, community submission, Places photo download). |
| `lib/ratelimit.ts` `[new]` | `countSince(model, where, sinceMs)` thin wrappers: `aiProposalsLastHour()`, `photosByUser(userId, windowMs)`. Plus the in-process `Map` limiter for non-money endpoints, lifted from the pattern already in `app/api/auth/login/route.ts`. |
| `lib/filters.ts` `[new]` | The single source of truth for URL ⟷ filter state. `parseFilters(searchParams): SearchFilters & {view, page}` and `toSearchParams(filters): URLSearchParams`. Imported by the client shell **and** `/api/recommend`, so a shared link and the API agree by construction. Zod-validated, same coercion rules as the current `recommendSchema` (note the existing `flag` helper: `z.coerce.boolean()` is wrong here, only the literal `'true'` counts). |
| `app/api/restaurants/route.ts`, `[id]/route.ts`, `import/`, `export/`, `seed/`, `app/api/upload/route.ts` `[modify]` | `requireAuth()` → `requireAdmin()`. **This is the single most important line of this plan.** Once `User` holds community accounts, `requireAuth()` on these routes authorises any registered stranger to edit the catalogue. Six files, one substitution, must land in Phase 1 with the schema. |
| `middleware.ts` `[modify — comment only]` | Behaviour unchanged; the edge cannot verify the HMAC or read the role. Extend the comment to say a community user's cookie also passes this gate and that `/admin` safety rests entirely on `requireAdmin()` + the `/api/auth/me` role check in `app/admin/layout.tsx`. Matcher stays `/admin` only — community pages live under `/account` and are never matched. |
| `app/admin/layout.tsx` `[modify]` | Redirect to `/` when `/api/auth/me` returns `role !== 'admin'`. Add nav links: Discover, AI Queue, Photos. |
| `app/api/auth/me/route.ts` `[modify]` | Return `role` and `displayName`. |
| `.env.example` `[modify]` | `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `MAPBOX_TOKEN` (deliberately **not** `NEXT_PUBLIC_` — see Phase 2). |

### Public experience (Phase 2)

| File | Holds |
| --- | --- |
| `app/page.tsx` `[modify — full rewrite]` | Server component. Reads `MAPBOX_TOKEN` and `CITY` at request time, passes them as props. This is the new front door; the marketing splash it holds today is deleted. |
| `app/eat/page.tsx` `[modify — reduced to 3 lines]` | `redirect('/')`. Old links keep working. |
| `components/search/SearchShell.tsx` `[new]` | `'use client'`. Owns filter state, syncs it to the URL with `useSearchParams` + `router.replace(..., {scroll:false})` — no `nuqs`, no state library. Debounced 300 ms fetch of `/api/recommend`. Passes results to both panes. |
| `components/search/SearchBar.tsx` `[new]` | Free-text input plus the removable chip rail; a chip's × removes exactly one filter value. |
| `components/search/FilterPanel.tsx` `[new]` | The drawer: cuisine, tags, price 1-4, neighborhood, open-now, radius, and the three mood sliders (existing `input[type=range]` styling in `globals.css` is reused as-is). |
| `components/search/SortHeader.tsx` `[new]` | "`{n}` places" + the sort `<select>` + the List/Grid/Map `ViewToggle`. |
| `components/map/MapPane.tsx` `[new]` | `react-map-gl` `<Map>`, `<GeolocateControl>`, `<NavigationControl>`. Emits `onMoveEnd` bounds. Renders a "Search this area" pill when bounds drift from the last query. Renders a static fallback panel when `token` is falsy. |
| `components/map/PointsLayer.tsx` `[new]` | One GeoJSON `<Source cluster>` + three `<Layer>`s (cluster circle, cluster count, unclustered point). Mapbox GL clusters natively — no `supercluster` dependency. |
| `components/map/PopupCard.tsx` `[new]` | The marker-anchored hover/click card. Same visual component as the grid card at a smaller size. |
| `components/results/ResultsPane.tsx` `[new]` | Scroll container, grid/list switch, empty state, "load more". Hover on a card highlights its marker via a shared `hoveredId` in `SearchShell`. |
| `components/results/RestaurantCard.tsx` `[new]` | Image, name, price, cuisines, distance, open-now, score. Used by grid, list and popup. |
| `app/api/recommend/route.ts` `[modify]` | Parses via `lib/filters.ts`. Returns `{ items, points, total, facets }` — `items` paged at 24, `points` the id/lat/lng/name/price of every match capped at 500 so map and list never disagree. Still exactly one `prisma.restaurant.findMany({where:{isActive:true}})`, which is what keeps `__tests__/api.test.ts` passing. |
| `app/r/[slug]/page.tsx` `[new]` | Server component, reads Prisma directly (no API route needed): detail, approved photo gallery, hours, links, mini-map, favourite button, "submit a photo" CTA. |

### Google Places ingest (Phase 3 — parallel with Phase 2, zero shared files)

| File | Holds |
| --- | --- |
| `lib/places.ts` `[new]` | `searchText()`, `searchNearby()`, `placeDetails()`, `photoMediaUrl()`. Key read from `process.env.GOOGLE_PLACES_API_KEY` inside each function; missing key throws `PlacesDisabledError`. Sends `X-Goog-Api-Key` + an explicit `X-Goog-FieldMask` per call (never `*` — the field mask is the billing tier). Also `toRestaurantDraft(place)`: maps `displayName`, `formattedAddress`, `location`, `regularOpeningHours.periods` → our `OpenHours` shape (validated through `openHoursSchema` before write), `priceLevel` enum → 1-4, `addressComponents` sublocality → `neighborhood`. |
| `app/api/admin/places/search/route.ts` `[new]` | `requireAdmin`. POST `{query, mode:'text'|'nearby', lat, lng, radius}`. Proxies Places, marks each candidate `alreadyImported` by looking up `placeId`. Persists nothing. 503 with a readable message when the key is absent. |
| `app/api/admin/places/import/route.ts` `[new]` | `requireAdmin`. POST `{placeIds: string[]}` (cap 20). Per place: details call → create `Restaurant` with `isActive:false, source:'google', aiStatus:'none'` → download up to 6 photo media server-side through `lib/storage.saveImage` → `RestaurantPhoto` rows (`source:'google'`, `status:'approved'`, `attributions` filled) → set `image` from the first. Idempotent on `placeId`. Returns a per-place ok/skipped/failed list. |
| `app/api/admin/places/refresh/route.ts` `[new]` | `requireAdmin`. Re-pulls hours/rating/phone for one existing `placeId`, updates only the Google-owned columns, bumps `placesSyncedAt`. Never touches owner-edited fields. |
| `app/admin/discover/page.tsx` `[new]` | Search box, mode toggle, candidate grid with checkboxes, Import selected. Disabled banner when the key is missing. |
| `app/admin/page.tsx` `[modify]` | Add status columns (`source`, `aiStatus`, active/draft) and a filter for drafts. |

### Gemini enrichment (Phase 4)

| File | Holds |
| --- | --- |
| `lib/gemini.ts` `[new]` | Lazily constructs the `@google/genai` client per call from `GEMINI_API_KEY`, model from `GEMINI_MODEL` (fallback `'gemini-3.5-flash-lite'`). Two exports: `scoreRestaurant(input)` and `moderatePhoto(input)`. Each sets `responseMimeType:'application/json'` + `responseSchema`, zod-parses the result, retries once at `temperature: 0`, then gives up and returns a discriminated failure. Missing key throws `AiDisabledError`. |
| `lib/aiSchemas.ts` `[new]` | The Gemini `responseSchema` objects and their mirror zod schemas, defined side by side so they cannot drift. See "The AI contract" below. |
| `app/api/admin/ai/enrich/route.ts` `[new]` | `requireAdmin`. POST `{restaurantId}` or `{restaurantIds:[]}` (cap 10). Assembles photos + `placesRaw` reviews + description, calls `scoreRestaurant`, writes an `AiProposal`, sets `Restaurant.aiStatus='pending'`. Rate limited (below). |
| `app/api/admin/proposals/route.ts` `[new]` | `requireAdmin`. GET the queue, filterable by status. |
| `app/api/admin/proposals/[id]/route.ts` `[new]` | `requireAdmin`. `POST ?action=approve` with an optional edited payload → validates through the same zod schema as a manual edit → writes to `Restaurant`, records `appliedFields`, `reviewedById`, `reviewedAt`, sets `aiStatus='approved'`, `aiApprovedAt`. `?action=reject` records the note and sets `aiStatus='rejected'`, leaving the restaurant untouched and inactive. |
| `app/admin/queue/page.tsx` `[new]` | Side-by-side current-value vs proposed-value, per-field confidence bar and rationale, each field editable before approve. Approve all / reject. |
| `app/admin/components/RestaurantForm.tsx` `[modify]` | Add tags, spice, wolt/instagram, an "Ask AI" button, and the photo gallery manager. It currently drops `tags`, `woltUrl`, `instagramUrl`, `address`, `rating` and `isFeatured` on the floor even though the API accepts them — fix that here. |

### Community (Phase 5)

| File | Holds |
| --- | --- |
| `app/api/auth/register/route.ts` `[new]` | Public. Email + password + display name, zod-validated, `role` **hardcoded** to `'user'` — the field is never read from the body. Reuses `hashPassword`, `createSession`, `sessionCookieOptions`. Same in-process attempt limiter as login, keyed on email. |
| `app/api/auth/login/route.ts` `[modify]` | Accept `username` **or** `email`. Otherwise unchanged, including the lockout map and the constant-cost invalid path. |
| `app/account/login/page.tsx`, `register/page.tsx`, `page.tsx` `[new]` | Community-facing auth pages and "my photos / my favourites". Not matched by `middleware.ts`. |
| `app/api/community/photos/route.ts` `[new]` | `requireAuth` (any signed-in, non-banned user). POST multipart `{restaurantId, file, caption}`. Validates the restaurant exists and `isActive`; `lib/storage.saveImage` sniffs and stores; calls `moderatePhoto`; applies the auto-publish rule; writes `RestaurantPhoto`. GET returns the caller's own submissions only. |
| `app/api/community/favorites/route.ts` `[new]` | `requireAuth`. POST/DELETE `{restaurantId}`, GET the caller's list. |
| `app/api/admin/photos/route.ts`, `[id]/route.ts` `[new]` | `requireAdmin`. Queue filtered by status **including auto-approved** ones, so the owner can review what the AI let through. `POST ?action=approve|reject|delete` writes `decidedById`/`decidedAt`/`decisionNote` and, on delete, calls `deleteUpload`. |
| `app/admin/photos/page.tsx` `[new]` | Moderation grid: thumbnail, restaurant, submitter, the AI verdict and reason, auto-vs-held badge, approve/reject/delete. |
| `components/community/PhotoUpload.tsx` `[new]` | The submit widget on `/r/[slug]`. Signed-out state links to `/account/login?next=`. |

---

## Trust and safety boundaries

**Where a community value is validated.** Server-side only, at the route handler, before anything is
persisted:
- Image bytes → `sniffExt()` in `lib/storage.ts`. Extension comes from magic bytes, never from the
  filename or the client `Content-Type` — `public/uploads` is served from our own origin, so a stored
  `.html` is stored XSS. This is already correct in `app/api/upload/route.ts`; moving it to
  `lib/storage.ts` is what makes it correct for the community route too, rather than a second
  half-copy of it.
- Size cap 5 MB, checked from `file.size` **before** `arrayBuffer()`, same as today.
- `caption` → zod, ≤ 140 chars, stored as text and rendered as text. No HTML anywhere.
- `restaurantId` → must resolve to an `isActive` restaurant. A community user cannot create a
  restaurant, cannot address a draft, cannot set `source`, `status`, `sortOrder` or any moderation
  column. Those are not in the request schema at all, so a crafted body cannot reach them.
- Registration `role` is never read from the body.

**What a non-admin can reach.** Everything under `/api/admin/**` and the six existing catalogue
routes calls `requireAdmin()` and returns 403. `middleware.ts` stays a cookie-presence check —
it *will* let a community user load the `/admin` shell HTML, and that is acceptable because the shell
is empty until `/api/auth/me` answers, and `app/admin/layout.tsx` redirects on `role !== 'admin'`
while every data call independently returns 403. Write this down in the middleware comment; it is
exactly the assumption a future reader will otherwise break. A banned user's `getCurrentUser()`
returns `null`, so a ban takes effect on the next request with no session revocation machinery.

**Rate limits on the money endpoints.** Counted from rows already in the database, so a process
restart cannot reset the budget:
- `POST /api/admin/ai/enrich` — refuse when `AiProposal` rows created in the last hour ≥ 60, or when
  the target restaurant already has a `pending` proposal. Batch capped at 10 per request.
- `POST /api/community/photos` — refuse when this user's `RestaurantPhoto` rows exceed 5 in the last
  hour or 20 in the last 24 h. Query is covered by `@@index([submittedById, createdAt])`.
- `POST /api/admin/places/search` — 100 per hour, in-process `Map` (quota, not spend).
- `POST /api/admin/places/import` — 20 places per request; photo downloads capped at 6 per place.
- Public `/api/recommend` keeps its existing in-memory limiter.
All limits return **429 with a human-readable message and the retry window**, never a silent empty
result.

**How an override is recorded.** The AI's verdict columns (`aiVerdict`, `aiConfidence`, `aiReason`
on a photo; `payload` on a proposal) are written once and never mutated. A human decision is written
to *different* columns (`status`, `decidedById`, `decidedAt`, `decisionNote`; `appliedFields`,
`reviewedById`, `reviewedAt`, `reviewNote`). Both survive together, so "the AI approved this and the
owner later pulled it" is a readable fact, and `wasAutoDecision` tells you whether a human ever
looked. Diffing `appliedFields` against `payload` shows exactly where the owner disagreed with the
model — which is the data you would need to tune the prompt later.

---

## The AI contract

Both calls use `responseMimeType: 'application/json'` plus an explicit `responseSchema`, and both
re-validate with zod after parsing. Structured output constrains decoding; zod is what protects the
database. Neither alone is sufficient.

### (a) Restaurant scoring — `scoreRestaurant()`

Input assembled server-side: up to 8 photo bytes (inline parts), up to 10 Google review texts from
`placesRaw`, the current description, name, `primaryType`/`types`, address, and the two controlled
vocabularies `CUISINE_VOCAB` / `TAG_VOCAB` from `lib/types.ts` — the schema's `enum` constraint on
those arrays is what stops tag-space explosion.

```jsonc
{
  "scores": {
    "heaviness":   { "value": 72, "confidence": 0.81, "rationale": "Grilled meat plates, few vegetable dishes." },
    "portionSize": { "value": 85, "confidence": 0.74, "rationale": "Reviews repeatedly mention huge shares." },
    "fineDining":  { "value": 30, "confidence": 0.9,  "rationale": "Paper napkins, counter service, plastic chairs." },
    "spiceLevel":  { "value": 15, "confidence": 0.5,  "rationale": "No chili-forward dishes visible." }
  },
  "priceLevel":   { "value": 2, "confidence": 0.7, "rationale": "Mains around 6-9 EUR per reviews." },
  "cuisines":     { "value": ["Balkan", "Grill"], "confidence": 0.88, "rationale": "Qebapa and pleskavica dominate the photos." },
  "tags":         { "value": ["late-night", "outdoor-seating"], "confidence": 0.6, "rationale": "Terrace photos; reviews mention 2am visits." },
  "description":  { "value": "A no-frills grill house...", "confidence": 0.75, "rationale": "Synthesised from 10 reviews and 8 photos." },
  "neighborhood": { "value": "Qendra", "confidence": 0.4, "rationale": "Address is on Rr. UÇK near the centre." },
  "overallConfidence": 0.72,
  "insufficientEvidence": false
}
```

Rules the schema enforces: `value` integers `0..100` for the four axes, `1..4` for `priceLevel`,
every `confidence` `0..1`, every `rationale` a single line ≤ 160 chars, `description` ≤ 280 chars,
`cuisines`/`tags` arrays of the vocabulary enums with 0-4 items, every property required and
`nullable: false`, `propertyOrdering` set so decoding is stable.

`insufficientEvidence: true` (no usable photos, no reviews) means the proposal is stored but the
queue shows it as low-signal; no field auto-fills.

### (b) Photo moderation — `moderatePhoto()`

Input: the uploaded image bytes plus the restaurant's name, cuisines and up to 3 existing approved
photos as context for the "does it match this venue" question.

```jsonc
{
  "isFood": true,
  "depictsFoodOrVenue": true,
  "matchesVenue": "likely",          // "yes" | "likely" | "unknown" | "no"
  "isNsfw": false,
  "isSpamOrPromotional": false,      // watermarks, phone numbers, overlaid text, memes
  "looksLikeStockOrScreenshot": false,
  "containsIdentifiablePeople": false,
  "qualityScore": 78,                // 0-100, blur/exposure/framing
  "verdict": "approve",              // "approve" | "review" | "reject"
  "confidence": 0.91,
  "reason": "Plated grilled meat on a wooden table, consistent with the venue's existing photos."
}
```

**Auto-publish rule** (all must hold, evaluated in our code, never delegated to `verdict` alone):
`verdict === "approve"` **and** `confidence >= 0.85` **and** `isFood` **and**
`depictsFoodOrVenue` **and** `matchesVenue` in `{"yes","likely"}` **and** `!isNsfw` **and**
`!isSpamOrPromotional` **and** `!looksLikeStockOrScreenshot` **and** `qualityScore >= 40`.
→ `status: 'approved'`, `wasAutoDecision: true`.

`verdict === "reject"` with `confidence >= 0.85` → `status: 'rejected'`, `wasAutoDecision: true`,
still listed in the admin queue with an override button. **Everything else → `status: 'pending'`.**

### Malformed, hallucinated or absent responses

1. Parse the text as JSON. Failure → retry **once**, same prompt, `temperature: 0`, with the
   instruction "return only the JSON object".
2. Zod-validate. Out-of-range numbers, unknown enum members, missing keys, extra keys → treated as
   a parse failure and go through the same single retry. Values are **never** clamped into range:
   a model returning `heaviness: 340` is a model that misunderstood the task, and clamping it to 100
   launders a wrong answer into a plausible one.
3. Still bad after the retry:
   - **Scoring** → `AiProposal` written with `status: 'failed'`, `payload: null`, `rawResponse` set
     to the model's text and `errorMessage` to the zod issue. `Restaurant.aiStatus = 'failed'`. The
     restaurant is untouched and stays a draft. The queue shows it as a retryable failure.
   - **Moderation** → **fail closed**: `status: 'pending'`, `wasAutoDecision: false`,
     `aiReason: 'moderation unavailable'`. A photo never auto-publishes on a failed check.
4. `GEMINI_API_KEY` absent → `AiDisabledError`. The enrich route answers 503 with
   `"AI enrichment is disabled: GEMINI_API_KEY is not set"` and the admin UI renders a disabled state
   with that message. Community photo submission still succeeds and lands in the pending queue —
   the feature degrades to manual moderation rather than breaking.

---

## Phases

Each phase ends with the app running and something the owner can look at.

### Phase 1 — Foundation. Blocking. One agent, alone.

Schema + migration (with the two hand-added SQL statements), `lib/types.ts` additions,
`lib/auth.ts` roles + `requireAdmin()`, the `requireAuth → requireAdmin` swap across the six
existing admin routes, `lib/scoring.ts` extension, `sniffExt` moved into `lib/storage.ts`,
`lib/ratelimit.ts`, `lib/filters.ts`, `.env.example`, dependency install.

**Deliverable:** identical app, new schema underneath.
**Verify:** `npm test` green with **zero edits to `__tests__`**; `npm run build` clean; log in at
`/admin/login` and confirm the restaurant list still loads and an edit still saves; run the two
migration assertions from the Data model section against a copy of `dev.db`.

### Phase 2 — Public map experience. **Parallel with Phase 3.**

`app/page.tsx`, `app/eat/page.tsx` redirect, everything under `components/search/`,
`components/map/`, `components/results/`, `app/api/recommend/route.ts`, `app/r/[slug]/page.tsx`.

`MAPBOX_TOKEN` is read in the server component and passed down as a prop rather than declared
`NEXT_PUBLIC_*`, because a `NEXT_PUBLIC_` value is inlined at build time — which would violate the
"read at request time" constraint and bake the token into the standalone bundle. It reaches the
browser either way, so it must be URL-restricted in the Mapbox dashboard regardless.

**Deliverable:** the new front door, working against the restaurants already in the database.
**Verify:** open `/`, apply a cuisine chip and a price filter, copy the URL, open it in a private
window — identical results. Browser Back removes the last chip. Pan the map, hit "Search this area",
confirm the count changes. Unset `MAPBOX_TOKEN`, reload: grid view renders, map pane shows the
disabled panel, nothing throws.

### Phase 3 — Google Places ingest. **Parallel with Phase 2.** No shared files.

`lib/places.ts`, `app/api/admin/places/{search,import,refresh}/route.ts`,
`app/admin/discover/page.tsx`, plus the status columns in `app/admin/page.tsx`.

**Deliverable:** owner can search "restaurants in Prishtina", tick 10, and get 10 drafts with photos,
hours and coordinates.
**Verify:** import a known place; confirm the draft has `source='google'`, a `placeId`, non-null
lat/lng, `RestaurantPhoto` rows pointing at local `/uploads/` files (not Google URLs), and hours that
survive `openHoursSchema`. Re-import the same place — skipped, not duplicated. Unset the key: the
Discover page shows a disabled banner instead of a stack trace.

### Phase 4 — Gemini enrichment and the review queue. Needs Phases 1 and 3.

`lib/aiSchemas.ts`, `lib/gemini.ts`, `app/api/admin/ai/enrich/route.ts`,
`app/api/admin/proposals/**`, `app/admin/queue/page.tsx`, `RestaurantForm.tsx` field completion.

**Deliverable:** a draft goes from Places-raw to owner-approved and live without manual typing.
**Verify:** enrich one draft; the queue shows per-field proposals with confidences and rationales;
edit one value, approve, and confirm `Restaurant` holds the *edited* value while `AiProposal.payload`
still holds the original and `appliedFields` records what was written. Reject another and confirm the
restaurant is unchanged and still inactive. Point `GEMINI_MODEL` at a nonsense id and confirm you get
a `failed` proposal with `rawResponse` populated, not a 500.

### Phase 5 — Community accounts and photo moderation. Needs Phase 1; needs `lib/gemini.ts` from Phase 4.

Register/login, `/account/**`, `app/api/community/**`, `app/api/admin/photos/**`,
`app/admin/photos/page.tsx`, `components/community/PhotoUpload.tsx`.

The accounts, favourites and upload-storage half depends only on Phase 1 and can start while Phase 4
is in flight; only the `moderatePhoto()` call is a hard dependency.

**Deliverable:** a stranger can register, submit a photo, and see a clean one appear on the
restaurant page; a bad one lands in the owner's queue.
**Verify:** register a second account; confirm it gets 403 from `/api/restaurants` and is bounced off
`/admin`. Submit a clear food photo → auto-published, `wasAutoDecision: true`. Submit a screenshot →
pending. Approve it as admin and confirm `decidedById`/`decidedAt` are set while `aiVerdict` is
unchanged. Submit 6 photos in an hour and confirm the 6th gets a 429 with a retry window.

### Phase 6 — Consolidation. Needs everything.

Mobile layout for the map/list split (map collapses to a toggle below `md`), keyboard and screen
reader passes on the chip rail and marker popups, `app/admin/import` CSV round-trip re-verified
against the new columns, `prisma/seed.ts` refreshed, `README.md` rewritten, deploy runbook for the
VPS (env vars, `prisma migrate deploy`, `public/uploads` persistence and backup, Nginx cache headers
for `/uploads`).

**Deliverable:** shippable.
**Verify:** deploy to the VPS, run the Phase 2-5 verifications against the live host, confirm
`public/uploads` survives a redeploy and is included in the backup.

### Parallelism summary

```
Phase 1 ──┬── Phase 2 (public UI)      ──┐
          └── Phase 3 (Places ingest)  ──┴── Phase 4 (Gemini) ── Phase 5 (community) ── Phase 6
                                              (Phase 5's account/upload half may start with Phase 4)
```

Phase 2 and Phase 3 touch **no file in common**. Phase 2 owns `app/page.tsx`, `app/eat/`, `app/r/`,
`components/**`, `app/api/recommend/`. Phase 3 owns `lib/places.ts`, `app/api/admin/places/**`,
`app/admin/discover/`, and is the only phase permitted to edit `app/admin/page.tsx`. Both depend on
`lib/types.ts` and `lib/filters.ts`, which is why Phase 1 must fully land first.

---

## Out of scope for v1

| Not built | Trigger to build it |
| --- | --- |
| Named saved lists / collections ("date night", "cheap lunch") | Owner sees people using `Favorite` and asks for grouping. `Favorite` already carries the `userId`, so a `List` table is additive. |
| Public user reviews or ratings | Photos are moderated first. Text moderation is a different, harder problem and needs a reporting flow behind it. |
| Email verification, password reset, OAuth | The first support request about a forgotten password. Until then a manual reset via `scripts/create-admin.ts` covers it. |
| Background job queue for AI calls | Enrichment is a foreground admin action on ≤ 10 restaurants and takes seconds. Add a queue when a batch exceeds ~50, or when a request times out at the Nginx proxy. |
| Scheduled Places re-sync | The manual `/api/admin/places/refresh` button covers it. Automate when the owner is clicking it weekly. |
| Postgres / PostGIS | Only if the dataset leaves one city, or `findMany`-and-score exceeds ~200 ms. |
| S3 or object storage for uploads | Only if the app leaves the VPS for a serverless host. `lib/storage.ts` is two functions; that is the whole migration. |
| Multi-city support | `CITY` in `lib/types.ts` is a single const by design. Generalise when a second city actually exists, not before. |
| Multiple admin accounts / granular permissions | `role` is a string, so a third value costs one migration. Add when a second person needs access. |
| i18n (Albanian / Serbian / English) | Real user demand. Retrofitting is genuinely painful, so this is the one item worth reconsidering early — see Needs a call. |
| Wolt / delivery integration beyond the existing link | Wolt exposes a usable partner API. |
| Server-side rendering of search results for SEO | `/r/[slug]` detail pages are server-rendered and are the SEO surface. The map page is an app, not a document. |

---

## Risks and open questions

1. **Google Places photo licensing.** Downloading and re-hosting Places photos is not clearly within
   the Places TOS, which expects the photo media endpoint to be called at display time with
   attribution. Re-hosting is chosen anyway because proxying every photo through our key on every
   page view is both slow and expensive. Mitigation: `attributions` is stored and must be rendered on
   the gallery, and photo count per place is capped at 6. **This is a decision the owner should
   confirm** — the alternative is a signed proxy route with a disk cache, roughly a day of work.
2. **AI cost is unbounded per photo submission.** Every community upload is a Gemini vision call.
   The per-user limits above cap an individual, not the aggregate. If the site gets attention, add a
   global daily ceiling that flips submissions straight to `pending` once crossed — cheap to add,
   deliberately not built now.
3. **In-process rate limiters die with the process.** The login lockout and the Places search limit
   are `Map`s, matching the existing precedent. The two limiters that guard money are DB-counted and
   survive restarts. If the app ever runs more than one node process, the in-process ones silently
   multiply by the process count.
4. **`middleware.ts` cannot see the role.** A community user's cookie passes the edge check. The real
   gate is `requireAdmin()` in every handler. If a future admin page ever renders data server-side in
   the page component instead of fetching it, it must call `requireAdmin()` itself — the middleware
   will not save it.
5. **Uncommitted working tree.** `git status` shows a large set of unstaged modifications and
   untracked files including `middleware.ts` and `lib/types.ts`. Phase 1 should commit the current
   state first, so the v2 migration is a reviewable diff rather than a merge with in-flight work.
6. **`Restaurant.name` is `@unique`.** Two genuinely different venues with the same name (a chain
   with two branches, likely in Prishtina) will collide on import. The import route must catch
   `P2002` and surface "name already taken" per place rather than failing the batch. Dropping the
   unique constraint would break `lib/csv.ts`'s upsert-on-name, so it stays; the import
   disambiguates by appending the neighborhood.
7. **Mood axes for a Google-imported restaurant are guesses.** A restaurant scored 50/50/50 by
   default and never enriched ranks identically to a perfectly-matched one under `axisScore`.
   Consider whether an un-enriched draft should be excluded from the mood-sorted results entirely —
   currently it is, since drafts are `isActive: false`, but that stops being true the moment the
   owner approves a low-confidence proposal.
8. **`priceLevel` now has two sources** — editorial and Google. The recommender uses only the
   editorial one. If the owner never fills it, everything sits at the default 2 and the price filter
   becomes meaningless. Approving an AI proposal should always set it.

---

## Needs a call from the owner

1. **Photo re-hosting vs. proxying (Risk 1).** Re-host with attribution as planned, or build the
   signed proxy? Affects Phase 3 scope by about a day.
2. **Does the map load results on first paint, or wait for a search?** Emlakjet-style portals show
   everything immediately. That means one full-catalogue query on every cold visit. Recommendation:
   load immediately, capped at 500 map points — but say so if you want a landing state instead.
3. **Language.** English only in v1, or is Albanian needed at launch? This is the one out-of-scope
   item that is materially harder to retrofit, and it changes every component built in Phase 2.
4. **Should community photos be attributed publicly** (display name under the photo) or shown
   anonymously? Changes the DTO and the gallery, and it is a privacy commitment worth making before
   the first submission rather than after.
5. **The controlled vocabularies.** `CUISINE_VOCAB` and `TAG_VOCAB` in `lib/types.ts` constrain what
   the AI may ever propose and what chips exist. The plan seeds them from the current data plus
   obvious Kosovo categories, but the owner should review the list once before Phase 4 — changing it
   later means re-running enrichment.
6. **Auto-publish threshold.** `confidence >= 0.85` is a guess with no data behind it. Start at 0.85,
   or start at 1.0 (nothing auto-publishes) for the first weeks and lower it once the queue shows the
   model is trustworthy? The second is safer and costs only owner attention.
```