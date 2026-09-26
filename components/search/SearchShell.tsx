'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { parseFilters, toSearchParams, type ParsedFilters } from '@/lib/filters'
import type { MapPoint, ScoredRestaurant, Sort, View } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'
import SearchBar, { activeChips, type Patch } from './SearchBar'
import FilterPanel from './FilterPanel'
import QuickRail from './QuickRail'
import SortHeader, { ViewToggle } from './SortHeader'
import ResultsPane from '@/components/results/ResultsPane'
import TopBar from '@/components/TopBar'
import MobileNav from '@/components/MobileNav'
import { PAGE_SIZE, type Facets, type RecommendResponse } from './types'
import { resultsKey, searchMemory } from './memory'

// mapbox-gl touches `window` at import time, so the map pane never renders on
// the server. Everything else on this page does.
const MapPane = dynamic(() => import('@/components/map/MapPane'), { ssr: false })

const EMPTY_FACETS: Facets = { cuisines: {}, tags: {}, neighborhoods: {}, priceLevels: {} }

/**
 * Hides the phone header while the list scrolls down and brings it back on
 * the first scroll up. Writes a data attribute rather than state: this fires
 * on every scroll frame and nothing else needs to re-render for it.
 */
function useHideOnScroll(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.dataset.hidden = 'false'
    if (!enabled) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return // finger jitter is not a direction
      // Never while the header still overlaps its own resting place, or it
      // slides away over nothing at the top of the page.
      el.dataset.hidden = String(y > last && y > el.offsetHeight)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref, enabled])
}

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
  const key = resultsKey(spString)

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
    searchMemory.params = spString
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
  // so Back undoes exactly one of them. Continuous ones (typing, dragging a
  // slider) replace, or a ten-character query would bury the previous page
  // under ten entries.
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
  // Seeded from the last search when this is the same one (Back from a
  // restaurant, or a tab from another page): the list paints in the first
  // frame instead of a skeleton, and at the scroll offset you left it.
  const [restored] = useState(() => searchMemory.key === key && searchMemory.data !== null)
  const seed = restored ? searchMemory.data : null
  const [items, setItems] = useState<ScoredRestaurant[]>(seed?.items ?? [])
  const [points, setPoints] = useState<MapPoint[]>(seed?.points ?? [])
  const [facets, setFacets] = useState<Facets>(seed?.facets ?? EMPTY_FACETS)
  const [total, setTotal] = useState(seed?.total ?? 0)
  const [loading, setLoading] = useState(!seed)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const paneRef = useRef<HTMLDivElement>(null)

  const firstRun = useRef(true)
  const lastKey = useRef<string | null>(restored ? key : null)
  const handledReload = useRef(0)

  useEffect(() => {
    const first = firstRun.current
    firstRun.current = false
    // Grid, list and map are three looks at one result set: a view switch
    // changes the URL but not the key, and needs no request. Retry does.
    if (lastKey.current === key && handledReload.current === reloadKey) return
    handledReload.current = reloadKey
    const page = urlFilters.page

    // A shared ?page=2 link has no page 1 on screen to append to, so it would
    // render results 25-48 as the whole list. Rewrite it and let the URL
    // change re-run this effect.
    if (first && page > 1) {
      write({ ...urlFilters, page: 1 }, 'replace')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/recommend?${key}`, { signal: controller.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as RecommendResponse
        const newQuery = page === 1 && lastKey.current !== key
        lastKey.current = key
        // page > 1 is "load more": keep what is already on screen.
        setItems((prev) => (page > 1 ? [...prev, ...data.items] : data.items))
        setPoints(data.points)
        setFacets(data.facets)
        setTotal(data.total)
        setError(false)
        setLoading(false)
        // A new query starts at the top of its own results, not forty rows
        // down where the last one happened to be.
        if (newQuery) {
          if (window.scrollY > 0) window.scrollTo({ top: 0 })
          if (paneRef.current) paneRef.current.scrollTop = 0
        }
      } catch (e) {
        // An aborted request has a successor already loading; leaving the
        // spinner to it stops the two racing over `loading`.
        if ((e as Error).name === 'AbortError') return
        setError(true)
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [key, urlFilters, reloadKey, write])

  // Remember what is on screen for the next time this shell mounts.
  useEffect(() => {
    if (loading || error) return
    searchMemory.key = key
    searchMemory.data = { items, points, facets, total }
  }, [loading, error, key, items, points, facets, total])

  useEffect(() => {
    const save = () => {
      searchMemory.scrollY = window.scrollY
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [])

  // Before paint, so the restored list never flashes at the top first.
  useLayoutEffect(() => {
    if (!restored) return
    window.scrollTo(0, searchMemory.scrollY)
    if (paneRef.current) paneRef.current.scrollTop = searchMemory.paneY
  }, [restored])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const appbarRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // The map is one screen-sized canvas fixed behind everything, in every view
  // and at every width (see the map wrapper below); the header just covers its
  // top. Its height (--appbar-h: the chip row comes and goes, and wraps) tells
  // MapPane where the visible part starts. Written straight to the DOM so the
  // overlays move in the same frame as the header.
  const [appbarH, setAppbarH] = useState(0)
  useEffect(() => {
    const el = appbarRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      rootRef.current?.style.setProperty('--appbar-h', `${el.offsetHeight}px`)
      setAppbarH(el.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const view: View = filters.view
  const chips = activeChips(filters, locale)
  const hasMore = items.length < total

  const showMap = Boolean(mapboxToken) && view === 'map'
  const showResults = !showMap
  useHideOnScroll(appbarRef, showResults)

  const setView = (next: View) => patch({ view: next }, { keepPage: true })

  // Map view pins the page to one screen, which snaps the list's scroll to the
  // top. Remember where the list was and put it back on the way out.
  const listY = useRef<number | null>(null)
  const toMap = () => {
    listY.current = window.scrollY
    setView('map')
  }
  useLayoutEffect(() => {
    if (!showResults || listY.current === null) return
    window.scrollTo(0, listY.current)
    listY.current = null
  }, [showResults])

  return (
    <div
      ref={rootRef}
      className={
        showMap
          ? // The map is the screen: nothing scrolls, the canvas fills it.
            'flex h-[100dvh] flex-col overflow-hidden'
          : // A phone scrolls the document (toolbar collapse, pull to
            // refresh, a header that can hide); from md the split pane
            // scrolls on its own beside the map.
            'flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden'
      }
    >
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

      <div ref={appbarRef} className="ef-appbar shrink-0 border-b border-border">
        <TopBar locale={locale}>
          <SearchBar
            locale={locale}
            query={filters.query ?? ''}
            onQuery={(v) => patch({ query: v || undefined }, { debounce: true })}
            onClearQuery={() => patch({ query: undefined })}
            onOpenFilters={() => setPanelOpen(true)}
            filterCount={chips.length}
            inputRef={searchInputRef}
          />
        </TopBar>

        <QuickRail locale={locale} filters={filters} facets={facets} onPatch={(p) => patch(p)} />

        {chips.length > 0 && (
          // One line that scrolls sideways on a phone, rather than a stack of
          // chips pushing the list down a row at a time. Clear-all leads, so
          // it is never the thing scrolled off the end.
          <div
            className="ef-no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 sm:px-5 md:flex-wrap"
            role="group"
            aria-label={t(locale, 'search.activeFilters')}
          >
            <button
              type="button"
              onClick={clearAll}
              className="ef-btn ef-btn--quiet shrink-0 underline decoration-border-strong underline-offset-4"
            >
              {t(locale, 'search.clearAll')}
            </button>
            {chips.map((chip) => (
              <span key={chip.key} className="ef-chip ef-chip-enter shrink-0">
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
          </div>
        )}
      </div>

      <main className="ef-tabbar-pad relative flex min-h-0 flex-1 md:pb-0">
        {/* Map: full-bleed, no padding, no card wrapper. Hidden below md unless
            the user asked for it. */}
        {mapboxToken && <div
          id={showResults ? undefined : 'results'}
          tabIndex={showResults ? undefined : -1}
          className={[
            // Always the full screen, fixed behind the header, the tab bar and
            // the results pane, whatever the view. Nothing that happens on
            // this page ever changes its size, so the canvas is never
            // reallocated (a white flash) and never re-laid out; MapPane pans
            // the camera to keep the pins in the part that is uncovered.
            // h-lvh, not dvh: the phone's browser toolbar coming and going
            // must not resize it either. `isolate` keeps its overlays under
            // the pane and the header.
            'fixed inset-x-0 top-0 isolate h-lvh outline-none',
            // The phone list covers the screen: hide the map without taking
            // it out of layout, so switching tabs is instant.
            showMap ? '' : 'invisible md:visible',
          ].join(' ')}
        >
          <MapPane
            token={mapboxToken}
            locale={locale}
            points={points}
            items={items}
            queriedBbox={filters.bbox}
            topInset={appbarH}
            near={filters.near}
            hoveredId={hoveredId}
            view={view}
            onHover={setHoveredId}
            onView={setView}
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
          className={`ef-split-pane min-h-0 w-full shrink-0 border-border bg-background outline-none ${mapboxToken ? 'md:absolute md:inset-y-0 md:right-0 md:w-[40vw] md:border-l' : 'md:w-full'} ${
            showResults ? 'flex' : 'hidden md:flex'
          }`}
        >
<div className={`flex w-full shrink-0 flex-col md:h-full ${mapboxToken ? 'md:w-[40vw]' : 'md:w-full'}`}>
            <SortHeader
              locale={locale}
              total={total}
              sort={(filters.sort ?? 'match') as Sort}
              onSort={(s) => patch({ sort: s })}
              loading={loading && items.length === 0}
            >
              {/* Over the map on desktop; here wherever that is not on screen. */}
              <ViewToggle
                locale={locale}
                view={view === 'map' ? 'grid' : view}
                onChange={setView}
                includeMap={false}
                className={mapboxToken ? 'md:hidden' : ''}
              />
            </SortHeader>
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
              paneRef={paneRef}
              onPaneScroll={(top) => {
                searchMemory.paneY = top
              }}
              animate={!restored}
            />
          </div>
        </section>
      </main>

      <MobileNav
        locale={locale}
        current={showMap ? 'map' : 'explore'}
        hasMap={Boolean(mapboxToken)}
        onView={(tab) =>
          tab === 'map'
            ? toMap()
            : showMap
              ? setView('grid')
              : window.scrollTo({ top: 0, behavior: 'smooth' }) // re-tap = back to top
        }
      />

      <FilterPanel
        locale={locale}
        open={panelOpen}
        filters={filters}
        facets={facets}
        total={total}
        loading={loading}
        onPatch={(p) => patch(p, { debounce: true })}
        onClearAll={clearAll}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  )
}
