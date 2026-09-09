# Visual experience review

This pass updates presentation only. API routes, authentication, scoring, database schema, integrations, and deployment configuration are unchanged. Deployment uses the existing dev-branch webhook.

## Changes

- Admin shell: desktop sidebar, mobile navigation rail, page context, account controls, keyboard skip link, consistent page headers and spacing.
- Restaurant catalogue: summary cards, search and status controls, thumbnails, grouped profile scores, status badges, accessible row actions, and a mobile card layout that retains table semantics.
- New/edit restaurant: section links, grouped fields, consistent form controls, resizable text areas, gallery controls, and a persistent save/cancel bar.
- Discover: clearer search modes, selected states, candidate cards, page guidance, and initial empty state.
- AI queue: status tabs, loading and empty states, profile score panels, confidence information, and selectable vocabulary buttons.
- Photo moderation: responsive image cards, clearer review metadata, consistent moderation actions, and loading/empty states.
- Import/export: paired tools, a clearer file picker, quieter sample-data action, and structured format guidance.
- Admin sign-in: branded desktop layout and a focused mobile form.
- Public site: results columns adapt to pane width; list cards and account layouts fit smaller screens; consistent sign-in/register forms; empty contact panels are omitted from restaurant details.

## Verification

Browser review used an isolated copy of the database. Temporary AI proposals and photo fixtures were added only to that copy; no live catalogue was edited.

Reviewed the catalogue, new/edit form, discovery, import/export, AI review queue, photo moderation, admin login, public grid/list discovery, mobile filters, restaurant detail, account, and public login/register pages. Desktop review used the default browser viewport; responsive checks used 390px and 320px where relevant. The compiled production dashboard, catalogue inline edit/cancel state, filtered empty state, and sign-in screens were also inspected.

- `npm run lint`: passed.
- `npm test -- --runInBand`: all 10 suites / 56 tests passed. The temporary preview copy caused a package-name warning; tests still completed successfully.
- `npx next build`: passed, including TypeScript checks and all route generation.
- `git diff --check`: passed.

The initial `npm run build` attempt stopped during Prisma generation because Windows locked the existing query-engine DLL while a local server was using it. The existing generated client was then used for the successful Next.js production build. No Prisma/schema changes were needed.

## Verification limits

Mapbox, Google Places, and Gemini keys are absent locally. The map fallback, discovery unavailable state, and fixture-backed AI/photo review layouts were inspected; live maps, Google search results, and AI calls were not verified. This was a visual pass, not a functional or security audit. Existing native confirmation/error dialogs and backend behavior remain unchanged.

Automatic approval review blocked deletion of temporary preview folders. Those generated files remain outside version control and are not part of the deployment changes.
