# Operations — running EatFinder day to day

Owner-facing workflows. Everything below assumes you're logged in at
`/admin/login` with the admin account, unless stated otherwise.

## 1. Import restaurants from Google Places

Requires `GOOGLE_PLACES_API_KEY` set (see README "Running without API keys").

1. Go to `/admin/discover`.
2. Search either by text (`mode: 'text'`, e.g. "restaurants in Prishtina") or
   nearby a point (`mode: 'nearby'`, needs lat/lng). This calls
   `POST /api/admin/places/search`, which proxies Google and **persists
   nothing** — nothing is written to the database until you import.
3. Results already imported (matched by `placeId`) are marked
   `alreadyImported` and their checkbox is disabled — you cannot double-import
   the same place.
4. Tick up to 20 candidates, click Import. `POST /api/admin/places/import`
   fetches full details per place, downloads up to 6 photos each and
   re-hosts them through `lib/storage.saveImage`, and creates each as a
   **draft** restaurant: `source: 'google'`, `isActive: false`,
   `aiStatus: 'none'`. One failed place never fails the batch — you get a
   per-place `ok` / `skipped` / `failed` result, and re-running the import for
   an already-imported `placeId` just reports `skipped`.
5. Drafts do not appear on the public site (`/api/recommend` only returns
   `isActive: true`). Review them on `/admin` — filter to drafts, check
   address/hours/photos, then either enrich them with AI (§2) or hand-edit
   and flip `isActive` to publish.

**Name collisions.** `Restaurant.name` is `@unique`. If a chain has two
branches, the import route retries once with the neighbourhood appended to
the name (`"Place (Neighborhood)"`); if that still collides it reports that
one place as `failed` rather than failing the whole batch.

**Refreshing an already-imported place.** `POST /api/admin/places/refresh`
(no UI button by design — a per-row refresh button would put a billed Google
call one click away) re-pulls only the Google-owned columns (hours, phone,
`googleRating`, `googleRatingCount`, `googlePriceLevel`) for one existing
`placeId`. It never touches your editorial fields: description, the mood
axes, editorial `priceLevel`, `image`, or the editorial `rating`.

## 2. AI enrichment and the review queue

Requires `GEMINI_API_KEY` set.

1. From an admin restaurant, click "Ask AI" (in `RestaurantForm`) or batch up
   to 10 restaurant IDs against `POST /api/admin/ai/enrich`. This assembles up
   to 8 approved photos, up to 10 Google review excerpts (from `placesRaw`),
   and the current description, and sends them to Gemini with a strict JSON
   schema. Refused with a clear message if a pending proposal already exists
   for that restaurant, or if 60 proposals have already been created across
   the whole app in the last hour (§4).
2. A successful call writes an `AiProposal` row (`status: 'pending'`) and sets
   `Restaurant.aiStatus = 'pending'`. It does **not** touch the restaurant
   itself yet.
3. Open `/admin/queue`. Each pending proposal shows the model's suggested
   value per field next to the current one, with a confidence bar and a
   one-line rationale, editable before you approve.
4. **Approve** (`POST /api/admin/proposals/[id]?action=approve`): your
   (possibly edited) values are re-validated through the same zod rules a
   manual edit uses, then written to `Restaurant` — description, the three
   mood axes, spice level, price level, cuisines, tags, neighbourhood.
   `priceLevel` is always set on approval, even if you didn't touch it,
   because an un-enriched draft otherwise sits at the default `2` forever and
   the price filter goes meaningless.
5. **Reject** (`?action=reject`): the restaurant is left untouched and stays
   a draft. Record a `reviewNote` either way.

**`appliedFields` vs `payload` — read this before tuning the prompt.**
`AiProposal.payload` is the model's original answer, written once, never
mutated. `AiProposal.appliedFields` is what actually landed in `Restaurant`
after your edits, written only on approval. They will usually match. When
they don't, the difference is exactly where you disagreed with the model —
diff the two JSON blobs for a rejected suggestion (say, the model proposed
`heaviness: 80` and you approved it at `60`) and you have real evidence for
what the prompt in `lib/gemini.ts` should say differently, rather than a
guess.

**Failures.** If Gemini's response doesn't parse as valid JSON matching the
schema, `lib/gemini.ts` retries once at `temperature: 0` with an explicit
"return only the JSON object" instruction. Still bad → the proposal is
written with `status: 'failed'`, `payload: null`, `rawResponse` set to
whatever text the model produced (even if that's nothing, for e.g. an
invalid `GEMINI_MODEL`), and `Restaurant.aiStatus = 'failed'`. Values from
Gemini are **never clamped** into range — a `heaviness: 340` is a failure to
retry, not a value to silently cap at 100.

