import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { slugify } from '@/lib/types'
import { sampleRestaurants } from '@/prisma/sample-restaurants'

export async function POST() {
  try {
    await requireAuth()

    let created = 0
    for (const restaurant of sampleRestaurants) {
      try {
        await prisma.restaurant.create({
          data: { ...restaurant, slug: slugify(restaurant.name) },
        })
        created++
      } catch (error: any) {
        // Skip if restaurant already exists
        if (error.code !== 'P2002') {
          throw error
        }
      }
    }

    return NextResponse.json({ success: true, count: created })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

