import type { MapPoint, ScoredRestaurant } from '@/lib/types'
import type { Facets } from './types'

/**
 * The last search, held at module scope so it survives client-side navigation
 * (not a reload). Opening a restaurant unmounts the search shell; without this,
 * Back landed on a skeleton, refetched, and dropped you at the top of a list
 * you had scrolled forty places down. With it, Back paints the same list at the
 * same scroll offset in the first frame.
 *
 * `key` is the query minus `view`: grid, list and map are three looks at one
 * result set, so switching between them never needs the network.
 */
export const searchMemory: {
  /** The full query string, for links back to the search from other pages. */
  params: string
  key: string
  data: { items: ScoredRestaurant[]; points: MapPoint[]; facets: Facets; total: number } | null
  scrollY: number
  paneY: number
} = { params: '', key: '', data: null, scrollY: 0, paneY: 0 }

export function resultsKey(params: string): string {
  const sp = new URLSearchParams(params)
  sp.delete('view')
  return sp.toString()
}
