'use client'

import { useEffect, useRef } from 'react'
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
  label,
  min,
  max,
  value,
  onChange,
}: {
  locale: Locale
  label: string
  min: string
  max: string
  value: number
  onChange: (v: number) => void
}) {
  const id = `mood-${label}`
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
}: {
  locale: Locale
  open: boolean
  filters: ParsedFilters
  facets: Facets
  onPatch: (patch: Patch) => void
  onClearAll: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  // A native <dialog> opened with showModal() brings the focus trap, Escape to
  // close, ::backdrop, inert background and focus restoration with it. Every
  // one of those was hand-rolled work on the previous div-with-role="dialog",
  // and three of the four were simply missing.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const priceOptions = [1, 2, 3, 4]

  return (
    <dialog
      ref={ref}
      aria-label={t(locale, 'filters.title')}
      onClose={onClose}
      // Escape fires `close`; a click on the backdrop lands on the dialog
      // element itself rather than any child, which is the standard test for
      // "outside the panel".
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="ef-drawer"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-extrabold tracking-tight text-text">
            {t(locale, 'filters.title')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-full px-3 py-1.5 text-[12px] font-bold text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text"
            >
              {t(locale, 'filters.clear')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t(locale, 'filters.close')}
              className="grid h-9 w-9 place-items-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
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
            <div className="flex items-center gap-3">
              <select
                aria-label={`${t(locale, 'filters.price')} — min`}
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  onPatch({ minPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-[14px] font-semibold text-text"
              >
                <option value="">{t(locale, 'filters.anyPrice')}</option>
                {priceOptions.map((p) => (
                  <option key={p} value={p}>
                    {priceGlyphs(p)}
                  </option>
                ))}
              </select>
              <span aria-hidden className="text-text-secondary">
                –
              </span>
              <select
                aria-label={`${t(locale, 'filters.price')} — max`}
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  onPatch({ maxPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-[14px] font-semibold text-text"
              >
                <option value="">{t(locale, 'filters.anyPrice')}</option>
                {priceOptions.map((p) => (
                  <option key={p} value={p}>
                    {priceGlyphs(p)}
                  </option>
                ))}
              </select>
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
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-[14px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={!!filters.openNow}
                  onChange={(e) => onPatch({ openNow: e.target.checked || undefined })}
                  className="h-5 w-5 accent-[color:var(--primary)]"
                />
                {t(locale, 'filters.openNow')}
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-[14px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={!!filters.woltOnly}
                  onChange={(e) => onPatch({ woltOnly: e.target.checked || undefined })}
                  className="h-5 w-5 accent-[color:var(--primary)]"
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

          <Section title={t(locale, 'filters.mood')}>
            <Mood
              locale={locale}
              label={t(locale, 'filters.heavy')}
              min={t(locale, 'mood.heavy.min')}
              max={t(locale, 'mood.heavy.max')}
              value={filters.heavy}
              onChange={(v) => onPatch({ heavy: v })}
            />
            <Mood
              locale={locale}
              label={t(locale, 'filters.hungry')}
              min={t(locale, 'mood.hungry.min')}
              max={t(locale, 'mood.hungry.max')}
              value={filters.hungry}
              onChange={(v) => onPatch({ hungry: v })}
            />
            <Mood
              locale={locale}
              label={t(locale, 'filters.fine')}
              min={t(locale, 'mood.fine.min')}
              max={t(locale, 'mood.fine.max')}
              value={filters.fine}
              onChange={(v) => onPatch({ fine: v })}
            />
          </Section>
        </div>
      </aside>
    </dialog>
  )
}
