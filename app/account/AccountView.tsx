'use client'

import Link from 'next/link'
import { ArrowUpRight, Camera, ChevronRight, Heart, ImageOff, Shield, UserRound } from 'lucide-react'
import { priceGlyphs, t, type Locale, type TKey } from '@/lib/i18n'
import { useVocabLabel } from '@/components/VocabProvider'
import { BarList, Donut, SERIES } from '@/components/charts'
import AccountSettings from './AccountSettings'

export interface SavedPlace {
  id: string
  slug: string
  name: string
  image: string | null
  cuisines: string[]
  neighborhood: string
  priceLevel: number
  rating: number | null
  savedAt: string
}

export interface MyPhoto {
  id: string
  url: string
  caption: string
  status: string
  createdAt: string
  restaurantSlug: string
  restaurantName: string
}

export interface AccountData {
  user: {
    id: string
    username: string
    role: string
    displayName: string
    email: string | null
    createdAt: string
  }
  saved: SavedPlace[]
  photos: MyPhoto[]
}

const intlLocale = (locale: Locale) => (locale === 'sq' ? 'sq-AL' : 'en-GB')

/** Most frequent values first; ties keep first-seen order (= most recently saved). */
function tally(values: string[]): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function AccountView({ locale, data }: { locale: Locale; data: AccountData | null }) {
  if (!data) return <GuestCard locale={locale} />

  const { user, saved, photos } = data
  const name = user.displayName || user.username
  const approved = photos.filter((p) => p.status === 'approved').length
  const pending = photos.filter((p) => p.status === 'pending').length
  const since = new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(
    new Date(user.createdAt)
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* The one dark card: who you are, and the three numbers that are yours. */}
      <section aria-labelledby="account-name" className="ef-hero ef-enter lg:col-span-8 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-[17px] font-extrabold text-on-primary sm:h-16 sm:w-16"
          >
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="ef-label ef-hero-muted">{t(locale, 'account.title')}</p>
            <h1 id="account-name" className="ef-title mt-1 break-words !text-surface">
              {name}
            </h1>
            <p className="ef-hero-muted mt-1.5 text-[13px] font-semibold">
              {t(locale, 'account.memberSince', { date: since })}
            </p>
          </div>
        </div>

        {user.role === 'admin' && (
          <Link
            href="/admin"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--hero-line)] px-4 text-[13px] font-semibold hover:bg-[color:var(--hero-line)]"
          >
            <Shield size={15} aria-hidden />
            {t(locale, 'account.openAdmin')}
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        )}

        <dl className="mt-7 grid grid-cols-3 border-t border-[color:var(--hero-line)] pt-5 sm:mt-9">
          {(
            [
              ['account.stats.saved', saved.length],
              ['account.stats.photos', photos.length],
              ['account.photos.status.approved', approved],
            ] as [TKey, number][]
          ).map(([key, n], i) => (
            <div key={key} className={i ? 'border-l border-[color:var(--hero-line)] pl-4 sm:pl-6' : ''}>
              <dt className="ef-hero-muted text-[12px] font-semibold leading-snug sm:text-[13px]">
                {t(locale, key)}
              </dt>
              <dd className="ef-figure mt-2">{n}</dd>
            </div>
          ))}
        </dl>
        {pending > 0 && (
          <p className="ef-hero-muted mt-4 text-[12px] font-semibold">
            {t(locale, 'account.stats.pendingNote', { n: pending })}
          </p>
        )}
      </section>

      <TasteCard locale={locale} saved={saved} />

      <RecentlySaved locale={locale} saved={saved} />

      <PhotosCard locale={locale} photos={photos} />

      <AccountSettings
        locale={locale}
        displayName={user.displayName}
        email={user.email ?? user.username}
      />
    </div>
  )
}

