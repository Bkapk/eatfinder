import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { search, SearchFilters } from '@/lib/scoring'
import { toDTO } from '@/lib/types'
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

// Comma-separated list -> string[], the shape SearchFilters wants.
const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))

// z.coerce.boolean() is useless here: Boolean('false') is true. Only the literal
// string 'true' turns a flag on.
const flag = z
  .string()
  .optional()
  .transform((v) => (v === 'true' ? true : undefined))

const recommendSchema = z.object({
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
  openNow: flag,
  woltOnly: flag,
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().min(0).optional(),
})

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Built from the keys actually present: a key that was never sent must stay
    // undefined so zod's .default() fires. Reading a missing key would give null,
    // and Number(null) is 0 — every unset axis would score as "as light/small/
    // casual as possible" rather than neutral.
    const searchParams = request.nextUrl.searchParams
    const params = recommendSchema.parse(
      Object.fromEntries(
        [...searchParams.keys()].map((k) => [k, searchParams.get(k) ?? undefined])
      )
    )

    // Public endpoint: only ever surface active listings.
    const restaurants = await prisma.restaurant.findMany({ where: { isActive: true } })

    // near/maxDistanceKm only bite as a pair — passesFilters ignores a lone `near`.
    const { lat, lng, ...rest } = params
    const filters: SearchFilters = {
      ...rest,
      near: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    }

    const items = search(restaurants.map(toDTO), filters)

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

