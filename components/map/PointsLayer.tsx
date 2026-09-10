'use client'

import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/mapbox'
import type { MapPoint } from '@/lib/types'

export const CLUSTER_LAYER = 'ef-clusters'
export const POINT_LAYER = 'ef-point'
const COUNT_LAYER = 'ef-cluster-count'
/** No restaurant id can be the empty string, so this filter matches nothing. */
const NO_MATCH = ''

const ACTIVE_LAYER = 'ef-point-active'

/** Resting radius, and the selected radius — 25% larger. */
const R = 8
const R_ACTIVE = 10

/** 0.2s for both, with the growth waiting out the colour change. */
const DUR = 200

/**
 * Mapbox GL cannot read a CSS variable, so the token values are resolved from
 * the document once and handed to the paint properties as literals. That keeps
 * the rule "every colour comes from a token" true for the map too — a dark-mode
 * token swap moves these with everything else.
 */
function tokens() {
  const fallback = { primary: '#0b6bb0', accent: '#d9480f', onPrimary: '#ffffff', surface: '#ffffff' }
  if (typeof window === 'undefined') return fallback
  const s = getComputedStyle(document.documentElement)
  const read = (name: string, d: string) => s.getPropertyValue(name).trim() || d
  return {
    primary: read('--primary', fallback.primary),
    accent: read('--accent', fallback.accent),
    onPrimary: read('--on-primary', fallback.onPrimary),
    surface: read('--surface', fallback.surface),
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
   * The accent layer draws EVERY pin and hides the ones that are not active,
   * rather than filtering down to the one that is. That is the whole reason
   * the colour change can be animated at all: a filter change is instant —
   * the feature simply is or is not there — whereas an opacity that Mapbox
   * evaluates per feature is a paint property it will interpolate on the GPU.
   * Accent fading in over the blue dot beneath it IS the colour transition.
   */
  const isActive = ['in', ['get', 'id'], ['literal', [hoveredId ?? NO_MATCH, selectedId ?? NO_MATCH]]]
  const isSelected = ['==', ['get', 'id'], selectedId ?? NO_MATCH]

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
          'circle-radius': R,
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
        }}
      />
      {/* Hovered or selected, in one layer: both mean "this one", and a second
          layer would only let them disagree.

          Hover only recolours. Selection also grows the dot by 25%, and its
          radius transition is delayed by exactly the length of the fade so the
          two read as one gesture — colour first, then the dot takes its place —
          instead of a single blurry event. */}
      <Layer
        id={ACTIVE_LAYER}
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': c.accent,
          'circle-opacity': ['case', isActive, 1, 0],
          'circle-opacity-transition': { duration: DUR, delay: 0 },
          'circle-radius': ['case', isSelected, R_ACTIVE, R],
          'circle-radius-transition': { duration: DUR, delay: DUR },
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
          'circle-stroke-opacity': ['case', isActive, 1, 0],
          'circle-stroke-opacity-transition': { duration: DUR, delay: 0 },
        }}
      />
    </Source>
  )
}
