---
name: EatFinder
description: A daylight-bright restaurant finder for Prishtina — one blue voice, one warm ember, and nothing that moves without a reason.
colors:
  background: "#f4f6f8"
  surface: "#ffffff"
  surface-hover: "#eef1f5"
  surface-muted: "#f0f3f7"
  border: "#e3e7ed"
  border-strong: "#c7d0dc"
  border-control: "#8793a4"
  text: "#0b1220"
  text-secondary: "#55617a"
  primary: "#0b6bb0"
  primary-hover: "#095a95"
  primary-soft: "#e6f1fa"
  on-primary: "#ffffff"
  accent: "#b83b09"
  accent-hover: "#9c320a"
  accent-soft: "#fdefe7"
  success: "#157347"
  success-hover: "#10603a"
  success-soft: "#e7f4ed"
  error: "#c2261d"
  error-hover: "#9f1d16"
  error-soft: "#fdeceb"
  warning: "#a16207"
  warning-soft: "#fdf5e3"
typography:
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  meta:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.meta}"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    size: "44px"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "36px"
  pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "0 4px 0 10px"
    height: "28px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-neutral:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "44px"
  searchbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "0 8px 0 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  notice:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  alert:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: EatFinder

## Overview

**Creative North Star: "The Daylight Directory"**

EatFinder is a map and a list, side by side, in a room with the lights on. The
product's job is to get a hungry person from "somewhere near here" to a decision
in under a minute, so the interface behaves like good signage rather than like a
magazine: cool paper surfaces, one blue that means "you can act on this", one
warm ember that means "this is the food part", and nothing decorative competing
with either. Density is moderate — cards breathe, but the results pane is a
working list, not a gallery.

Every value in this system is a CSS custom property in `app/globals.css`, mapped
into Tailwind in `tailwind.config.ts`. No component names a literal hex. That is
not tidiness for its own sake: it is what keeps a future dark mode a second
block of variable assignments rather than a rewrite. The same discipline applies
to shape and motion — there is one easing curve, one duration ladder, one focus
halo, and one set of `.ef-*` component classes shared by the public app and the
admin. When the public side and the admin disagreed about what a delete button
or a "pending" badge looked like, the disagreement was resolved by deleting one
of them, not by adding a third.

Contrast was measured, not eyeballed, and the ratios are recorded next to the
tokens. Motion is short, settles rather than coasts, and never animates a
property that triggers layout. Anything that moves is wrapped in
`prefers-reduced-motion: no-preference`, and nothing has a resting state of
`opacity: 0` — if the animation never runs, the content is still there.

**Key Characteristics:**
- Light, slightly cool paper (`#f4f6f8`) with white cards; depth from soft
  shadow plus a hairline border, never from heavy elevation.
- One action blue, one appetite ember, and semantic soft-tint pairs for status.
- Manrope throughout, in exactly three heading steps chosen by semantic level.
- Rounded-but-not-soft geometry: 12px controls, 16px cards, full-round pills.
- Motion ladder of 130 / 220 / 320 / 180ms — feedback, state, panel, exit.
- 44px touch targets on everything a finger is meant to hit.

## Colors

A cool neutral paper stack carrying exactly two chromatic voices — an action
blue and a warm ember — with four semantic tints reserved for status.

### Primary
- **Signal Blue** — every actionable thing: primary buttons, active pills and
  tabs, links, meter fills, selected table rows, the search capsule's focus
  border, and the focus halo it tints. Measured 5.4:1 against white in both
  directions, so white text on it is safe and it is safe as text on white.
- **Signal Blue Deep** — the hover and pressed state of anything filled with
  Signal Blue. Never used as a resting fill.
- **Blue Wash** — the flat tint behind filter chips, informational badges and a
  selected admin row. It is a background only; text on it is always Signal Blue.

### Secondary
- **Ember** — the warm counterweight and the only colour allowed to compete with
  Signal Blue: the match-score figure, the filled favourite heart, the Featured
  badge, the rating number. 5.7:1 on white and 5.1:1 on its own wash. It is
  deliberately a *dark* burnt orange; the earlier brighter orange measured
  3.85:1 behind the match badge and was the only failing token in the file.
- **Ember Wash** — tint behind Ember text in badges and score pills.

### Tertiary
Status tints, used only to report the outcome of something: **Field Green**
(success confirmations, published state), **Signal Red** (errors, destructive
hover), **Harvest Amber** (warnings, pending state). Each ships as a darkened
text colour plus a separate pale wash, because the natural amber and green read
as warning and success but fail contrast as text.

