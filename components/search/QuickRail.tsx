'use client'

import { useState } from 'react'
import { Clock, Loader2, LocateFixed, X } from 'lucide-react'
import { t, tVocab, type Locale } from '@/lib/i18n'
import type { ParsedFilters } from '@/lib/filters'
import type { Facets } from './types'
import type { Patch } from './SearchBar'
import { MOODS, activeMood } from './moods'

/** Top cuisines by count, plus anything already selected so it can be undone. */
function railCuisines(facets: Facets, selected: string[]): string[] {
  const top = Object.keys(facets.cuisines)
    .sort((a, b) => facets.cuisines[b] - facets.cuisines[a])
    .slice(0, 8)
  return [...new Set([...selected, ...top])]
}

/**
 * The one-tap row under the search field: where am I, is it open, what am I
 * in the mood for, what kind of food. Everything here is also in the filter
 * sheet; this row is for the four decisions people make in the first second.
 */
export default function QuickRail({
  locale,
  filters,
  facets,
  onPatch,
}: {
  locale: Locale
  filters: ParsedFilters
  facets: Facets
  onPatch: (p: Patch) => void
}) {
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState(false)
  const near = Boolean(filters.near)
  const mood = activeMood(filters)
  const selected = filters.cuisines ?? []

  const toggleNear = () => {
    setLocateError(false)
    if (near) {
      onPatch({
        near: undefined,
        maxDistanceKm: undefined,
        sort: filters.sort === 'distance' ? undefined : filters.sort,
      })
      return
    }
    if (!('geolocation' in navigator)) {
      setLocateError(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        // Rounded to ~100m: this lands in a shareable URL, and a street is
        // precise enough to rank restaurants by.
        const round = (n: number) => Math.round(n * 1000) / 1000
        onPatch({
          near: { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) },
          sort: 'distance',
        })
      },
      () => {
        setLocating(false)
        setLocateError(true)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  return (
    <div>
      <div
        role="group"
        aria-label={t(locale, 'rail.label')}
        // scroll-px: a pill focused at either edge scrolls clear of the
        // padding and the fade rather than under them.
        className="ef-scroll-fade flex items-center gap-2 overflow-x-auto scroll-px-4 px-4 pb-3 sm:scroll-px-5 sm:px-5"
      >
        <button
          type="button"
          aria-pressed={near}
          aria-busy={locating}
          onClick={toggleNear}
          className={`ef-pill ef-pill--lg shrink-0 ${near ? 'ef-pill--active' : ''}`}
        >
          {locating ? (
            <Loader2 size={16} aria-hidden className="motion-safe:animate-spin" />
          ) : (
            <LocateFixed size={16} aria-hidden />
          )}
          {t(locale, locating ? 'rail.locating' : 'rail.nearMe')}
        </button>

        <button
          type="button"
          aria-pressed={Boolean(filters.openNow)}
          onClick={() => onPatch({ openNow: filters.openNow ? undefined : true })}
          className={`ef-pill ef-pill--lg shrink-0 ${filters.openNow ? 'ef-pill--active' : ''}`}
        >
          <Clock size={16} aria-hidden />
          {t(locale, 'filters.openNow')}
        </button>

        <span aria-hidden className="h-6 w-px shrink-0 bg-border" />

        {MOODS.map((m) => {
          const on = mood?.key === m.key
          const Icon = m.icon
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onPatch(
                  on
                    ? { heavy: 50, hungry: 50, fine: 50 }
                    : { heavy: m.heavy, hungry: m.hungry, fine: m.fine }
                )
              }
              className={`ef-pill ef-pill--lg shrink-0 ${on ? 'ef-pill--active' : ''}`}
            >
              <Icon size={16} aria-hidden className={on ? '' : 'text-accent'} />
              {t(locale, m.label)}
            </button>
          )
        })}

        {railCuisines(facets, selected).length > 0 && (
          <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
        )}

        {railCuisines(facets, selected).map((c) => {
          const on = selected.includes(c)
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = on ? selected.filter((x) => x !== c) : [...selected, c]
                onPatch({ cuisines: next.length ? next : undefined })
              }}
              className={`ef-pill ef-pill--lg shrink-0 ${on ? 'ef-pill--active' : ''}`}
            >
              {tVocab(locale, 'cuisine', c)}
            </button>
          )
        })}
        {/* The fade eats the last 24px; this keeps the final pill clear of it
            when scrolled to the end. */}
        <span aria-hidden className="w-4 shrink-0" />
      </div>

      {locateError && (
        <div role="alert" className="ef-alert mx-4 !mb-3 items-center sm:mx-5">
          <span className="flex-1">{t(locale, 'rail.locateError')}</span>
          <button
            type="button"
            onClick={() => setLocateError(false)}
            aria-label={t(locale, 'rail.dismiss')}
            className="-my-2 -mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
