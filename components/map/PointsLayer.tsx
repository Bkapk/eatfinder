'use client'

import { useEffect, useMemo } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/mapbox'
import type { MapPoint } from '@/lib/types'

export const CLUSTER_LAYER = 'ef-clusters'
export const POINT_LAYER = 'ef-point'
const COUNT_LAYER = 'ef-cluster-count'
/** No restaurant id can be the empty string, so this filter matches nothing. */
const NO_MATCH = ''

const ACTIVE_LAYER = 'ef-point-active'
const PLATE_LAYER = 'ef-point-plate'

/** Where the rim comes to rest, and how far above the pin it starts. */
const PLATE_R = 17
const PLATE_DROP = 13

/**
 * Mapbox GL cannot read a CSS variable, so the token values are resolved from
 * the document once and handed to the paint properties as literals. That keeps
 * the rule "every colour comes from a token" true for the map too — a dark-mode
 * token swap moves these with everything else.
 */
function tokens() {
  const fallback = { primary: '#0b6bb0', accent: '#d9480f', onPrimary: '#ffffff', surface: '#ffffff' }
  if (typeof window === 'undefined') return { ...fallback, durPanel: 320 }
  const s = getComputedStyle(document.documentElement)
  const read = (name: string, d: string) => s.getPropertyValue(name).trim() || d
  return {
    primary: read('--primary', fallback.primary),
    accent: read('--accent', fallback.accent),
    onPrimary: read('--on-primary', fallback.onPrimary),
    surface: read('--surface', fallback.surface),
    // Same trick for the motion ladder: "320ms" -> 320.
    durPanel: parseFloat(read('--dur-panel', '320ms')) || 320,
  }
}

export default function PointsLayer({
  points,
  hoveredId,
  selectedId,
}: {
  points: MapPoint[]
  hoveredId: string | null
  selectedId: string | null
}) {
  const c = useMemo(() => tokens(), [])
  const { current: map } = useMap()

  const data = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { id: p.id, slug: p.slug, name: p.name, priceLevel: p.priceLevel },
      })),
    }),
    [points]
  )

  /**
   * "The plate lands." Selecting a pin drops an ember rim onto it from above —
   * it settles inward and stays as the marker of what the popup is about,
   * rather than radiating outward and dying like every pulse on every map.
   * It runs once, on exactly one feature, so density and point count cost
   * nothing; a rejected alternative was animating the whole point layer.
   *
   * Mapbox interpolates paint properties itself, on the GPU — there is no
   * per-frame JS here and no way to hand it `--ease`, so the duration comes
   * from the token and the curve is Mapbox's own.
   */
  useEffect(() => {
    const m = map?.getMap()
    if (!m || !selectedId || !m.getLayer(PLATE_LAYER)) return

    const set = (radius: number, opacity: number, duration: number) => {
      m.setPaintProperty(PLATE_LAYER, 'circle-radius-transition', { duration, delay: 0 })
      m.setPaintProperty(PLATE_LAYER, 'circle-stroke-opacity-transition', { duration, delay: 0 })
      m.setPaintProperty(PLATE_LAYER, 'circle-radius', radius)
      m.setPaintProperty(PLATE_LAYER, 'circle-stroke-opacity', opacity)
    }

    // Resting state is the visible one: no motion preference means the rim is
    // simply there, never a pin left wearing an invisible ring.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set(PLATE_R, 1, 0)
      return
    }

    set(PLATE_R + PLATE_DROP, 0, 0)
    const frame = requestAnimationFrame(() => set(PLATE_R, 1, c.durPanel))
    return () => cancelAnimationFrame(frame)
  }, [map, selectedId, c.durPanel])

  return (
    <Source
      id="ef-places"
      type="geojson"
      data={data}
      // Native Mapbox GL clustering — no supercluster dependency.
      cluster
      clusterMaxZoom={14}
      clusterRadius={48}
    >
      <Layer
        id={CLUSTER_LAYER}
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': c.primary,
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
        }}
      />
      <Layer
        id={COUNT_LAYER}
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        }}
        paint={{ 'text-color': c.onPrimary }}
      />
      <Layer
        id={POINT_LAYER}
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': c.primary,
          'circle-radius': 8,
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
        }}
      />
      {/* The rim, under the dot. Fill is fully transparent so it never dims the
          map beneath it and never becomes a second click target. */}
      <Layer
        id={PLATE_LAYER}
        type="circle"
        filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], selectedId ?? NO_MATCH]]}
        paint={{
          'circle-color': c.accent,
          'circle-opacity': 0,
          'circle-radius': PLATE_R,
          'circle-stroke-width': 2,
          'circle-stroke-color': c.accent,
          'circle-stroke-opacity': 1,
        }}
      />
      {/* Hovered or selected, in one layer: both mean "this one", and a second
          layer would only let them disagree. A filter that can never match is
          cheaper than mounting and unmounting a layer on every mouse move.

          Deliberately the same radius and stroke as POINT_LAYER — the pin's
          silhouette is also its hit area, and a halo wider than the thing you
          can click is how a click on a highlighted pin misses. Only the colour
          changes. */}
      <Layer
        id={ACTIVE_LAYER}
        type="circle"
        filter={[
          'all',
          ['!', ['has', 'point_count']],
          ['in', ['get', 'id'], ['literal', [hoveredId ?? NO_MATCH, selectedId ?? NO_MATCH]]],
        ]}
        paint={{
          'circle-color': c.accent,
          'circle-radius': 8,
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
        }}
      />
    </Source>
  )
}
