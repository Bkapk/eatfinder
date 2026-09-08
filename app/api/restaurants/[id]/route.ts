import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { toDTO, slugify, openHoursSchema } from '@/lib/types'
import { deleteUpload } from '@/lib/storage'
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
  tags: z.array(z.string()).optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  websiteUrl: z.string().url().optional().nullable(),
  gmapsUrl: z.string().url().optional().nullable(),
  woltUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
  openHours: openHoursSchema.optional().nullable(),
  rating: z.coerce.number().min(0).max(5).optional().nullable(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
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

    return NextResponse.json({ restaurant: toDTO(restaurant) })
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
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags)
    }
    if (data.name) {
      updateData.slug = slugify(data.name)
    }
    // undefined = field not sent, leave it alone. null = explicitly cleared.
    if (data.openHours !== undefined) {
      updateData.openHours = data.openHours ? JSON.stringify(data.openHours) : null
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ restaurant: toDTO(restaurant) })
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
    const restaurant = await prisma.restaurant.findUnique({ where: { id } })
    if (restaurant?.image) {
      await deleteUpload(restaurant.image)
    }
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

