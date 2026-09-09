'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Heart } from 'lucide-react'
import type { RestaurantDTO, RestaurantPhotoDTO } from '@/lib/types'
import { priceGlyphs, t, type Locale, type TKey } from '@/lib/i18n'

interface Me {
  id: string
  username: string
  role: string
  displayName: string
}

type MyPhoto = RestaurantPhotoDTO & { restaurantSlug: string; restaurantName: string }

export default function AccountView({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [favorites, setFavorites] = useState<RestaurantDTO[]>([])
  const [photos, setPhotos] = useState<MyPhoto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        if (!meRes.ok) return
        const meData = await meRes.json()
        setMe(meData.user)

        const [favRes, photoRes] = await Promise.all([
          fetch('/api/community/favorites'),
          fetch('/api/community/photos'),
        ])
        if (favRes.ok) setFavorites((await favRes.json()).restaurants)
        if (photoRes.ok) setPhotos((await photoRes.json()).photos)
      } catch {
        // Offline or a 5xx: fall through to the signed-out card rather than
        // sitting on the loading line forever.
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (loading) {
    // Same panel shell as the signed-in view, so the page does not change shape
    // between "loading" and the answer.
    return (
      <p className="ef-panel py-10 text-center text-[14px] text-text-secondary">
        {t(locale, 'account.loading')}
      </p>
    )
  }

  if (!me) {
    return (
      <div className="ef-card p-6 text-center">
        <p className="mb-4 text-[14px] text-text-secondary">{t(locale, 'account.notSignedIn')}</p>
        <Link href="/account/login" className="ef-pill ef-pill--active inline-flex">
          {t(locale, 'account.signInLink')}
        </Link>
      </div>
    )
  }

  return (
    // gap-6, not gap-8: the two sections below are cards on a tinted page, and
    // 32px pushed the second one below the fold on a phone for no gain.
    <div className="flex flex-col gap-6">
      {/* .ef-panel, so the header sits on the same padding as the sections it
          introduces — it was a hand-rolled copy of the same card at p-5. */}
      <header className="ef-panel flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="ef-title">
            {t(locale, 'account.title')}
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            {t(locale, 'account.signedInAs', { name: me.displayName || me.username })}
          </p>
        </div>
        <button type="button" onClick={logout} className="ef-pill">
          {t(locale, 'account.logout')}
        </button>
      </header>

      <section className="ef-panel">
        <h2 className="ef-label mb-4">{t(locale, 'account.favorites.title')}</h2>
        {favorites.length === 0 ? (
          // The empty state carries the same heart the cards do, so the
          // instruction is the control the user is looking for, not a
          // description of it — and a way out to the map, which is the only
          // thing they can usefully do from here.
          <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-10 text-center">
            <Heart size={22} aria-hidden className="text-text-secondary" />
            <p className="max-w-xs text-[14px] text-text-secondary">
              {t(locale, 'account.favorites.empty')}
            </p>
            <Link href="/" className="ef-pill">
              {t(locale, 'account.favorites.emptyCta')}
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
            {favorites.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.slug}`} className="ef-card block overflow-hidden">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image}
                      alt={r.name}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-surface-muted text-text-secondary">
                      <Heart size={20} aria-hidden />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-[13px] font-bold leading-snug text-text">
                      {r.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-secondary">
                      {priceGlyphs(r.priceLevel)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ef-panel">
        <h2 className="ef-label mb-4">{t(locale, 'account.photos.title')}</h2>
        {photos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-10 text-center">
            <Camera size={22} aria-hidden className="text-text-secondary" />
            <p className="max-w-sm text-[14px] text-text-secondary">
              {t(locale, 'account.photos.empty')}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="ef-card overflow-hidden">
                <Link href={`/r/${p.restaurantSlug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || p.restaurantName}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                </Link>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="truncate text-[13px] font-bold text-text">{p.restaurantName}</p>
                  <PhotoStatusBadge status={p.status} locale={locale} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const STATUS_KEY: Record<string, TKey> = {
  approved: 'account.photos.status.approved',
  rejected: 'account.photos.status.rejected',
  pending: 'account.photos.status.pending',
}

function PhotoStatusBadge({ status, locale }: { status: string; locale: Locale }) {
  const key = STATUS_KEY[status] ?? STATUS_KEY.pending
  // .ef-badge, the same pill the dashboard uses. This was the app's only 4px
  // corner and its own type weight — a guest and a moderator were reading the
  // same word in two different components.
  const tone =
    status === 'approved'
      ? 'ef-badge--success'
      : status === 'rejected'
        ? 'ef-badge--error'
        : 'ef-badge--info'
  return <span className={`ef-badge ${tone} shrink-0`}>{t(locale, key)}</span>
}
