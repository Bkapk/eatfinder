import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const restaurants = await prisma.restaurant.findMany({
      orderBy: { name: 'asc' },
    })

    // Convert to CSV
    const headers = [
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
    ]

    const csvRows = [headers.join(',')]

    for (const restaurant of restaurants) {
      const row = headers.map(header => {
        const value = restaurant[header as keyof typeof restaurant]
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = value?.toString() || ''
        return stringValue.includes(',') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue
      })
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="restaurants.csv"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}

