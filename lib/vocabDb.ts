import { cache } from 'react'
import { prisma } from './prisma'
import { slugify } from './types'
import { checkTerms, resolveTerm, VOCAB_KINDS, type Term, type VocabKind } from './vocab'

const SELECT = { id: true, kind: true, slug: true, labelSq: true, labelEn: true, sortOrder: true, active: true } as const

/**
 * Every term, inactive included: a deactivated term is still on restaurants
 * that already had it and still needs a label. cache() so the root layout and
 * a page in the same request share one query.
 */
export const getVocab = cache(async (): Promise<Term[]> => {
  const rows = await prisma.vocabTerm.findMany({
    select: SELECT,
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { labelSq: 'asc' }],
  })
  return rows.filter((r): r is Term => (VOCAB_KINDS as readonly string[]).includes(r.kind))
})

/** A slug for a new term that does not collide with one already in this kind. */
async function freeSlug(kind: VocabKind, label: string): Promise<string> {
  const base = slugify(label) || 'term'
  const taken = new Set(
    (await prisma.vocabTerm.findMany({ where: { kind, slug: { startsWith: base } }, select: { slug: true } })).map(
      (r) => r.slug
    )
  )
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

export async function createTerm(kind: VocabKind, labelSq: string, labelEn: string): Promise<Term> {
  const last = await prisma.vocabTerm.findFirst({ where: { kind }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
  const row = await prisma.vocabTerm.create({
    data: {
      kind,
      slug: await freeSlug(kind, labelEn || labelSq),
      labelSq,
      labelEn: labelEn || labelSq,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
    select: SELECT,
  })
  return row as Term
}

/**
 * Raw values -> slugs for the bulk import paths (CSV). Known values resolve
 * (slug, label or legacy alias); unknown ones become new terms labelled as
 * written — the same rule the vocab_terms migration applied, so an import
 * never silently loses a value.
 */
export async function ensureTerms(kind: VocabKind, values: string[], terms: Term[]): Promise<string[]> {
  const out: string[] = []
  for (const value of values) {
    let slug = resolveTerm(terms, kind, value)
    if (slug === null) {
      const term = await createTerm(kind, value.trim(), value.trim())
      terms.push(term)
      slug = term.slug
    }
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

/**
 * The vocabulary gate shared by the admin restaurant API and AI approval:
 * cuisines/tags/neighborhood -> slugs (legacy spellings resolve), plus every
 * value that is not a term so the caller can refuse with a 400. Fields not
 * present in the input stay absent in the output.
 */
export async function checkVocabFields(input: { cuisines?: string[]; tags?: string[]; neighborhood?: string }) {
  const terms = await getVocab()
  const fields: { cuisines?: string[]; tags?: string[]; neighborhood?: string } = {}
  const unknown: string[] = []
  if (input.cuisines) {
    const r = checkTerms(terms, 'cuisine', input.cuisines)
    fields.cuisines = r.slugs
    unknown.push(...r.unknown)
  }
  if (input.tags) {
    const r = checkTerms(terms, 'tag', input.tags)
    fields.tags = r.slugs
    unknown.push(...r.unknown)
  }
  if (input.neighborhood !== undefined) {
    const r = checkTerms(terms, 'neighborhood', input.neighborhood ? [input.neighborhood] : [])
    fields.neighborhood = r.slugs[0] ?? ''
    unknown.push(...r.unknown)
  }
  return { fields, unknown }
}

export function unknownTermsMessage(unknown: string[]): string {
  return `Not in the vocabulary: ${unknown.join(', ')}. Pick an existing term or add it first.`
}
