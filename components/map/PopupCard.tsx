'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Popup } from 'react-map-gl/mapbox'
import type { MapPoint, ScoredRestaurant } from '@/lib/types'
import { priceGlyphs, t, type Locale } from '@/lib/i18n'
import RestaurantCard from '@/components/results/RestaurantCard'

/**
 * Marker-anchored card. `item` is the full scored record when the marker's
 * restaurant is in the pages already loaded; `points` runs to 500 while `items`
 * pages at 24, so a pin further down the ranking falls back to what MapPoint
 * actually carries rather than firing a second request per click.
 */
export default function PopupCard({
  locale,
  point,
  item,
  onClose,
}: {
  locale: Locale
  point: MapPoint
  item?: ScoredRestaurant
  onClose: () => void
}) {
  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      offset={16}
      closeButton={false}
      // Mapbox closes its own popup on the next map click, which is the same
      // click that selects the next pin. react-map-gl never re-adds a popup it
      // did not just mount, so that left a live <PopupCard> pointing at a dead
      // instance and no pin openable until a remount. MapPane already clears
      // the selection when a click lands on no feature, so this is only ever
      // removing the duplicate.
      closeOnClick={false}
      onClose={onClose}
      maxWidth="260px"
      className="ef-popup"
    >
      {/* Fade only. The popup is positioned by mapbox on the marker it belongs
          to, and anything that moves it moves it away from its own pin. */}
      <div className="ef-fade-enter relative w-[236px]">
        {item ? (
          <RestaurantCard item={item} locale={locale} size="popup" />
        ) : (
          <Link href={`/r/${point.slug}`} className="ef-card block p-3">
            <span className="block truncate text-[14px] font-bold text-text">{point.name}</span>
            <span className="mt-1 block text-[13px] font-bold text-text-secondary">
              {priceGlyphs(point.priceLevel)}
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={t(locale, 'map.closePopup')}
          // The same overlay-control chrome the favourite heart uses, mirrored
          // to the other corner: one definition of "a round control sitting on
          // a photo", not a second 28px × glyph that exists nowhere else. Only
          // the hover ink differs — ember means "food quality", and dismissing
          // a popup is not that.
          className="ef-favorite-overlay absolute right-2 top-2 z-overlay hover:text-text"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </Popup>
  )
}
