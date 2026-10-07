import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Globe, Instagram, MapPin, Navigation, Phone, ShoppingBag, Star } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  DAYS,
  directionsUrl,
  haversineKm,
  isOpenAt,
  nextChange,
  photoToDTO,
  toDTO,
  type RestaurantDTO,
} from '@/lib/types'
import { priceGlyphs, t, type Locale } from '@/lib/i18n'
import { termLabel } from '@/lib/vocab'
import { getVocab } from '@/lib/vocabDb'
import FavoriteButton from '@/components/FavoriteButton'
import MiniMap from '@/components/map/MiniMap'
import PhotoUpload from '@/components/community/PhotoUpload'
import PhotoGallery from '@/components/detail/PhotoGallery'
import { BackButton, ShareButton } from '@/components/detail/PlaceControls'
import { CloseButton } from '@/components/detail/Flyout'
import RestaurantCard, { PickBadge, type CardItem } from '@/components/results/RestaurantCard'

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
    // Same reasoning: only the directions link wants it (lib/types directionsUrl).
    placeId: row.placeId,
    // displayName is the public identity for a community submission
    // (Decisions log 5) — never username or email.
    photos: row.photos.map((p) => ({
      ...photoToDTO(p),
      submittedByName: p.source === 'community' ? p.submittedBy?.displayName || null : null,
    })),
  }
})

/** The full page and the flyout name the tab the same way. */
export async function restaurantMetadata(slug: string): Promise<Metadata> {
  const data = await load(slug)
  if (!data) return { title: 'EatFinder' }
  return {
    title: `${data.dto.name} — EatFinder`,
    description: data.dto.description.slice(0, 160) || undefined,
  }
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

/**
 * One stretch of the listing. On a phone the page is a single white sheet,
 * like a native place card, and sections are divided by hairlines; from md,
 * sitting on the cool paper beside a sidebar, each one is a panel. Never a
 * card: nothing here is picked up, so nothing here lifts on hover. The flyout
 * is that phone sheet at every width, so it never gets the panels.
 */
function Section({
  title,
  wide,
  children,
}: {
  title: string
  wide: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`border-t border-border py-6 ${wide ? 'md:rounded-2xl md:border md:bg-surface md:p-5' : ''}`}
    >
      <h2 className="ef-heading mb-4">{title}</h2>
      {children}
    </section>
  )
}

