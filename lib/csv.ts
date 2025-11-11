import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { Restaurant } from '@prisma/client'

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
  neighborhood?: string
  websiteUrl?: string
  gmapsUrl?: string
  phone?: string
  image?: string
  lat?: string
  lng?: string
  openHours?: string
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

  return {
    name: row.name.trim(),
    description: row.description || '',
    heaviness: parseInt(row.heaviness),
    portionSize: parseInt(row.portionSize),
    fineDining: parseInt(row.fineDining),
    priceLevel: parseInt(row.priceLevel),
    spiceLevel: row.spiceLevel ? parseInt(row.spiceLevel) : 50,
    avgPrepTime: row.avgPrepTime ? parseInt(row.avgPrepTime) : 30,
    cuisines: JSON.stringify(cuisines),
    neighborhood: row.neighborhood || '',
    websiteUrl: row.websiteUrl || null,
    gmapsUrl: row.gmapsUrl || null,
    phone: row.phone || null,
    image: row.image || null,
    lat: row.lat ? parseFloat(row.lat) : null,
    lng: row.lng ? parseFloat(row.lng) : null,
    openHours: row.openHours || null,
  }
}

/**
 * Export restaurants to CSV
 */
export function exportToCSV(restaurants: Restaurant[]): string {
  const rows = restaurants.map((r) => {
    const cuisines = JSON.parse(r.cuisines || '[]')
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
      neighborhood: r.neighborhood,
      websiteUrl: r.websiteUrl || '',
      gmapsUrl: r.gmapsUrl || '',
      phone: r.phone || '',
      image: r.image || '',
      lat: r.lat?.toString() || '',
      lng: r.lng?.toString() || '',
      openHours: r.openHours || '',
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
      'neighborhood',
      'websiteUrl',
      'gmapsUrl',
      'phone',
      'image',
      'lat',
      'lng',
      'openHours',
    ],
  })
}

