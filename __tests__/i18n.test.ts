/**
 * A missing dictionary key is invisible until an Albanian user hits it, so it
 * has to fail here instead. TypeScript already enforces the key set (en.ts is
 * typed as Record<keyof typeof sq, string>); this catches the same mistake for
 * anyone who ships without a typecheck, plus the placeholder mismatches types
 * cannot see.
 */
import { sq } from '../lib/dictionaries/sq'
import { en } from '../lib/dictionaries/en'
import { resolveLocale, t, tVocab, priceGlyphs } from '../lib/i18n'

const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()

describe('dictionaries', () => {
  it('have identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sq).sort())
  })

  it('have no empty values', () => {
    for (const [k, v] of Object.entries({ ...sq, ...en })) {
      expect(`${k}=${v}`).not.toMatch(/=\s*$/)
    }
  })

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(sq) as (keyof typeof sq)[]) {
      expect([key, placeholders(en[key])]).toEqual([key, placeholders(sq[key])])
    }
  })
})

describe('t()', () => {
  it('defaults to Albanian and substitutes vars', () => {
    expect(resolveLocale(null, null)).toBe('sq')
    expect(t('sq', 'results.heading', { n: 7 })).toBe('7 vende')
    expect(t('en', 'results.heading', { n: 7 })).toBe('7 places')
  })

  it('only accepts known locales from the URL or the cookie', () => {
    expect(resolveLocale('en', null)).toBe('en')
    expect(resolveLocale(null, 'en')).toBe('en')
    expect(resolveLocale('de', 'fr')).toBe('sq')
    expect(resolveLocale('__proto__', null)).toBe('sq')
  })

  it('falls back to the raw value for vocabulary outside the dictionaries', () => {
    expect(tVocab('sq', 'cuisine', 'Pizza')).toBe('Pica')
    expect(tVocab('sq', 'cuisine', 'Ethiopian')).toBe('Ethiopian')
    expect(tVocab('en', 'tag', 'wifi')).toBe('Wi-Fi')
  })

  it('clamps price glyphs to 1-4', () => {
    expect(priceGlyphs(0)).toBe('$')
    expect(priceGlyphs(3)).toBe('$$$')
    expect(priceGlyphs(9)).toBe('$$$$')
  })
})