function GuestCard({ locale }: { locale: Locale }) {
  return (
    <div className="ef-enter mx-auto flex max-w-md flex-col items-center px-2 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
        <UserRound size={28} aria-hidden />
      </span>
      <h1 className="ef-title mt-5">{t(locale, 'account.guestTitle')}</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-text-secondary">
        {t(locale, 'account.guestBody')}
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <Link href="/account/login" className="ef-btn ef-btn--primary">
          {t(locale, 'account.signInLink')}
        </Link>
        <Link href="/account/register" className="ef-btn ef-btn--ghost">
          {t(locale, 'nav.register')}
        </Link>
      </div>
    </div>
  )
}

function TasteCard({ locale, saved }: { locale: Locale; saved: SavedPlace[] }) {
  const label = useVocabLabel(locale)
  const cuisines = tally(saved.flatMap((s) => s.cuisines))
  const areas = tally(saved.map((s) => s.neighborhood)).slice(0, 3)
  const top = cuisines.slice(0, 4)
  const rest = cuisines.slice(4).reduce((s, c) => s + c.count, 0)
  const tagged = cuisines.reduce((s, c) => s + c.count, 0)
  const avgPrice = saved.length ? Math.round(saved.reduce((s, r) => s + r.priceLevel, 0) / saved.length) : 0
  const pct = (n: number) => Math.round((n / Math.max(1, tagged)) * 100)

  return (
    <section aria-labelledby="taste-h" className="ef-panel lg:col-span-4 lg:row-span-2">
      <h2 id="taste-h" className="ef-heading">
        {t(locale, 'account.taste.title')}
      </h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        {saved.length === 1
          ? t(locale, 'account.taste.leadOne')
          : t(locale, 'account.taste.lead', { n: saved.length })}
      </p>

      {tagged === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-10 text-center">
          <Heart size={22} aria-hidden className="text-accent" />
          <p className="max-w-[16rem] text-[14px] leading-relaxed text-text-secondary">
            {t(locale, 'account.taste.empty')}
          </p>
          <Link href="/eat" className="ef-btn ef-btn--primary mt-1">
            {t(locale, 'account.favorites.emptyCta')}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-5">
            <Donut
              size={124}
              label={top.map((c) => `${label('cuisine', c.key)} ${pct(c.count)}%`).join(', ')}
              segments={[
                ...top.map((c, i) => ({ value: c.count, color: SERIES[i] })),
                ...(rest ? [{ value: rest, color: SERIES[4] }] : []),
              ]}
            >
              <span>
                <span className="ef-figure block text-[26px]">{pct(top[0].count)}%</span>
                <span className="mt-1 block max-w-[5.5rem] truncate text-[11px] font-semibold text-text-secondary">
                  {label('cuisine', top[0].key)}
                </span>
              </span>
            </Donut>
            <ul className="min-w-0 flex-1">
              {top.map((c, i) => (
                <li key={c.key}>
                  {/* Each cuisine is a way back into search: "more of this". */}
                  <Link
                    href={`/eat?cuisines=${encodeURIComponent(c.key)}`}
                    className="ef-row !min-h-11 !py-1 text-[13px]"
                    aria-label={t(locale, 'account.taste.explore', { label: label('cuisine', c.key) })}
                  >
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[i] }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{label('cuisine', c.key)}</span>
                    <span className="tabular-nums text-text-secondary">{c.count}</span>
                  </Link>
                </li>
              ))}
              {rest > 0 && (
                <li className="flex min-h-11 items-center gap-3 text-[13px] text-text-secondary">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[4] }} />
                  <span className="flex-1">{t(locale, 'account.taste.other')}</span>
                  <span className="tabular-nums">{rest}</span>
                </li>
              )}
            </ul>
          </div>

          {areas.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="ef-label mb-3">{t(locale, 'account.taste.areas')}</h3>
              <BarList
                max={saved.length}
                rows={areas.map((a) => ({
                  key: a.key,
                  label: (
                    <Link href={`/eat?neighborhoods=${encodeURIComponent(a.key)}`} className="hover:text-primary">
                      {label('neighborhood', a.key)}
                    </Link>
                  ),
                  value: a.count,
                }))}
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <h3 className="ef-label">{t(locale, 'account.taste.price')}</h3>
            <p className="text-[17px] font-extrabold tracking-wider" aria-label={priceGlyphs(avgPrice)}>
              <span className="text-accent">{priceGlyphs(avgPrice)}</span>
              <span className="text-border-strong" aria-hidden>
                {'$'.repeat(4 - Math.max(1, avgPrice))}
              </span>
            </p>
          </div>
        </>
      )}
    </section>
  )
}

