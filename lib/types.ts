import type { Restaurant } from '@prisma/client'
import { z } from 'zod'

/** Prishtina, Kosovo — map default centre. */
export const CITY = {
  name: 'Prishtina',
  lat: 42.6629,
  lng: 21.1655,
  zoom: 13,
} as const

export const PRICE_LEVELS = [1, 2, 3, 4] as const
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

/** null = closed that day. Otherwise ["HH:MM open", "HH:MM close"]. */
export type OpenHours = Partial<Record<Day, [string, string] | null>>

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validates the OpenHours wire shape at the API boundary. Without this, a
 * free-text value reaches isOpenAt(), which sees unrecognised keys and returns
 * false — "confirmed closed" — and the openNow filter then hides the place.
 * Bad hours must be rejected on write, never silently read as closed.
 */
export const openHoursSchema = z.record(
  z.enum(DAYS),
  z.tuple([z.string().regex(HHMM), z.string().regex(HHMM)]).nullable()
)

/**
 * A restaurant with its JSON-string columns parsed. This is the shape the API
 * returns and the UI consumes — never leak the raw Prisma row past the API.
 */
export interface RestaurantDTO {
  id: string
  slug: string
  name: string
  description: string
  heaviness: number
  portionSize: number
  fineDining: number
  spiceLevel: number
  priceLevel: number
  avgPrepTime: number
  cuisines: string[]
  tags: string[]
  neighborhood: string
  address: string
  lat: number | null
  lng: number | null
  woltUrl: string | null
  websiteUrl: string | null
  instagramUrl: string | null
  gmapsUrl: string | null
  phone: string | null
  image: string | null
  openHours: OpenHours | null
  rating: number | null
  isFeatured: boolean
}

/** A scored search result: the restaurant plus why it surfaced. */
export interface ScoredRestaurant extends RestaurantDTO {
  score: number
  distanceKm: number | null
  isOpenNow: boolean | null
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function toDTO(r: Restaurant): RestaurantDTO {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    heaviness: r.heaviness,
    portionSize: r.portionSize,
    fineDining: r.fineDining,
    spiceLevel: r.spiceLevel,
    priceLevel: r.priceLevel,
    avgPrepTime: r.avgPrepTime,
    cuisines: parseJson<string[]>(r.cuisines, []),
    tags: parseJson<string[]>(r.tags, []),
    neighborhood: r.neighborhood,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    woltUrl: r.woltUrl,
    websiteUrl: r.websiteUrl,
    instagramUrl: r.instagramUrl,
    gmapsUrl: r.gmapsUrl,
    phone: r.phone,
    image: r.image,
    openHours: parseJson<OpenHours | null>(r.openHours, null),
    rating: r.rating,
    isFeatured: r.isFeatured,
  }
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics: Dit' e Nat' -> Dit e Nat
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Is it open at `now` (local time)? null when hours are unknown.
 * Handles past-midnight closing (e.g. ["18:00","02:00"]).
 */
export function isOpenAt(hours: OpenHours | null, now: Date = new Date()): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null

  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const dayIndex = (now.getDay() + 6) % 7 // JS Sunday=0 -> our Monday=0
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const check = (day: Day, mins: number) => {
    const slot = hours[day]
    if (!slot) return false
    const [open, close] = [minutes(slot[0]), minutes(slot[1])]
    return close > open ? mins >= open && mins < close : mins >= open // past-midnight: rest of day
  }

  if (check(DAYS[dayIndex], nowMins)) return true

  // Yesterday's past-midnight slot may still be running.
  const yesterday = DAYS[(dayIndex + 6) % 7]
  const slot = hours[yesterday]
  if (slot) {
    const [open, close] = [minutes(slot[0]), minutes(slot[1])]
    if (close <= open && nowMins < close) return true
  }
  return false
}
