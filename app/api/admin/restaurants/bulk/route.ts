import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { adminServerError } from '@/lib/apiError'
import { deleteRestaurantsWithFiles } from '@/lib/restaurants'
import { z } from 'zod'

// z.boolean(), never z.coerce.boolean(): coerce turns the STRING "false" into
// true, which would publish a restaurant the caller asked to unpublish.
const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['publish', 'unpublish', 'delete']),
})

/**
 * One request per bulk action, not one per restaurant — selecting 40 rows and
 * firing 40 PUTs is the request fanout this codebase already fixed once.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { ids, action } = bulkSchema.parse(body)
    // Duplicate ids would inflate the count reported back to the admin.
    const unique = [...new Set(ids)]

    if (action === 'delete') {
      return NextResponse.json({ action, count: await deleteRestaurantsWithFiles(unique) })
    }

    const { count } = await prisma.restaurant.updateMany({
      where: { id: { in: unique } },
      data: { isActive: action === 'publish' },
    })
    return NextResponse.json({ action, count })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return adminServerError('restaurants/bulk', error)
  }
}
