import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { parseCSV, validateCSVRow, csvRowToRestaurant, CSVImportResult } from '@/lib/csv'
import { adminServerError } from '@/lib/apiError'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'CSV must be under 2MB' }, { status: 413 })
    }

    const text = await file.text()
    let rows
    try {
      rows = parseCSV(text)
    } catch {
      return NextResponse.json({ error: 'CSV could not be parsed. Check the file format.' }, { status: 400 })
    }
    if (rows.length > 1000) {
      return NextResponse.json({ error: 'CSV may contain at most 1000 restaurants' }, { status: 400 })
    }

    const result: CSVImportResult = {
      success: true,
      imported: 0,
      errors: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const error = validateCSVRow(row, i)
      if (error) {
        result.errors.push({ row: i + 1, message: error })
        result.success = false
        continue
      }

      try {
        const data = csvRowToRestaurant(row)
        await prisma.restaurant.upsert({
          where: { name: data.name! },
          update: data,
          create: { ...data, isActive: data.isActive ?? false } as any,
        })
        result.imported++
      } catch (err: any) {
        result.errors.push({
          row: i + 1,
          message: err.message || 'Failed to import row',
        })
        result.success = false
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return adminServerError('restaurants/import', error)
  }
}

