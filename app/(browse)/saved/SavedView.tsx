'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { isOpenAt, nextChange } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'
import { reloadFavorites, useFavorites } from '@/components/useFavorites'
import RestaurantCard from '@/components/results/RestaurantCard'

export default function SavedView({ locale }: { locale: Locale }) {
  const { ids, signedIn, restaurants } = useFavorites()
  // The store loads once per visit; a heart tapped since then is in `ids`
  // but has no row yet. One refresh on arrival picks those up.
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    reloadFavorites().finally(() => setFresh(true))
  }, [])

  // Filtered by the live ids, so un-hearting here takes the card away at once.
  const now = new Date()
  const places = restaurants
    .filter((r) => ids.includes(r.id))
    .map((r) => ({ ...r, isOpenNow: isOpenAt(r.openHours, now), changeAt: nextChange(r.openHours, now) }))

  if (signedIn === false) {
    return (
      <div className="ef-enter flex flex-col items-center px-2 py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
          <Heart size={28} aria-hidden className="fill-accent" />
        </span>
        <h2 className="ef-heading mt-5">{t(locale, 'saved.signedOutTitle')}</h2>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-text-secondary">
          {t(locale, 'saved.signedOutBody')}
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Link href="/account/login?next=/saved" className="ef-btn ef-btn--primary">
            {t(locale, 'nav.signIn')}
          </Link>
          <Link href="/account/register" className="ef-btn ef-btn--ghost">
            {t(locale, 'nav.register')}
          </Link>
        </div>
      </div>
    )
  }

  if (!fresh && places.length === 0) {
    return (
      <ul aria-hidden className="ef-results-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-surface-hover" />
            <div className="mt-3 h-4 w-3/5 animate-pulse rounded-full bg-surface-hover" />
            <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded-full bg-surface-muted" />
          </li>
        ))}
      </ul>
    )
  }

  if (places.length === 0) {
    return (
      <div className="ef-enter flex flex-col items-center px-2 py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-hover text-text-secondary">
          <Heart size={28} aria-hidden />
        </span>
        <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-text-secondary">
          {t(locale, 'saved.empty')}
        </p>
        <Link href="/" className="ef-btn ef-btn--primary mt-6">
          {t(locale, 'account.favorites.emptyCta')}
        </Link>
      </div>
    )
  }

  return (
    <>
      <p className="-mt-4 mb-6 text-[14px] font-semibold text-text-secondary tabular-nums">
        {places.length === 1 ? t(locale, 'results.headingOne') : t(locale, 'results.heading', { n: places.length })}
      </p>
      <ul className="ef-results-grid">
        {places.map((item, i) => (
          <li key={item.id}>
            <RestaurantCard item={item} locale={locale} size="grid" eager={i < 2} />
          </li>
        ))}
      </ul>
    </>
  )
}
