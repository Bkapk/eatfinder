'use client'

import Link from 'next/link'
import { Clock, ImageOff, Navigation, Utensils } from 'lucide-react'
import type { ScoredRestaurant } from '@/lib/types'
import { priceGlyphs, t, tVocab, type Locale } from '@/lib/i18n'
import FavoriteButton from '@/components/FavoriteButton'

/**
 * Ceiling of lib/scoring.ts: 3 axes x 100, +25 rating, +10 featured,
 * +30 distance, +15 open now, +5 wolt. Used only to render the raw score as a
 * percentage — if the weights there change this number follows, nothing breaks.
 */
const MATCH_MAX = 385

export function matchPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round((score / MATCH_MAX) * 100)))
}

type Size = 'grid' | 'list' | 'popup'

export default function RestaurantCard({
  item,
  locale,
  size = 'grid',
  onHover,
  active = false,
}: {
  item: ScoredRestaurant
  locale: Locale
  size?: Size
  onHover?: (id: string | null) => void
  active?: boolean
}) {
  const row = size === 'list'
  const popup = size === 'popup'

  return (
    <article
      onMouseEnter={onHover ? () => onHover(item.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      // Focus mirrors hover: tabbing a card highlights its map pin too.
      onFocus={onHover ? () => onHover(item.id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      className={[
        'ef-card group relative h-full overflow-hidden',
        row ? 'flex' : 'flex flex-col',
        active ? 'ring-2 ring-primary' : '',
      ].join(' ')}
    >
      <div
        className={[
          'relative shrink-0 overflow-hidden bg-surface-muted',
          row ? 'w-28 sm:w-32' : popup ? 'aspect-[16/9]' : 'aspect-[3/2]',
        ].join(' ')}
      >
        {item.image ? (
          // Plain <img>: the URL is opaque and moves to Cloudflare R2 shortly,
          // so it must never be routed through next/image's remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-text-secondary"
            aria-label={t(locale, 'card.noImage')}
          >
            <ImageOff size={popup ? 16 : 22} aria-hidden />
          </div>
        )}

        <FavoriteButton
          id={item.id}
          locale={locale}
          className="absolute left-2 top-2 z-overlay grid h-9 w-9 place-items-center rounded-full bg-surface/90 text-text-secondary shadow-sm backdrop-blur transition-colors duration-200 hover:bg-surface hover:text-accent"
        />

        {item.isFeatured && !popup && (
          // 11px is the scale's floor and 0.08em is what every other uppercase
          // run in the app uses; this badge was the only 10px text shipping.
          <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--on-primary)]">
            {t(locale, 'card.featured')}
          </span>
        )}
      </div>

      {/* p-4, not p-3.5: 14px was the one off-scale inset in the app, and it is
          the padding the loading skeleton has to reproduce exactly or the whole
          list shifts a couple of pixels the moment results arrive. */}
      <div className={['flex min-w-0 flex-1 flex-col gap-2', popup ? 'p-3' : 'p-4'].join(' ')}>
        <Link
          href={`/r/${item.slug}`}
          className="truncate text-[15px] font-bold leading-snug text-text after:absolute after:inset-0 after:content-['']"
        >
          {item.name}
        </Link>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-text-secondary">
          {item.cuisines[0] && (
            <li className="flex min-w-0 items-center gap-1">
              <Utensils size={13} aria-hidden className="shrink-0" />
              <span className="truncate">{tVocab(locale, 'cuisine', item.cuisines[0])}</span>
            </li>
          )}
          {/* The bottom row already carries the price as the listing anchor. In
              the 236px popup the two sit a line apart and read as a mistake. */}
          {!popup && (
            <li
              className="flex items-center gap-1"
              aria-label={t(locale, 'card.priceLevel', { n: item.priceLevel })}
            >
              <span aria-hidden>{priceGlyphs(item.priceLevel)}</span>
            </li>
          )}
          {item.distanceKm != null && (
            <li className="flex items-center gap-1">
              <Navigation size={13} aria-hidden className="shrink-0" />
              {t(locale, 'card.distance', { n: item.distanceKm.toFixed(1) })}
            </li>
          )}
          <li
            className={[
              'flex items-center gap-1',
              item.isOpenNow === true
                ? 'text-success'
                : item.isOpenNow === false
                  ? 'text-error'
                  : '',
            ].join(' ')}
          >
            <Clock size={13} aria-hidden className="shrink-0" />
            {t(
              locale,
              item.isOpenNow === true
                ? 'card.openNow'
                : item.isOpenNow === false
                  ? 'card.closed'
                  : 'card.hoursUnknown'
            )}
          </li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <span className="text-[17px] font-extrabold leading-none tracking-tight text-text">
            {priceGlyphs(item.priceLevel)}
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-bold leading-none text-accent">
            {t(locale, 'card.match', { n: matchPercent(item.score) })}
          </span>
        </div>
      </div>
    </article>
  )
}
