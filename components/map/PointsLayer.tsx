'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

/** 0.2s, and colour and size run on it together. */
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

  /** Where the paint actually is right now, so an interrupted run continues
   *  from the current frame instead of snapping back to a resting value. */
  const at = useRef({ o: 0, r: R })
  const was = useRef<string | null>(null)
  const frame = useRef(0)

  /**
   * Interpolated here rather than by Mapbox. Two of its rules make its own
   * transitions the wrong tool: they apply only to CONSTANT paint properties,
   * not the `['case', ...]` expressions an earlier version used — which is why
   * that one snapped — and the curve is Mapbox's, with no way to hand it a
   * bezier. Driving the numbers directly gets one code path that behaves
   * identically opening and closing, and colour and size on the same clock.
   */
  useEffect(() => {
    const m = map?.getMap()
    if (!m || !m.getLayer(ACTIVE_LAYER)) return

    const lit = shown != null && shown === activeId
    const to = { o: lit ? 1 : 0, r: lit && shown === selectedId ? R_ACTIVE : R }

    // Moving straight from one pin to another swaps which feature the filter
    // matches while the paint is still fully opaque, so the new pin would
    // arrive already lit. Start it from nothing and it fades in like any other.
    const moved = shown !== was.current
    was.current = shown
    const from = moved ? { ...at.current, o: 0 } : { ...at.current }

    const paint = (o: number, r: number) => {
      at.current = { o, r }
      m.setPaintProperty(ACTIVE_LAYER, 'circle-opacity', o)
      m.setPaintProperty(ACTIVE_LAYER, 'circle-stroke-opacity', o)
      m.setPaintProperty(ACTIVE_LAYER, 'circle-radius', r)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(to.o, to.r)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DUR)
      // Ease-out cubic: leaves immediately, settles at the end.
      const e = 1 - (1 - p) ** 3
      paint(from.o + (to.o - from.o) * e, from.r + (to.r - from.r) * e)
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }

    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
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
          layer would only let them disagree. Hover recolours; a selection also
          grows the dot 25%, on the same 200ms as the colour. */}
      <Layer
        id={ACTIVE_LAYER}
        type="circle"
        filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], shown ?? NO_MATCH]]}
        // Starting values only — everything animated is set in the effect
        // above. This object is deliberately constant so react-map-gl never
        // diffs it and resets the paint mid-fade.
        //
        // The three zero durations are required, not tidiness: Mapbox applies
        // a 300ms transition to every paint change by default, so each frame
        // of the loop above would start its own animation toward the next
        // frame's value and the whole thing would smear.
        paint={{
          'circle-color': c.accent,
          'circle-opacity': 0,
          'circle-opacity-transition': { duration: 0 },
          'circle-radius': R,
          'circle-radius-transition': { duration: 0 },
          'circle-stroke-width': 3,
          'circle-stroke-color': c.surface,
          'circle-stroke-opacity': 0,
          'circle-stroke-opacity-transition': { duration: 0 },
        }}
      />
    </Source>
  )
}
