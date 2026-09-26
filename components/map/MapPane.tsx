'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Map, {
  GeolocateControl,
  Marker,
  NavigationControl,
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl/mapbox'
import type { GeoJSONSource } from 'mapbox-gl'
import { MapPinOff, Search } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

import { CITY, type MapPoint, type ScoredRestaurant, type View } from '@/lib/types'
import { priceGlyphs, t, type Locale } from '@/lib/i18n'
import { ViewToggle } from '@/components/search/SortHeader'
import PointsLayer, { CLUSTER_LAYER, POINT_LAYER } from './PointsLayer'
import PopupCard from './PopupCard'
import RestaurantCard from '@/components/results/RestaurantCard'

type Bbox = [number, number, number, number]

/** Quiet time before the canvas is reallocated. Longer than one animation frame,
 *  shorter than anyone notices the stretch. */
const RESIZE_SETTLE_MS = 120

/** Matches --dur-split, so the camera and the results pane move together. */
const SPLIT_MS = 320

/** Roughly a tenth of a city block — below this a "move" is just jitter. */
const BBOX_EPSILON = 0.0015

function differs(a: Bbox | undefined, b: Bbox): boolean {
  if (!a) return true
  return a.some((v, i) => Math.abs(v - b[i]) > BBOX_EPSILON)
}

function sameBbox(a?: Bbox, b?: Bbox): boolean {
  if (!a || !b) return !a && !b
  return !differs(a, b)
}

const DESKTOP = '(min-width: 768px)'

/** A pointer-and-popup map from md, a thumb-and-carousel map below it. */
function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(DESKTOP)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true
  )
}

