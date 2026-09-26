'use client'

import { useDrawer } from '../useDrawer'
import { useSheetDrag } from '../useSheetDrag'
import { X } from 'lucide-react'
import { priceGlyphs, t, tVocab, type Locale } from '@/lib/i18n'
import type { ParsedFilters } from '@/lib/filters'
import type { Facets } from './types'
import type { Patch } from './SearchBar'

/** Facet keys ordered by count, keeping anything already selected visible. */
function options(counts: Record<string, number>, selected: string[]): string[] {
  const keys = new Set([...Object.keys(counts), ...selected])
  return [...keys].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b))
}

function toggle(list: string[] | undefined, v: string): string[] | undefined {
  const cur = list ?? []
  const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
  return next.length ? next : undefined
}

/**
 * Price as four toggles over one contiguous range, because the API filters on
 * min/max. The two <select>s this replaces could be set to "$$$ – $", which
 * matched nothing and said nothing about why.
 */
function priceTap(min: number | undefined, max: number | undefined, p: number) {
  const lo = min ?? (max !== undefined ? 1 : undefined)
  const hi = max ?? (min !== undefined ? 4 : undefined)
  let next: [number, number] | null
  if (lo === undefined || hi === undefined) next = [p, p]
  else if (p === lo && p === hi) next = null
  else if (p < lo) next = [p, hi]
  else if (p > hi) next = [lo, p]
  else next = [p, p] // inside a wider range: narrow to the one tapped
  if (!next || (next[0] === 1 && next[1] === 4)) return { minPrice: undefined, maxPrice: undefined }
  return {
    minPrice: next[0] === 1 ? undefined : next[0],
    maxPrice: next[1] === 4 ? undefined : next[1],
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-5 last:border-0">
      <h3 className="ef-label mb-3">{title}</h3>
      {children}
    </section>
  )
}

