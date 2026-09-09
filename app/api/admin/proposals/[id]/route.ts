import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { aiProposalEditSchema, flattenScoringResult, restaurantScoringResultSchema } from '@/lib/aiSchemas'
import { adminServerError } from '@/lib/apiError'
import { z } from 'zod'

const approveBodySchema = z.object({
  payload: aiProposalEditSchema.partial().optional(),
  reviewNote: z.string().max(500).optional().default(''),
})

const rejectBodySchema = z.object({
  reviewNote: z.string().max(500).optional().default(''),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const action = request.nextUrl.searchParams.get('action')

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    const proposal = await prisma.aiProposal.findUnique({ where: { id } })
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }
    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: `Proposal is already ${proposal.status}` }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    if (action === 'reject') {
      const { reviewNote } = rejectBodySchema.parse(body)
      await prisma.aiProposal.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote,
        },
      })
      await prisma.restaurant.update({
        where: { id: proposal.restaurantId },
        data: { aiStatus: 'rejected' },
      })
      return NextResponse.json({ status: 'rejected' })
    }

    // action === 'approve'
    if (!proposal.payload) {
      return NextResponse.json(
        { error: 'This proposal has no payload to approve (it failed to parse).' },
        { status: 400 }
      )
    }

    const { payload: edited, reviewNote } = approveBodySchema.parse(body)

    // AiProposal.payload is written once and never mutated — it stays the
    // model's original answer. The merge of original + owner edits is
    // re-validated through the same rules a manual edit uses before it is
    // ever written to Restaurant.
    const original = flattenScoringResult(restaurantScoringResultSchema.parse(JSON.parse(proposal.payload)))
    const applied = aiProposalEditSchema.parse({ ...original, ...edited })

    await prisma.restaurant.update({
      where: { id: proposal.restaurantId },
      data: {
        description: applied.description,
        heaviness: applied.heaviness,
        portionSize: applied.portionSize,
        fineDining: applied.fineDining,
        spiceLevel: applied.spiceLevel,
        // Always set on approval — an un-enriched restaurant otherwise sits
        // at the default 2 forever and the price filter goes meaningless
        // (docs/PLAN.md, Risk 8).
        priceLevel: applied.priceLevel,
        cuisines: JSON.stringify(applied.cuisines),
        tags: JSON.stringify(applied.tags),
        neighborhood: applied.neighborhood,
        aiStatus: 'approved',
        aiApprovedAt: new Date(),
      },
    })

    await prisma.aiProposal.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote,
        appliedFields: JSON.stringify(applied),
      },
    })

    return NextResponse.json({ status: 'approved', appliedFields: applied })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return adminServerError('admin/proposals/[id]', error)
  }
}
