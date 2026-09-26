'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { RestaurantDTO } from '@/lib/types'

/**
 * Favourites live in the database (Favorite table) behind
 * /api/community/favorites, one per signed-in user.
 *
 * `signedIn` is part of the snapshot because a signed-out visitor's 401 used
 * to make the heart a silent no-op: it flipped, reverted ~100 ms later, and
 * aria-pressed reported a state that was never saved. Callers use it to send
 * the visitor to sign in instead of lying to them.
 */
interface Snapshot {
  ids: string[]
  /** null until the first load resolves, or when the network failed. */
  signedIn: boolean | null
  /** The same response's rows, for the Saved tab. Not updated by toggle(). */
  restaurants: RestaurantDTO[]
}

let snapshot: Snapshot = { ids: [], signedIn: null, restaurants: [] }
/**
 * The one load, held at module scope. React calls `subscribe` synchronously
 * during commit for every consumer — TopBar plus one heart per card — so a
 * guard set after an `await` is still false for all of them and fires a
 * request each. Assigning the promise itself is synchronous, so subscriber
 * two onwards join the request subscriber one started.
 */
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function setSnapshot(next: Snapshot) {
  snapshot = next
  listeners.forEach((l) => l())
}

async function loadFavorites() {
  try {
    const res = await fetch('/api/community/favorites')
    const data = res.ok ? await res.json() : null
    setSnapshot({
      ids: Array.isArray(data?.restaurantIds) ? data.restaurantIds : [],
      signedIn: res.status !== 401,
      restaurants: Array.isArray(data?.restaurants) ? data.restaurants : [],
    })
  } catch {
    // Offline is unknown, not signed out, so the control stays a toggle.
    setSnapshot({ ids: [], signedIn: null, restaurants: [] })
  }
}

/**
 * Re-ask the server after sign-in or sign-out. The snapshot lives at module
 * scope, which survives client-side navigation — so without this, signing in
 * left every heart still holding "signed out" and bouncing to the login page
 * until a full reload.
 */
export function reloadFavorites() {
  inflight = loadFavorites()
  return inflight
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  inflight ??= loadFavorites()
  return () => listeners.delete(fn)
}

// useSyncExternalStore requires a stable snapshot reference or it loops.
const getSnapshot = () => snapshot
// The server never loads favourites, so hydration must see exactly what it
// rendered: the empty initial state, not the live one. Handing back `snapshot`
// here broke any boundary that hydrated after the first load had landed (the
// Suspense-wrapped TopBar on /r) with a hydration mismatch.
const SERVER_SNAPSHOT: Snapshot = { ids: [], signedIn: null, restaurants: [] }
const getServerSnapshot = () => SERVER_SNAPSHOT

export function useFavorites() {
  const { ids, signedIn, restaurants } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => {
    const wasOn = snapshot.ids.includes(id)
    // Optimistic: flip immediately, revert if the request fails.
    setSnapshot({
      ...snapshot,
      ids: wasOn ? snapshot.ids.filter((v) => v !== id) : [...snapshot.ids, id],
    })

    fetch('/api/community/favorites', {
      method: wasOn ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
      })
      .catch(() => {
        setSnapshot({
          ...snapshot,
          ids: wasOn ? [...snapshot.ids, id] : snapshot.ids.filter((v) => v !== id),
        })
      })
  }, [])

  return { ids, signedIn, restaurants, toggle }
}
