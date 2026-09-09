import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { photoToDTO } from '@/lib/types'
import { adminServerError } from '@/lib/apiError'

const STATUSES = ['pending', 'approved', 'rejected'] as const

/**
 * requireAdmin only. Filterable by status and by restaurantId — the latter is
 * what PhotoGalleryManager passes to show ONE restaurant's gallery. Ignoring it
 * used to return the newest 200 photos across every restaurant, so every
 * gallery rendered the same mixed set.
 *
 * Filterable by status, but "approved" here includes both
 * auto-published and human-approved photos — the owner must be able to see
 * what the AI let through, not just what is still pending (docs/PLAN.md,
 * "Trust and safety boundaries").
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const requestedStatus = request.nextUrl.searchParams.get('status')
    const restaurantId = request.nextUrl.searchParams.get('restaurantId')

    const where: { status?: string; restaurantId?: string } = {}
    if (requestedStatus && (STATUSES as readonly string[]).includes(requestedStatus)) {
      where.status = requestedStatus
    }
    if (restaurantId) {
      where.restaurantId = restaurantId
    }

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
    return adminServerError('admin/photos', error)
  }
}
