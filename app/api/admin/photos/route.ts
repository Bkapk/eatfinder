import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { photoToDTO } from '@/lib/types'

const STATUSES = ['pending', 'approved', 'rejected'] as const

/**
 * requireAdmin only. Filterable by status, but "approved" here includes both
 * auto-published and human-approved photos — the owner must be able to see
 * what the AI let through, not just what is still pending (docs/PLAN.md,
 * "Trust and safety boundaries").
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const requestedStatus = request.nextUrl.searchParams.get('status')
    const where =
      requestedStatus && (STATUSES as readonly string[]).includes(requestedStatus)
        ? { status: requestedStatus }
        : {}

    const photos = await prisma.restaurantPhoto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: { select: { id: true, slug: true, name: true } },
        submittedBy: { select: { displayName: true } },
        decidedBy: { select: { username: true } },
      },
      take: 200,
    })

    return NextResponse.json({
      photos: photos.map((p) => ({
        ...photoToDTO(p),
        restaurantSlug: p.restaurant.slug,
        restaurantName: p.restaurant.name,
        submittedByName: p.submittedBy?.displayName || null,
        aiVerdict: p.aiVerdict ? JSON.parse(p.aiVerdict) : null,
        aiConfidence: p.aiConfidence,
        aiReason: p.aiReason,
        wasAutoDecision: p.wasAutoDecision,
        decidedByUsername: p.decidedBy?.username ?? null,
        decidedAt: p.decidedAt,
        decisionNote: p.decisionNote,
      })),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Get admin photos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