### Neutral
- **Cool Paper** — the page. Every screen sits on it; cards sit on white above it.
- **Card White** — every card, panel, drawer, table header row and top bar.
- **Hover Mist / Muted Mist** — the hover fill for ghost controls and the resting
  track behind meters and progress bars; the muted variant backs table headers
  and image placeholders.
- **Ink** — body and heading text, 18.4:1 on white. Body copy never goes lighter
  than **Slate**, its 6.6:1 secondary, which carries meta lines, hints, table
  headers and eyebrows.
- **Hairline** — decorative rules and card edges only (1.24:1, which WCAG 1.4.11
  does not govern). **Hairline Strong** for scrollbar thumbs.
- **Control Edge** — 3.12:1 on white, and the *only* legal border for a control
  whose outline is the sole thing identifying it: text inputs, textareas,
  selects, checkboxes, radios, the dashed upload zone.

### Named Rules
**The No Literal Hex Rule.** A component may not write a colour value. It names a
token (`bg-primary`, `text-text-secondary`) or it is wrong. The only exceptions
are data-URI SVGs (a `url()` cannot read a custom property) and they carry a
comment saying which token they spell out.

**The Two Voices Rule.** Blue means "act", Ember means "food quality". A screen
never introduces a third chromatic colour to mean a third thing; if something
needs to stand out, it earns size, weight or whitespace instead.

**The Control Edge Rule.** If the boundary is the affordance, the border is
`--border-control`, not `--border`. A text input drawn in `--border` is
white-on-white at 1.2:1.

## Typography

**Body / Display Font:** Manrope (self-hosted via `next/font`, weights 400–800,
`latin` + `latin-ext` so Albanian ë and ç render from the same file), falling
back to `system-ui, sans-serif`.

**Character:** One family doing everything. Manrope's tight, slightly geometric
lowercase reads cleanly at 13px in a dense table and turns confident at
extra-bold in a page title, which is why there is no second family: hierarchy
comes from weight and size, not from a serif guest appearance.

### Hierarchy
- **Title** (800, 26px → 32px at ≥640px, 1.15, −0.02em): the page `<h1>` and
  nothing else — restaurant detail, account, both logins, the admin page header,
  the 404. Ships as `.ef-title`.
- **Heading** (700, 17px, snug, −0.01em): the heading of a card, panel, drawer or
  form section. Ships as `.ef-heading`; admin form `<h2>`s inherit the same
  metrics by element selector.
- **Body** (400, 16px, 1.55): set on `<body>`, inherited everywhere. Long-form
  prose steps to 15px with relaxed leading and caps at 68ch.
- **Meta** (600, 13–14px, 1.5): card meta lines, table cells, buttons, form
  labels, hints. The working size of the product.
- **Label** (700, 11px, uppercase, 0.08em): eyebrows, table column headers and
  every micro-label. Ships as `.ef-label`; the responsive card view of the admin
  table reproduces the exact same metrics so a column header does not change
  register with the viewport.

### Named Rules
**The Three Steps Rule.** Every heading in the app is Title, Heading or Label,
and the step is chosen by semantic level — never by how important the page felt
the day it was written. Six pages once shipped the same `<h1>` at 22, 24, 26,
28, 30 and 34px.

**The 17px Tracking Floor.** Negative letter-spacing only from 17px up. Below
that it closes Manrope's already tight letterfit.

**The Tabular Numbers Rule.** Any number that updates in place — favourite
counts, score meters, result totals — uses `tabular-nums` so it does not jitter.

### Copy & localization
User-facing strings never appear inline in a component. They live in
`lib/dictionaries/sq.ts` (Albanian, the source of truth) and `lib/dictionaries/en.ts`,
which is typed `Record<keyof typeof sq, string>` so a missing or stray key is a
compile error. Keys are flat and dot-namespaced by surface
(`search.placeholder`, `results.empty.title`, `nav.favorites`); interpolation
uses named braces (`{n}`, `{label}`) and singular forms get their own key
(`results.headingOne`) rather than a naive plural. English copy is UK-spelled
("Favourites", "neighbourhoods"). Design new copy as a key pair, not as a string.

## Layout

