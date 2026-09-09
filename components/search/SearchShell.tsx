'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, Map as MapIcon } from 'lucide-react'

import { parseFilters, toSearchParams, type ParsedFilters } from '@/lib/filters'
import type { MapPoint, ScoredRestaurant, Sort, View } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'
import SearchBar, { activeChips, type Patch } from './SearchBar'
import FilterPanel from './FilterPanel'
import SortHeader from './SortHeader'
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

  useEffect(() => {
    setOverride(null)
    pendingRef.current = null
  }, [spString])

  // Discrete changes (a chip, a pill, sort, view) get their own history entry
  // so Back undoes exactly one of them, which is the Phase 2 acceptance
  // criterion. Continuous ones (typing, dragging a slider) replace, or a
  // ten-character query would bury the previous page under ten entries.
  const write = useCallback(
    (next: ParsedFilters, mode: 'push' | 'replace') => {
      const url = `${pathname}?${toSearchParams(next).toString()}`
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
      if (opts.debounce) timerRef.current = setTimeout(() => write(next, 'replace'), 300)
      else write(next, 'push')
    },
    [filters, write]
  )

  const clearAll = useCallback(() => {
    write({ heavy: 50, hungry: 50, fine: 50, view: filters.view, page: 1 }, 'push')
  }, [filters.view, write])

  // --- results ---------------------------------------------------------
  const [items, setItems] = useState<ScoredRestaurant[]>([])
  const [points, setPoints] = useState<MapPoint[]>([])
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const page = urlFilters.page
    setLoading(true)

    // 300 ms: one keystroke burst or one slider drag is a single request.
    const id = setTimeout(async () => {
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
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setError(true)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(id)
      controller.abort()
    }
  }, [spString, urlFilters.page, reloadKey])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const view: View = filters.view
  const chipCount = activeChips(filters, locale).length
  const hasMore = items.length < total

  const showMap = view === 'map'
  const showResults = view !== 'map'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The map is a large non-tabbable canvas sitting before the results;
          without this a keyboard user tabs through the whole overlay rail to
          reach the listings. */}
      <a
        href="#results"
        className="sr-only rounded-b-xl bg-primary px-4 py-2 text-[13px] font-bold text-on-primary focus:not-sr-only focus:absolute focus:left-3 focus:top-0 focus:z-modal"
      >
        {t(locale, 'app.skipToResults')}
      </a>

      <TopBar locale={locale}>
        <SearchBar
          locale={locale}
          filters={filters}
          query={filters.query ?? ''}
          onQuery={(v) => patch({ query: v || undefined }, { debounce: true })}
          onPatch={(p) => patch(p)}
          onClearAll={clearAll}
          onOpenFilters={() => setPanelOpen(true)}
          filterCount={chipCount}
        />
      </TopBar>

      <div className="flex min-h-0 flex-1">
        {/* Map: full-bleed, no padding, no card wrapper. Hidden below md unless
            the user asked for it. */}
        <div
          className={[
            'relative min-h-0',
            showMap ? 'flex-1' : 'hidden md:block md:w-[60%]',
            showMap ? '' : 'md:shrink-0',
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
        </div>

        {showResults && (
          <section
            id="results"
            tabIndex={-1}
            aria-label={t(locale, 'view.label')}
            className="flex min-h-0 w-full flex-col border-border bg-background outline-none md:w-[40%] md:border-l"
          >
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
          </section>
        )}
      </div>

      {/* Below md the split collapses: results are the page, map is a toggle. */}
      <button
        type="button"
        onClick={() => patch({ view: showMap ? 'grid' : 'map' }, { keepPage: true })}
        className="ef-pill ef-pill--active fixed bottom-5 left-1/2 z-sticky h-11 -translate-x-1/2 px-5 shadow-lg md:hidden"
      >
        {showMap ? <List size={16} aria-hidden /> : <MapIcon size={16} aria-hidden />}
        {t(locale, showMap ? 'map.showList' : 'map.showMap')}
      </button>

      <FilterPanel
        locale={locale}
        open={panelOpen}
        filters={filters}
        facets={facets}
        onPatch={(p) => patch(p, { debounce: true })}
        onClearAll={clearAll}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  )
}
