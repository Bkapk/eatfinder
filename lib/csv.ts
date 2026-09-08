import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { Restaurant } from '@prisma/client'
import { slugify, openHoursSchema } from './types'

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
}

export interface CSVImportResult {
  success: boolean
  imported: number
  errors: Array<{ row: number; field?: string; message: string }>
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

  const heaviness = parseInt(row.heaviness)
  if (isNaN(heaviness) || heaviness < 0 || heaviness > 100) {
    return `Row ${rowIndex + 1}: heaviness must be 0-100`
  }

  const portionSize = parseInt(row.portionSize)
  if (isNaN(portionSize) || portionSize < 0 || portionSize > 100) {
    return `Row ${rowIndex + 1}: portionSize must be 0-100`
  }

  const fineDining = parseInt(row.fineDining)
  if (isNaN(fineDining) || fineDining < 0 || fineDining > 100) {
    return `Row ${rowIndex + 1}: fineDining must be 0-100`
  }

  const priceLevel = parseInt(row.priceLevel)
  if (isNaN(priceLevel) || priceLevel < 1 || priceLevel > 4) {
    return `Row ${rowIndex + 1}: priceLevel must be 1-4`
  }

  if (row.spiceLevel) {
    const spiceLevel = parseInt(row.spiceLevel)
    if (isNaN(spiceLevel) || spiceLevel < 0 || spiceLevel > 100) {
      return `Row ${rowIndex + 1}: spiceLevel must be 0-100`
    }
  }

  if (row.avgPrepTime) {
    const avgPrepTime = parseInt(row.avgPrepTime)
    if (isNaN(avgPrepTime) || avgPrepTime < 0) {
      return `Row ${rowIndex + 1}: avgPrepTime must be a positive integer`
    }
  }

  if (row.rating) {
    const rating = parseFloat(row.rating)
    if (isNaN(rating) || rating < 0 || rating > 5) {
      return `Row ${rowIndex + 1}: rating must be 0-5`
    }
  }

  return null
}

/**
 * Convert CSV row to Restaurant data
 */
export function csvRowToRestaurant(row: CSVRow): Partial<Restaurant> {
  let cuisines: string[] = []
  if (row.cuisines) {
    try {
      // Try parsing as JSON first
      cuisines = JSON.parse(row.cuisines.replace(/'/g, '"'))
    } catch {
      // If not JSON, try splitting by comma
      cuisines = row.cuisines.split(',').map((c) => c.trim()).filter(Boolean)
    }
  }

  let tags: string[] = []
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags.replace(/'/g, '"'))
    } catch {
      tags = row.tags.split(',').map((t) => t.trim()).filter(Boolean)
    }
  }

  const name = row.name.trim()

  return {
    slug: slugify(name),
    name,
    description: row.description || '',
    heaviness: parseInt(row.heaviness),
    portionSize: parseInt(row.portionSize),
    fineDining: parseInt(row.fineDining),
    priceLevel: parseInt(row.priceLevel),
    spiceLevel: row.spiceLevel ? parseInt(row.spiceLevel) : 0,
    avgPrepTime: row.avgPrepTime ? parseInt(row.avgPrepTime) : 30,
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
    lat: row.lat ? parseFloat(row.lat) : null,
    lng: row.lng ? parseFloat(row.lng) : null,
    openHours: row.openHours || null,
    rating: row.rating ? parseFloat(row.rating) : null,
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
    ],
  })
}

