import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { deleteUpload } from '@/lib/storage'

const bodySchema = z.object({
  decisionNote: z.string().max(500).optional().default(''),
})

/**
 * requireAdmin only. The AI's verdict columns (aiVerdict/aiConfidence/aiReason)
 * are never touched here — a human decision always lands in a different set
 * of columns (status/decidedById/decidedAt/decisionNote), so "the AI approved
 * this and the owner later pulled it" stays readable.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const action = request.nextUrl.searchParams.get('action')

    if (action !== 'approve' && action !== 'reject' && action !== 'delete') {
      return NextResponse.json(
        { error: 'action must be "approve", "reject" or "delete"' },
        { status: 400 }
      )
    }

    const photo = await prisma.restaurantPhoto.findUnique({ where: { id } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { decisionNote } = bodySchema.parse(body)

    if (action === 'delete') {
      await deleteUpload(photo.url)
      await prisma.restaurantPhoto.delete({ where: { id } })
      return NextResponse.json({ status: 'deleted' })
    }

    const status = action === 'approve' ? 'approved' : 'rejected'
    await prisma.restaurantPhoto.update({
      where: { id },
      data: { status, decidedById: user.id, decidedAt: new Date(), decisionNote },
    })

    // Never overwrite an owner-chosen hero.
    if (status === 'approved') {
      await prisma.restaurant.updateMany({
        where: { id: photo.restaurantId, OR: [{ image: null }, { image: '' }] },
        data: { image: photo.url },
      })
    }

    return NextResponse.json({ status })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Photo decision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
