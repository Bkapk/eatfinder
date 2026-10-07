import { checkTerms, resolveTerm, termLabel, type Term } from '../lib/vocab'
import { passesFilters, type SearchFilters } from '../lib/scoring'
import type { RestaurantDTO } from '../lib/types'

const term = (kind: Term['kind'], slug: string, labelSq: string, labelEn = labelSq, active = true): Term => ({
  id: `${kind}:${slug}`,
  kind,
  slug,
  labelSq,
  labelEn,
  sortOrder: 0,
  active,
})

const terms: Term[] = [
  term('cuisine', 'traditional', 'Tradicionale', 'Traditional'),
  term('cuisine', 'pizza', 'Pica', 'Pizza'),
  term('cuisine', 'desserts', 'Ëmbëlsira & Akullore', 'Desserts & Ice cream'),
  term('tag', 'breakfast', 'Mëngjes & brunch', 'Breakfast & brunch'),
  term('neighborhood', 'ulpiane', 'Ulpianë'),
  term('neighborhood', 'bregu-i-diellit', 'Bregu i Diellit', 'Bregu i Diellit', false),
]

describe('resolveTerm', () => {
  it('accepts a slug, either label, and labels typed without diacritics', () => {
    expect(resolveTerm(terms, 'cuisine', 'pizza')).toBe('pizza')
    expect(resolveTerm(terms, 'cuisine', 'Pica')).toBe('pizza')
    expect(resolveTerm(terms, 'cuisine', 'embelsira & akullore')).toBe('desserts')
    expect(resolveTerm(terms, 'neighborhood', 'Ulpiane')).toBe('ulpiane')
    // Inactive terms still resolve: deactivating must not break imports of data that uses them.
    expect(resolveTerm(terms, 'neighborhood', 'Bregu i Diellit')).toBe('bregu-i-diellit')
  })

  it('maps legacy values, drops the deliberately removed ones, and reports the unknown', () => {
    expect(resolveTerm(terms, 'cuisine', 'Kosovan')).toBe('traditional')
    expect(resolveTerm(terms, 'tag', 'brunch')).toBe('breakfast')
    expect(resolveTerm(terms, 'neighborhood', 'Ulpiana')).toBe('ulpiane')
    expect(resolveTerm(terms, 'cuisine', 'Spicy')).toBe('')
    expect(resolveTerm(terms, 'neighborhood', 'Prishtinë')).toBe('')
    expect(resolveTerm(terms, 'cuisine', 'Ethiopian')).toBeNull()
    // Kinds do not leak into each other.
    expect(resolveTerm(terms, 'tag', 'pizza')).toBeNull()
  })
})

test('checkTerms de-duplicates and separates out what is not a term', () => {
  expect(checkTerms(terms, 'cuisine', ['Pizza', 'pizza', 'Balkan', 'Ethiopian', 'Spicy'])).toEqual({
    slugs: ['pizza', 'traditional'],
    unknown: ['Ethiopian'],
  })
})

test('termLabel picks the locale and falls back to the slug', () => {
  expect(termLabel(terms, 'sq', 'cuisine', 'pizza')).toBe('Pica')
  expect(termLabel(terms, 'en', 'cuisine', 'pizza')).toBe('Pizza')
  expect(termLabel(terms, 'en', 'cuisine', 'ethiopian')).toBe('ethiopian')
})

test('free-text search matches vocabulary labels, not only slugs', () => {
  const r = { name: 'Napoli', description: '', cuisines: ['pizza'], tags: [], neighborhood: 'ulpiane' } as unknown as RestaurantDTO
  const f = (query: string) => ({ heavy: 50, hungry: 50, fine: 50, query }) as SearchFilters
  const labels = { pizza: 'Pica Pizza', ulpiane: 'Ulpianë Ulpianë' }
  expect(passesFilters(r, f('pica'), new Date(), labels)).toBe(true)
  expect(passesFilters(r, f('ulpianë'), new Date(), labels)).toBe(true)
  expect(passesFilters(r, f('pica'))).toBe(false)
})
