'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { t, tVocab, type Locale } from '@/lib/i18n'
import { ViewToggle } from '@/components/search/SortHeader'
import type { Facets } from '@/components/search/types'
import type { Patch } from '@/components/search/SearchBar'
import PointsLayer, { CLUSTER_LAYER, POINT_LAYER } from './PointsLayer'
import PopupCard from './PopupCard'

type Bbox = [number, number, number, number]

/** Quiet time before the canvas is reallocated. Longer than one animation frame,
 *  shorter than anyone notices the stretch. */
const RESIZE_SETTLE_MS = 120

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

/** Top cuisines by facet count — the quick-filter row over the map. */
function quickCuisines(facets: Facets, selected: string[]): string[] {
  const keys = new Set([
    ...Object.keys(facets.cuisines)
      .sort((a, b) => facets.cuisines[b] - facets.cuisines[a])
      .slice(0, 6),
    ...selected,
  ])
  return [...keys]
}

export default function MapPane({
  token,
  locale,
  points,
  items,
  facets,
  selectedCuisines,
  queriedBbox,
  hoveredId,
  view,
  onHover,
  onView,
  onPatch,
  onSearchArea,
  onLocate,
}: {
  token: string | null
  locale: Locale
  points: MapPoint[]
  items: ScoredRestaurant[]
  facets: Facets
  selectedCuisines: string[]
  queriedBbox?: Bbox
  hoveredId: string | null
  view: View
  onHover: (id: string | null) => void
  onView: (v: View) => void
  onPatch: (patch: Patch) => void
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

  // Derived rather than cleared in an effect: the offer to re-search is only
  // meaningful while the shell is still showing the bounds it was measured
  // against, so the moment those change the pill is simply not rendered.
  const pendingBbox = pending && sameBbox(pending.against, queriedBbox) ? pending.bbox : null

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
      timer = window.setTimeout(() => mapRef.current?.resize(), RESIZE_SETTLE_MS)
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
      const b = mapRef.current?.getBounds()
      if (!b) return
      const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
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

  const pills = (
    // scroll-pr-8: a pill focused at the right edge must not sit under the fade.
    <div className="ef-scroll-fade pointer-events-auto flex max-w-[calc(100%-1rem)] scroll-pr-8 items-center gap-2 overflow-x-auto pb-1">
      {quickCuisines(facets, selectedCuisines).map((c) => {
        const on = selectedCuisines.includes(c)
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? selectedCuisines.filter((x) => x !== c) : [...selectedCuisines, c]
              onPatch({ cuisines: next.length ? next : undefined })
            }}
            className={`ef-pill ${on ? 'ef-pill--active' : ''}`}
          >
            {tVocab(locale, 'cuisine', c)}
          </button>
        )
      })}
    </div>
  )

  if (!token) {
    // No MAPBOX_TOKEN: the grid is still the product. Nothing here throws and
    // mapbox-gl is never constructed.
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-muted p-8 text-center">
        <div className="pointer-events-none absolute inset-x-3 top-3 z-overlay flex items-start justify-between gap-2">
          {pills}
          <ViewToggle locale={locale} view={view} onChange={onView} className="pointer-events-auto" />
        </div>
        <MapPinOff size={30} aria-hidden className="text-text-secondary" />
        <p className="text-[16px] font-extrabold text-text">{t(locale, 'map.disabled.title')}</p>
        <p className="max-w-sm text-[14px] text-text-secondary">{t(locale, 'map.disabled.body')}</p>
      </div>
    )
  }

  return (
    <div ref={shellRef} className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={{ longitude: CITY.lng, latitude: CITY.lat, zoom: CITY.zoom }}
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

        {live && (
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

      {/* Overlays. pointer-events-none on the rail so map drag still works
          between the controls. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-overlay flex items-start justify-between gap-2">
        {pills}
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
          className="ef-pill ef-pill--active ef-fade-enter absolute left-1/2 top-16 z-overlay h-10 -translate-x-1/2 px-4 shadow-lg"
        >
          <Search size={15} aria-hidden />
          {t(locale, 'map.searchArea')}
        </button>
      )}
    </div>
  )
}
