import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { exportToCSV } from '@/lib/csv'
import { adminServerError } from '@/lib/apiError'

export async function GET() {
  try {
    await requireAdmin()

    const restaurants = await prisma.restaurant.findMany({
      orderBy: { updatedAt: 'desc' },
    })

    const csv = exportToCSV(restaurants)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="restaurants.csv"',
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return adminServerError('restaurants/export', error)
  }
}