**The frame.** The public app is a full-height column: a sticky top bar
(`h-[72px]`-class density, white on a hairline) over a `flex min-h-0 flex-1`
main. Inside main, the results pane and the map split; the results pane is
`md:w-[40%]` with a left hairline and the map takes the rest. Below `md` the map
is hidden and a centred, full-height (44px) pill toggles between the two — the
one place a pill is a primary mobile action.

**The admin** is a fixed 240px left rail (`lg:` and up only) with a
`lg:ml-60` workspace, a 72px topbar, and content centred at `max-w-[1480px]`
with padding stepping 16 → 32 → 40px across `sm` and `xl`. Below `lg` the rail
becomes a left-anchored `<dialog>` sheet of the same width and padding, so it is
one navigation in two places rather than two navigations.

**Grids.** The results grid is driven by *container* queries, not viewport
queries, because the pane is narrower than the window: 1 column, 2 at 390px of
pane width, 3 at 740px, 16px gutters. Admin forms are one column, two at `xl`,
with `.admin-form-wide` for full-bleed sections. The admin stat row is three
columns at every size and drops its icons below `sm`.

**Tables become cards.** Under 768px `.admin-table` switches to a two-column
grid per row with the `<thead>` visually hidden and each cell's label re-emitted
from `data-label`. Identity, actions and profile cells span the full width. No
horizontal scroll trap.

**Rhythm.** Tailwind's 4px scale. In practice: 8px inside a control, 12–16px
between siblings, 20–24px inside a panel, 28–32px between sections, 32px below a
page header. Long-form text caps at 68ch, descriptions at `max-w-xl`.

**Stacking.** One z-index scale in the Tailwind config — `overlay: 10`,
`sticky: 20`, `drawer: 30`, `modal: 50`. Nothing writes a raw z-index.

### Named Rules
**The No-Reflow Rule.** Anything that toggles reserves its space. The admin
table's top bar has a `min-h-[68px]` floor so ticking one checkbox cannot swap a
20px heading for a 44px button row and shove the table down the page. A
refetching list dims in place (`.admin-refreshing`) rather than being replaced by
a spinner that collapses the page height.

## Elevation & Depth

Nearly flat, and layered by tone first. A surface is separated from the page by
being white on cool paper *and* by a hairline border; the shadow is a whisper on
top of that, not the mechanism. Only three shadows exist, and the largest is
reserved for things in the top layer.

### Shadow Vocabulary
- **Resting** (`--shadow-sm`): cards, panels, pills, the search capsule, primary
  buttons, the range thumb. Effectively a soft contact edge.
- **Lifted** (`--shadow-md`): the hover/focus-within state of a card, the fixed
  admin form action bar, Mapbox control clusters.
- **Floating** (`--shadow-lg`): the mobile navigation sheet and the mobile map
  toggle — elements genuinely detached from the page.

The drawer backdrop is its own layer: `rgb(11 18 32 / 0.35)` plus a 3px blur,
transitioned independently of the dialog because a `::backdrop` does not inherit
the dialog's transition.

### Named Rules
**The Lift Is Transform Rule.** A hovered card rises with `translate: 0 -2px` and
a shadow swap — never a margin, border-width or size change. The grid around it
must not re-lay-out. The same rule makes buttons and pills press with `scale`,
and pills specifically use the independent `scale` property rather than
`transform` so it composes with an existing `-translate-x-1/2` centring instead
of destroying it.

## Shapes

Rounded, and consistently so, on a four-step radius ladder: **6px** for the
smallest custom controls (checkbox), **8px** for inline chrome (file-input
button, jump links), **12px** for every control that holds text or an icon
(buttons, inputs, icon buttons, nav rows, notices, alerts, the upload zone), and
**16px** for every surface (cards, panels, stat tiles, empty states, the fixed
form action bar). Anything that is a *token of state* rather than a container is
fully round: pills, chips, badges, meters, progress bars, the favourite button,
radios, scrollbar thumbs, Mapbox control groups.

Borders are 1px hairlines on surfaces and 1.5px on custom checkboxes and radios.
The single dashed border in the system is the upload drop zone, where dashed
means "put something here". Images are clipped by their container
(`overflow-hidden` on the card) at 3:2 in the grid, 16:9 in a map popup, and a
fixed 112–128px column in list mode; the card's own image scales to 1.03 on
hover inside that clip, so the silhouette never changes.

## Components

