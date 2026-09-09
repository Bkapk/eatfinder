import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { aiProposalsLastHour } from '@/lib/ratelimit'
import {
  scoreRestaurant,
  assertAiEnabled,
  AiDisabledError,
  type ScoreRestaurantReview,
  type ScoreRestaurantPhoto,
} from '@/lib/gemini'
import { z } from 'zod'

const enrichSchema = z.object({
  restaurantIds: z.array(z.string().min(1)).min(1).max(10),
})

// Same window/shape as the AiProposal.createdAt-based rule in docs/PLAN.md
// ("Trust and safety boundaries") — refuse once 60 proposals exist in the
// trailing hour, across all restaurants.
const HOURLY_LIMIT = 60
const MAX_PHOTOS = 8

type EnrichResult =
  | { restaurantId: string; status: 'proposed'; proposalId: string }
  | { restaurantId: string; status: 'failed'; proposalId: string; reason: string }
  | { restaurantId: string; status: 'skipped'; reason: string }

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    // Check the key once, up front — a missing key must be one clear 503,
    // not N individually-failed proposals.
    assertAiEnabled()

    const body = await request.json()
    // Accept either {restaurantId} or {restaurantIds:[]}, per docs/PLAN.md.
    const restaurantIds: unknown = Array.isArray(body?.restaurantIds)
      ? body.restaurantIds
      : body?.restaurantId
        ? [body.restaurantId]
        : undefined
    const { restaurantIds: ids } = enrichSchema.parse({ restaurantIds })

    const usedThisHour = await aiProposalsLastHour()
    if (usedThisHour >= HOURLY_LIMIT) {
      return NextResponse.json(
        {
          error: `AI enrichment limit reached — ${HOURLY_LIMIT} proposals per hour. Try again in up to an hour.`,
        },
        { status: 429 }
      )
    }

    const results: EnrichResult[] = []
    for (const restaurantId of ids) {
      results.push(await enrichOne(restaurantId))
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof AiDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('AI enrich error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// One bad restaurant must never fail the whole batch.
async function enrichOne(restaurantId: string): Promise<EnrichResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
  if (!restaurant) {
    return { restaurantId, status: 'skipped', reason: 'Restaurant not found' }
  }

  const pending = await prisma.aiProposal.findFirst({
    where: { restaurantId, status: 'pending' },
    select: { id: true },
  })
  if (pending) {
    return { restaurantId, status: 'skipped', reason: 'Already has a pending proposal' }
  }

  const placesRaw = restaurant.placesRaw ? safeParse(restaurant.placesRaw) : null
  const reviews: ScoreRestaurantReview[] = Array.isArray(placesRaw?.reviews)
    ? placesRaw.reviews
        .slice(0, 10)
        .map((r: any) => ({ text: String(r?.text ?? ''), rating: typeof r?.rating === 'number' ? r.rating : null }))
        .filter((r: ScoreRestaurantReview) => r.text)
    : []

  const photoRows = await prisma.restaurantPhoto.findMany({
    where: { restaurantId, status: 'approved' },
    orderBy: { sortOrder: 'asc' },
    take: MAX_PHOTOS,
    select: { url: true },
  })
  const photos = (await Promise.all(photoRows.map((p) => fetchPhotoBytes(p.url)))).filter(
    (p): p is ScoreRestaurantPhoto => p !== null
  )

  const inputsUsed = [
    photos.length > 0 ? 'photos' : null,
    reviews.length > 0 ? 'reviews' : null,
    restaurant.description ? 'description' : null,
  ].filter((x): x is string => Boolean(x))

  const result = await scoreRestaurant({
    name: restaurant.name,
    description: restaurant.description,
    address: restaurant.address,
    primaryType: placesRaw?.primaryType ?? null,
    types: Array.isArray(placesRaw?.types) ? placesRaw.types : [],
    reviews,
    photos,
  })

  if (result.ok) {
    const proposal = await prisma.aiProposal.create({
      data: {
        restaurantId,
        model: result.model,
        status: 'pending',
        payload: JSON.stringify(result.data),
        overallConfidence: result.data.overallConfidence,
        inputsUsed: JSON.stringify(inputsUsed),
        photoCount: photos.length,
      },
    })
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { aiStatus: 'pending' } })
    return { restaurantId, status: 'proposed', proposalId: proposal.id }
  }

  // Parse failure after the retry — never a 500, never clamped. The
  // restaurant is untouched apart from aiStatus, and stays a draft.
  // rawResponse is always populated, even when the model never returned text
  // at all (e.g. an invalid GEMINI_MODEL id), so the queue always has
  // something to show the operator.
  const proposal = await prisma.aiProposal.create({
    data: {
      restaurantId,
      model: result.model,
      status: 'failed',
      payload: null,
      rawResponse: result.raw ?? `(no response text) ${result.error}`,
      errorMessage: result.error,
      inputsUsed: JSON.stringify(inputsUsed),
      photoCount: photos.length,
    },
  })
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { aiStatus: 'failed' } })
  return { restaurantId, status: 'failed', proposalId: proposal.id, reason: result.error }
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// RestaurantPhoto.url is an opaque storage URL (lib/storage.ts) — either an
// absolute R2 url or a local "/uploads/..." path. A local path needs an
// absolute base to fetch server-side; NEXT_PUBLIC_APP_URL is already the
// declared base for this app (.env.example).
async function fetchPhotoBytes(url: string): Promise<ScoreRestaurantPhoto | null> {
  try {
    const absolute = /^https?:\/\//.test(url)
      ? url
      : `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}${url}`
    const res = await fetch(absolute)
    if (!res.ok) return null
    const data = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    return { data, mimeType }
  } catch {
    return null
  }
}
