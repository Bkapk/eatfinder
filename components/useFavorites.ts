'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Favourites live in the database (Favorite table) behind
 * /api/community/favorites, one per signed-in user. A signed-out visitor
 * simply gets an empty list back (401) — toggling while signed out reverts
 * the optimistic update rather than throwing. The two exported hooks are the
 * whole surface, matching the localStorage version this replaces.
 */
let cache: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

async function loadFavorites() {
  try {
    const res = await fetch('/api/community/favorites')
    const data = res.ok ? await res.json() : null
    cache = Array.isArray(data?.restaurantIds) ? data.restaurantIds : []
  } catch {
    cache = []
  } finally {
    loaded = true
    notify()
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  if (!loaded) loadFavorites()
  return () => listeners.delete(fn)
}

// useSyncExternalStore requires a stable snapshot reference or it loops.
const getSnapshot = () => cache
const getServerSnapshot = () => cache

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => {
    const wasOn = cache.includes(id)
    // Optimistic: flip immediately, revert if the request fails (e.g. the
    // user is not signed in and gets a 401).
    cache = wasOn ? cache.filter((v) => v !== id) : [...cache, id]
    notify()

    fetch('/api/community/favorites', {
      method: wasOn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('failed')
      })
      .catch(() => {
        cache = wasOn ? [...cache, id] : cache.filter((v) => v !== id)
        notify()
      })
  }, [])

  return { ids, toggle }
}