function Mood({
  locale,
  name,
  label,
  min,
  max,
  value,
  onChange,
}: {
  locale: Locale
  /** Stable axis key: the label is translated and contains spaces. */
  name: string
  label: string
  min: string
  max: string
  value: number
  onChange: (v: number) => void
}) {
  const id = `mood-${name}`
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-bold text-text">
          {label}
        </label>
        <span className="text-[13px] font-bold tabular-nums text-primary">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-text-secondary">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default function FilterPanel({
  locale,
  open,
  filters,
  facets,
  onPatch,
  onClearAll,
  onClose,
  total,
  loading,
}: {
  locale: Locale
  open: boolean
  filters: ParsedFilters
  facets: Facets
  total: number
  loading: boolean
  onPatch: (patch: Patch) => void
  onClearAll: () => void
  onClose: () => void
}) {
  // A native <dialog> opened with showModal() brings the focus trap, Escape to
  // close, ::backdrop, inert background and focus restoration with it. Every
  // one of those was hand-rolled work on the previous div-with-role="dialog",
  // and three of the four were simply missing. useDrawer adds the slide.
  const drawer = useDrawer(open, onClose)
  const drag = useSheetDrag(onClose)

  const priceOptions = [1, 2, 3, 4]
  const priceLo = filters.minPrice ?? (filters.maxPrice !== undefined ? 1 : undefined)
  const priceHi = filters.maxPrice ?? (filters.minPrice !== undefined ? 4 : undefined)

  return (
    <dialog
      {...drawer}
      aria-label={t(locale, 'filters.title')}
      onClose={onClose}
      className="ef-drawer ef-drawer--sheet"
    >
      <aside
        // No shadow: the scrim already separates the panel from the page, and a
        // large blurred shadow on the element that is travelling is a full
        // repaint on every frame of the slide.
        // Below md it is a bottom sheet: content height, capped short of the
        // top so the results it is filtering still show behind it.
        className="flex h-full w-full max-w-md flex-col bg-surface max-md:h-auto max-md:max-h-[calc(100dvh-2.5rem)] max-md:max-w-none max-md:rounded-t-3xl"
      >
        <header
          {...drag}
          className="relative flex items-center justify-between border-b border-border px-5 py-4 max-md:touch-none max-md:pt-6"
        >
          <span aria-hidden className="ef-grabber absolute inset-x-0 top-2 md:hidden" />
          <h2 className="ef-heading">
            {t(locale, 'filters.title')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t(locale, 'filters.close')}
              className="ef-icon-btn ef-icon-btn--quiet"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Mood first. It is the reason the product exists — you say how you
              feel and it matches — so it opens the panel rather than sitting
              under five conventional facets where nobody scrolled to it. */}
          <Section title={t(locale, 'filters.mood')}>
            <Mood
              locale={locale}
              name="heavy"
              label={t(locale, 'filters.heavy')}
              min={t(locale, 'mood.heavy.min')}
              max={t(locale, 'mood.heavy.max')}
              value={filters.heavy}
              onChange={(v) => onPatch({ heavy: v })}
            />
            <Mood
              locale={locale}
              name="hungry"
              label={t(locale, 'filters.hungry')}
              min={t(locale, 'mood.hungry.min')}
              max={t(locale, 'mood.hungry.max')}
              value={filters.hungry}
              onChange={(v) => onPatch({ hungry: v })}
            />
            <Mood
              locale={locale}
              name="fine"
              label={t(locale, 'filters.fine')}
              min={t(locale, 'mood.fine.min')}
              max={t(locale, 'mood.fine.max')}
              value={filters.fine}
              onChange={(v) => onPatch({ fine: v })}
            />
          </Section>

          <Section title={t(locale, 'filters.cuisine')}>
            <div className="flex flex-wrap gap-2">
              {options(facets.cuisines, filters.cuisines ?? []).map((c) => {
                const on = (filters.cuisines ?? []).includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPatch({ cuisines: toggle(filters.cuisines, c) })}
                    className={`ef-pill ${on ? 'ef-pill--active' : ''}`}
                  >
                    {tVocab(locale, 'cuisine', c)}
                    <span className={on ? 'opacity-80' : 'text-text-secondary'}>
                      {facets.cuisines[c] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t(locale, 'filters.tags')}>
            <div className="flex flex-wrap gap-2">
              {options(facets.tags, filters.tags ?? []).map((tag) => {
                const on = (filters.tags ?? []).includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPatch({ tags: toggle(filters.tags, tag) })}
                    className={`ef-pill ${on ? 'ef-pill--active' : ''}`}
                  >
                    {tVocab(locale, 'tag', tag)}
                    <span className={on ? 'opacity-80' : 'text-text-secondary'}>
                      {facets.tags[tag] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t(locale, 'filters.price')}>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={t(locale, 'filters.price')}>
              {priceOptions.map((p) => {
                const on = priceLo !== undefined && priceHi !== undefined && p >= priceLo && p <= priceHi
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    aria-label={t(locale, 'card.priceLevel', { n: p })}
                    onClick={() => onPatch(priceTap(filters.minPrice, filters.maxPrice, p))}
                    className={`ef-pill ef-pill--lg justify-center tracking-wider ${on ? 'ef-pill--active' : ''}`}
                  >
                    {priceGlyphs(p)}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t(locale, 'filters.neighborhood')}>
            <div className="flex flex-wrap gap-2">
              {options(facets.neighborhoods, filters.neighborhoods ?? []).map((n) => {
                const on = (filters.neighborhoods ?? []).includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPatch({ neighborhoods: toggle(filters.neighborhoods, n) })}
                    className={`ef-pill ${on ? 'ef-pill--active' : ''}`}
                  >
                    {n}
                    <span className={on ? 'opacity-80' : 'text-text-secondary'}>
                      {facets.neighborhoods[n] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t(locale, 'filters.more')}>
            <div className="flex flex-col">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={!!filters.openNow}
                  onChange={(e) => onPatch({ openNow: e.target.checked || undefined })}
                />
                {t(locale, 'filters.openNow')}
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={!!filters.woltOnly}
                  onChange={(e) => onPatch({ woltOnly: e.target.checked || undefined })}
                />
                {t(locale, 'filters.woltOnly')}
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="f-spice" className="text-[13px] font-bold text-text">
                  {t(locale, 'filters.spice')}
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">
                  {filters.spiceMax ?? 100}
                </span>
              </div>
              <input
                id="f-spice"
                type="range"
                min={0}
                max={100}
                value={filters.spiceMax ?? 100}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onPatch({ spiceMax: v >= 100 ? undefined : v })
                }}
              />
            </div>

            {/* Radius is meaningless without an origin; lib/scoring only applies
                maxDistanceKm alongside `near`, which the geolocate control sets. */}
            <div className="mt-5" aria-disabled={!filters.near}>
              <div className="mb-2 flex items-baseline justify-between">
                <label
                  htmlFor="f-radius"
                  className={`text-[13px] font-bold ${filters.near ? 'text-text' : 'text-text-secondary'}`}
                >
                  {t(locale, 'filters.radius')}
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">
                  {t(locale, 'filters.radiusValue', { n: filters.maxDistanceKm ?? 20 })}
                </span>
              </div>
              <input
                id="f-radius"
                type="range"
                min={1}
                max={20}
                disabled={!filters.near}
                value={filters.maxDistanceKm ?? 20}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onPatch({ maxDistanceKm: v >= 20 ? undefined : v })
                }}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </Section>
        </div>

        {/* The answer to "what will this give me", live, on the button that
            takes you there — the count updates as you move a slider. */}
        <footer className="flex items-center gap-3 border-t border-border px-5 pb-[calc(0.75rem+var(--safe-b))] pt-3">
          <button type="button" onClick={onClearAll} className="ef-btn ef-btn--ghost">
            {t(locale, 'filters.clear')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-busy={loading}
            className="ef-btn ef-btn--primary flex-1 tabular-nums"
          >
            {total === 0
              ? t(locale, 'filters.showNone')
              : total === 1
                ? t(locale, 'filters.showOne')
                : t(locale, 'filters.show', { n: total })}
          </button>
        </footer>
      </aside>
    </dialog>
  )
}