/** Places sharing a cuisine with this one, nearest first. */
async function similarTo(r: RestaurantDTO): Promise<CardItem[]> {
  if (r.cuisines.length === 0) return []
  const rows = await prisma.restaurant.findMany({ where: { isActive: true, id: { not: r.id } } })
  const now = new Date()
  const want = new Set(r.cuisines)
  return rows
    .map(toDTO)
    .filter((x) => x.cuisines.some((c) => want.has(c)))
    .map((x) => ({
      ...x,
      distanceKm:
        r.lat != null && r.lng != null && x.lat != null && x.lng != null
          ? Math.round(haversineKm({ lat: r.lat, lng: r.lng }, { lat: x.lat, lng: x.lng }) * 10) / 10
          : null,
      isOpenNow: isOpenAt(x.openHours, now),
      changeAt: nextChange(x.openHours, now),
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, 8)
}

interface Action {
  href: string
  icon: typeof Phone
  label: string
  primary?: boolean
  external?: boolean
}

/**
 * A listing, as the /r/[slug] page and as the flyout over the results
 * (app/(browse)/@modal). One body for both so they cannot drift; `flyout`
 * swaps the back arrow for a close button and keeps the single-sheet phone
 * layout at every width, because the sheet is ~40rem wide however wide the
 * window is and the md:/lg: split below is keyed to the viewport.
 */
export default async function RestaurantDetail({
  slug,
  locale,
  flyout = false,
}: {
  slug: string
  locale: Locale
  flyout?: boolean
}) {
  const [data, terms, user] = await Promise.all([load(slug), getVocab(), getCurrentUser()])
  if (!data) notFound()

  const { dto: r, google, photos } = data
  const similar = await similarTo(r)
  const mapboxToken = process.env.MAPBOX_TOKEN || null
  const now = new Date()
  const open = isOpenAt(r.openHours, now)
  const changeAt = nextChange(r.openHours, now)
  const today = DAYS[(now.getDay() + 6) % 7]
  const hasCoords = r.lat != null && r.lng != null
  const hasSidebar = Boolean(r.openHours) || hasCoords || Boolean(r.address)
  const wide = !flyout
  // Google's is the one a visitor recognises and the one with a count behind
  // it; the editorial figure stands in only where a place has no Google score.
  const stars = google.rating ?? r.rating

  // The things you do with a place, in the order you do them: get there, call,
  // order, look it up. Google Maps' action row, because that is the pattern
  // every phone user already has in their thumb.
  const directions = directionsUrl(r, data.placeId)
  const actions = (
    [
      directions && { href: directions, icon: Navigation, label: t(locale, 'detail.directions'), primary: true },
      r.phone && { href: `tel:${r.phone}`, icon: Phone, label: t(locale, 'detail.phone'), external: false },
      r.woltUrl && { href: r.woltUrl, icon: ShoppingBag, label: t(locale, 'detail.wolt') },
      r.websiteUrl && { href: r.websiteUrl, icon: Globe, label: t(locale, 'detail.website') },
      r.instagramUrl && { href: r.instagramUrl, icon: Instagram, label: t(locale, 'detail.instagram') },
    ] as (Action | null | '')[]
  ).filter((a): a is Action => Boolean(a))

  const controls = (
    <div className="flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+var(--safe-t))] md:p-4">
      {flyout ? (
        <CloseButton locale={locale} className="ef-float-btn" />
      ) : (
        <BackButton locale={locale} className="ef-float-btn" />
      )}
      <div className="flex items-center gap-2">
        <ShareButton locale={locale} title={r.name} className="ef-float-btn" />
        <FavoriteButton id={r.id} locale={locale} size={19} className="ef-float-btn" />
      </div>
    </div>
  )

  const Root = flyout ? 'div' : 'main'

  return (
    <Root
      className={
        flyout
          ? 'pb-[calc(2.5rem+var(--safe-b))]'
          : 'mx-auto w-full max-w-6xl flex-1 pb-[calc(2.5rem+var(--safe-b))] md:px-6 md:py-6'
      }
    >
      {/* In the flyout the sheet itself scrolls, so the controls ride along at
          the top of it (a zero-height sticky row, floating over the photo)
          instead of scrolling away with the photo: close is always in reach. */}
      {flyout && <div className="sticky top-0 z-overlay h-0">{controls}</div>}
      <div className="relative">
        {r.image ? (
          // Opaque URL straight from the database — never parsed or rebuilt.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.image}
            alt={r.name}
            fetchPriority="high"
            className={`aspect-[4/3] w-full bg-surface-muted object-cover sm:aspect-[16/9] ${
              wide ? 'md:aspect-[21/9] md:rounded-3xl' : ''
            }`}
          />
        ) : (
          // No photo: the floating controls still need a row to float in.
          <div aria-hidden className="h-[calc(4.25rem+var(--safe-t))] md:h-16" />
        )}
        {!flyout && <div className="absolute inset-x-0 top-0">{controls}</div>}
      </div>

      {/* The sheet rises 24px over the photo on a phone: the page reads as
          one card pulled up over the picture rather than a stack of boxes. */}
      <div
        className={`relative bg-surface px-4 ${wide ? 'md:bg-transparent md:px-0' : 'sm:px-6'} ${
          r.image
            ? `-mt-6 rounded-t-3xl pt-6 ${wide ? 'md:mt-6 md:rounded-none md:pt-0' : ''}`
            : wide
              ? 'md:pt-2'
              : ''
        }`}
      >
        <header className="pb-5">
          {r.isFeatured && <PickBadge locale={locale} className="mb-3" />}
          <h1 id={flyout ? 'ef-flyout-title' : undefined} className="ef-title text-balance">
            {r.name}
          </h1>

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
              <span>{r.cuisines.map((c) => termLabel(terms, locale, 'cuisine', c)).join(' · ')}</span>
            )}
            {r.neighborhood && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden />
                {termLabel(terms, locale, 'neighborhood', r.neighborhood)}
              </span>
            )}
          </p>

          {open !== null && (
            <p
              className={`mt-3 flex items-center gap-2 text-[14px] font-bold ${
                open ? 'text-success' : 'text-error'
              }`}
            >
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-current" />
              <span>
                {t(locale, open ? 'card.openNow' : 'card.closed')}
                {changeAt && (
                  <span className="font-semibold text-text-secondary">
                    {' · '}
                    {t(locale, open ? 'card.closesAt' : 'card.opensAt', { time: changeAt })}
                  </span>
                )}
              </span>
            </p>
          )}
        </header>

        {actions.length > 0 && (
          <ul
            className={`ef-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-6 ${
              wide ? 'md:mx-0 md:flex-wrap md:px-0' : 'sm:-mx-6 sm:px-6'
            }`}
          >
            {actions.map(({ href, icon: Icon, label, primary, external = true }) => (
              <li key={label} className="shrink-0">
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`ef-pill ef-pill--lg ${primary ? 'ef-pill--active' : ''}`}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`grid ${wide ? 'md:gap-5' : ''} ${wide && hasSidebar ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}
        >
          <div className={`flex min-w-0 flex-col ${wide ? 'md:gap-5' : ''}`}>
            {r.description && (
              <Section title={t(locale, 'detail.about')} wide={wide}>
                <p className="max-w-[68ch] text-[15px] leading-relaxed text-text">{r.description}</p>
                {r.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {r.tags.map((tag) => (
                      <li key={tag} className="ef-chip pr-3">
                        {termLabel(terms, locale, 'tag', tag)}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {/* Above the gallery: this is the one thing on the page that
                answers "is this the kind of place I am in the mood for", which
                is the question the whole app is built around. */}
            <Section title={t(locale, 'detail.mood')} wide={wide}>
              <MoodBar label={t(locale, 'filters.heavy')} value={r.heaviness} />
              <MoodBar label={t(locale, 'filters.hungry')} value={r.portionSize} />
              <MoodBar label={t(locale, 'filters.fine')} value={r.fineDining} />
            </Section>

            <Section title={t(locale, 'detail.gallery')} wide={wide}>
              {photos.length === 0 ? (
                <p className="text-[14px] text-text-secondary">{t(locale, 'detail.noPhotos')}</p>
              ) : (
                <PhotoGallery photos={photos} alt={r.name} locale={locale} />
              )}

              {user ? (
                <div className="mt-4 rounded-2xl bg-surface-muted p-4">
                  <p className="mb-3 text-[14px] font-bold text-text">{t(locale, 'photoUpload.title')}</p>
                  <PhotoUpload restaurantId={r.id} locale={locale} />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-muted p-4">
                  <div>
                    <p className="text-[14px] font-bold text-text">{t(locale, 'detail.photoCta')}</p>
                    <p className="text-[13px] text-text-secondary">{t(locale, 'detail.photoCtaBody')}</p>
                  </div>
                  <Link
                    href={`/account/login?next=/r/${r.slug}`}
                    className="ef-pill ef-pill--lg ef-pill--active"
                  >
                    {t(locale, 'detail.photoCtaAction')}
                  </Link>
                </div>
              )}
            </Section>
          </div>

          {hasSidebar && (
            /* self-start is what makes the sticky stop: the aside shrinks to
               its own content instead of stretching to the grid row. The
               max-height keeps a sidebar taller than a laptop viewport
               reachable; it only scrolls when it actually overflows. */
            <aside
              className={`flex min-w-0 flex-col ${
                wide
                  ? 'md:gap-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain'
                  : ''
              }`}
            >
              {r.openHours && (
                <Section title={t(locale, 'detail.hours')} wide={wide}>
                  <ul className="flex flex-col">
                    {DAYS.map((d) => {
                      const slot = r.openHours?.[d]
                      const isToday = d === today
                      return (
                        <li
                          key={d}
                          aria-current={isToday ? 'date' : undefined}
                          className={`-mx-2 flex justify-between rounded-lg px-2 py-1.5 text-[14px] ${
                            isToday ? 'bg-primary-soft font-bold text-text' : ''
                          }`}
                        >
                          <span className={isToday ? '' : 'font-semibold text-text'}>
                            {t(locale, `day.${d}`)}
                            {isToday && (
                              <span className="font-semibold text-primary"> · {t(locale, 'detail.today')}</span>
                            )}
                          </span>
                          <span className={`tabular-nums ${isToday ? 'text-text' : 'text-text-secondary'}`}>
                            {slot ? `${slot[0]} – ${slot[1]}` : t(locale, 'card.closed')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </Section>
              )}

              {(hasCoords || r.address) && (
                <Section title={t(locale, 'detail.location')} wide={wide}>
                  {r.address && (
                    <p className="mb-4 text-[14px] leading-relaxed text-text-secondary">{r.address}</p>
                  )}
                  {hasCoords && (
                    <MiniMap token={mapboxToken} locale={locale} lat={r.lat as number} lng={r.lng as number} />
                  )}
                  {/* The action row above scrolls sideways on a phone and is
                      gone once you scroll down; this is where someone who has
                      just read the address and looked at the map reaches for
                      the route, so it is the full-width primary here. */}
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ef-btn ef-btn--primary mt-4 w-full"
                    >
                      <Navigation size={16} aria-hidden />
                      {t(locale, 'detail.getDirections')}
                    </a>
                  )}
                </Section>
              )}
            </aside>
          )}
        </div>

        {similar.length > 0 && (
          <section className={`border-t border-border py-6 ${wide ? 'md:mt-8 md:border-0 md:py-0' : ''}`}>
            <h2 className="ef-heading mb-4">{t(locale, 'detail.similar')}</h2>
            <ul
              className={`ef-snap ef-snap--start -mx-4 scroll-px-4 gap-4 px-4 pb-2 ${
                wide ? 'md:mx-0 md:scroll-px-0 md:px-0' : 'sm:-mx-6 sm:scroll-px-6 sm:px-6'
              }`}
            >
              {similar.map((item) => (
                <li key={item.id} className="w-[72%] max-w-[17rem] sm:w-64">
                  <RestaurantCard item={item} locale={locale} size="grid" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Root>
  )
}
