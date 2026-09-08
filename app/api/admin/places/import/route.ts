import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { slugify } from '@/lib/types'
import { saveImage } from '@/lib/storage'
import {
  assertPlacesEnabled,
  placeDetails,
  toRestaurantDraft,
  downloadPhotoMedia,
  PlacesDisabledError,
  type RestaurantDraft,
  type PlacePhoto,
} from '@/lib/places'
import { z } from 'zod'

const importSchema = z.object({
  placeIds: z.array(z.string().min(1)).min(1).max(20),
})

const MAX_PHOTOS_PER_PLACE = 6

type ImportResult =
  | { placeId: string; status: 'ok'; restaurantId: string; name: string }
  | { placeId: string; status: 'skipped'; reason: string }
  | { placeId: string; status: 'failed'; reason: string }

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    // Check the key once, up front — otherwise a missing key would report all
    // 20 places as individually "failed" instead of one clear 503.
    assertPlacesEnabled()

    const body = await request.json()
    const { placeIds } = importSchema.parse(body)

    const results: ImportResult[] = []
    for (const placeId of placeIds) {
      results.push(await importOne(placeId))
    }

    return NextResponse.json({ results })
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
    console.error('Places import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// One bad place must never fail the whole batch — every branch below returns
// a per-place result instead of throwing past importOne().
async function importOne(placeId: string): Promise<ImportResult> {
  try {
    const existing = await prisma.restaurant.findUnique({ where: { placeId }, select: { id: true } })
    if (existing) return { placeId, status: 'skipped', reason: 'Already imported' }

    const place = await placeDetails(placeId)
    const draft = toRestaurantDraft(place)

    const restaurant = await createDraftRestaurant(placeId, draft)
    if (!restaurant) {
      return { placeId, status: 'failed', reason: 'Name already taken and could not be disambiguated' }
    }

    const photoUrls = await importPhotos(restaurant.id, draft.photos)
    if (photoUrls.length > 0) {
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { image: photoUrls[0] } })
    }

    return { placeId, status: 'ok', restaurantId: restaurant.id, name: restaurant.name }
  } catch (error: any) {
    console.error(`Places import failed for ${placeId}:`, error)
    return { placeId, status: 'failed', reason: error?.message ?? 'Unknown error' }
  }
}

/**
 * Restaurant.name and .slug are both @unique, and Prishtina has chains with
 * repeated names (Risk 6). First try the bare name; on a P2002 collision,
 * retry once with the neighborhood appended. Still colliding -> null, and the
 * caller reports that one place as failed rather than throwing.
 */
async function createDraftRestaurant(placeId: string, draft: RestaurantDraft) {
  const attempts = [draft.name, draft.neighborhood ? `${draft.name} (${draft.neighborhood})` : null].filter(
    (n): n is string => Boolean(n)
  )

  for (const name of attempts) {
    try {
      return await prisma.restaurant.create({
        data: {
          name,
          slug: slugify(name),
          source: 'google',
          placeId,
          placesSyncedAt: new Date(),
          placesRaw: draft.placesRaw,
          isActive: false,
          aiStatus: 'none',
          address: draft.address,
          neighborhood: draft.neighborhood,
          lat: draft.lat,
          lng: draft.lng,
          phone: draft.phone,
          websiteUrl: draft.websiteUrl,
          gmapsUrl: draft.gmapsUrl,
          openHours: draft.openHours ? JSON.stringify(draft.openHours) : null,
          googleRating: draft.googleRating,
          googleRatingCount: draft.googleRatingCount,
          googlePriceLevel: draft.googlePriceLevel,
        },
      })
    } catch (error: any) {
      if (error?.code === 'P2002') continue // name or slug collision — try the next disambiguated name
      throw error
    }
  }
  return null
}

async function importPhotos(restaurantId: string, photos: PlacePhoto[]): Promise<string[]> {
  const urls: string[] = []
  for (const photo of photos.slice(0, MAX_PHOTOS_PER_PLACE)) {
    try {
      const buffer = await downloadPhotoMedia(photo.name)
      const { url } = await saveImage(buffer)
      const attributions = (photo.authorAttributions ?? []).map((a) => a.displayName).filter(Boolean)
      await prisma.restaurantPhoto.create({
        data: {
          restaurantId,
          url,
          source: 'google',
          status: 'approved',
          attributions: JSON.stringify(attributions),
        },
      })
      urls.push(url)
    } catch (error) {
      // One failed photo skips, never fails the place.
      console.error(`Places photo download failed for restaurant ${restaurantId}:`, error)
    }
  }
  return urls
}
