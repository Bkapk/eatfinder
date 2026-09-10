'use client'

import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/mapbox'
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

  const activeId = selectedId ?? hoveredId

  /**
   * The id the accent layer is FILTERED to, which is not the same as the id
   * that is active: it holds the last active pin after the pointer leaves, so
   * there is still a feature on screen to fade out. Clearing the filter would
   * delete it mid-fade.
   */
  const [shown, setShown] = useState<string | null>(null)
  // Adjusted during render, not in an effect: React re-runs this component
  // immediately and nothing paints in between, so the filter and the paint
  // effect below always agree on which feature is on screen.
  if (activeId && activeId !== shown) setShown(activeId)

  /**
   * Mapbox does not transition data-driven paint properties — only constant
   * ones. A `['case', ...]` expression is data-driven, which is why the last
   * version snapped instead of fading: the values were right and the
   * interpolation was never going to happen. So the layer is filtered down to
   * one feature and its paint values are plain numbers, set imperatively.
   *
   * The curve is Mapbox's own; there is no way to hand it a bezier. Duration
   * and delay are ours: colour first, then the dot grows into its place.
   */
  useEffect(() => {
    const m = map?.getMap()
    if (!m || !m.getLayer(ACTIVE_LAYER)) return

    const lit = shown != null && shown === activeId
    type Prop = 'circle-opacity' | 'circle-stroke-opacity' | 'circle-radius'
    const set = (prop: Prop, value: number, delay = 0) => {
      // `<property>-transition` is a real paint key that mapbox-gl reads, but
      // the generated style-spec types only list the properties themselves.
      const transition = `${prop}-transition` as Prop
      m.setPaintProperty(ACTIVE_LAYER, transition, { duration: DUR, delay } as never)
      m.setPaintProperty(ACTIVE_LAYER, prop, value)
    }

    set('circle-opacity', lit ? 1 : 0)
    set('circle-stroke-opacity', lit ? 1 : 0)
    // Only a selection grows; a hover just recolours.
    set('circle-radius', lit && shown === selectedId ? R_ACTIVE : R, DUR)
  }, [map, shown, activeId, selectedId])

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
        filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], shown ?? NO_MATCH]]}
        // Starting values only — everything animated is set in the effect
        // above. This object is deliberately constant so react-map-gl never
        // diffs it and resets the paint mid-fade.
        paint={{
          'circle-color': c.accent,
          'circle-opacity': 0,
          'circle-radius': R,
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
          'circle-stroke-opacity': 0,
        }}
      />
    </Source>
  )
}
