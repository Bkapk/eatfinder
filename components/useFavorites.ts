'use client'

import { useCallback, useSyncExternalStore } from 'react'

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
}

let snapshot: Snapshot = { ids: [], signedIn: null }
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
    })
  } catch {
    // Offline is unknown, not signed out, so the control stays a toggle.
    setSnapshot({ ids: [], signedIn: null })
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  inflight ??= loadFavorites()
  return () => listeners.delete(fn)
}

// useSyncExternalStore requires a stable snapshot reference or it loops.
const getSnapshot = () => snapshot
const getServerSnapshot = () => snapshot

export function useFavorites() {
  const { ids, signedIn } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => {
    const wasOn = snapshot.ids.includes(id)
    // Optimistic: flip immediately, revert if the request fails.
    setSnapshot({
      ids: wasOn ? snapshot.ids.filter((v) => v !== id) : [...snapshot.ids, id],
      signedIn: snapshot.signedIn,
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
          ids: wasOn ? [...snapshot.ids, id] : snapshot.ids.filter((v) => v !== id),
          signedIn: snapshot.signedIn,
        })
      })
  }, [])

  return { ids, signedIn, toggle }
}
