# Production readiness review — 23 September 2026

## Scope and evidence

Reviewed the public search, map, restaurant detail and account screens; the
authenticated staging dashboard, catalogue, form, Places discovery, AI proposal
history, photo moderation and CSV tools; and the related API, authentication,
storage and deployment code. The staging site was
`https://hajdehajme.bleart.dev`. It contains six published restaurants, live
Mapbox and Google Places access, approved Gemini proposals and Google photos.
The staging catalogue was not edited for this review.

Local write tests used an isolated copy of the SQLite database. A draft
restaurant created there remained absent from the public recommendation API.
The production build was started against that copy and checked through HTTP.

## Issues fixed locally

| Area | Finding | Change |
| --- | --- | --- |
| Admin access | Staging `/admin` redirected signed-out visitors to `https://localhost:3009/admin/login` behind the reverse proxy. | Build the login redirect from the public forwarded host and protocol. Verified a 307 redirect to the staging domain in a production-mode server. |
| Publishing | Manual restaurant creation published immediately. | New rows default to draft; the form offers an explicit publish checkbox. The public API excludes the draft. |
| Admin catalogue | Sort controls for heaviness, portion size and fine dining did not match the API's allowed fields. | Added the fields to the server allowlist and verified sorting through the API. |
| AI review | Approved proposals still showed editable controls and decision buttons; the bulk approval action could apply unreviewed proposals. | Approved/rejected entries now show read-only history and applied fields; removed bulk approval. |
| Photos | Approved Google photos were labelled as unknown submissions awaiting review. | Show source and review status accurately. |
| Public mobile | Account access disappeared from the narrow header; at 320 px the search input was squeezed. | Added a mobile account link and wrapped search controls on very narrow screens. |
| Missing map key | An empty map panel consumed much of the public page. | Show full-width results and cuisine shortcuts when no map token is configured. |
| Import and validation | CSV accepted malformed or out-of-range values; imported rows could publish unintentionally; URL fields could accept unsafe schemes; string `"false"` could become boolean true. | Strict CSV parsing, size/row limits, draft default, HTTP(S) URL validation and real boolean validation. |
| Account navigation | A crafted `next` URL could redirect a newly signed-in user off site. | Constrain post-login/register navigation to local paths. |
| Uploads | Image magic bytes alone allowed a truncated image to be stored. | Decode before saving and reject unreadable image data. |
| Browser protections | No baseline response headers. | Added MIME sniffing, frame, referrer and permissions headers. |
| Admin bootstrap | Re-running admin creation did not correct an existing account's role. | The upsert now sets `role: 'admin'` on updates. |

## Verification

- Local `npm run lint`, `npx tsc --noEmit`, `npm run build` and 95 tests across
  20 suites passed.
- Production-mode HTTP smoke checks passed for public search, the admin
  authentication boundary, proxy-aware redirect, server-side sort, invalid
  boolean rejection, draft invisibility and security headers.
- Browser checks covered desktop staging public/admin screens, Google Places
  search of an already imported venue, and local public layouts at 390 px and
  320 px. The latter had no horizontal page overflow.
- Live staging already has working map tiles, restaurant photos, approved AI
  proposals and imported Places records. This verifies previously completed
  integration flows; it does not prove that a new external API call will
  succeed today.

## Before public launch

1. Deploy these changes to staging and repeat the signed-out admin redirect,
   draft creation/public visibility, AI history, photo attribution and mobile
   checks on the deployed build. The currently running staging site still has
   its old redirect behavior until it receives the fix.
2. Run one controlled new Places import, Gemini enrichment and community photo
   submission against disposable staging records. Confirm the review decisions,
   stored photos and cleanup. These writes were intentionally excluded from
   the existing live catalogue during this pass.
3. Set a production domain and `PROD_DOMAIN` in `deploy/config.sh`, provision
   the production vhost and environment, restrict external API keys, then
   verify backups and restore for the external SQLite/upload data directories.
   The repository currently has only a staging domain configured.
4. Run an accessibility pass with keyboard and screen reader on the deployed
   site. Automated lint and responsive checks do not establish accessibility
   quality. Test a content security policy with Next.js, Mapbox and photo URLs
   before enforcing it.

## Operating constraints

The app is designed for one Node process with SQLite. Login, Places search and
public request limits are in memory, so adding PM2 workers would change their
effective limits. The deployment scripts keep database and uploads outside the
checkout; retain those directories in backup and recovery procedures.
