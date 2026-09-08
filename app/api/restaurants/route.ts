import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { toDTO, slugify, openHoursSchema } from '@/lib/types'
import { z } from 'zod'

const restaurantSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  heaviness: z.coerce.number().min(0).max(100),
  portionSize: z.coerce.number().min(0).max(100),
  fineDining: z.coerce.number().min(0).max(100),
  priceLevel: z.coerce.number().min(1).max(4),
  spiceLevel: z.coerce.number().min(0).max(100).optional().default(0),
  avgPrepTime: z.coerce.number().min(0).optional().default(30),
  cuisines: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  neighborhood: z.string().optional().default(''),
  address: z.string().optional().default(''),
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
  isActive: z.coerce.boolean().optional().default(true),
  isFeatured: z.coerce.boolean().optional().default(false),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Whitelisted: orderBy is interpolated straight into the Prisma query, so an
    // unknown column or direction is a reachable 500 on an authenticated endpoint.
    const SORTABLE = ['name', 'priceLevel', 'rating', 'neighborhood', 'createdAt', 'updatedAt']

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const requestedSort = searchParams.get('sortBy') || 'updatedAt'
    const sortBy = SORTABLE.includes(requestedSort) ? requestedSort : 'updatedAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { neighborhood: { contains: search } },
        { cuisines: { contains: search } },
      ]
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    })

    return NextResponse.json({ restaurants: restaurants.map(toDTO) })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Get restaurants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const data = restaurantSchema.parse(body)

    const restaurant = await prisma.restaurant.create({
      data: {
        ...data,
        slug: slugify(data.name),
        cuisines: JSON.stringify(data.cuisines || []),
        tags: JSON.stringify(data.tags || []),
        openHours: data.openHours ? JSON.stringify(data.openHours) : null,
      },
    })

    return NextResponse.json({ restaurant: toDTO(restaurant) })
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
    console.error('Create restaurant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