## 3. Moderating community photos

1. `/admin/photos` lists every `RestaurantPhoto`, filterable by status
   (`pending` / `approved` / `rejected`). **"Approved" here includes photos
   the AI auto-published without any human looking** — this is deliberate,
   so you can audit what went out, not just what's waiting.
2. Each row shows the AI's verdict (`aiVerdict`, the full parsed moderation
   result), `aiConfidence`, `aiReason`, and a `wasAutoDecision` badge.
   `wasAutoDecision: true` means nobody reviewed this before it went live (or
   before it was auto-rejected) — it's the single field that tells you
   whether a human ever looked.
3. Approve, reject, or delete
   (`POST /api/admin/photos/[id]?action=approve|reject|delete`). This writes
   to a **separate** set of columns — `status`, `decidedById`, `decidedAt`,
   `decisionNote` — from the AI's own verdict columns, which are never
   overwritten. So "the AI approved this and I later pulled it" stays
   readable in the data forever, not lost the moment a human touches the row.
   Delete also removes the underlying file/object via `deleteUpload()`.
4. Approving a photo (whether by a human here or automatically) sets it as
   the restaurant's hero `image` **only if `image` is currently null or
   empty** — it never overwrites an owner-chosen hero photo.

**`PHOTO_AUTOPUBLISH_CONFIDENCE`.** Env var, default `0.85`, read at request
time (`lib/gemini.ts` → `photoAutoPublishThreshold()`). A submission
auto-publishes only if **every** one of these holds: `verdict === "approve"`,
`confidence >= threshold`, `isFood`, `depictsFoodOrVenue`, `matchesVenue` is
`"yes"` or `"likely"`, not NSFW, not spam/promotional, not a stock photo or
screenshot, and `qualityScore >= 40`. It auto-*rejects* only if
`verdict === "reject"` and `confidence >= threshold`. Everything else —
including any failed or unavailable moderation call — lands as `pending`,
fail-closed.

**Setting it to `1` holds every submission for manual review**, since no
real confidence score can ever be `>= 1`. This is the recommended way to
start: run with `PHOTO_AUTOPUBLISH_CONFIDENCE=1` for the first weeks, watch
`/admin/photos` to see whether the AI's verdicts would have been right, then
lower the threshold once you trust it. Changing it takes effect on the next
request — no restart needed beyond however your process manager reloads env.

## 4. Cost controls

Endpoints that spend money (a billed Gemini or Google Places call per
request):

| Endpoint | Limit | Enforced by |
| --- | --- | --- |
| `POST /api/admin/ai/enrich` | 60 `AiProposal` rows created in the trailing hour, across all restaurants; also refuses a restaurant that already has a pending proposal; batch capped at 10 restaurant IDs per request | `aiProposalsLastHour()` in `lib/ratelimit.ts` — counts DB rows, survives a process restart |
| `POST /api/community/photos` | 5 photos per user per hour, 20 per user per 24h (each submission is a Gemini vision call) | Row counts against `RestaurantPhoto.submittedById`/`createdAt`, DB-backed |
| `POST /api/admin/places/search` | 100 searches per admin per hour | In-process `Map` in `lib/ratelimit.ts`'s `createMapLimiter()` — quota guard, not spend, and resets on restart (see `docs/DEPLOY.md` §7) |
| `POST /api/admin/places/import` | 20 places per request, photo downloads capped at 6 per place | Request schema (`z.array(...).max(20)`) plus `MAX_PHOTOS_PER_PLACE` in `app/api/admin/places/import/route.ts` |

All of the above return `429` with a human-readable message (and, for the
photo endpoint, a `Retry-After` header) rather than a silent empty result.

**The Places field mask is the billing tier — never widen it to a
wildcard.** `lib/places.ts` sends an explicit `X-Goog-FieldMask` on every
call: `SEARCH_FIELD_MASK` (cheap — id, name, address, location, price,
rating, primary type only) for search results, which are thrown away and
never persisted, and a wider `DETAILS_FIELD_MASK` (adds hours, photos,
reviews, contact info) only for the one details call made per place the
admin actually ticks to import. If this ever changes to `X-Goog-FieldMask:
*`, every search result starts being billed at the Details/Enterprise tier
regardless of whether anything was imported. Do not do that.