export default function MapPane({
  token,
  locale,
  points,
  items,
  queriedBbox,
  topInset = 0,
  near,
  hoveredId,
  view,
  onHover,
  onView,
  onSearchArea,
  onLocate,
}: {
  token: string | null
  locale: Locale
  points: MapPoint[]
  items: ScoredRestaurant[]
  queriedBbox?: Bbox
  /** Height of the header sitting over the top of the map. Only a trigger:
   *  the padding itself is measured from the overlay box. */
  topInset?: number
  /** "Near me": drawn as a you-are-here dot. */
  near?: { lat: number; lng: number }
  hoveredId: string | null
  view: View
  onHover: (id: string | null) => void
  onView: (v: View) => void
  onSearchArea: (bbox: Bbox) => void
  onLocate: (lat: number, lng: number) => void
}) {
  const mapRef = useRef<MapRef>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<{ bbox: Bbox; against?: Bbox } | null>(null)
  const [selected, setSelected] = useState<MapPoint | null>(null)

  // A re-search can drop the selected pin out of the result set. Derive the
  // popup from what is actually on the map rather than clearing it in an
  // effect: the pin is gone, so the card that describes it goes with it.
  const live = selected && points.some((p) => p.id === selected.id) ? selected : null
  const [cursor, setCursor] = useState<string>('grab')
  const desktop = useDesktop()
  const carouselRef = useRef<HTMLUListElement>(null)

  // Derived rather than cleared in an effect: the offer to re-search is only
  // meaningful while the shell is still showing the bounds it was measured
  // against, so the moment those change the pill is simply not rendered.
  const pendingBbox = pending && sameBbox(pending.against, queriedBbox) ? pending.bbox : null

  // This canvas is always the whole screen (SearchShell fixes it there). The
  // header covers its top, the tab bar and carousel its bottom on a phone, and
  // from md the results pane its right 40vw. Camera padding keeps the pins
  // centred in what is left, and easing it glides the map instead of jumping.
  const split = desktop && view !== 'map'
  const splitRef = useRef(split)
  const overlayRef = useRef<HTMLDivElement>(null)

  /** Measured from the overlay box, which CSS pins to the uncovered area.
   *  The right edge is computed: the pane is mid-slide when this runs. */
  const camPadding = useCallback(() => {
    const shell = shellRef.current?.getBoundingClientRect()
    const box = overlayRef.current?.getBoundingClientRect()
    const carousel = carouselRef.current?.offsetHeight ?? 0
    return {
      top: shell && box ? Math.max(0, box.top - shell.top) : 0,
      bottom: (shell && box ? Math.max(0, shell.bottom - box.bottom) : 0) + carousel,
      left: 0,
      right: splitRef.current ? window.innerWidth * 0.4 : 0,
    }
  }, [])

  // mapbox-gl watches the window, not its container (there is no ResizeObserver
  // anywhere in the library), so every layout change that resizes this pane
  // without resizing the window leaves the canvas at its old size and the
  // revealed strip blank until a refresh. Observing the container covers all of
  // them at once — the grid/map toggle, the filter drawer, the mobile switch —
  // where a resize() in the toggle handler would only ever cover the one.
  //
  // Trailing edge only. resize() reallocates the WebGL drawing buffer, and the
  // cleared buffer gets painted once before mapbox redraws into it: one white
  // flash per call. Running it per observed frame — the whole split-pane slide,
  // every frame of a window drag — strobed. The canvas stretches to its
  // container in the meantime, which is a far cheaper artefact than the flash,
  // so wait for the size to settle and pay for exactly one.
  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    let timer = 0
    let last = ''
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        // A change that settled back where it started (the chip row appearing
        // and the map tucking up behind it) costs nothing, not a flash.
        const size = `${el.clientWidth}x${el.clientHeight}`
        if (size === last) return
        last = size
        mapRef.current?.resize()
        // 40vw moved with the window.
        mapRef.current?.getMap().setPadding(camPadding())
      }, RESIZE_SETTLE_MS)
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [camPadding])

  // The canvas is lvh tall, so a phone's browser toolbar sliding in or out
  // never resizes it, but it does move the tab bar. Re-pad once it settles.
  useEffect(() => {
    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(
        () => mapRef.current?.easeTo({ padding: camPadding(), duration: 200 }),
        RESIZE_SETTLE_MS
      )
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [camPadding])

  const onMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      // Only a human gesture counts. A programmatic flyTo (or the geolocate
      // control recentring) must not offer to re-search where it just put you.
      if (!(e as unknown as { originalEvent?: unknown }).originalEvent) return
      // The visible area, not the canvas: the part under the results pane
      // is not somewhere the user is looking.
      const m = mapRef.current?.getMap()
      if (!m) return
      const c = m.getContainer()
      const pad = m.getPadding()
      const sw = m.unproject([pad.left ?? 0, c.clientHeight - (pad.bottom ?? 0)])
      const ne = m.unproject([c.clientWidth - (pad.right ?? 0), pad.top ?? 0])
      const bbox: Bbox = [sw.lng, sw.lat, ne.lng, ne.lat]
      setPending(differs(queriedBbox, bbox) ? { bbox, against: queriedBbox } : null)
    },
    [queriedBbox]
  )

  const onClick = useCallback((e: MapMouseEvent) => {
    // mapbox-gl's GeoJSONFeature extends GeoJSON.Feature from @types/geojson,
    // which is not installed and which we are not adding a dependency for.
    // This is the shape our own three layers actually emit.
    const feature = e.features?.[0] as
      | {
          layer?: { id?: string }
          geometry?: { coordinates?: number[] }
          properties?: Record<string, unknown>
        }
      | undefined

    const coords = feature?.geometry?.coordinates
    if (!feature || !coords || coords.length < 2) {
      setSelected(null)
      return
    }
    const [lng, lat] = coords as [number, number]

    if (feature.layer?.id === CLUSTER_LAYER) {
      const src = mapRef.current?.getMap().getSource('ef-places') as GeoJSONSource | undefined
      const clusterId = feature.properties?.cluster_id
      if (!src || typeof clusterId !== 'number') return
      src.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        mapRef.current?.easeTo({ center: [lng, lat], zoom, padding: camPadding(), duration: 400 })
      })
      return
    }

    const p = feature.properties ?? {}
    setSelected({
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      priceLevel: Number(p.priceLevel),
      lat,
      lng,
    })
  }, [camPadding])

  // The card -> pin direction was wired from the start; this is the return leg.
  // mouseenter/mouseleave alone cannot carry it: moving straight from one pin
  // to the next never leaves the interactive layer, so the highlight would stay
  // stuck on the pin the pointer left. react-map-gl already queries features on
  // every mousemove for the cursor, so this is the same work, read twice.
  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const f = e.features?.[0] as { layer?: { id?: string }; properties?: Record<string, unknown> } | undefined
      const id = f && f.layer?.id === POINT_LAYER ? String(f.properties?.id) : null
      onHover(id)
    },
    [onHover]
  )

  // Mapbox's own popup has no keyboard dismissal once closeButton is off, and
  // the markers are canvas-drawn so there is nothing to Shift+Tab back to.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // --- the phone carousel ------------------------------------------------
  // The loaded results as swipeable cards along the bottom edge, each one
  // bound to its pin: tap a pin and its card slides into the middle; swipe to
  // a card and the map glides to its pin. A pin further down the ranking than
  // the loaded page gets a card of its own at the front.
  const carouselItems = items.filter((i) => i.lat != null && i.lng != null)
  const orphan = live && !carouselItems.some((i) => i.id === live.id) ? live : null
  const showCarousel = !desktop && (carouselItems.length > 0 || orphan !== null)

  useEffect(() => {
    if (desktop || !live) return
    const card = carouselRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(live.id)}"]`)
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [desktop, live])

  // Only a swipe picks a card. The list also scrolls when it re-renders under
  // a new result set (fewer cards, one inserted at the front) and when a card
  // is brought into view for a tapped pin; none of that is the user choosing a
  // place, and selecting on it jumped the map to whatever card landed centre.
  const swiped = useRef(false)
  const onSwipe = () => {
    swiped.current = true
  }
  const settle = useRef(0)
  const onCarouselScroll = () => {
    clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      if (!swiped.current) return
      swiped.current = false
      const list = carouselRef.current
      if (!list) return
      const mid = list.getBoundingClientRect().left + list.clientWidth / 2
      let best: HTMLElement | null = null
      let bestD = Infinity
      for (const el of list.querySelectorAll<HTMLElement>('[data-id]')) {
        const r = el.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - mid)
        if (d < bestD) {
          bestD = d
          best = el
        }
      }
      const id = best?.dataset.id
      if (!id || id === live?.id) return
      const item = carouselItems.find((i) => i.id === id)
      if (!item || item.lat == null || item.lng == null) return
      setSelected({ id: item.id, slug: item.slug, name: item.name, priceLevel: item.priceLevel, lat: item.lat, lng: item.lng })
      // Padding passed along, not left to the camera: this easeTo cancels any
      // padding glide still running, which would otherwise stop halfway.
      mapRef.current?.easeTo({ center: [item.lng, item.lat], padding: camPadding(), duration: 450 })
    }, 120)
  }

  useEffect(() => {
    splitRef.current = split
    mapRef.current?.easeTo({ padding: camPadding(), duration: SPLIT_MS })
  }, [split, topInset, showCarousel, camPadding])

  // A new result set starts the carousel at its front, or at the card still
  // selected, without selecting anything or moving the map: a filter change
  // is not a reason to go anywhere. Load-more keeps the same first card and is
  // left alone.
  const firstId = carouselItems[0]?.id
  useEffect(() => {
    const list = carouselRef.current
    if (!list) return
    swiped.current = false
    const card = live && list.querySelector<HTMLElement>(`[data-id="${CSS.escape(live.id)}"]`)
    if (card) card.scrollIntoView({ inline: 'center', block: 'nearest' })
    else list.scrollTo({ left: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new result set, not a new selection
  }, [firstId])

  // The one exception: turning "near me" on is asking for the closest place.
  // When the re-sorted results land, go to the first: on a phone by bringing
  // its card to the front, which selects it and glides the map to its pin
  // (onCarouselScroll); from md by gliding there directly. Turning it off, or
  // clearing everything, stays put.
  const nearKey = near ? `${near.lat},${near.lng}` : ''
  const lastNear = useRef(nearKey)
  const toFirst = useRef(false)
  useEffect(() => {
    if (lastNear.current === nearKey) return
    lastNear.current = nearKey
    toFirst.current = nearKey !== ''
  }, [nearKey])

  const onCarouselScrollRef = useRef(onCarouselScroll)
  useEffect(() => {
    onCarouselScrollRef.current = onCarouselScroll
  })
  useEffect(() => {
    if (!toFirst.current) return
    const first = items.find((i) => i.lat != null && i.lng != null)
    if (!first || first.lat == null || first.lng == null) return
    toFirst.current = false
    const list = carouselRef.current
    if (!desktop && list) {
      swiped.current = true // stands in for the swipe the user did not have to make
      list.scrollTo({ left: 0, behavior: 'smooth' })
      // Already at the front means no scroll event: settle by hand.
      onCarouselScrollRef.current()
      return
    }
    mapRef.current?.easeTo({ center: [first.lng, first.lat], padding: camPadding(), duration: 600 })
  }, [items, desktop, camPadding])

  if (!token) {
    // No MAPBOX_TOKEN: the grid is still the product. Nothing here throws and
    // mapbox-gl is never constructed.
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-muted p-8 text-center">
        <div className="pointer-events-none absolute inset-x-3 top-3 z-overlay flex items-start justify-end gap-2">
          <ViewToggle locale={locale} view={view} onChange={onView} className="pointer-events-auto" />
        </div>
        <MapPinOff size={30} aria-hidden className="text-text-secondary" />
        <p className="text-[16px] font-extrabold text-text">{t(locale, 'map.disabled.title')}</p>
        <p className="max-w-sm text-[14px] text-text-secondary">{t(locale, 'map.disabled.body')}</p>
      </div>
    )
  }

  return (
    <div
      ref={shellRef}
      className="ef-map relative h-full w-full"
      style={
        {
          // Where Mapbox's own corner controls sit above the bottom edge.
          '--map-bottom-inset': desktop
            ? '0px'
            : `calc(var(--tabbar-space) + ${showCarousel ? '9.25rem' : '0px'})`,
          '--map-right-inset': split ? '40vw' : '0px',
        } as React.CSSProperties
      }
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={{ longitude: CITY.lng, latitude: CITY.lat, zoom: CITY.zoom }}
        // The ref is not there yet when the padding effect first runs.
        onLoad={() => mapRef.current?.getMap().setPadding(camPadding())}
        interactiveLayerIds={[CLUSTER_LAYER, POINT_LAYER]}
        cursor={cursor}
        onMouseEnter={() => setCursor('pointer')}
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          setCursor('grab')
          onHover(null)
        }}
        onMoveEnd={onMoveEnd}
        onClick={onClick}
        reuseMaps
        // The ResizeObserver above already covers window resizes, and is
        // debounced; mapbox's own window listener is not, and would flash.
        trackResize={false}
        style={{ width: '100%', height: '100%' }}
        aria-label={t(locale, 'map.label')}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={false}
          // Its own dot would be a second you-are-here beside ours, and one
          // that outlives "near me". Ours follows `near` alone.
          showUserLocation={false}
          onGeolocate={(e) => onLocate(e.coords.latitude, e.coords.longitude)}
        />

        {near && (
          <Marker longitude={near.lng} latitude={near.lat} anchor="center">
            <span className="ef-me" role="img" aria-label={t(locale, 'map.you')} />
          </Marker>
        )}

        <PointsLayer points={points} hoveredId={hoveredId} selectedId={live?.id ?? null} />

        {live && desktop && (
          <PopupCard
            // Keyed by pin: react-map-gl only ever calls addTo() on mount, so a
            // popup instance that has been closed once can never come back.
            // A fresh instance per selection also replays the entrance.
            key={live.id}
            locale={locale}
            point={live}
            item={items.find((i) => i.id === live.id)}
            onClose={() => setSelected(null)}
          />
        )}
      </Map>

      {/* Everything drawn over the map lives in its uncovered part (see
          .ef-map-visible). pointer-events-none so the map still drags under
          it; each control opts back in. */}
      <div ref={overlayRef} className="ef-map-visible pointer-events-none z-overlay">
        {/* The view toggle, desktop only: on a phone the tab bar is the switch. */}
        <div className="absolute inset-x-3 top-3 hidden items-start justify-end gap-2 md:flex">
          <ViewToggle locale={locale} view={view} onChange={onView} className="pointer-events-auto" />
        </div>

        {pendingBbox && (
          <button
            type="button"
            onClick={() => onSearchArea(pendingBbox)}
            onMouseEnter={() => onHover(null)}
            // ef-fade-enter, not ef-enter: this pill is centred with
            // -translate-x-1/2, and an entrance that animates `transform` would
            // interpolate from translateY(8px) to that and slide it in sideways.
            className="ef-pill ef-pill--lg ef-pill--active ef-fade-enter pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 px-5 shadow-lg md:top-16"
          >
            <Search size={15} aria-hidden />
            {t(locale, 'map.searchArea')}
          </button>
        )}

      {showCarousel && (
        <ul
          ref={carouselRef}
          onScroll={onCarouselScroll}
          onPointerDown={onSwipe}
          onTouchStart={onSwipe}
          onWheel={onSwipe}
          onKeyDown={onSwipe}
          aria-label={t(locale, 'map.label')}
          className="ef-snap pointer-events-auto absolute inset-x-0 bottom-0 gap-3 px-4 pb-4 pt-2"
        >
          {orphan && (
            <li data-id={orphan.id} className="w-[86%] max-w-[22rem]">
              <Link
                href={`/r/${orphan.slug}`}
                className="ef-card ef-press flex h-[7.5rem] flex-col justify-center gap-1 p-4 shadow-lg ring-2 ring-primary"
              >
                <span className="truncate text-[16px] font-bold text-text">{orphan.name}</span>
                <span className="text-[13px] font-semibold text-text-secondary">
                  {priceGlyphs(orphan.priceLevel)}
                </span>
              </Link>
            </li>
          )}
          {carouselItems.map((item) => (
            <li key={item.id} data-id={item.id} className="h-[7.5rem] w-[86%] max-w-[22rem]">
              <RestaurantCard
                item={item}
                locale={locale}
                size="carousel"
                active={live?.id === item.id}
              />
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}
