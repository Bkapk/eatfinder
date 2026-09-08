import { CITY, DAYS, openHoursSchema, type Day, type OpenHours } from './types'

// Google Places API (New) v1. Auth is a plain header, no SDK — see fetch calls below.
// GOOGLE_PLACES_API_KEY is read lazily inside apiKey(), never at module load, so a
// missing key fails the request that needs it rather than the build (same precedent
// as secret() in lib/auth.ts).
const PLACES_BASE = 'https://places.googleapis.com/v1'

export class PlacesDisabledError extends Error {}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new PlacesDisabledError('Google Places is disabled: GOOGLE_PLACES_API_KEY is not set')
  }
  return key
}

/** Throws PlacesDisabledError up front, before a route does 20 places' worth of work. */
export function assertPlacesEnabled(): void {
  apiKey()
}

// ---------------------------------------------------------------------------
// Raw Google shapes (only the fields we ever request)
// ---------------------------------------------------------------------------

interface GoogleAddressComponent {
  longText: string
  shortText: string
  types: string[]
}

interface GoogleLatLng {
  latitude: number
  longitude: number
}

interface GooglePeriodPoint {
  day: number // 0 = Sunday .. 6 = Saturday
  hour: number
  minute: number
}

interface GooglePeriod {
  open?: GooglePeriodPoint
  close?: GooglePeriodPoint
}

export interface PlacePhoto {
  name: string // "places/xxx/photos/yyy" — pass straight to downloadPhotoMedia()
  widthPx?: number
  heightPx?: number
  authorAttributions?: Array<{ displayName: string; uri?: string; photoUri?: string }>
}

interface GoogleReview {
  text?: { text: string }
  rating?: number
  authorAttribution?: { displayName: string }
  publishTime?: string
}

interface GooglePlace {
  id?: string
  displayName?: { text: string }
  formattedAddress?: string
  addressComponents?: GoogleAddressComponent[]
  location?: GoogleLatLng
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  types?: string[]
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  regularOpeningHours?: { periods?: GooglePeriod[] }
  photos?: PlacePhoto[]
  reviews?: GoogleReview[]
}

// ---------------------------------------------------------------------------
// Our shapes
// ---------------------------------------------------------------------------

/** What the admin Discover grid renders. Search persists none of this. */
export interface PlaceCandidate {
  placeId: string // "places/ChIJ..." resource name — matches Restaurant.placeId
  name: string
  address: string
  lat: number | null
  lng: number | null
  priceLevel: number | null // mapped 1-4, our scale
  rating: number | null
  ratingCount: number | null
  primaryType: string | null
}

/** What toRestaurantDraft() hands the import route — Prisma-column-shaped, not a DTO. */
export interface RestaurantDraft {
  name: string
  address: string
  neighborhood: string
  lat: number | null
  lng: number | null
  phone: string | null
  websiteUrl: string | null
  gmapsUrl: string | null
  openHours: OpenHours | null
  googleRating: number | null
  googleRatingCount: number | null
  googlePriceLevel: number | null
  photos: PlacePhoto[]
  /** JSON string: the trimmed payload Phase 4's Gemini enrichment reads reviews from. */
  placesRaw: string
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function callPlaces<T>(url: string, fieldMask: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Places API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

// Candidate list fields only — no photos, no reviews, no opening hours. Those are
// Pro/Enterprise-tier fields and search results are thrown away, never persisted,
// so there is no reason to pay for them until a place is actually imported.
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
].join(',')

// Full record for one place actually being imported: contact/links, hours (mapped
// to our OpenHours shape), photos to re-host, and reviews for Phase 4's Gemini
// scoring. This is the one call in this module allowed to be this wide, because it
// only runs per place the admin ticked, not per search result.
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'priceLevel',
  'rating',
  'userRatingCount',
  'primaryType',
  'types',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'regularOpeningHours',
  'photos',
  'reviews',
].join(',')

export interface SearchTextInput {
  query: string
  lat?: number
  lng?: number
  radius?: number
}

export async function searchText(input: SearchTextInput): Promise<PlaceCandidate[]> {
  const center =
    input.lat !== undefined && input.lng !== undefined
      ? { latitude: input.lat, longitude: input.lng }
      : { latitude: CITY.lat, longitude: CITY.lng }

  const data = await callPlaces<{ places?: GooglePlace[] }>(
    `${PLACES_BASE}/places:searchText`,
    SEARCH_FIELD_MASK,
    {
      textQuery: input.query,
      maxResultCount: 20,
      locationBias: { circle: { center, radius: input.radius ?? 5000 } },
    }
  )
  return (data.places ?? []).map(toCandidate).filter((c) => c.placeId)
}

export interface SearchNearbyInput {
  lat: number
  lng: number
  radius?: number
}