The shared vocabulary lives in `app/globals.css` under `@layer components` as
`.ef-*` classes and is used by **both** the public app and the admin. The
`.admin-*` classes in `app/admin/admin.css` are layout and shell only — rail,
topbar, tabs, table, form scaffolding — plus a few `.admin-shell .ef-*`
overrides that raise metrics for a desk product. Build new UI from `.ef-*`.

### Buttons — `.ef-btn`
- **Shape:** 12px radius, transparent 1px border so variants can colour it.
- **Metrics:** 16px horizontal / 8px vertical padding, 14px semibold, 8px gap to
  its icon; `min-h-11` (44px) inside the admin shell.
- **Primary** (`.ef-btn--primary`): Signal Blue fill, white label, resting
  shadow, Signal Blue Deep on hover.
- **Ghost** (`.ef-btn--ghost`): white fill, hairline border, ink label, Hover
  Mist on hover. The default for anything that is not the one main action.
- **Quiet** (`.ef-btn--quiet`): the "clear all" affordance — pill-shaped, 12px
  bold, secondary ink, no border. It exists because it sits *inside* controls
  that already draw a border (the search capsule, the filter drawer header) and
  a second outlined box read as a second field.
- **States:** 130ms colour transition; `scale: 0.97` on press; disabled is 50%
  opacity plus `not-allowed`. Focus is the global halo — never a bespoke ring.

### Icon buttons — `.ef-icon-btn`
44 × 44px, 12px radius, hairline border, secondary ink going to full ink on
hover. `--quiet` drops the border and background for one sitting inside a header
that already draws its own edge; `--danger` tints Signal Red on hover. Presses at
`scale: 0.94`. Every icon-only control in the app is this class — there is no
36px variant.

### Pills — `.ef-pill`
The search UI's currency: filter openers, sort, the language switch, the
favourites counter, the map's "search this area". 36px tall, fully round,
hairline border, white fill, 13px semibold, resting shadow. `--active` fills
Signal Blue. Pills live in horizontal rails that fade at the right edge
(`.ef-scroll-fade`) rather than showing a clipped chip.

### Chips — `.ef-chip`
An applied filter. 28px tall, fully round, Blue Wash fill, Signal Blue 12px
semibold label, with a 24px `.ef-chip-remove` × that inverts to a filled blue
circle on hover. Chips animate in with `.ef-chip-enter` (scale from 0.9) so a new
one reads as "just added" rather than "the row reflowed".

### Badges — `.ef-badge`
Status, never action. Fully round, 11px bold, soft-tint background with the
matching solid text colour, in five tones: `--success`, `--warning`, `--error`,
`--info`, `--neutral`. A pending photo must look identical in the admin queue and
on the guest's account page.

### Cards — `.ef-card`
White, 16px radius, hairline border, resting shadow. Rises 2px into the lifted
shadow on `:hover` **and** `:focus-within` — the card's title is the link, so a
keyboard user gets the same "this one" cue a mouse does. Press settles it back
down faster than it rose. An active card (hovered from its map pin) gets
`ring-2 ring-primary`.

### Panels — `.ef-panel`
The static twin of the card: same white, radius, border and shadow, with 24px of
built-in padding and no hover behaviour. Admin form panels step it to 20 → 28px.

### Inputs — `.ef-input`
White fill, 12px radius, **Control Edge** border, 14px text, secondary-ink
placeholder, `min-h-11` in the admin. Focus is deliberately `:focus`, not
`:focus-visible` — a field you clicked into should say so — and shows a Signal
Blue border plus the halo, with no offset ring. Labels are `.ef-field-label`
(13px semibold, 8px below). File pickers are `.ef-file-input`; textareas resize
vertically only. Checkboxes, radios and select chevrons are drawn by this system,
not by the OS, and hand themselves back to the UA under forced colours.

### Search capsule — `.ef-searchbar`
The signature control. A 44px fully-round white capsule holding the icon, the
input, the applied-filter chip rail and a quiet clear button. It lights up on
`:focus-within`, not `:focus`, because the whole capsule is one control as far as
the eye is concerned.

### Drawer — `.ef-drawer`
A native `<dialog>` in the top layer laid out as an edge sheet — right by
default, `--left` for the admin navigation. It slides on `translate` with
`transition-behavior: allow-discrete` and `@starting-style`, so there is no
`isClosing` state flag and no JS animation; browsers lacking either simply snap.
Entrance is 320ms on the deep-deceleration curve, exit 180ms.

