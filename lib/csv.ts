import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { Restaurant } from '@prisma/client'
import { slugify, openHoursSchema, httpUrlSchema } from './types'

export interface CSVRow {
  name: string
  description?: string
  heaviness: string
  portionSize: string
  fineDining: string
  priceLevel: string
  spiceLevel?: string
  avgPrepTime?: string
  cuisines?: string
  tags?: string
  neighborhood?: string
  address?: string
  websiteUrl?: string
  gmapsUrl?: string
  woltUrl?: string
  instagramUrl?: string
  phone?: string
  image?: string
  lat?: string
  lng?: string
  openHours?: string
  rating?: string
  isActive?: string
}

export interface CSVImportResult {
  success: boolean
  imported: number
  errors: Array<{ row: number; field?: string; message: string }>
}

function parseListField(value?: string): string[] {
  if (!value?.trim()) return []
  const raw = value.trim()
  let parsed: unknown
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = JSON.parse(raw.replace(/'/g, '"'))
    }
  } else {
    parsed = raw.split(',').map((item) => item.trim())
  }
  if (!Array.isArray(parsed) || parsed.length > 20 || parsed.some((item) => typeof item !== 'string' || item.length > 60)) {
    throw new Error('Expected up to 20 text values')
  }
  return parsed.filter(Boolean)
}

/**
 * Parse CSV file and validate rows
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
  return records
}

/**
 * Validate a CSV row
 */
export function validateCSVRow(row: CSVRow, rowIndex: number): string | null {
  if (!row.name || row.name.trim() === '') {
    return `Row ${rowIndex + 1}: name is required`
  }

  // Same gate as the API: unparseable hours would read as "confirmed closed".
  if (row.openHours?.trim()) {
    try {
      openHoursSchema.parse(JSON.parse(row.openHours))
    } catch {
      return `Row ${rowIndex + 1}: openHours must be JSON like {"mon":["09:00","23:00"],"sun":null}`
    }
  }

  const whole = (value: string | undefined) => value?.trim() !== '' && Number.isInteger(Number(value))
  const heaviness = Number(row.heaviness)
  if (!whole(row.heaviness) || heaviness < 0 || heaviness > 100) {
    return `Row ${rowIndex + 1}: heaviness must be 0-100`
  }

  const portionSize = Number(row.portionSize)
  if (!whole(row.portionSize) || portionSize < 0 || portionSize > 100) {
    return `Row ${rowIndex + 1}: portionSize must be 0-100`
  }

  const fineDining = Number(row.fineDining)
  if (!whole(row.fineDining) || fineDining < 0 || fineDining > 100) {
    return `Row ${rowIndex + 1}: fineDining must be 0-100`
  }

  const priceLevel = Number(row.priceLevel)
  if (!whole(row.priceLevel) || priceLevel < 1 || priceLevel > 4) {
    return `Row ${rowIndex + 1}: priceLevel must be 1-4`
  }

  if (row.spiceLevel) {
    const spiceLevel = Number(row.spiceLevel)
    if (!whole(row.spiceLevel) || spiceLevel < 0 || spiceLevel > 100) {
      return `Row ${rowIndex + 1}: spiceLevel must be 0-100`
    }
  }

  if (row.avgPrepTime) {
    const avgPrepTime = Number(row.avgPrepTime)
    if (!whole(row.avgPrepTime) || avgPrepTime < 0) {
      return `Row ${rowIndex + 1}: avgPrepTime must be a positive integer`
    }
  }

  if (row.rating) {
    const rating = Number(row.rating)
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return `Row ${rowIndex + 1}: rating must be 0-5`
    }
  }

  if (row.isActive?.trim() && !['true', 'false'].includes(row.isActive.trim().toLowerCase())) {
    return `Row ${rowIndex + 1}: isActive must be true or false`
  }
  for (const [field, limit] of [['lat', 90], ['lng', 180]] as const) {
    const value = row[field]
    if (value?.trim() && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit)) {
      return `Row ${rowIndex + 1}: ${field} must be between -${limit} and ${limit}`
    }
  }
  for (const field of ['websiteUrl', 'gmapsUrl', 'woltUrl', 'instagramUrl'] as const) {
    if (row[field]?.trim() && !httpUrlSchema.safeParse(row[field]).success) {
      return `Row ${rowIndex + 1}: ${field} must be an http or https URL`
    }
  }
  for (const field of ['cuisines', 'tags'] as const) {
    try {
      parseListField(row[field])
    } catch {
      return `Row ${rowIndex + 1}: ${field} must be a comma-separated list or JSON array of text`
    }
  }

  return null
}

