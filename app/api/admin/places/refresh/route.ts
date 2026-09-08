import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { toDTO } from '@/lib/types'
import { placeDetails, toRestaurantDraft, PlacesDisabledError } from '@/lib/places'
import { z } from 'zod'

const refreshSchema = z.object({ placeId: z.string().min(1) })

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { placeId } = refreshSchema.parse(body)

    const existing = await prisma.restaurant.findUnique({ where: { placeId } })
    if (!existing) {
      return NextResponse.json({ error: 'No restaurant is linked to this placeId' }, { status: 404 })
    }

    const place = await placeDetails(placeId)
    const draft = toRestaurantDraft(place)

    // Google-owned columns only. description, the mood axes, editorial
    // priceLevel, image and the editorial `rating` column are the owner's —
    // never overwritten here, only googleRating/googleRatingCount/googlePriceLevel are.
    const restaurant = await prisma.restaurant.update({
      where: { id: existing.id },
      data: {
        openHours: draft.openHours ? JSON.stringify(draft.openHours) : null,
        phone: draft.phone,
        googleRating: draft.googleRating,
        googleRatingCount: draft.googleRatingCount,
        googlePriceLevel: draft.googlePriceLevel,
        placesSyncedAt: new Date(),
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
    if (error instanceof PlacesDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Places refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
