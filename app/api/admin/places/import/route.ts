import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminServerError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/auth'
import { slugify } from '@/lib/types'
import { saveImage } from '@/lib/storage'
import { recordSystemEvent } from '@/lib/systemEvents'
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

const importSchema = z.object({ placeIds: z.array(z.string().min(1)).length(1) })

// Google returns at most 10. Keep its ordering: doing one Gemini call for each
// photo made imports take minutes and could outlive the proxy request timeout.
const MAX_PHOTOS_PER_PLACE = 10

type ImportResult =
  | { placeId: string; status: 'ok'; restaurantId: string; name: string; photoCount: number; photoFailures: number }
  | { placeId: string; status: 'skipped'; reason: string }
  | { placeId: string; status: 'failed'; reason: string }

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    // Each request imports one place, so a batch cannot exceed the proxy timeout.
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
    return adminServerError('places/import', error)
  }
}

// One bad place must never fail the whole batch — every branch below returns
// a per-place result instead of throwing past importOne().
async function importOne(placeId: string): Promise<ImportResult> {
  try {
    const existing = await prisma.restaurant.findUnique({
      where: { placeId },
      select: { id: true, name: true, image: true, _count: { select: { photos: true } } },
    })
    if (existing && existing._count.photos > 0) {
      return { placeId, status: 'skipped', reason: 'Already imported with photos' }
    }

    const place = await placeDetails(placeId)
    const draft = toRestaurantDraft(place)

    const restaurant = existing ?? (await createDraftRestaurant(placeId, draft))
    if (!restaurant) {
      return { placeId, status: 'failed', reason: 'Name already taken and could not be disambiguated' }
    }

    const photoResult = await importPhotos(restaurant.id, draft.photos)
    if (photoResult.urls.length > 0 && !restaurant.image) {
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { image: photoResult.urls[0] } })
    }

    await recordSystemEvent(
      'places-import',
      photoResult.urls.length > 0 ? 'info' : 'warning',
      `${existing ? 'Repaired' : 'Imported'} ${restaurant.name}: ${photoResult.urls.length} photos`,
      `${photoResult.failures} photo failures${draft.photos.length === 0 ? '; Google returned no photos' : ''}`
    )
    return {
      placeId,
      status: 'ok',
      restaurantId: restaurant.id,
      name: restaurant.name,
      photoCount: photoResult.urls.length,
      photoFailures: photoResult.failures,
    }
  } catch (error: any) {
    console.error(`Places import failed for ${placeId}:`, error)
    await recordSystemEvent('places-import', 'error', `Import failed for ${placeId}`, safeError(error))
    return { placeId, status: 'failed', reason: error?.message ?? 'Unknown error' }
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500)
  return 'Unknown error'
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

async function importPhotos(restaurantId: string, photos: PlacePhoto[]): Promise<{ urls: string[]; failures: number }> {
  const chosen = photos.slice(0, MAX_PHOTOS_PER_PLACE)
  const urls: string[] = []
  let failures = 0

  // Three downloads at a time make the import quick without a burst of ten
  // requests to Google. Persist in Google's original order afterward.
  for (let start = 0; start < chosen.length; start += 3) {
    const batch = await Promise.all(chosen.slice(start, start + 3).map(async (photo, offset) => {
      try {
        const image = await saveImage(await downloadPhotoMedia(photo.name))
        return { image, sortOrder: start + offset, attributions: (photo.authorAttributions ?? []).map((a) => a.displayName).filter(Boolean) }
      } catch (error) {
        failures++
        const detail = safeError(error)
        console.error(`Places photo failed for restaurant ${restaurantId}:`, detail)
        await recordSystemEvent('places-photo', 'error', `Photo ${start + offset + 1} failed for restaurant ${restaurantId}`, detail)
        return null
      }
    }))
    for (const row of batch) {
      if (!row) continue
      await prisma.restaurantPhoto.create({
        data: {
          restaurantId,
          url: row.image.url,
          width: row.image.width,
          height: row.image.height,
          blurDataUrl: row.image.blurDataUrl,
          source: 'google',
          status: 'approved',
          attributions: JSON.stringify(row.attributions),
          sortOrder: row.sortOrder,
        },
      })
      urls.push(row.image.url)
    }
  }
  return { urls, failures }
}