### Meters and progress — `.ef-meter`, `.ef-progress`
`.ef-meter` is determinate: a fully-round Hover Mist track with a Signal Blue
fill that animates via `transform: scaleX()` from a left origin (never `width` —
that thrashes layout). Height is the caller's, everything else is not. Use the
`ScoreMeter` React wrapper in the admin. `.ef-progress` is indeterminate — a
sliding 40% bar — used where no real percentage exists (uploads report none),
because a fake percentage that jumps to 100 is worse than no percentage.

### Status messages — `.ef-notice`, `.ef-alert`
`.ef-notice` is the green confirmation: solid border on its own wash, 14px
semibold, centred icon, one line. `.ef-alert` is the red twin with
`items-start` and relaxed leading because errors regularly run to two lines. Both
enter with `.ef-enter`. Success notices auto-dismiss after 6 seconds via
`useNotice()`; **errors never auto-dismiss** — a message you have to catch inside
six seconds is not an error report. The `<Notice>` live region stays mounted even
when empty so screen readers announce it reliably.

### Admin page furniture — `AdminUI.tsx`
Four React primitives sit above the CSS and should be reused rather than
re-composed: `<PageHeader eyebrow title description actions>` (label / title /
secondary description, actions right-aligned, wrapping to a column below `xl`),
`<EmptyState icon title description>` (a 56px bordered icon tile over a heading
and one sentence, with room for one action), `<LoadingState label>` (the same
288px-min box with a spinner, `role="status"`), and `<ScoreMeter value>`.

### Navigation
The admin rail: 13px semibold rows at 12px inset, 12px radius, 44px minimum
height, tinted on active, colour-transitioned at 220ms. Tabs (`.admin-tab`) are a
48px-tall underline row over a hairline, secondary ink going to Signal Blue with
a 2px blue underline when `aria-pressed="true"`. The public top bar carries the
wordmark tile, then pills pushed right; below `sm` the labels drop and the icons
stay. Both shells start with a skip link that is `sr-only` until focused.

## Do's and Don'ts

### Do:
- **Do** reach for an existing `.ef-*` class first — `.ef-btn`, `.ef-icon-btn`,
  `.ef-pill`, `.ef-chip`, `.ef-badge`, `.ef-card`, `.ef-panel`, `.ef-input`,
  `.ef-notice`/`.ef-alert`, `.ef-meter`, `.ef-drawer`, `.ef-title`/`.ef-heading`/
  `.ef-label`. If one nearly fits, add a modifier to it in `globals.css`.
- **Do** use the motion ladder: `--dur-fast` (130ms) for press/hover feedback,
  `--dur` (220ms) for a state change, `--dur-panel` (320ms) for a panel that
  travels, `--dur-exit` (180ms) for every dismissal. An exit is always faster
  than its entrance.
- **Do** animate `transform`, `translate`, `scale`, `opacity` and colour only.
- **Do** wrap every animation in `@media (prefers-reduced-motion: no-preference)`
  and make sure the resting state is the *visible* one.
- **Do** give anything a finger touches 44px (`h-11`/`min-h-11`).
- **Do** let the one global focus halo do its job; controls that draw their own
  (`--ring` plus a Signal Blue border) opt out of the offset ring.
- **Do** put every user-facing string in both dictionaries as a dot-namespaced key.
- **Do** state a measured contrast ratio in a comment when adding a colour token.

### Don't:
- **Don't** write a literal colour, shadow, easing or duration value in a
  component. Name the token.
- **Don't** introduce a second button, badge, empty state or icon-button
  implementation. Two definitions of the same thing is exactly what this system
  was consolidated to remove.
- **Don't** animate `width`, `height`, `top`/`left`, margin or padding — use
  `scaleX`, `translate` or a shadow swap.
- **Don't** add a Tailwind `ring-*` to a control that already has the halo; that
  is where the doubled, detached outline came from.
- **Don't** border a control with `--border` when the border is the only thing
  identifying it. Use `--border-control`.
- **Don't** invent a fourth heading size. Pick the semantic level, then the step.
- **Don't** let a toggle, refetch or selection change an element's height —
  reserve the space.
- **Don't** auto-dismiss an error, and don't fake a determinate progress bar.
- **Don't** hand a form control back to the OS with `accent-color`; the drawn
  checkbox/radio/select chrome is the product on every platform.
- **Don't** write a raw `z-index`; use the `overlay`/`sticky`/`drawer`/`modal`
  scale.
