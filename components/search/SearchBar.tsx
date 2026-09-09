'use client'

import { useRef } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { priceGlyphs, t, tVocab, type Locale } from '@/lib/i18n'
import type { ParsedFilters } from '@/lib/filters'

export type Patch = Partial<ParsedFilters>

/** One removable filter value. `patch` is what removing it applies. */
interface Chip {
  key: string
  label: string
  patch: Patch
}

const without = (list: string[] | undefined, v: string) => {
  const next = (list ?? []).filter((x) => x !== v)
  return next.length ? next : undefined
}

/**
 * Every active filter value as its own chip, so an x removes exactly one thing.
 * Mood axes only appear once moved off the neutral 50 — otherwise every visit
 * would open with three chips nobody set.
 */
export function activeChips(f: ParsedFilters, locale: Locale): Chip[] {
  const chips: Chip[] = []

  for (const v of f.cuisines ?? [])
    chips.push({ key: `cuisine:${v}`, label: tVocab(locale, 'cuisine', v), patch: { cuisines: without(f.cuisines, v) } })
  for (const v of f.tags ?? [])
    chips.push({ key: `tag:${v}`, label: tVocab(locale, 'tag', v), patch: { tags: without(f.tags, v) } })
  for (const v of f.neighborhoods ?? [])
    chips.push({ key: `hood:${v}`, label: v, patch: { neighborhoods: without(f.neighborhoods, v) } })

  if (f.minPrice !== undefined)
    chips.push({ key: 'minPrice', label: `${priceGlyphs(f.minPrice)}+`, patch: { minPrice: undefined } })
  if (f.maxPrice !== undefined)
    chips.push({ key: 'maxPrice', label: `≤ ${priceGlyphs(f.maxPrice)}`, patch: { maxPrice: undefined } })
  if (f.openNow)
    chips.push({ key: 'openNow', label: t(locale, 'filters.openNow'), patch: { openNow: undefined } })
  if (f.woltOnly)
    chips.push({ key: 'woltOnly', label: t(locale, 'filters.woltOnly'), patch: { woltOnly: undefined } })
  if (f.spiceMax !== undefined)
    chips.push({ key: 'spiceMax', label: `${t(locale, 'filters.spice')} ${f.spiceMax}`, patch: { spiceMax: undefined } })
  if (f.maxDistanceKm !== undefined)
    chips.push({
      key: 'radius',
      label: t(locale, 'filters.radiusValue', { n: f.maxDistanceKm }),
      patch: { maxDistanceKm: undefined },
    })

  const axes = [
    ['heavy', f.heavy] as const,
    ['hungry', f.hungry] as const,
    ['fine', f.fine] as const,
  ]
  for (const [name, value] of axes) {
    if (value === 50) continue
    chips.push({
      key: `mood:${name}`,
      label: `${t(locale, `filters.${name}`)} ${value}`,
      patch: { [name]: 50 } as Patch,
    })
  }

  return chips
}

export default function SearchBar({
  locale,
  filters,
  query,
  onQuery,
  onPatch,
  onClearAll,
  onOpenFilters,
  filterCount,
}: {
  locale: Locale
  filters: ParsedFilters
  query: string
  onQuery: (v: string) => void
  onPatch: (patch: Patch) => void
  onClearAll: () => void
  onOpenFilters: () => void
  filterCount: number
}) {
  const chips = activeChips(filters, locale)
  const inputRef = useRef<HTMLInputElement>(null)

  // Removing a chip unmounts the button that had focus, which drops focus to
  // <body> and loses the keyboard user's place. Hand it to the search input.
  const remove = (patch: Patch) => {
    onPatch(patch)
    inputRef.current?.focus()
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="ef-searchbar">
        <Search size={17} aria-hidden className="shrink-0 text-text-secondary" />

        <div
          // scroll-pr-8 clears the 24px mask on .ef-scroll-fade: without it a
          // chip tabbed to at the right edge lands under the fade and its focus
          // ring is half invisible (WCAG 2.4.11).
          className="ef-scroll-fade flex min-w-0 flex-1 scroll-pr-8 items-center gap-1.5 overflow-x-auto"
          role="group"
          aria-label={t(locale, 'search.activeFilters')}
        >
          {chips.map((c) => (
            <span key={c.key} className="ef-chip ef-chip-enter">
              {c.label}
              <button
                type="button"
                onClick={() => remove(c.patch)}
                aria-label={t(locale, 'search.remove', { label: c.label })}
                className="ef-chip-remove"
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={chips.length ? '' : t(locale, 'search.placeholder')}
            aria-label={t(locale, 'search.label')}
            className="h-9 min-w-[4.5rem] flex-1 border-0 bg-transparent text-[14px] text-text outline-none placeholder:text-text-secondary"
          />
        </div>

        {(chips.length > 0 || query) && (
          <button
            type="button"
            onClick={onClearAll}
            className="ef-btn ef-btn--quiet shrink-0"
          >
            {t(locale, 'search.clearAll')}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenFilters}
        className="ef-pill shrink-0"
        aria-label={t(locale, 'search.filters')}
      >
        <SlidersHorizontal size={15} aria-hidden />
        <span className="hidden sm:inline">{t(locale, 'search.filters')}</span>
        {filterCount > 0 && (
          <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-primary px-1 text-[11px] text-[color:var(--on-primary)]">
            {filterCount}
          </span>
        )}
      </button>
    </div>
  )
}
