import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { adminServerError } from '@/lib/apiError'
import { resolveTerm, VOCAB_KINDS } from '@/lib/vocab'
import { createTerm, getVocab } from '@/lib/vocabDb'

const label = z.string().trim().min(1).max(60)

const createSchema = z.object({
  kind: z.enum(VOCAB_KINDS),
  labelSq: label,
  labelEn: label,
})

const reorderSchema = z.object({
  kind: z.enum(VOCAB_KINDS),
  ids: z.array(z.string().min(1)).min(1).max(500),
})

function authError(error: any) {
  if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error?.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
  }
  return null
}

/**
 * Add a term. If the label already names one in this kind (any case, with or
 * without diacritics, either language) that term comes back instead of a
 * near-duplicate, so "Pica" typed into the picker selects `pizza`.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const { kind, labelSq, labelEn } = createSchema.parse(await request.json())
    const terms = await getVocab()
    const existing = resolveTerm(terms, kind, labelSq) || resolveTerm(terms, kind, labelEn)
    const hit = existing ? terms.find((t) => t.kind === kind && t.slug === existing) : undefined
    if (hit) return NextResponse.json({ term: hit, existed: true })
    return NextResponse.json({ term: await createTerm(kind, labelSq, labelEn), existed: false }, { status: 201 })
  } catch (error: any) {
    return authError(error) ?? adminServerError('admin/vocab', error)
  }
}

/** Reorder one kind: `ids` in the new order. */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()
    const { kind, ids } = reorderSchema.parse(await request.json())
    await prisma.$transaction(
      ids.map((id, i) => prisma.vocabTerm.updateMany({ where: { id, kind }, data: { sortOrder: (i + 1) * 10 } }))
    )
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return authError(error) ?? adminServerError('admin/vocab', error)
  }
}
