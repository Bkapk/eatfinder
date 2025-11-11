import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RestaurantSchema } from '@/lib/validation'

// GET all restaurants (admin only, with search/filter)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'updatedAt'
    const order = searchParams.get('order') || 'desc'

    const restaurants = await prisma.restaurant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { cuisines: { contains: search } },
              { neighborhood: { contains: search } },
            ],
          }
        : {},
      orderBy: {
        [sortBy]: order,
      },
    })

    return NextResponse.json({ restaurants })
  } catch (error) {
    console.error('GET restaurants error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new restaurant
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = RestaurantSchema.parse(body)

    const restaurant = await prisma.restaurant.create({
      data: validated,
    })

    return NextResponse.json({ restaurant }, { status: 201 })
  } catch (error: any) {
    console.error('POST restaurant error:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Restaurant name already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Invalid data' },
      { status: 400 }
    )
  }
}

