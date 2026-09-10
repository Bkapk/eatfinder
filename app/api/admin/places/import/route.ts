import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminServerError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/auth'
import { slugify } from '@/lib/types'
import { saveImage } from '@/lib/storage'
import { moderatePhoto, AiDisabledError } from '@/lib/gemini'
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

// Google returns up to 10 photos per place and they are worth having: the
// gallery is one of the few things on a listing that is genuinely ours to
// show. The AI pass below is what makes the extra ones safe to take — the
// weak ones sink to the end of the gallery instead of leading it.
const MAX_PHOTOS_PER_PLACE = 12

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
    return adminServerError('places/import', error)
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
  const saved: Array<{ url: string; quality: number; data: Parameters<typeof prisma.restaurantPhoto.create>[0]['data'] }> = []

  for (const [index, photo] of photos.slice(0, MAX_PHOTOS_PER_PLACE).entries()) {
    try {
      const buffer = await downloadPhotoMedia(photo.name)
      const image = await saveImage(buffer)
      const attributions = (photo.authorAttributions ?? []).map((a) => a.displayName).filter(Boolean)

      // The same moderator the community upload path uses, run here for its
      // qualityScore rather than its verdict: these photos are Google's and
      // already published, so the model ranks them, it does not gate them.
      // Falling back to Google's own ordering keeps the import working with
      // no AI key at all.
      const quality = await ratePhoto(restaurantId, buffer, image.ext, MAX_PHOTOS_PER_PLACE - index)

      saved.push({
        url: image.url,
        quality,
        data: {
          restaurantId,
          url: image.url,
          width: image.width,
          height: image.height,
          blurDataUrl: image.blurDataUrl,
          source: 'google',
          status: 'approved',
          attributions: JSON.stringify(attributions),
        },
      })
    } catch (error) {
      // One failed photo skips, never fails the place.
      console.error(`Places photo download failed for restaurant ${restaurantId}:`, error)
    }
  }

  // Best first. sortOrder is what app/r/[slug] orders the gallery by, so this
  // is the whole of "the AI picks which photos lead" — nothing is discarded.
  saved.sort((a, b) => b.quality - a.quality)
  for (const [sortOrder, row] of saved.entries()) {
    await prisma.restaurantPhoto.create({ data: { ...row.data, sortOrder } })
  }

  return saved.map((row) => row.url)
}

const RATE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

/**
 * 0-100 for how good a shot this is of this venue. `fallback` is Google's own
 * position, preserved when the model is off or fails — it is always below the
 * lowest real score a rated photo can beat it with, so an unrated photo never
 * jumps ahead of a rated one on a technicality.
 */
async function ratePhoto(
  restaurantId: string,
  buffer: Buffer,
  ext: string,
  fallback: number
): Promise<number> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, cuisines: true },
    })
    if (!restaurant) return fallback

    const result = await moderatePhoto({
      restaurantName: restaurant.name,
      cuisines: JSON.parse(restaurant.cuisines || '[]'),
      photo: { data: buffer, mimeType: RATE_MIME[ext] ?? 'application/octet-stream' },
      existingPhotos: [],
    })
    if (!result.ok) return fallback

    const v = result.data
    // A photo the moderator would have rejected still gets shown (it is
    // Google's own listing photo) but it is pushed behind everything rated.
    if (v.isNsfw || v.isSpamOrPromotional || !v.depictsFoodOrVenue) return 0
    return v.qualityScore
  } catch (error) {
    if (!(error instanceof AiDisabledError)) {
      console.error(`Photo rating failed for restaurant ${restaurantId}:`, error)
    }
    return fallback
  }
}
