import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { parseCSV, validateCSVRow, csvRowToRestaurant, CSVImportResult } from '@/lib/csv'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

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
          create: data as any,
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
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

