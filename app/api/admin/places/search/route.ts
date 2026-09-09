import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { createMapLimiter } from '@/lib/ratelimit'
import { searchText, searchNearby, PlacesApiError, PlacesDisabledError, type PlaceCandidate } from '@/lib/places'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).optional(),
  mode: z.enum(['text', 'nearby']).default('text'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().min(50).max(50000).optional(),
})

// ponytail: in-process, keyed on admin id — single admin, single VPS process,
// matches the precedent in lib/ratelimit.ts and app/api/auth/login/route.ts.
// Quota guard (Places search cost), not a spend guard.
const SEARCH_LIMIT = 100
const SEARCH_WINDOW_MS = 60 * 60 * 1000
const limiter = createMapLimiter(SEARCH_LIMIT, SEARCH_WINDOW_MS)

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()

    if (!limiter(user.id)) {
      return NextResponse.json(
        {
          error: `Too many place searches — limit is ${SEARCH_LIMIT} per hour. Try again in up to an hour.`,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const input = searchSchema.parse(body)

    if (input.mode === 'nearby' && (input.lat === undefined || input.lng === undefined)) {
      return NextResponse.json(
        { error: 'lat and lng are required for a nearby search' },
        { status: 400 }
      )
    }
    if (input.mode === 'text' && !input.query) {
      return NextResponse.json({ error: 'query is required for a text search' }, { status: 400 })
    }

    const candidates: PlaceCandidate[] =
      input.mode === 'nearby'
        ? await searchNearby({ lat: input.lat as number, lng: input.lng as number, radius: input.radius })
        : await searchText({ query: input.query as string, lat: input.lat, lng: input.lng, radius: input.radius })

    const placeIds = candidates.map((c) => c.placeId).filter(Boolean)
    const existing = placeIds.length
      ? await prisma.restaurant.findMany({
          where: { placeId: { in: placeIds } },
          select: { placeId: true },
        })
      : []
    const importedSet = new Set(existing.map((r) => r.placeId))

    return NextResponse.json({
      candidates: candidates.map((c) => ({ ...c, alreadyImported: importedSet.has(c.placeId) })),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof PlacesDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof PlacesApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Places search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
