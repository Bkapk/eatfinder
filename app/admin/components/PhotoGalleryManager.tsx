'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Star, Trash2 } from 'lucide-react'
import type { RestaurantPhotoDTO } from '@/lib/types'

interface PhotoGalleryManagerProps {
  restaurantId: string
  onSetHero: (url: string) => void
}

/**
 * Views and manages the RestaurantPhoto gallery for one restaurant. Reads
 * and writes through the admin photo-moderation endpoints from docs/PLAN.md
 * Phase 5 (`/api/admin/photos`), which is out of this phase's file
 * ownership. Until that phase lands this degrades to a clear "not available
 * yet" message instead of crashing the form — see 404 handling below.
 */
export default function PhotoGalleryManager({ restaurantId, onSetHero }: PhotoGalleryManagerProps) {
  const [photos, setPhotos] = useState<RestaurantPhotoDTO[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/photos?restaurantId=${restaurantId}`)
      if (res.status === 404) {
        setUnavailable(true)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load photos')
        return
      }
      setPhotos(data.photos || [])
    } catch {
      setUnavailable(true)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const deletePhoto = async (photoId: string) => {
    if (!window.confirm('Delete this photo?')) return
    setBusyId(photoId)
    try {
      const res = await fetch(`/api/admin/photos/${photoId}?action=delete`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to delete photo')
        return
      }
      setPhotos((p) => p?.filter((ph) => ph.id !== photoId) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon size={20} className="text-primary" />
        <h2 className="text-xl font-semibold text-primary">Photo Gallery</h2>
      </div>

      {unavailable && (
        <p className="text-sm text-text-secondary">
          Photo management isn't available yet — it ships with the community photo moderation queue.
        </p>
      )}
      {error && <p className="text-sm text-error mb-3">{error}</p>}

      {photos && photos.length === 0 && !unavailable && (
        <p className="text-sm text-text-secondary">No gallery photos yet.</p>
      )}

      {photos && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="space-y-2">
              <img
                src={photo.url}
                alt={photo.caption || ''}
                className="w-full aspect-square object-cover rounded-lg border border-border"
              />
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span className="capitalize">{photo.status}</span>
                <span>{photo.source}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetHero(photo.url)}
                  title="Set as hero image"
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-surface-hover hover:bg-border border border-border rounded text-xs transition-colors"
                >
                  <Star size={12} /> Hero
                </button>
                <button
                  type="button"
                  onClick={() => deletePhoto(photo.id)}
                  disabled={busyId === photo.id}
                  title="Delete photo"
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-surface-hover hover:bg-error/20 hover:text-error border border-border rounded text-xs transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
