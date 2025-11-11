import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scoreAndSort, RecommendationParams } from '@/lib/scoring'
import { z } from 'zod'

// Rate limiting (simple in-memory store - use Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 1000 // requests per window (generous for development)
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  // Skip rate limiting for localhost/development
  if (ip === 'unknown' || ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost')) {
    return true
  }

  const now = Date.now()
  const record = requestCounts.get(ip)

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

const recommendSchema = z.object({
  heavy: z.coerce.number().min(0).max(100).default(50),
  hungry: z.coerce.number().min(0).max(100).default(50),
  finedine: z.coerce.number().min(0).max(100).default(50),
  cuisine: z.string().optional().nullable(),
  max_price: z.coerce.number().min(1).max(4).optional().nullable(),
  fast_only: z.coerce.boolean().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const searchParams = request.nextUrl.searchParams
    const params = recommendSchema.parse({
      heavy: searchParams.get('heavy'),
      hungry: searchParams.get('hungry'),
      finedine: searchParams.get('finedine'),
      cuisine: searchParams.get('cuisine'),
      max_price: searchParams.get('max_price'),
      fast_only: searchParams.get('fast_only'),
    })

    // Fetch all restaurants
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        neighborhood: true,
        heaviness: true,
        portionSize: true,
        fineDining: true,
        priceLevel: true,
        cuisines: true,
        image: true,
        websiteUrl: true,
        gmapsUrl: true,
        phone: true,
        avgPrepTime: true,
      },
    })

    // Parse cuisines and prepare for scoring
    const restaurantsForScoring = restaurants.map((r) => ({
      id: r.id,
      heaviness: r.heaviness,
      portionSize: r.portionSize,
      fineDining: r.fineDining,
      priceLevel: r.priceLevel,
      cuisines: JSON.parse(r.cuisines || '[]') as string[],
      avgPrepTime: r.avgPrepTime,
    }))

    // Score and sort
    const scoringParams: RecommendationParams = {
      wantHeavy: params.heavy,
      wantHungry: params.hungry,
      wantFinedine: params.finedine,
      cuisines: params.cuisine ? params.cuisine.split(',').map((c) => c.trim()) : undefined,
      maxPrice: params.max_price ?? undefined,
      fastOnly: params.fast_only ?? undefined,
    }

    const scored = scoreAndSort(restaurantsForScoring, scoringParams)

    // Map back to full restaurant data
    const restaurantMap = new Map(restaurants.map((r) => [r.id, r]))
    const items = scored.map((scored) => {
      const restaurant = restaurantMap.get(scored.id)!
      return {
        id: restaurant.id,
        score: scored.score,
        name: restaurant.name,
        priceLevel: restaurant.priceLevel,
        cuisines: JSON.parse(restaurant.cuisines || '[]') as string[],
        image: restaurant.image,
        description: restaurant.description,
        neighborhood: restaurant.neighborhood,
        websiteUrl: restaurant.websiteUrl,
        gmapsUrl: restaurant.gmapsUrl,
        phone: restaurant.phone,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: process.env.NODE_ENV === 'development' ? error.errors : undefined
      }, { status: 400 })
    }
    console.error('Recommendation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

