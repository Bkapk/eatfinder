'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Map, {
  GeolocateControl,
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

/** The results pane is md:w-[40vw] in SearchShell. */
function splitPadding(split: boolean) {
  return { top: 0, bottom: 0, left: 0, right: split ? window.innerWidth * 0.4 : 0 }
}

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

  // From md the results pane covers the right 40vw of this map rather than
  // shrinking it. Camera padding keeps the pins centred in what is still
  // visible, and easing it glides the map along with the pane's slide.
  const split = desktop && view !== 'map'
  const splitRef = useRef(split)
  useEffect(() => {
    splitRef.current = split
    mapRef.current?.easeTo({ padding: splitPadding(split), duration: SPLIT_MS })
  }, [split])

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
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        mapRef.current?.resize()
        // 40vw moved with the window.
        mapRef.current?.getMap().setPadding(splitPadding(splitRef.current))
      }, RESIZE_SETTLE_MS)
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

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
        mapRef.current?.easeTo({ center: [lng, lat], zoom, duration: 400 })
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
  }, [])

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

  const settle = useRef(0)
  const onCarouselScroll = () => {
    clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
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
      mapRef.current?.easeTo({ center: [item.lng, item.lat], duration: 450 })
    }, 120)
  }

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
          '--map-bottom-inset': showCarousel ? '9.25rem' : '0px',
          '--map-right-inset': split ? '40vw' : '0px',
        } as React.CSSProperties
      }
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={{ longitude: CITY.lng, latitude: CITY.lat, zoom: CITY.zoom, padding: splitPadding(split) }}
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
          onGeolocate={(e) => onLocate(e.coords.latitude, e.coords.longitude)}
        />

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

      {/* The view toggle, desktop only: on a phone the tab bar is the switch.
          pointer-events-none on the row so map drag still works around it. */}
      {/* Overlays live in the visible part of the map, beside the pane. */}
      <div className="ef-map-visible pointer-events-none absolute inset-y-0 left-0 z-overlay">
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
      </div>

      {showCarousel && (
        <ul
          ref={carouselRef}
          onScroll={onCarouselScroll}
          aria-label={t(locale, 'map.label')}
          className="ef-snap absolute inset-x-0 bottom-0 z-overlay gap-3 px-4 pb-4 pt-2"
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
  )
}