function RecentlySaved({ locale, saved }: { locale: Locale; saved: SavedPlace[] }) {
  const label = useVocabLabel(locale)
  return (
    <section aria-labelledby="recent-h" className="ef-panel lg:col-span-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="recent-h" className="ef-heading">
          {t(locale, 'account.saved.title')}
        </h2>
        {saved.length > 0 && (
          <Link href="/saved" className="ef-pill ef-pill--quiet -mr-2 h-11 text-primary">
            {t(locale, 'account.saved.all')}
            <ChevronRight size={15} aria-hidden />
          </Link>
        )}
      </div>
      {saved.length === 0 ? (
        <p className="rounded-xl bg-background px-4 py-8 text-center text-[14px] text-text-secondary">
          {t(locale, 'saved.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
          {saved.slice(0, 4).map((r) => (
            <li key={r.id} className="group min-w-0">
              <Link href={`/r/${r.slug}`} className="ef-press block rounded-xl">
                <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-surface-muted">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-[var(--dur)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-text-secondary">
                      <ImageOff size={20} aria-hidden />
                    </span>
                  )}
                </span>
                <span className="mt-2 block truncate text-[14px] font-bold text-text">{r.name}</span>
                <span className="block truncate text-[12px] font-semibold text-text-secondary">
                  {[r.cuisines[0] && label('cuisine', r.cuisines[0]), priceGlyphs(r.priceLevel)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const STATUS: Record<string, { key: TKey; tone: string }> = {
  approved: { key: 'account.photos.status.approved', tone: 'ef-badge--success' },
  rejected: { key: 'account.photos.status.rejected', tone: 'ef-badge--error' },
  // --info, not --warning: on the guest's side "pending" means "we have it",
  // nothing is owed. The admin queue shows the same state as a warning.
  pending: { key: 'account.photos.status.pending', tone: 'ef-badge--info' },
}

function PhotosCard({ locale, photos }: { locale: Locale; photos: MyPhoto[] }) {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short' })
  const shown = photos.slice(0, 6)
  return (
    <section aria-labelledby="photos-h" className="ef-panel lg:col-span-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="photos-h" className="ef-heading">
          {t(locale, 'account.photos.title')}
        </h2>
        {photos.length > 0 && (
          <span className="text-[13px] font-semibold tabular-nums text-text-secondary">{photos.length}</span>
        )}
      </div>
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-10 text-center">
          <Camera size={22} aria-hidden className="text-text-secondary" />
          <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">{t(locale, 'account.photos.empty')}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map((p) => {
              const s = STATUS[p.status] ?? STATUS.pending
              return (
                <li key={p.id}>
                  <Link href={`/r/${p.restaurantSlug}`} className="ef-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 shrink-0 rounded-lg bg-surface-muted object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">{p.restaurantName}</span>
                      <span className="block truncate text-[12px] font-semibold text-text-secondary">
                        {fmt.format(new Date(p.createdAt))}
                        {p.caption && ` · ${p.caption}`}
                      </span>
                    </span>
                    <span className={`ef-badge ${s.tone} shrink-0`}>{t(locale, s.key)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {photos.length > shown.length && (
            <p className="mt-3 text-[12px] font-semibold text-text-secondary">
              {t(locale, 'account.photos.more', { n: photos.length - shown.length })}
            </p>
          )}
        </>
      )}
    </section>
  )
}
