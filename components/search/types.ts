import type { MapPoint, ScoredRestaurant } from '@/lib/types'

/**
 * Counts for the chip rail and the filter panel. Computed over the set that
 * passes every filter EXCEPT the facet's own dimension, so toggling one cuisine
 * chip does not zero the count on every other cuisine chip.
 */
export interface Facets {
  cuisines: Record<string, number>
  tags: Record<string, number>
  neighborhoods: Record<string, number>
  priceLevels: Record<string, number>
}

/** The /api/recommend body. Shared by the route and the client shell. */
export interface RecommendResponse {
  items: ScoredRestaurant[]
  points: MapPoint[]
  total: number
  facets: Facets
}

/** items are paged at this size; `points` is capped at 500 (see the route). */
export const PAGE_SIZE = 24
