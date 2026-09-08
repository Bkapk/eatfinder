import { z } from 'zod'
import { SearchFilters } from './scoring'
import { SORTS, VIEWS } from './types'

/** Everything a search URL carries: the scoring filters plus view state. */
export interface ParsedFilters extends SearchFilters {
  view: (typeof VIEWS)[number]
  page: number
}

// Comma-separated list -> string[]. Same coercion as the existing recommendSchema.
const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))

// z.coerce.boolean() is useless here: Boolean('false') is true. Only the literal
// string 'true' turns a flag on — same rule as app/api/recommend/route.ts.
const flag = z
  .string()
  .optional()
  .transform((v) => (v === 'true' ? true : undefined))

const bboxParam = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined
    const parts = v.split(',').map(Number)
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return undefined
    return parts as [number, number, number, number]
  })

const filtersSchema = z.object({
  heavy: z.coerce.number().min(0).max(100).default(50),
  hungry: z.coerce.number().min(0).max(100).default(50),
  fine: z.coerce.number().min(0).max(100).default(50),
  cuisines: csv,
  tags: csv,
  neighborhoods: csv,
  query: z.string().optional(),
  minPrice: z.coerce.number().min(1).max(4).optional(),
  maxPrice: z.coerce.number().min(1).max(4).optional(),
  maxPrepTime: z.coerce.number().min(0).optional(),
  spiceMax: z.coerce.number().min(0).max(100).optional(),
  openNow: flag,
  woltOnly: flag,
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().min(0).optional(),
  bbox: bboxParam,
  sort: z.enum(SORTS).optional(),
  view: z.enum(VIEWS).default('grid'),
  page: z.coerce.number().min(1).default(1),
})

/**
 * The single source of truth for URL <-> filter state. Imported by the client
 * search shell and by /api/recommend so a shared link and the API agree by
 * construction.
 */
export function parseFilters(searchParams: URLSearchParams): ParsedFilters {
  // Built from the keys actually present: a key that was never sent must stay
  // undefined so zod's .default() fires, rather than reading a literal null.
  const params = filtersSchema.parse(
    Object.fromEntries([...searchParams.keys()].map((k) => [k, searchParams.get(k) ?? undefined]))
  )

  const { lat, lng, ...rest } = params
  return {
    ...rest,
    near: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
  }
}

export function toSearchParams(filters: ParsedFilters): URLSearchParams {
  const sp = new URLSearchParams()

  sp.set('heavy', String(filters.heavy))
  sp.set('hungry', String(filters.hungry))
  sp.set('fine', String(filters.fine))
  if (filters.cuisines?.length) sp.set('cuisines', filters.cuisines.join(','))
  if (filters.tags?.length) sp.set('tags', filters.tags.join(','))
  if (filters.neighborhoods?.length) sp.set('neighborhoods', filters.neighborhoods.join(','))
  if (filters.query) sp.set('query', filters.query)
  if (filters.minPrice !== undefined) sp.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) sp.set('maxPrice', String(filters.maxPrice))
  if (filters.maxPrepTime !== undefined) sp.set('maxPrepTime', String(filters.maxPrepTime))
  if (filters.spiceMax !== undefined) sp.set('spiceMax', String(filters.spiceMax))
  if (filters.openNow) sp.set('openNow', 'true')
  if (filters.woltOnly) sp.set('woltOnly', 'true')
  if (filters.near) {
    sp.set('lat', String(filters.near.lat))
    sp.set('lng', String(filters.near.lng))
  }
  if (filters.maxDistanceKm !== undefined) sp.set('maxDistanceKm', String(filters.maxDistanceKm))
  if (filters.bbox) sp.set('bbox', filters.bbox.join(','))
  if (filters.sort) sp.set('sort', filters.sort)
  sp.set('view', filters.view)
  sp.set('page', String(filters.page))

  return sp
}
