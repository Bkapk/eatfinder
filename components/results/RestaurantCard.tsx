'use client'

import Link from 'next/link'
import { ImageOff, Star } from 'lucide-react'
import type { RestaurantDTO } from '@/lib/types'
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

/**
 * A search result, a saved place or a similar place. Only a search result has
 * a score and a distance; everything else is optional so one card serves all
 * three instead of three cards drifting apart.
 */
export type CardItem = RestaurantDTO & {
  score?: number
  distanceKm?: number | null
  isOpenNow?: boolean | null
  changeAt?: string | null
}

type Size = 'grid' | 'list' | 'popup' | 'carousel'

/** "Open · Closes 23:00", "Closed · Opens 18:00", or just the state. */
function OpenState({ item, locale }: { item: CardItem; locale: Locale }) {
  if (item.isOpenNow == null) return null
  const open = item.isOpenNow
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${open ? 'text-success' : 'text-error'}`}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">
        {t(locale, open ? 'card.openNow' : 'card.closed')}
        {item.changeAt && (
          <span className="font-semibold text-text-secondary">
            {' · '}
            {t(locale, open ? 'card.closesAt' : 'card.opensAt', { time: item.changeAt })}
          </span>
        )}
      </span>
    </span>
  )
}

function Rating({ value, locale }: { value: number; locale: Locale }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[14px] font-bold tabular-nums text-text"
      aria-label={t(locale, 'card.rating', { n: value.toFixed(1) })}
    >
      <Star size={14} aria-hidden className="fill-accent text-accent" />
      <span aria-hidden>{value.toFixed(1)}</span>
    </span>
  )
}

export default function RestaurantCard({
  item,
  locale,
  size = 'grid',
  onHover,
  active = false,
  eager = false,
}: {
  item: CardItem
  locale: Locale
  size?: Size
  onHover?: (id: string | null) => void
  active?: boolean
  /** The first row of a list is above the fold: don't make it wait on lazy. */
  eager?: boolean
}) {
  const row = size === 'list' || size === 'carousel'
  const popup = size === 'popup'
  const stars = item.googleRating ?? item.rating
  const cuisine = item.cuisines[0] ? tVocab(locale, 'cuisine', item.cuisines[0]) : null

  // cuisine · $$ · 1.2 km — one line, the order people scan it in.
  const meta = [
    cuisine,
    priceGlyphs(item.priceLevel),
    item.distanceKm == null
      ? null
      : item.distanceKm < 0.995 // not "1000 m"
        ? t(locale, 'card.distanceM', { n: Math.round(item.distanceKm * 100) * 10 })
        : t(locale, 'card.distance', { n: item.distanceKm.toFixed(1) }),
  ].filter(Boolean)

  const hover = onHover
    ? {
        onMouseEnter: () => onHover(item.id),
        onMouseLeave: () => onHover(null),
        // Focus mirrors hover: tabbing a card highlights its map pin too.
        onFocus: () => onHover(item.id),
        onBlur: () => onHover(null),
      }
    : {}

  const photo = (
    <>
      {item.image ? (
        // Plain <img>: the URL is opaque and moves to Cloudflare R2 shortly,
        // so it must never be routed through next/image's remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          // The name is the link text right beside it; alt={name} made a
          // screen reader say every restaurant twice.
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:scale-[1.015]"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-text-secondary"
          aria-label={t(locale, 'card.noImage')}
        >
          <ImageOff size={popup || row ? 18 : 24} aria-hidden />
        </div>
      )}
    </>
  )

  const name = (
    <Link
      href={`/r/${item.slug}`}
      className={[
        'min-w-0 truncate font-bold leading-snug text-text',
        // The whole card is the target; the link text is its name.
        "after:absolute after:inset-0 after:z-[1] after:content-['']",
        popup ? 'text-[14px]' : 'text-[16px]',
      ].join(' ')}
    >
      {item.name}
    </Link>
  )

  // --- the photo-led card: grid view and similar places -------------------
  if (size === 'grid') {
    return (
      <article {...hover} className="ef-press group relative flex h-full flex-col">
        <div
          className={[
            'relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-muted',
            'transition-shadow duration-[var(--dur)]',
            // Hovered from its map pin: a ring, not a lift. Cards do not travel.
            active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
          ].join(' ')}
        >
          {photo}
          {item.isFeatured && (
            <span className="absolute left-3 top-3 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent shadow-sm">
              {t(locale, 'card.featured')}
            </span>
          )}
          {/* z-[2]: above the name link's stretched ::after, so the heart is
              its own target and not a tap on the card. */}
          <FavoriteButton
            id={item.id}
            locale={locale}
            className="ef-favorite-overlay absolute right-3 top-3 z-[2] h-10 w-10"
            size={18}
          />
          {item.score != null && (
            <span className="absolute bottom-3 left-3 rounded-full bg-surface px-2.5 py-1 text-[12px] font-bold leading-none text-accent shadow-sm">
              {t(locale, 'card.match', { n: matchPercent(item.score) })}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1 pt-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            {name}
            {stars != null && <Rating value={stars} locale={locale} />}
          </div>
          <p className="truncate text-[14px] font-medium text-text-secondary">
            {meta.join(' · ')}
          </p>
          <p className="text-[13px] font-bold">
            <OpenState item={item} locale={locale} />
          </p>
        </div>
      </article>
    )
  }

  // --- the compact row: list view, the phone map carousel, the popup -------
  return (
    <article
      {...hover}
      className={[
        'ef-card ef-press group relative h-full overflow-hidden',
        row ? 'flex' : 'flex flex-col',
        size === 'carousel' ? 'shadow-lg' : '',
        active ? 'ring-2 ring-primary' : '',
      ].join(' ')}
    >
      <div
        className={[
          'relative shrink-0 overflow-hidden bg-surface-muted',
          row ? 'w-28 self-stretch sm:w-32' : 'aspect-[16/9]',
        ].join(' ')}
      >
        {photo}
        {!popup && (
          <FavoriteButton
            id={item.id}
            locale={locale}
            className="ef-favorite-overlay absolute left-2 top-2 z-[2]"
          />
        )}
      </div>

      <div className={['flex min-w-0 flex-1 flex-col gap-1', popup ? 'p-3' : 'p-3.5'].join(' ')}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {name}
          {stars != null && <Rating value={stars} locale={locale} />}
        </div>
        <p className="truncate text-[13px] font-medium text-text-secondary">{meta.join(' · ')}</p>
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-1 text-[12px] font-bold">
          <OpenState item={item} locale={locale} />
          {item.score != null && !popup && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-soft px-2 py-1 text-[11px] font-bold leading-none text-accent">
              {t(locale, 'card.match', { n: matchPercent(item.score) })}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
