'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * ponytail: favourites live in localStorage, not the database. Phase 5 owns
 * /api/community/favorites and the Favorite table; until a user can sign in
 * there is nobody to hang a row on. Swap point is this file only — the two
 * exported hooks are the whole surface. Upgrade when /account/login exists.
 */
const KEY = 'ef:favorites'

let cache: string[] = []
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function subscribe(fn: () => void) {
  if (listeners.size === 0) cache = read()
  listeners.add(fn)
  // Another tab writing the same key must not leave this one stale.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read()
      listeners.forEach((l) => l())
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

// useSyncExternalStore requires a stable snapshot reference or it loops.
const getSnapshot = () => cache
const getServerSnapshot = () => cache

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => {
    const next = cache.includes(id) ? cache.filter((v) => v !== id) : [...cache, id]
    cache = next
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* private mode / quota: the in-memory set still works for this session */
    }
    listeners.forEach((l) => l())
  }, [])

  return { ids, toggle }
}
