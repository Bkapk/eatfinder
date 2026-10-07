import type { Locale } from './i18n'
import { slugify } from './types'

/**
 * The admin-managed vocabularies (VocabTerm rows). Client-safe: no Prisma
 * here, so cards and the filter panel can import it. DB access lives in
 * lib/vocabDb.ts.
 */
export const VOCAB_KINDS = ['neighborhood', 'cuisine', 'tag'] as const
export type VocabKind = (typeof VOCAB_KINDS)[number]

/** What the client needs of a VocabTerm row. */
export interface Term {
  id: string
  kind: VocabKind
  slug: string
  labelSq: string
  labelEn: string
  sortOrder: number
  active: boolean
}

/**
 * Old free-text values -> current slugs, keyed by kind then lowercased value.
 * The migration (prisma/migrations/*_vocab_terms) was generated from this map,
 * and the import paths (CSV, Google Places, pre-migration AI proposals) use it
 * so an old export or a queued proposal still lands on the right term.
 * '' means "deliberately dropped": spice is gone, and a city name is not a
 * neighbourhood.
 */
export const LEGACY_ALIASES: Record<VocabKind, Record<string, string>> = {
  cuisine: {
    kosovan: 'traditional',
    balkan: 'traditional',
    albanian: 'traditional',
    kosovar: 'traditional',
    qebapa: 'grill',
    bbq: 'grill',
    barbecue: 'grill',
    burek: 'burek-pite',
    pite: 'burek-pite',
    pastry: 'bakery',
    pasta: 'italian',
    american: 'burgers',
    burger: 'burgers',
    'street food': 'fast-food',
    'fine dining': 'international',
    french: 'international',
    'modern european': 'international',
    european: 'international',
    japanese: 'sushi-asian',
    sushi: 'sushi-asian',
    ramen: 'sushi-asian',
    chinese: 'sushi-asian',
    szechuan: 'sushi-asian',
    asian: 'sushi-asian',
    thai: 'sushi-asian',
    tacos: 'mexican',
    salads: 'healthy',
    organic: 'healthy',
    smoothies: 'healthy',
    coffee: 'cafe',
    doner: 'turkish',
    döner: 'turkish',
    kebab: 'turkish',
    fish: 'seafood',
    'ice cream': 'desserts',
    steak: 'steakhouse',
    spicy: '',
  },
  tag: {
    brunch: 'breakfast',
    romantic: 'date-night',
    takeaway: 'takeout',
    'take-away': 'takeout',
    vegetarian: 'vegan-friendly',
    'kid-friendly': 'family-friendly',
    'specialty coffee': 'specialty-coffee',
  },
  neighborhood: {
    center: 'qendra',
    centre: 'qendra',
    'city center': 'qendra',
    'city centre': 'qendra',
    downtown: 'qendra',
    qendër: 'qendra',
    qender: 'qendra',
    ulpiana: 'ulpiane',
    muhaxheret: 'lagjja-e-muhaxhereve',
    prishtina: '',
    prishtinë: '',
    pristina: '',
    priština: '',
  },
}

/**
 * The slug a raw value refers to: an exact slug, a legacy alias, or either
 * label typed with or without diacritics. '' = a known value that is
 * deliberately dropped. null = genuinely unknown.
 */
export function resolveTerm(terms: Term[], kind: VocabKind, raw: string): string | null {
  const value = raw.trim()
  if (!value) return ''
  const ofKind = terms.filter((t) => t.kind === kind)
  if (ofKind.some((t) => t.slug === value)) return value
  const alias = LEGACY_ALIASES[kind][value.toLowerCase()]
  if (alias !== undefined) return alias
  const key = slugify(value)
  const hit = ofKind.find(
    (t) => t.slug === key || slugify(t.labelSq) === key || slugify(t.labelEn) === key
  )
  return hit ? hit.slug : null
}

/** Display label in the current locale. Unknown slugs render as themselves. */
export function termLabel(terms: Term[], locale: Locale, kind: VocabKind, slug: string): string {
  const term = terms.find((t) => t.kind === kind && t.slug === slug)
  if (!term) return slug
  return (locale === 'en' ? term.labelEn : term.labelSq) || term.labelSq
}

/**
 * Admin form / AI approval: every value must already be a term (the pickers
 * only offer terms, and "add new" creates one first). Legacy spellings still
 * resolve. Returns the unknown values so the caller can 400 on them.
 */
export function checkTerms(terms: Term[], kind: VocabKind, values: string[]): { slugs: string[]; unknown: string[] } {
  const slugs: string[] = []
  const unknown: string[] = []
  for (const value of values) {
    const slug = resolveTerm(terms, kind, value)
    if (slug === null) unknown.push(value)
    else if (slug && !slugs.includes(slug)) slugs.push(slug)
  }
  return { slugs, unknown }
}
