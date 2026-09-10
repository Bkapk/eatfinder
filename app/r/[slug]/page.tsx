import { cache, Suspense } from 'react'
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
import PhotoGallery from '@/components/detail/PhotoGallery'

export const dynamic = 'force-dynamic'

/**
 * One query, one shape. Only approved photos ever leave this function.
 * cache() because generateMetadata and the page body both call it: Next's
 * request memoization covers fetch(), not Prisma, so without this every hit
 * on a listing runs the join twice.
 */
const load = cache(async (slug: string) => {
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
    // Not on RestaurantDTO: /api/recommend selects that shape for every result
    // in a list and has no use for review counts. Read straight off the row
    // here instead of widening the DTO for one page.
    google: { rating: row.googleRating, count: row.googleRatingCount },
    // displayName is the public identity for a community submission
    // (Decisions log 5) — never username or email.
    photos: row.photos.map((p) => ({
      ...photoToDTO(p),
      submittedByName: p.source === 'community' ? p.submittedBy?.displayName || null : null,
    })),
  }
})

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
 * A static panel, not a card: no shadow, and no hover state either. The
 * listing page is a column of these and .ef-card's hover cue would have every
 * one of them light up as the pointer travelled down the page.
 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ef-panel ef-panel--tight">
      <h2 className="ef-label mb-3">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Five glyphs, each wholly on or wholly off, rounded to the nearest half only
 * for the .5 threshold. A partial-fill star needs a clip path per instance to
 * be honest at any width; the exact figure is printed next to it anyway.
 */
function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={15}
          className={value >= i + 0.5 ? 'fill-accent text-accent' : 'text-border-strong'}
        />
      ))}
    </span>
  )
}

function MoodBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-[13px] font-semibold text-text">
        <span>{label}</span>
        <span className="tabular-nums text-text-secondary">{value}</span>
      </div>
      <div className="ef-meter h-2">
        <div style={{ transform: `scaleX(${value / 100})` }} />
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
      // -mx-2 pulls the hover surface out past the panel's padding while the
      // text itself sits on the panel's left edge — with px-2 alone every link
      // in this card was inset 8px from the heading above it.
      className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-2 text-[14px] font-semibold text-text transition-colors duration-200 hover:bg-surface-hover"
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
  const [{ slug }, sp, jar, user] = await Promise.all([
    params,
    searchParams,
    cookies(),
    getCurrentUser(),
  ])
  // Same rule as app/page.tsx: ?lang= wins, then the cookie, then Albanian.
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale: Locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)
  const data = await load(slug)
  if (!data) notFound()

  const { dto: r, google, photos } = data
  const mapboxToken = process.env.MAPBOX_TOKEN || null
  const open = isOpenAt(r.openHours)
  const hasContact = Boolean(
    r.address || r.phone || r.websiteUrl || r.instagramUrl || r.woltUrl || r.gmapsUrl
  )
  const hasSidebar = hasContact || Boolean(r.openHours) || (r.lat != null && r.lng != null)
  // Google's is the one a visitor recognises and the one with a count behind
  // it; the editorial figure stands in only where a place has no Google score.
  const stars = google.rating ?? r.rating

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="ef-topbar" />}>
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
            <h1 className="ef-title">{r.name}</h1>

            {/* The rating is the first thing under the name, on its own line —
                buried in the meta run it read as one more grey attribute. */}
            {stars != null && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px]">
                <Stars value={stars} />
                <span className="font-bold tabular-nums text-text">{stars.toFixed(1)}</span>
                <span className="text-text-secondary">
                  {google.rating != null && google.count
                    ? t(locale, 'detail.reviews', { n: google.count })
                    : t(locale, 'detail.ourRating')}
                </span>
              </p>
            )}

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
              <span className={open === true ? 'text-success' : open === false ? 'text-error' : ''}>
                {t(
                  locale,
                  open === true
                    ? 'card.openNow'
                    : open === false
                      ? 'card.closed'
                      : 'card.hoursUnknown'
                )}
              </span>
            </p>
          </div>

          <FavoriteButton id={r.id} locale={locale} label className="ef-pill ef-pill--lg shrink-0" />
        </header>

        <div className={`grid gap-5 ${hasSidebar ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
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
                <p className="max-w-[68ch] text-[15px] leading-relaxed text-text">
                  {r.description}
                </p>
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

            {/* Above the gallery: this is the one thing on the page that
                answers "is this the kind of place I am in the mood for", which
                is the question the whole app is built around. */}
            <Panel title={t(locale, 'detail.mood')}>
              <MoodBar label={t(locale, 'filters.heavy')} value={r.heaviness} />
              <MoodBar label={t(locale, 'filters.hungry')} value={r.portionSize} />
              <MoodBar label={t(locale, 'filters.fine')} value={r.fineDining} />
            </Panel>

            <Panel title={t(locale, 'detail.gallery')}>
              {photos.length === 0 ? (
                <p className="text-[14px] text-text-secondary">{t(locale, 'detail.noPhotos')}</p>
              ) : (
                <PhotoGallery photos={photos} alt={r.name} locale={locale} />
              )}

              {user ? (
                <div className="mt-4 rounded-xl bg-surface-muted p-4">
                  <p className="mb-3 text-[14px] font-bold text-text">
                    {t(locale, 'photoUpload.title')}
                  </p>
                  <PhotoUpload restaurantId={r.id} locale={locale} />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4">
                  <div>
                    <p className="text-[14px] font-bold text-text">
                      {t(locale, 'detail.photoCta')}
                    </p>
                    <p className="text-[13px] text-text-secondary">
                      {t(locale, 'detail.photoCtaBody')}
                    </p>
                  </div>
                  <Link
                    href={`/account/login?next=/r/${r.slug}`}
                    className="ef-pill ef-pill--active"
                  >
                    {t(locale, 'detail.photoCtaAction')}
                  </Link>
                </div>
              )}
            </Panel>
          </div>

          {hasSidebar && (
            /* self-start is what makes the sticky stop: the aside shrinks to
               its own content instead of stretching to the grid row, so it
               travels down with the page and comes to rest when its bottom
               meets the end of the left column. Only from lg — below that the
               sidebar is stacked under the content and has nothing to stick to.

               The max-height is not decoration: contact + hours + a map is
               taller than a 768px laptop viewport, and a sticky element taller
               than its viewport pins its top and puts the rest permanently out
               of reach. It only ever scrolls when it actually overflows. */
            <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
              {hasContact && (
                <Panel title={t(locale, 'detail.contact')}>
                  {r.address && (
                    <p className="mb-3 text-[14px] leading-relaxed text-text-secondary">
                      {r.address}
                    </p>
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
              )}

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
          )}
        </div>
      </main>
    </div>
  )
}
