'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
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
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) {
        setLoading(false)
        return
      }
      const meData = await meRes.json()
      setMe(meData.user)

      const [favRes, photoRes] = await Promise.all([
        fetch('/api/community/favorites'),
        fetch('/api/community/photos'),
      ])
      if (favRes.ok) setFavorites((await favRes.json()).restaurants)
      if (photoRes.ok) setPhotos((await photoRes.json()).photos)
      setLoading(false)
    })()
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return <p className="text-[14px] text-text-secondary">{t(locale, 'account.loading')}</p>
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
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text">{t(locale, 'account.title')}</h1>
          <p className="text-[13px] text-text-secondary">
            {t(locale, 'account.signedInAs', { name: me.displayName || me.username })}
          </p>
        </div>
        <button type="button" onClick={logout} className="ef-pill">
          {t(locale, 'account.logout')}
        </button>
      </header>

      <section>
        <h2 className="ef-label mb-3">{t(locale, 'account.favorites.title')}</h2>
        {favorites.length === 0 ? (
          <p className="text-[14px] text-text-secondary">{t(locale, 'account.favorites.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {favorites.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.slug}`} className="ef-card block overflow-hidden">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt={r.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-surface-muted text-text-secondary">
                      <Heart size={20} aria-hidden />
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-bold text-text">{r.name}</p>
                    <p className="text-[12px] text-text-secondary">{priceGlyphs(r.priceLevel)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="ef-label mb-3">{t(locale, 'account.photos.title')}</h2>
        {photos.length === 0 ? (
          <p className="text-[14px] text-text-secondary">{t(locale, 'account.photos.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="ef-card overflow-hidden">
                <Link href={`/r/${p.restaurantSlug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || p.restaurantName}
                    className="aspect-square w-full object-cover"
                  />
                </Link>
                <div className="flex items-center justify-between gap-2 p-2.5">
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
  const cls =
    status === 'approved'
      ? 'bg-success/10 text-success'
      : status === 'rejected'
        ? 'bg-error/10 text-error'
        : 'bg-info/10 text-info'
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{t(locale, key)}</span>
}
