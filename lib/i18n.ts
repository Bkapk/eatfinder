import { sq } from './dictionaries/sq'
import { en } from './dictionaries/en'

export const LOCALES = ['sq', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Albanian is the default (Decisions log 1). */
export const DEFAULT_LOCALE: Locale = 'sq'

/** The cookie that persists the choice. Written client-side by <LocaleCookie>. */
export const LOCALE_COOKIE = 'lang'

const DICTIONARIES: Record<Locale, Record<string, string>> = { sq, en }

export type TKey = keyof typeof sq

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

/**
 * `?lang=` wins (that is how the toggle switches), then the cookie, then sq.
 * Both inputs are untrusted strings, so anything unrecognised falls back
 * rather than indexing the dictionary map with it.
 */
export function resolveLocale(param?: string | null, cookie?: string | null): Locale {
  if (isLocale(param)) return param
  if (isLocale(cookie)) return cookie
  return DEFAULT_LOCALE
}

/**
 * Look up a chrome string. `{name}` placeholders are substituted from `vars`.
 * A missing key returns the key itself — visible in the UI, never a crash, and
 * __tests__/i18n.test.ts is what stops it happening in the first place.
 */
export function t(
  locale: Locale,
  key: TKey,
  vars?: Record<string, string | number>
): string {
  const raw = DICTIONARIES[locale][key] ?? sq[key] ?? String(key)
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m
  )
}

/**
 * Vocabulary values come from the database and may pre-date or post-date
 * CUISINE_VOCAB / TAG_VOCAB, so an unknown value renders as itself rather than
 * disappearing behind a missing-key placeholder.
 */
export function tVocab(locale: Locale, prefix: 'cuisine' | 'tag', value: string): string {
  const key = `${prefix}.${value}` as TKey
  return DICTIONARIES[locale][key] ?? value
}

/** "$", "$$", … for a 1-4 price level. Currency-neutral, so not a dictionary string. */
export function priceGlyphs(level: number): string {
  return '$'.repeat(Math.min(4, Math.max(1, Math.round(level))))
}
