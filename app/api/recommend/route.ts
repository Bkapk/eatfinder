import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseFilters } from '@/lib/filters'
import { passesFilters, search } from '@/lib/scoring'
import { toDTO } from '@/lib/types'
import type { RestaurantDTO } from '@/lib/types'
import { serverError } from '@/lib/apiError'
import { getVocab } from '@/lib/vocabDb'
import type { Facets, RecommendResponse } from '@/components/search/types'
import { PAGE_SIZE } from '@/components/search/types'
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

/** The map never gets more than this many pins, however many rows match. */
const MAX_POINTS = 500

function tally(values: string[], into: Record<string, number>) {
  for (const v of values) if (v) into[v] = (into[v] ?? 0) + 1
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // lib/filters.ts is the single parser: the client builds the URL with
    // toSearchParams() and we read it back with parseFilters(), so a shared
    // link and this endpoint cannot disagree.
    const { view: _view, page, ...filters } = parseFilters(request.nextUrl.searchParams)

    // Public endpoint: only ever surface active listings. One restaurant
    // query, no joins — this is what __tests__/api.test.ts mocks. The vocab
    // (~70 rows, only when there is free text) lets "pica" match `pizza`.
    const [rows, terms] = await Promise.all([
      prisma.restaurant.findMany({ where: { isActive: true } }),
      filters.query?.trim() ? getVocab() : Promise.resolve([]),
    ])
    const all: RestaurantDTO[] = rows.map(toDTO)
    const now = new Date()
    const labels: Record<string, string> = {}
    for (const term of terms) labels[term.slug] = `${labels[term.slug] ?? ''} ${term.labelSq} ${term.labelEn}`

    // Full match set, already sorted. `search` slices at `limit`, so ask for
    // everything and page here — `total` has to count matches, not the page.
    const matched = search(all, filters, Number.MAX_SAFE_INTEGER, now, labels)

    const start = (page - 1) * PAGE_SIZE
    const items = matched.slice(start, start + PAGE_SIZE)

    const points = matched
      .filter((r) => r.lat != null && r.lng != null)
      .slice(0, MAX_POINTS)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        lat: r.lat as number,
        lng: r.lng as number,
        priceLevel: r.priceLevel,
      }))

    // Facet counts ignore the three list dimensions they describe, so the chip
    // rail keeps showing what you would get by switching selection rather than
    // collapsing to zero the moment you pick one.
    const facetBase = { ...filters, cuisines: undefined, tags: undefined, neighborhoods: undefined }
    const facets: Facets = { cuisines: {}, tags: {}, neighborhoods: {}, priceLevels: {} }
    for (const r of all) {
      if (!passesFilters(r, facetBase, now, labels)) continue
      tally(r.cuisines, facets.cuisines)
      tally(r.tags, facets.tags)
      tally([r.neighborhood], facets.neighborhoods)
      tally([String(r.priceLevel)], facets.priceLevels)
    }

    const body: RecommendResponse = { items, points, total: matched.length, facets }
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid parameters',
        details: process.env.NODE_ENV === 'development' ? error.errors : undefined
      }, { status: 400 })
    }
    return serverError('recommend', error)
  }
}
