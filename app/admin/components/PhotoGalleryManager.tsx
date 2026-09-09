'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Star, Trash2 } from 'lucide-react'
import type { RestaurantPhotoDTO } from '@/lib/types'

interface PhotoGalleryManagerProps {
  restaurantId: string
  restaurantName?: string
  onSetHero: (url: string) => void
}

/**
 * Views and manages the RestaurantPhoto gallery for one restaurant. Reads
 * and writes through the admin photo-moderation endpoints from docs/PLAN.md
 * Phase 5 (`/api/admin/photos`), which is out of this phase's file
 * ownership. Until that phase lands this degrades to a clear "not available
 * yet" message instead of crashing the form — see 404 handling below.
 */
export default function PhotoGalleryManager({
  restaurantId,
  restaurantName,
  onSetHero,
}: PhotoGalleryManagerProps) {
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
    <div className="ef-panel admin-form-wide">
      <div className="mb-4 flex items-center gap-2.5">
        <ImageIcon size={18} className="text-primary" aria-hidden />
        <h2>Photo gallery</h2>
      </div>

      {unavailable && (
        <p className="text-sm leading-relaxed text-text-secondary">
          Photo management isn&apos;t available yet — it ships with the community photo moderation
          queue.
        </p>
      )}
      {error && (
        <div role="alert" className="ef-alert">
          {error}
        </div>
      )}

      {photos && photos.length === 0 && !unavailable && (
        <p className="admin-upload text-center text-sm text-text-secondary">
          No gallery photos yet.
        </p>
      )}

      {photos && photos.length > 0 && (
        <div className="ef-stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              // Capped at 9 like the public results grid: a gallery of 200
              // photos must not take twenty seconds to finish arriving.
              style={{ '--i': Math.min(i, 9) } as React.CSSProperties}
              // A tile mid-delete dims and stops taking clicks rather than
              // vanishing under the cursor.
              className={`space-y-2 transition-opacity duration-200 ${
                busyId === photo.id ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {/* Opaque URL from the database (local disk today, R2 next), so it
                  must not be routed through next/image's remotePatterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || restaurantName || ''}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-xl border border-border object-cover"
              />
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-text-secondary">
                <span className="truncate capitalize">{photo.status}</span>
                <span className="truncate">{photo.source}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetHero(photo.url)}
                  title="Set as hero image"
                  className="ef-btn ef-btn--ghost flex-1"
                >
                  <Star size={15} aria-hidden /> Hero
                </button>
                <button
                  type="button"
                  onClick={() => deletePhoto(photo.id)}
                  disabled={busyId === photo.id}
                  title="Delete photo"
                  aria-label="Delete gallery photo"
                  className="ef-icon-btn ef-icon-btn--danger"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
