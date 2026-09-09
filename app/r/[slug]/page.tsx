import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Instagram, MapPin, Phone, ShoppingBag, Star } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { DAYS, isOpenAt, photoToDTO, toDTO } from '@/lib/types'
import { LOCALE_COOKIE, priceGlyphs, resolveLocale, t, tVocab, type Locale } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import FavoriteButton from '@/components/FavoriteButton'
import MiniMap from '@/components/map/MiniMap'
import PhotoUpload from '@/components/community/PhotoUpload'

export const dynamic = 'force-dynamic'

/** One query, one shape. Only approved photos ever leave this function. */
async function load(slug: string) {
  const row = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      photos: {
        where: { status: 'approved' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { submittedBy: { select: { displayName: true } } },
      },
    },
  })
  if (!row || !row.isActive) return null
  return {
    dto: toDTO(row),
    // displayName is the public identity for a community submission
    // (Decisions log 5) — never username or email.
    photos: row.photos.map((p) => ({
      ...photoToDTO(p),
      submittedByName: p.source === 'community' ? p.submittedBy?.displayName || null : null,
    })),
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const data = await load((await params).slug)
  if (!data) return { title: 'EatFinder' }
  return {
    title: `${data.dto.name} — EatFinder`,
    description: data.dto.description.slice(0, 160) || undefined,
  }
}

/**
 * Google Places attribution HTML is an anchor tag. Rendering it raw would mean
 * dangerouslySetInnerHTML on third-party markup; the obligation is to credit
 * the author, and the text alone does that without opening an XSS surface.
 */
function attributionText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ef-card p-5">
      <h2 className="ef-label mb-3">{title}</h2>
      {children}
    </section>
  )
}

function MoodBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-[13px] font-semibold text-text">
        <span>{label}</span>
        <span className="tabular-nums text-text-secondary">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function LinkRow({
  href,
  icon,
  children,
  external = true,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[14px] font-semibold text-text transition-colors duration-200 hover:bg-surface-hover"
    >
      <span className="text-text-secondary">{icon}</span>
      <span className="truncate">{children}</span>
      {external && <ExternalLink size={13} aria-hidden className="ml-auto text-text-secondary" />}
    </a>
  )
}

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, sp, jar, user] = await Promise.all([params, searchParams, cookies(), getCurrentUser()])
  // Same rule as app/page.tsx: ?lang= wins, then the cookie, then Albanian.
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale: Locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)
  const data = await load(slug)
  if (!data) notFound()

  const { dto: r, photos } = data
  const mapboxToken = process.env.MAPBOX_TOKEN || null
  const open = isOpenAt(r.openHours)

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}>
        <TopBar locale={locale} />
      </Suspense>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-text-secondary transition-colors duration-200 hover:text-text"
        >
          <ArrowLeft size={15} aria-hidden />
          {t(locale, 'detail.back')}
        </Link>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-text sm:text-[34px]">
              {r.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-semibold text-text-secondary">
              <span>{priceGlyphs(r.priceLevel)}</span>
              {r.cuisines.length > 0 && (
                <span>{r.cuisines.map((c) => tVocab(locale, 'cuisine', c)).join(' · ')}</span>
              )}
              {r.neighborhood && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} aria-hidden />
                  {r.neighborhood}
                </span>
              )}
              {r.rating != null && (
                <span
                  className="inline-flex items-center gap-1 text-accent"
                  aria-label={t(locale, 'card.rating', { n: r.rating })}
                >
                  <Star size={13} aria-hidden className="fill-accent" />
                  {r.rating.toFixed(1)}
                </span>
              )}
              <span className={open === true ? 'text-success' : open === false ? 'text-error' : ''}>
                {t(
                  locale,
                  open === true ? 'card.openNow' : open === false ? 'card.closed' : 'card.hoursUnknown'
                )}
              </span>
            </p>
          </div>

          <FavoriteButton
            id={r.id}
            locale={locale}
            label
            className="ef-pill h-11 shrink-0 px-4"
          />
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-5">
            {r.image && (
              // Opaque URL straight from the database — never parsed or rebuilt.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.image}
                alt={r.name}
                className="aspect-[16/9] w-full rounded-2xl border border-border object-cover"
              />
            )}

            {r.description && (
              <Panel title={t(locale, 'detail.about')}>
                <p className="max-w-[68ch] text-[15px] leading-relaxed text-text">{r.description}</p>
                {r.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {r.tags.map((tag) => (
                      <li key={tag} className="ef-chip pr-2.5">
                        {tVocab(locale, 'tag', tag)}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            <Panel title={t(locale, 'detail.gallery')}>
              {photos.length === 0 ? (
                <p className="text-[14px] text-text-secondary">{t(locale, 'detail.noPhotos')}</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((p) => (
                    <li key={p.id} className="overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.caption || r.name}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full object-cover"
                      />
                      {p.attributions.length > 0 && (
                        <p className="px-2 py-1 text-[10px] text-text-secondary">
                          {p.attributions.map(attributionText).filter(Boolean).join(', ')}
                        </p>
                      )}
                      {p.submittedByName && (
                        <p className="px-2 py-1 text-[10px] text-text-secondary">{p.submittedByName}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {user ? (
                <div className="mt-4 rounded-xl bg-surface-muted p-4">
                  <p className="mb-3 text-[14px] font-bold text-text">{t(locale, 'photoUpload.title')}</p>
                  <PhotoUpload restaurantId={r.id} locale={locale} />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4">
                  <div>
                    <p className="text-[14px] font-bold text-text">{t(locale, 'detail.photoCta')}</p>
                    <p className="text-[13px] text-text-secondary">
                      {t(locale, 'detail.photoCtaBody')}
                    </p>
                  </div>
                  <Link href={`/account/login?next=/r/${r.slug}`} className="ef-pill ef-pill--active">
                    {t(locale, 'detail.photoCtaAction')}
                  </Link>
                </div>
              )}
            </Panel>

            <Panel title={t(locale, 'detail.mood')}>
              <MoodBar label={t(locale, 'filters.heavy')} value={r.heaviness} />
              <MoodBar label={t(locale, 'filters.hungry')} value={r.portionSize} />
              <MoodBar label={t(locale, 'filters.fine')} value={r.fineDining} />
            </Panel>
          </div>

          <aside className="flex flex-col gap-5">
            <Panel title={t(locale, 'detail.contact')}>
              {r.address && (
                <p className="mb-2 px-2 text-[14px] text-text-secondary">{r.address}</p>
              )}
              <div className="flex flex-col">
                {r.phone && (
                  <LinkRow href={`tel:${r.phone}`} icon={<Phone size={15} />} external={false}>
                    {r.phone}
                  </LinkRow>
                )}
                {r.websiteUrl && (
                  <LinkRow href={r.websiteUrl} icon={<ExternalLink size={15} />}>
                    {t(locale, 'detail.website')}
                  </LinkRow>
                )}
                {r.instagramUrl && (
                  <LinkRow href={r.instagramUrl} icon={<Instagram size={15} />}>
                    {t(locale, 'detail.instagram')}
                  </LinkRow>
                )}
                {r.woltUrl && (
                  <LinkRow href={r.woltUrl} icon={<ShoppingBag size={15} />}>
                    {t(locale, 'detail.wolt')}
                  </LinkRow>
                )}
                {r.gmapsUrl && (
                  <LinkRow href={r.gmapsUrl} icon={<MapPin size={15} />}>
                    {t(locale, 'detail.directions')}
                  </LinkRow>
                )}
              </div>
            </Panel>

            {r.openHours && (
              <Panel title={t(locale, 'detail.hours')}>
                <ul className="flex flex-col gap-1.5">
                  {DAYS.map((d) => {
                    const slot = r.openHours?.[d]
                    return (
                      <li key={d} className="flex justify-between text-[13px]">
                        <span className="font-semibold text-text">{t(locale, `day.${d}`)}</span>
                        <span className="tabular-nums text-text-secondary">
                          {slot ? `${slot[0]} – ${slot[1]}` : t(locale, 'card.closed')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )}

            {r.lat != null && r.lng != null && (
              <Panel title={t(locale, 'detail.location')}>
                <MiniMap token={mapboxToken} locale={locale} lat={r.lat} lng={r.lng} />
              </Panel>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}
