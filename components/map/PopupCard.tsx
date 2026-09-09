'use client'

import Link from 'next/link'
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
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-[13px] font-bold text-text-secondary shadow-sm transition-colors duration-200 hover:text-text"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </Popup>
  )
}
