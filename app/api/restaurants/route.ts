import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const restaurantSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  heaviness: z.coerce.number().min(0).max(100),
  portionSize: z.coerce.number().min(0).max(100),
  fineDining: z.coerce.number().min(0).max(100),
  priceLevel: z.coerce.number().min(1).max(4),
  spiceLevel: z.coerce.number().min(0).max(100).optional().default(50),
  avgPrepTime: z.coerce.number().min(0).optional().default(30),
  cuisines: z.array(z.string()).optional().default([]),
  neighborhood: z.string().optional().default(''),
  websiteUrl: z.string().url().optional().nullable(),
  gmapsUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
  openHours: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'updatedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

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

    const restaurantsWithParsedCuisines = restaurants.map((r) => ({
      ...r,
      cuisines: JSON.parse(r.cuisines || '[]') as string[],
    }))

    return NextResponse.json({ restaurants: restaurantsWithParsedCuisines })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Get restaurants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const data = restaurantSchema.parse(body)

    const restaurant = await prisma.restaurant.create({
      data: {
        ...data,
        cuisines: JSON.stringify(data.cuisines || []),
      },
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
    console.error('Create restaurant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

