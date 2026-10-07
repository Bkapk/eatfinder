'use client'

import { createContext, useCallback, useContext } from 'react'
import type { Locale } from '@/lib/i18n'
import { termLabel, type Term, type VocabKind } from '@/lib/vocab'

/**
 * The vocabulary, loaded once per request by the root layout. Without a
 * provider (a unit test rendering one card) labels fall back to the slug.
 * After an admin edits terms, router.refresh() re-renders the layout and this
 * value with it.
 */
const VocabContext = createContext<Term[]>([])

export function VocabProvider({ terms, children }: { terms: Term[]; children: React.ReactNode }) {
  return <VocabContext.Provider value={terms}>{children}</VocabContext.Provider>
}

export function useVocab(): Term[] {
  return useContext(VocabContext)
}

/** `label('cuisine', 'grill')` -> "Qebapa & Zgarë" in Albanian. */
export function useVocabLabel(locale: Locale) {
  const terms = useVocab()
  return useCallback((kind: VocabKind, slug: string) => termLabel(terms, locale, kind, slug), [terms, locale])
}
