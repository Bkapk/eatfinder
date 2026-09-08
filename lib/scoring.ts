import {
  RestaurantDTO,
  ScoredRestaurant,
  haversineKm,
  isOpenAt,
} from './types'

export interface SearchFilters {
  // Mood axes the user is aiming at, 0-100
  heavy: number
  hungry: number
  fine: number

  cuisines?: string[]
  tags?: string[]
  neighborhoods?: string[]
  maxPrice?: number // 1-4
  minPrice?: number // 1-4
  maxPrepTime?: number // minutes
  openNow?: boolean
  woltOnly?: boolean
  query?: string // free-text over name / description / cuisine

  // Distance
  near?: { lat: number; lng: number }
  maxDistanceKm?: number
}

/** Weights per mood axis. Each axis contributes at most this much. */
const AXIS_WEIGHT = 100

/**
 * Closeness on one 0-100 axis, as 0..AXIS_WEIGHT.
 * Exact match scores full; opposite ends score zero.
 */
function axisScore(want: number, actual: number): number {
  return AXIS_WEIGHT * (1 - Math.abs(want - actual) / 100)
}

/**
 * Hard filters. A restaurant failing any of these is not a worse result,
 * it is not a result — so this is a separate pass from scoring.
 */
export function passesFilters(
  r: RestaurantDTO,
  f: SearchFilters,
  now: Date = new Date()
): boolean {
  if (f.maxPrice !== undefined && r.priceLevel > f.maxPrice) return false
  if (f.minPrice !== undefined && r.priceLevel < f.minPrice) return false
  if (f.maxPrepTime !== undefined && r.avgPrepTime > f.maxPrepTime) return false
  if (f.woltOnly && !r.woltUrl) return false

  // Unknown hours must not silently vanish under "open now" — only a
  // confirmed-closed restaurant is excluded.
  if (f.openNow && isOpenAt(r.openHours, now) === false) return false

  if (f.cuisines?.length) {
    const want = f.cuisines.map((c) => c.toLowerCase())
    if (!r.cuisines.some((c) => want.includes(c.toLowerCase()))) return false
  }

  if (f.tags?.length) {
    const want = f.tags.map((t) => t.toLowerCase())
    if (!r.tags.some((t) => want.includes(t.toLowerCase()))) return false
  }

  if (f.neighborhoods?.length) {
    const want = f.neighborhoods.map((n) => n.toLowerCase())
    if (!want.includes(r.neighborhood.toLowerCase())) return false
  }

  if (f.query?.trim()) {
    const q = f.query.trim().toLowerCase()
    const haystack = [r.name, r.description, r.neighborhood, ...r.cuisines, ...r.tags]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(q)) return false
  }

  if (f.near && f.maxDistanceKm !== undefined) {
    if (r.lat == null || r.lng == null) return false
    if (haversineKm(f.near, { lat: r.lat, lng: r.lng }) > f.maxDistanceKm) return false
  }

  return true
}

/**
 * Soft score, higher is better. Mood match dominates; everything else nudges.
 * Max mood contribution is 3 * AXIS_WEIGHT = 300.
 */
export function calculateScore(
  r: RestaurantDTO,
  f: SearchFilters,
  now: Date = new Date()
): number {
  let score =
    axisScore(f.heavy, r.heaviness) +
    axisScore(f.hungry, r.portionSize) +
    axisScore(f.fine, r.fineDining)

  // Editorial rating: up to +25, so a great match still beats a mediocre one
  // that happens to be well rated.
  if (r.rating != null) score += (r.rating / 5) * 25

  if (r.isFeatured) score += 10

  // Closer is better: +30 at the doorstep decaying to 0 at 5km.
  if (f.near && r.lat != null && r.lng != null) {
    const km = haversineKm(f.near, { lat: r.lat, lng: r.lng })
    score += 30 * Math.max(0, 1 - km / 5)
  }

  // Open right now is worth a real nudge — a closed restaurant helps nobody
  // who is hungry, but it is not disqualifying unless they filtered for it.
  if (isOpenAt(r.openHours, now) === true) score += 15

  // Orderable right now.
  if (r.woltUrl) score += 5

  return Math.round(score * 100) / 100
}

export function search(
  restaurants: RestaurantDTO[],
  filters: SearchFilters,
  limit = 24,
  now: Date = new Date()
): ScoredRestaurant[] {
  return restaurants
    .filter((r) => passesFilters(r, filters, now))
    .map((r) => ({
      ...r,
      score: calculateScore(r, filters, now),
      distanceKm:
        filters.near && r.lat != null && r.lng != null
          ? Math.round(haversineKm(filters.near, { lat: r.lat, lng: r.lng }) * 100) / 100
          : null,
      isOpenNow: isOpenAt(r.openHours, now),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
