import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { toDTO } from '@/lib/types'
import { adminServerError } from '@/lib/apiError'

const STATUSES = ['pending', 'approved', 'rejected', 'failed'] as const

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const requestedStatus = request.nextUrl.searchParams.get('status')
    const where =
      requestedStatus && (STATUSES as readonly string[]).includes(requestedStatus)
        ? { status: requestedStatus }
        : {}

    const proposals = await prisma.aiProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { restaurant: true, reviewedBy: { select: { username: true } } },
      take: 100,
    })

    return NextResponse.json({
      proposals: proposals.map((p) => ({
        id: p.id,
        restaurantId: p.restaurantId,
        restaurant: toDTO(p.restaurant),
        model: p.model,
        status: p.status,
        payload: p.payload ? JSON.parse(p.payload) : null,
        rawResponse: p.rawResponse,
        errorMessage: p.errorMessage,
        overallConfidence: p.overallConfidence,
        inputsUsed: JSON.parse(p.inputsUsed),
        photoCount: p.photoCount,
        reviewedByUsername: p.reviewedBy?.username ?? null,
        reviewedAt: p.reviewedAt,
        reviewNote: p.reviewNote,
        appliedFields: p.appliedFields ? JSON.parse(p.appliedFields) : null,
        createdAt: p.createdAt,
      })),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return adminServerError('admin/proposals', error)
  }
}
