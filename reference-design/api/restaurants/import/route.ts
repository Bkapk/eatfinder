import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RestaurantSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data } = await request.json()
    
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    const results = {
      success: [] as any[],
      errors: [] as { row: number; error: string; data: any }[],
    }

    for (let i = 0; i < data.length; i++) {
      try {
        const validated = RestaurantSchema.parse(data[i])
        
        const restaurant = await prisma.restaurant.create({
          data: validated,
        })
        
        results.success.push(restaurant)
      } catch (error: any) {
        results.errors.push({
          row: i + 1,
          error: error.message || 'Validation failed',
          data: data[i],
        })
      }
    }

    return NextResponse.json({
      imported: results.success.length,
      failed: results.errors.length,
      errors: results.errors,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    )
  }
}

