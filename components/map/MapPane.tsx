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
  const [pending, setPending] = useState<{ bbox: Bbox; against?: Bbox } | null>(null)
  const [selected, setSelected] = useState<MapPoint | null>(null)
  const [cursor, setCursor] = useState<string>('grab')

  // Derived rather than cleared in an effect: the offer to re-search is only
  // meaningful while the shell is still showing the bounds it was measured
  // against, so the moment those change the pill is simply not rendered.
  const pendingBbox = pending && sameBbox(pending.against, queriedBbox) ? pending.bbox : null

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
    <div className="ef-scroll-fade pointer-events-auto flex max-w-[calc(100%-1rem)] items-center gap-2 overflow-x-auto pb-1">
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
            className={`ef-pill shadow-md ${on ? 'ef-pill--active' : ''}`}
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
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={{ longitude: CITY.lng, latitude: CITY.lat, zoom: CITY.zoom }}
        interactiveLayerIds={[CLUSTER_LAYER, POINT_LAYER]}
        cursor={cursor}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('grab')}
        onMoveEnd={onMoveEnd}
        onClick={onClick}
        reuseMaps
        style={{ width: '100%', height: '100%' }}
        aria-label={t(locale, 'map.label')}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={false}
          onGeolocate={(e) => onLocate(e.coords.latitude, e.coords.longitude)}
        />

        <PointsLayer points={points} hoveredId={hoveredId} />

        {selected && (
          <PopupCard
            locale={locale}
            point={selected}
            item={items.find((i) => i.id === selected.id)}
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
          className="ef-pill ef-pill--active absolute left-1/2 top-16 z-overlay h-10 -translate-x-1/2 px-4 shadow-lg"
        >
          <Search size={15} aria-hidden />
          {t(locale, 'map.searchArea')}
        </button>
      )}
    </div>
  )
}
