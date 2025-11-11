import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scoreAndRankRestaurants } from '@/lib/scoring'
import { ScoringParamsSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Simple in-memory rate limiting for public endpoint
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 30 // 30 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const requests = rateLimitMap.get(ip) || []
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW)
  
  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false
  }
  
  recentRequests.push(now)
  rateLimitMap.set(ip, recentRequests)
  return true
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const rawParams = {
      heavy: searchParams.get('heavy'),
      hungry: searchParams.get('hungry'),
      finedine: searchParams.get('finedine'),
      cuisines: searchParams.get('cuisines'),
      maxPrice: searchParams.get('maxPrice'),
    }

    // Validate parameters
    const validatedParams = ScoringParamsSchema.parse(rawParams)

    // Parse cuisines
    const cuisineFilters = validatedParams.cuisines
      ? validatedParams.cuisines.split(',').map(c => c.trim().toLowerCase())
      : []

    // Fetch all restaurants
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        heaviness: true,
        portionSize: true,
        fineDining: true,
        priceLevel: true,
        cuisines: true,
        avgPrepTime: true,
        description: true,
        image: true,
        websiteUrl: true,
        gmapsUrl: true,
        phone: true,
        neighborhood: true,
        spiceLevel: true,
      },
    })

    // Score and rank
    const scored = scoreAndRankRestaurants(restaurants, {
      wantHeavy: validatedParams.heavy,
      wantHungry: validatedParams.hungry,
      wantFineDine: validatedParams.finedine,
      cuisines: cuisineFilters.length > 0 ? cuisineFilters : undefined,
      maxPrice: validatedParams.maxPrice,
    })

    return NextResponse.json({ items: scored })
  } catch (error: any) {
    console.error('Recommend error:', error)
    console.error('Error details:', error?.issues || error?.message)
    return NextResponse.json(
      { error: 'Invalid parameters', details: error?.message },
      { status: 400 }
    )
  }
}

