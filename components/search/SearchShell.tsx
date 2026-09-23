'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, Map as MapIcon, X } from 'lucide-react'

import { parseFilters, toSearchParams, type ParsedFilters } from '@/lib/filters'
import type { MapPoint, ScoredRestaurant, Sort, View } from '@/lib/types'
import { t, tVocab, type Locale } from '@/lib/i18n'
import SearchBar, { activeChips, type Patch } from './SearchBar'
import FilterPanel from './FilterPanel'
import SortHeader, { ViewToggle } from './SortHeader'
import ResultsPane from '@/components/results/ResultsPane'
import TopBar from '@/components/TopBar'
import { PAGE_SIZE, type Facets, type RecommendResponse } from './types'

// mapbox-gl touches `window` at import time, so the map pane never renders on
// the server. Everything else on this page does.
const MapPane = dynamic(() => import('@/components/map/MapPane'), { ssr: false })

const EMPTY_FACETS: Facets = { cuisines: {}, tags: {}, neighborhoods: {}, priceLevels: {} }

export default function SearchShell({
  locale,
  mapboxToken,
}: {
  locale: Locale
  mapboxToken: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const spString = searchParams.toString()

  // The URL is the state store. parseFilters is the same function
  // /api/recommend uses, so a pasted link and the API cannot disagree.
  const urlFilters = useMemo(() => parseFilters(new URLSearchParams(spString)), [spString])

  // Continuous controls (text box, sliders) need to feel instant while their
  // URL write is still debounced, so they render from this optimistic copy
  // until the URL catches up.
  const [override, setOverride] = useState<ParsedFilters | null>(null)
  const filters = override ?? urlFilters

  const pendingRef = useRef<ParsedFilters | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writtenParamsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // A URL update can arrive after the user has already typed another
    // character. Keep that newer edit and its timer until its own write lands.
    const wasOurWrite = writtenParamsRef.current.delete(spString)
    if (
      wasOurWrite &&
      pendingRef.current &&
      toSearchParams(pendingRef.current).toString() !== spString
    ) return
    setOverride(null)
    pendingRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [spString])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Discrete changes (a chip, a pill, sort, view) get their own history entry
  // so Back undoes exactly one of them, which is the Phase 2 acceptance
  // criterion. Continuous ones (typing, dragging a slider) replace, or a
  // ten-character query would bury the previous page under ten entries.
  const write = useCallback(
    (next: ParsedFilters, mode: 'push' | 'replace') => {
      const params = toSearchParams(next).toString()
      if (writtenParamsRef.current.size > 20) writtenParamsRef.current.clear()
      writtenParamsRef.current.add(params)
      const url = `${pathname}?${params}`
      if (mode === 'push') router.push(url, { scroll: false })
      else router.replace(url, { scroll: false })
    },
    [pathname, router]
  )

  /** `debounce` is for anything that fires continuously; everything else writes now. */
  const patch = useCallback(
    (p: Patch, opts: { debounce?: boolean; keepPage?: boolean } = {}) => {
      const base = pendingRef.current ?? filters
      const next = { ...base, ...p, page: opts.keepPage ? (p.page ?? base.page) : 1 } as ParsedFilters
      pendingRef.current = next
      setOverride(next)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (opts.debounce) timerRef.current = setTimeout(() => {
        timerRef.current = null
        write(next, 'replace')
      }, 300)
      else write(next, 'push')
    },
    [filters, write]
  )

  const clearAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    const reset = { heavy: 50, hungry: 50, fine: 50, view: filters.view, page: 1 } as ParsedFilters
    setOverride(reset)
    write(reset, 'push')
  }, [filters.view, write])

  // --- results ---------------------------------------------------------
  const [items, setItems] = useState<ScoredRestaurant[]>([])
  const [points, setPoints] = useState<MapPoint[]>([])
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Coalescing lives in `patch` alone: continuous input holds the URL write for
  // 300 ms, so by the time the URL changes there is nothing left to debounce.
  // A second timer here only made every pill, sort and toggle wait 300 ms for
  // an event that fires once.
  const firstRun = useRef(true)

  useEffect(() => {
    const page = urlFilters.page

    // A shared ?page=2 link has no page 1 on screen to append to, so it would
    // render results 25-48 as the whole list. Rewrite it and let the URL
    // change re-run this effect.
    if (firstRun.current) {
      firstRun.current = false
      if (page > 1) {
        write({ ...urlFilters, page: 1 }, 'replace')
        return
      }
    }

    const controller = new AbortController()
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/recommend?${spString}`, { signal: controller.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as RecommendResponse
        // page > 1 is "load more": keep what is already on screen.
        setItems((prev) => (page > 1 ? [...prev, ...data.items] : data.items))
        setPoints(data.points)
        setFacets(data.facets)
        setTotal(data.total)
        setError(false)
        setLoading(false)
      } catch (e) {
        // An aborted request has a successor already loading; leaving the
        // spinner to it stops the two racing over `loading`.
        if ((e as Error).name === 'AbortError') return
        setError(true)
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [spString, urlFilters, reloadKey, write])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [expandedChips, setExpandedChips] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const view: View = filters.view
  const chips = activeChips(filters, locale)
  const chipCount = chips.length
  const hasMore = items.length < total

  const showMap = Boolean(mapboxToken) && view === 'map'
  const showResults = !showMap
  const quickCuisines = Object.keys(facets.cuisines)
    .sort((a, b) => facets.cuisines[b] - facets.cuisines[a])
    .slice(0, 6)

  return (
    <>
      {/* The document's one h1. Everything visible on this screen is a control
          or a listing, so the page title lives here for screen readers only. */}
      <h1 className="sr-only">
        {t(locale, 'app.name')} — {t(locale, 'app.tagline')}
      </h1>

      {/* The map is a large non-tabbable canvas sitting before the results;
          without this a keyboard user tabs through the whole overlay rail to
          reach the listings. In map view #results is unmounted, so the target
          moves to the map region rather than pointing at nothing. */}
      <a
        href="#results"
        className="sr-only rounded-b-xl bg-primary px-4 py-2 text-[13px] font-bold text-on-primary focus:not-sr-only focus:absolute focus:left-3 focus:top-0 focus:z-modal"
      >
        {t(locale, 'app.skipToResults')}
      </a>

      <TopBar locale={locale}>
        <SearchBar
          locale={locale}
          query={filters.query ?? ''}
          onQuery={(v) => patch({ query: v || undefined }, { debounce: true })}
          onClearQuery={() => patch({ query: undefined })}
          onOpenFilters={() => setPanelOpen(true)}
          filterCount={chipCount}
          inputRef={searchInputRef}
        />
      </TopBar>

      {chips.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 sm:px-5" role="group" aria-label={t(locale, 'search.activeFilters')}>
          {chips.map((chip, index) => (
            <span key={chip.key} className={`ef-chip ef-chip-enter ${index >= 3 && !expandedChips ? 'hidden sm:inline-flex' : ''}`}>
              <span className="min-w-0 truncate">{chip.label}</span>
              <button
                type="button"
                onClick={(event) => {
                  patch(chip.patch)
                  // Keep keyboard users in the controls without opening the
                  // software keyboard after a touch removal.
                  if (event.detail === 0) searchInputRef.current?.focus({ preventScroll: true })
                }}
                aria-label={t(locale, 'search.remove', { label: chip.label })}
                className="ef-chip-remove"
              >
                <X size={13} aria-hidden />
              </button>
            </span>
          ))}
          {chips.length > 3 && (
            <button
              type="button"
              onClick={() => setExpandedChips((value) => !value)}
              aria-expanded={expandedChips}
              aria-label={t(locale, expandedChips ? 'search.showLess' : 'search.showMore', { n: chips.length - 3 })}
              className="ef-pill sm:hidden"
            >
              {expandedChips ? t(locale, 'search.less') : `+${chips.length - 3}`}
            </button>
          )}
          <button type="button" onClick={() => { setExpandedChips(false); clearAll() }} className="ef-btn ef-btn--quiet">
            {t(locale, 'search.clearAll')}
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        {/* Map: full-bleed, no padding, no card wrapper. Hidden below md unless
            the user asked for it. */}
        {mapboxToken && <div
          id={showResults ? undefined : 'results'}
          tabIndex={showResults ? undefined : -1}
          className={[
            'relative min-h-0 flex-1 outline-none',
            // Always flex-1: the results pane owns the split's width and
            // animates it, and the map simply takes whatever is left.
            showMap ? '' : 'hidden md:block',
          ].join(' ')}
        >
          <MapPane
            token={mapboxToken}
            locale={locale}
            points={points}
            items={items}
            facets={facets}
            selectedCuisines={filters.cuisines ?? []}
            queriedBbox={filters.bbox}
            hoveredId={hoveredId}
            view={view}
            onHover={setHoveredId}
            onView={(v) => patch({ view: v }, { keepPage: true })}
            onPatch={(p) => patch(p)}
            onSearchArea={(bbox) => patch({ bbox })}
            onLocate={(lat, lng) => patch({ near: { lat, lng } })}
          />
        </div>}

        {/* Stays mounted in map view so the collapse can animate; `inert` keeps
            the hidden pane out of the tab order and off screen readers, and the
            id moves to the map so the skip link never points into it. */}
        <section
          id={showResults ? 'results' : undefined}
          tabIndex={-1}
          inert={!showResults}
          data-state={showResults ? 'open' : 'closed'}
          aria-label={t(locale, 'view.label')}
          className={`ef-split-pane min-h-0 w-full shrink-0 border-border bg-background outline-none ${mapboxToken ? 'md:w-[40vw] md:border-l' : 'md:w-full'} ${
            showResults ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* shrink-0 is the whole trick: the pane keeps its full width while the
              section around it collapses, so it slides out to the right under
              the clip instead of squashing and reflowing the cards. */}
          <div className={`flex h-full w-full shrink-0 flex-col ${mapboxToken ? 'md:w-[40vw]' : 'md:w-full'}`}>
            {!mapboxToken && (
              <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-border px-4 py-2 sm:px-5">
                <div className="ef-no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto" aria-label={t(locale, 'search.filters')}>
                  {quickCuisines.map((c) => {
                    const selected = (filters.cuisines ?? []).includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = selected
                            ? (filters.cuisines ?? []).filter((value) => value !== c)
                            : [...(filters.cuisines ?? []), c]
                          patch({ cuisines: next.length ? next : undefined })
                        }}
                        className={`ef-pill shrink-0 ${selected ? 'ef-pill--active' : ''}`}
                      >
                        {tVocab(locale, 'cuisine', c)}
                      </button>
                    )
                  })}
                </div>
                <ViewToggle
                  locale={locale}
                  view={view === 'map' ? 'grid' : view}
                  onChange={(next) => patch({ view: next }, { keepPage: true })}
                  includeMap={false}
                  className="shrink-0"
                />
              </div>
            )}
            <SortHeader
              locale={locale}
              total={total}
              sort={(filters.sort ?? 'match') as Sort}
              onSort={(s) => patch({ sort: s })}
              loading={loading && items.length === 0}
            />
            <ResultsPane
              locale={locale}
              items={items}
              view={view}
              loading={loading}
              error={error}
              hasMore={hasMore}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onLoadMore={() =>
                patch({ page: Math.floor(items.length / PAGE_SIZE) + 1 }, { keepPage: true })
              }
              onRetry={() => setReloadKey((k) => k + 1)}
              onClearAll={clearAll}
            />
          </div>
        </section>
      </main>

      {/* Below md the split collapses: results are the page, map is a toggle. */}
      {mapboxToken && <button
        type="button"
        onClick={() => patch({ view: showMap ? 'grid' : 'map' }, { keepPage: true })}
        className="ef-pill ef-pill--active fixed bottom-5 left-1/2 z-sticky h-11 -translate-x-1/2 px-5 shadow-lg md:hidden"
      >
        {showMap ? <List size={16} aria-hidden /> : <MapIcon size={16} aria-hidden />}
        {t(locale, showMap ? 'map.showList' : 'map.showMap')}
      </button>}

      <FilterPanel
        locale={locale}
        open={panelOpen}
        filters={filters}
        facets={facets}
        onPatch={(p) => patch(p, { debounce: true })}
        onClearAll={clearAll}
        onClose={() => setPanelOpen(false)}
      />
    </>
  )
}
