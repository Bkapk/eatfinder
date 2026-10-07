import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { adminServerError } from '@/lib/apiError'

const label = z.string().trim().min(1).max(60)

// The slug is deliberately not editable: it is what restaurants store, so
// renaming a term relabels every place that uses it and edits nothing else.
const patchSchema = z
  .object({ labelSq: label, labelEn: label, active: z.boolean() })
  .partial()
  .strict()

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const data = patchSchema.parse(await request.json())
    const found = await prisma.vocabTerm.findUnique({ where: { id }, select: { id: true } })
    if (!found) return NextResponse.json({ error: 'Term not found' }, { status: 404 })
    const term = await prisma.vocabTerm.update({ where: { id }, data })
    return NextResponse.json({ term })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error?.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return adminServerError('admin/vocab/[id]', error)
  }
}
