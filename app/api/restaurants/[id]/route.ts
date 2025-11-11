import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const restaurantSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  heaviness: z.coerce.number().min(0).max(100).optional(),
  portionSize: z.coerce.number().min(0).max(100).optional(),
  fineDining: z.coerce.number().min(0).max(100).optional(),
  priceLevel: z.coerce.number().min(1).max(4).optional(),
  spiceLevel: z.coerce.number().min(0).max(100).optional(),
  avgPrepTime: z.coerce.number().min(0).optional(),
  cuisines: z.array(z.string()).optional(),
  neighborhood: z.string().optional(),
  websiteUrl: z.string().url().optional().nullable(),
  gmapsUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
  openHours: z.string().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()

    const { id } = await params
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    return NextResponse.json({
      restaurant: {
        ...restaurant,
        cuisines: JSON.parse(restaurant.cuisines || '[]') as string[],
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Get restaurant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()

    const { id } = await params
    const body = await request.json()
    const data = restaurantSchema.parse(body)

    const updateData: any = { ...data }
    if (data.cuisines) {
      updateData.cuisines = JSON.stringify(data.cuisines)
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      restaurant: {
        ...restaurant,
        cuisines: JSON.parse(restaurant.cuisines || '[]') as string[],
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Update restaurant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()

    const { id } = await params
    await prisma.restaurant.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete restaurant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