/**
 * Convert CSV row to Restaurant data
 */
export function csvRowToRestaurant(row: CSVRow): Partial<Restaurant> {
  const cuisines = parseListField(row.cuisines)
  const tags = parseListField(row.tags)

  const name = row.name.trim()

  return {
    slug: slugify(name),
    name,
    description: row.description || '',
    heaviness: Number(row.heaviness),
    portionSize: Number(row.portionSize),
    fineDining: Number(row.fineDining),
    priceLevel: Number(row.priceLevel),
    spiceLevel: row.spiceLevel ? Number(row.spiceLevel) : 0,
    avgPrepTime: row.avgPrepTime ? Number(row.avgPrepTime) : 30,
    cuisines: JSON.stringify(cuisines),
    tags: JSON.stringify(tags),
    neighborhood: row.neighborhood || '',
    address: row.address || '',
    websiteUrl: row.websiteUrl || null,
    gmapsUrl: row.gmapsUrl || null,
    woltUrl: row.woltUrl || null,
    instagramUrl: row.instagramUrl || null,
    phone: row.phone || null,
    image: row.image || null,
    lat: row.lat ? Number(row.lat) : null,
    lng: row.lng ? Number(row.lng) : null,
    openHours: row.openHours || null,
    rating: row.rating ? Number(row.rating) : null,
    ...(row.isActive?.trim() ? { isActive: row.isActive.trim().toLowerCase() === 'true' } : {}),
  }
}

/**
 * Export restaurants to CSV
 */
export function exportToCSV(restaurants: Restaurant[]): string {
  const rows = restaurants.map((r) => {
    const cuisines = JSON.parse(r.cuisines || '[]')
    const tags = JSON.parse(r.tags || '[]')
    return {
      name: r.name,
      description: r.description,
      heaviness: r.heaviness.toString(),
      portionSize: r.portionSize.toString(),
      fineDining: r.fineDining.toString(),
      priceLevel: r.priceLevel.toString(),
      spiceLevel: r.spiceLevel.toString(),
      avgPrepTime: r.avgPrepTime.toString(),
      cuisines: JSON.stringify(cuisines),
      tags: JSON.stringify(tags),
      neighborhood: r.neighborhood,
      address: r.address,
      websiteUrl: r.websiteUrl || '',
      gmapsUrl: r.gmapsUrl || '',
      woltUrl: r.woltUrl || '',
      instagramUrl: r.instagramUrl || '',
      phone: r.phone || '',
      image: r.image || '',
      lat: r.lat?.toString() || '',
      lng: r.lng?.toString() || '',
      openHours: r.openHours || '',
      rating: r.rating?.toString() || '',
      isActive: String(r.isActive),
    }
  })

  return stringify(rows, {
    header: true,
    columns: [
      'name',
      'description',
      'heaviness',
      'portionSize',
      'fineDining',
      'priceLevel',
      'spiceLevel',
      'avgPrepTime',
      'cuisines',
      'tags',
      'neighborhood',
      'address',
      'websiteUrl',
      'gmapsUrl',
      'woltUrl',
      'instagramUrl',
      'phone',
      'image',
      'lat',
      'lng',
      'openHours',
      'rating',
      'isActive',
    ],
  })
}
