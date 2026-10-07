import { DAYS, type Day, type OpenHours } from '@/lib/types'
import type { VocabKind } from '@/lib/vocab'

/** The editable shape of a restaurant in the admin form. */
export interface RestaurantFormValues {
  name: string
  description: string
  heaviness: number
  portionSize: number
  fineDining: number
  priceLevel: number
  avgPrepTime: number
  cuisines: string[]
  tags: string[]
  neighborhood: string
  address: string
  websiteUrl: string
  gmapsUrl: string
  woltUrl: string
  instagramUrl: string
  phone: string
  image: string
  lat: string
  lng: string
  openHours: OpenHours | null
  rating: string
  isFeatured: boolean
  isActive: boolean
}

export interface FieldChange {
  key: string
  label: string
  from: string
  to: string
}

/** Field labels, shared by the diff and by server validation messages. */
export const FIELD_LABELS: Record<keyof RestaurantFormValues, string> = {
  name: 'Name',
  description: 'Description',
  heaviness: 'Heaviness',
  portionSize: 'Portion size',
  fineDining: 'Fine dining',
  priceLevel: 'Price level',
  avgPrepTime: 'Avg prep time',
  cuisines: 'Cuisines',
  tags: 'Tags',
  neighborhood: 'Neighborhood',
  address: 'Address',
  websiteUrl: 'Website URL',
  gmapsUrl: 'Google Maps URL',
  woltUrl: 'Wolt URL',
  instagramUrl: 'Instagram URL',
  phone: 'Phone',
  image: 'Hero image',
  lat: 'Latitude',
  lng: 'Longitude',
  openHours: 'Opening hours',
  rating: 'Editorial rating',
  isFeatured: 'Featured',
  isActive: 'Status',
}

export const DAY_NAMES: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const EMPTY = '—'

type Label = (kind: VocabKind, slug: string) => string

function show(key: keyof RestaurantFormValues, v: unknown, label: Label): string {
  if (key === 'priceLevel') return '$'.repeat(Number(v))
  if (key === 'isActive') return v ? 'Published' : 'Draft'
  if (key === 'isFeatured') return v ? 'Yes' : 'No'
  if (key === 'cuisines' || key === 'tags') {
    const list = (v as string[]).map((s) => label(key === 'cuisines' ? 'cuisine' : 'tag', s))
    return list.length ? list.join(', ') : EMPTY
  }
  if (key === 'neighborhood') return v ? label('neighborhood', String(v)) : EMPTY
  if (key === 'image') return v ? 'Image set' : EMPTY
  if (key === 'avgPrepTime') return `${v} min`
  const s = String(v ?? '').trim()
  return s || EMPTY
}

function slot(h: OpenHours | null, d: Day): string {
  if (!h) return 'Not set'
  const s = h[d]
  return s ? `${s[0]}–${s[1]}` : 'Closed'
}

/**
 * Every field that differs between the saved values and the form, formatted
 * for people. Opening hours expand to one row per changed day, so "3 unsaved
 * changes" counts the same rows the diff shows.
 */
export function diffRestaurant(
  before: RestaurantFormValues,
  after: RestaurantFormValues,
  label: Label = (_k, s) => s
): FieldChange[] {
  const out: FieldChange[] = []
  for (const key of Object.keys(FIELD_LABELS) as (keyof RestaurantFormValues)[]) {
    if (key === 'openHours') {
      for (const d of DAYS) {
        const a = slot(before.openHours, d)
        const b = slot(after.openHours, d)
        if (a !== b) out.push({ key: `openHours.${d}`, label: `Hours · ${DAY_NAMES[d]}`, from: a, to: b })
      }
      continue
    }
    if (key === 'image' && before.image && after.image && before.image !== after.image) {
      out.push({ key, label: FIELD_LABELS[key], from: 'Previous image', to: 'New image' })
      continue
    }
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    out.push({ key, label: FIELD_LABELS[key], from: show(key, before[key], label), to: show(key, after[key], label) })
  }
  return out
}
