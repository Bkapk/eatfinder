import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { toDTO } from '@/lib/types'

const bodySchema = z.object({ restaurantId: z.string().min(1) })

export async function GET() {
  try {
    const user = await requireAuth()
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { restaurant: true },
    })
    return NextResponse.json({
      restaurantIds: favorites.map((f) => f.restaurantId),
      restaurants: favorites.map((f) => toDTO(f.restaurant)),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Get favorites error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { restaurantId } = bodySchema.parse(await request.json())

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, isActive: true },
    })
    if (!restaurant || !restaurant.isActive) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    await prisma.favorite.upsert({
      where: { userId_restaurantId: { userId: user.id, restaurantId } },
      create: { userId: user.id, restaurantId },
      update: {},
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Add favorite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { restaurantId } = bodySchema.parse(await request.json())
    await prisma.favorite.deleteMany({ where: { userId: user.id, restaurantId } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Remove favorite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