export async function searchNearby(input: SearchNearbyInput): Promise<PlaceCandidate[]> {
  const data = await callPlaces<{ places?: GooglePlace[] }>(
    `${PLACES_BASE}/places:searchNearby`,
    SEARCH_FIELD_MASK,
    {
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: input.lat, longitude: input.lng },
          radius: input.radius ?? 1500,
        },
      },
    }
  )
  return (data.places ?? []).map(toCandidate).filter((c) => c.placeId)
}

/** `placeId` is the stored resource name, e.g. "places/ChIJ...". */
export async function placeDetails(placeId: string): Promise<GooglePlace> {
  return callPlaces<GooglePlace>(`${PLACES_BASE}/${placeId}`, DETAILS_FIELD_MASK)
}

// Media bytes, not JSON fields — the Photo (New) endpoint takes no field mask and
// documents `key` as a query param rather than the X-Goog-Api-Key header.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // maxWidthPx keeps normal photos well under this

export async function downloadPhotoMedia(photoName: string, maxWidthPx = 1200): Promise<Buffer> {
  const url = `${PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Places photo media ${res.status}`)

  const declared = res.headers.get('content-length')
  if (declared && Number(declared) > MAX_PHOTO_BYTES) {
    throw new Error('Photo exceeds size cap')
  }
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_PHOTO_BYTES) throw new Error('Photo exceeds size cap')
    return buf
  }

  // Stream and cap: a missing/wrong Content-Length header must not let an
  // oversized response get buffered whole before we notice.
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_PHOTO_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error('Photo exceeds size cap')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapPriceLevel(level?: string): number | null {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1
    case 'PRICE_LEVEL_MODERATE':
      return 2
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4
    default:
      return null
  }
}

function toCandidate(p: GooglePlace): PlaceCandidate {
  return {
    placeId: p.id ? `places/${p.id}` : '',
    name: p.displayName?.text ?? '(unnamed)',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    priceLevel: mapPriceLevel(p.priceLevel),
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    primaryType: p.primaryType ?? null,
  }
}

function extractNeighborhood(components?: GoogleAddressComponent[]): string {
  if (!components) return ''
  const hit = components.find(
    (c) =>
      c.types.includes('sublocality') ||
      c.types.includes('sublocality_level_1') ||
      c.types.includes('neighborhood')
  )
  return hit?.longText ?? ''
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Google's periods -> our OpenHours. Validated through openHoursSchema before
 * being handed back — isOpenAt() reads an unrecognised/malformed value as
 * "confirmed closed", so a shape that doesn't parse must be dropped (return
 * null), never stored raw.
 *
 * ponytail: a day with two split periods (lunch/dinner) keeps only the first
 * one seen — our OpenHours shape has room for one range per day. Upgrade if a
 * split-hours venue actually gets imported and looks wrong.
 */
function mapOpeningHours(periods?: GooglePeriod[]): OpenHours | null {
  if (!periods || periods.length === 0) return null

  // 24/7 venues: Google returns a single period, open Sunday 00:00, no close.
  if (periods.length === 1 && periods[0].open && !periods[0].close) {
    const allOpen: OpenHours = {}
    for (const day of DAYS) allOpen[day] = ['00:00', '23:59']
    const parsed = openHoursSchema.safeParse(allOpen)
    return parsed.success ? parsed.data : null
  }

  const hours: OpenHours = {}
  for (const period of periods) {
    if (!period.open || !period.close) continue
    const dayIndex = ((period.open.day + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6
    const day = DAYS[dayIndex] as Day
    if (hours[day]) continue // first period for this day wins, see comment above

    const open = `${pad2(period.open.hour)}:${pad2(period.open.minute)}`
    const close = `${pad2(period.close.hour)}:${pad2(period.close.minute)}`
    hours[day] = [open, close]
  }

  if (Object.keys(hours).length === 0) return null
  const parsed = openHoursSchema.safeParse(hours)
  return parsed.success ? parsed.data : null
}

export function toRestaurantDraft(place: GooglePlace): RestaurantDraft {
  const trimmed = {
    id: place.id ?? null,
    displayName: place.displayName?.text ?? null,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    // Up to 10 review texts — this is what Phase 4's Gemini scoring reads.
    reviews: (place.reviews ?? []).slice(0, 10).map((r) => ({
      text: r.text?.text ?? '',
      rating: r.rating ?? null,
      author: r.authorAttribution?.displayName ?? null,
      publishTime: r.publishTime ?? null,
    })),
  }

  return {
    name: place.displayName?.text ?? 'Unknown',
    address: place.formattedAddress ?? '',
    neighborhood: extractNeighborhood(place.addressComponents),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    phone: place.internationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    gmapsUrl: place.googleMapsUri ?? null,
    openHours: mapOpeningHours(place.regularOpeningHours?.periods),
    googleRating: place.rating ?? null,
    googleRatingCount: place.userRatingCount ?? null,
    googlePriceLevel: mapPriceLevel(place.priceLevel),
    photos: place.photos ?? [],
    placesRaw: JSON.stringify(trimmed),
  }
}
