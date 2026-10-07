import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Clock,
  Compass,
  FilePenLine,
  Heart,
  ImageOff,
  Images,
  LayoutList,
  MapPinOff,
  Plus,
  Sparkles,
  Star,
  Store,
  Tags,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getVocab } from '@/lib/vocabDb'
import { termLabel } from '@/lib/vocab'
import { BarList, Donut, Spark } from '@/components/charts'
import { PageHeader } from './components/AdminUI'

const DAY = 86_400_000
const TZ = 'Europe/Belgrade' // Prishtina's zone; the server's TZ is not trusted for a greeting

function jsonList(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function tally(values: string[]) {
  const m = new Map<string, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

/**
 * Daily counts for the last `days` days, oldest first. ponytail: rolling 24h
 * buckets from now, not calendar days in Europe/Belgrade — at this volume the
 * shape is what matters; switch to tz-aware dates if it is ever read per-day.
 */
function buckets(dates: Date[], days: number, now: number): number[] {
  const out = new Array(days).fill(0)
  for (const d of dates) {
    const i = Math.floor((now - d.getTime()) / DAY)
    if (i >= 0 && i < days) out[days - 1 - i]++
  }
  return out
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function ago(d: Date, now: number): string {
  const s = Math.round((d.getTime() - now) / 1000)
  if (s > -60) return 'just now'
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute')
  if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

const hasHours = (raw: string | null) => !!raw && raw !== '{}' && raw !== 'null'

export default async function Overview({ name }: { name: string }) {
  // A server component renders once per request; "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const since7 = new Date(now - 7 * DAY)
  const since28 = new Date(now - 28 * DAY)

  const [
    live,
    drafts,
    pendingPhotos,
    pendingProposals,
    failedAi,
    members,
    membersWeek,
    favTotal,
    favWeek,
    events,
    topGroups,
    favDates,
    photoDates,
    userDates,
    terms,
  ] = await Promise.all([
    prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, cuisines: true, neighborhood: true, image: true, lat: true, lng: true, openHours: true, isFeatured: true },
      orderBy: { updatedAt: 'asc' }, // stalest first, so "next up" is the one waiting longest
    }),
    prisma.restaurant.count({ where: { isActive: false } }),
    prisma.restaurantPhoto.count({ where: { status: 'pending' } }),
    prisma.aiProposal.count({ where: { status: 'pending' } }),
    prisma.restaurant.count({ where: { aiStatus: 'failed' } }),
    prisma.user.count({ where: { role: 'user' } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: since7 } } }),
    prisma.favorite.count(),
    prisma.favorite.count({ where: { createdAt: { gte: since7 } } }),
    prisma.systemEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.favorite.groupBy({
      by: ['restaurantId'],
      _count: { restaurantId: true },
      orderBy: { _count: { restaurantId: 'desc' } },
      take: 5,
    }),
    prisma.favorite.findMany({ where: { createdAt: { gte: since28 } }, select: { createdAt: true } }),
    prisma.restaurantPhoto.findMany({
      where: { source: 'community', createdAt: { gte: since28 } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({ where: { role: 'user', createdAt: { gte: since28 } }, select: { createdAt: true } }),
    getVocab(),
  ])

  const topRows = await prisma.restaurant.findMany({
    where: { id: { in: topGroups.map((g) => g.restaurantId) } },
    select: { id: true, name: true, image: true, neighborhood: true },
  })
  const top = topGroups
    .map((g) => ({ ...topRows.find((r) => r.id === g.restaurantId)!, count: g._count.restaurantId }))
    .filter((r) => r.id)

  // --- catalogue health: what a visitor actually sees on a live listing ---
  const noPhoto = live.filter((r) => !r.image)
  const noPin = live.filter((r) => r.lat == null || r.lng == null)
  const noHours = live.filter((r) => !hasHours(r.openHours))
  const complete = live.filter((r) => r.image && r.lat != null && r.lng != null && hasHours(r.openHours)).length
  const health = live.length ? Math.round((complete / live.length) * 100) : 0
  const featured = live.filter((r) => r.isFeatured).length

  // --- community pulse ---
  const all = [...favDates, ...photoDates, ...userDates].map((r) => r.createdAt)
  const pulse28 = buckets(all, 28, now)
  const pulse = pulse28.slice(14)
  const pulseTotal = pulse.reduce((a, b) => a + b, 0)
  const pulsePrev = pulse28.slice(0, 14).reduce((a, b) => a + b, 0)
  const delta = pulsePrev ? Math.round(((pulseTotal - pulsePrev) / pulsePrev) * 100) : null
  const in14 = (d: { createdAt: Date }) => now - d.createdAt.getTime() < 14 * DAY

  const label = (kind: 'cuisine' | 'neighborhood', slug: string) => termLabel(terms, 'sq', kind, slug)
  const areas = tally(live.map((r) => r.neighborhood)).slice(0, 8)
  const unplaced = live.filter((r) => !r.neighborhood).length
  const cuisines = tally(live.flatMap((r) => jsonList(r.cuisines))).slice(0, 8)

  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(now))
  const greeting = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(now)

  const attention = [
    { icon: Images, title: 'Photos awaiting review', detail: 'Community uploads held for a human decision', count: pendingPhotos, href: '/admin/photos', tone: 'warning' },
    { icon: Sparkles, title: 'AI proposals to review', detail: 'Enrichment ready to approve or edit', count: pendingProposals, href: '/admin/queue', tone: 'warning' },
    { icon: TriangleAlert, title: 'AI runs that failed', detail: 'Open the queue’s Failed tab to see why', count: failedAi, href: '/admin/queue', tone: 'error' },
    { icon: ImageOff, title: 'Live without a photo', detail: noPhoto[0] && `Next up: ${noPhoto[0].name}`, count: noPhoto.length, href: noPhoto[0] && `/admin/${noPhoto[0].id}`, tone: 'neutral' },
    { icon: MapPinOff, title: 'Live without a map pin', detail: noPin[0] && `Next up: ${noPin[0].name}`, count: noPin.length, href: noPin[0] && `/admin/${noPin[0].id}`, tone: 'neutral' },
    { icon: Clock, title: 'Live without opening hours', detail: noHours[0] && `Next up: ${noHours[0].name}`, count: noHours.length, href: noHours[0] && `/admin/${noHours[0].id}`, tone: 'neutral' },
  ].filter((a) => a.count > 0)

  const toneChip: Record<string, string> = {
    warning: 'bg-warning-soft text-warning',
    error: 'bg-error-soft text-error',
    neutral: 'bg-surface-hover text-text-secondary',
    info: 'bg-primary-soft text-primary',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success-soft text-success',
  }

  const tiles: { icon: LucideIcon; label: string; value: number; sub: string; href?: string; tone: string }[] = [
    { icon: Images, label: 'Pending photos', value: pendingPhotos, sub: pendingPhotos ? 'Waiting on you' : 'All reviewed', href: '/admin/photos', tone: pendingPhotos ? 'warning' : 'success' },
    { icon: Sparkles, label: 'AI proposals', value: pendingProposals, sub: pendingProposals ? 'Ready to review' : 'Queue is empty', href: '/admin/queue', tone: pendingProposals ? 'warning' : 'success' },
    { icon: Star, label: 'Featured', value: featured, sub: `of ${live.length} live listings`, tone: 'accent' },
    { icon: FilePenLine, label: 'Drafts', value: drafts, sub: 'Not public yet', href: '#directory', tone: 'neutral' },
    { icon: Users, label: 'Community members', value: members, sub: `+${membersWeek} this week`, tone: 'info' },
    { icon: Heart, label: 'Favourites', value: favTotal, sub: `+${favWeek} this week`, tone: 'accent' },
  ]

  const quick = [
    { href: '/admin/queue', label: 'Review AI queue', icon: Sparkles, count: pendingProposals },
    { href: '/admin/photos', label: 'Moderate photos', icon: Images, count: pendingPhotos },
    { href: '/admin/vocab', label: 'Vocabulary', icon: Tags, count: 0 },
    { href: '/admin/import', label: 'Import / export', icon: LayoutList, count: 0 },
    { href: '/', label: 'View public site', icon: ArrowUpRight, count: 0 },
  ]

  const levelDot: Record<string, string> = { error: 'bg-error', warning: 'bg-warning', info: 'bg-primary' }

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`${greeting}, ${name}`}
        description="Everything that needs you, how the catalogue is holding up and what the community has been doing."
        actions={
          <>
            <Link href="/admin/discover" className="ef-btn ef-btn--ghost">
              <Compass size={17} aria-hidden />
              Discover places
            </Link>
            <Link href="/admin/new" className="ef-btn ef-btn--primary">
              <Plus size={18} aria-hidden />
              Add restaurant
            </Link>
          </>
        }
      />

      <nav aria-label="Quick actions" className="-mt-3 mb-6 flex flex-wrap gap-2">
        {quick.map(({ href, label: text, icon: Icon, count }) => (
          <Link key={href} href={href} className="ef-pill ef-pill--lg">
            <Icon size={15} aria-hidden className="text-text-secondary" />
            {text}
            {count > 0 && <span className="ef-badge ef-badge--warning -mr-1.5 tabular-nums">{count}</span>}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---- the one dark card: what the public can see, and how complete it is ---- */}
        <section aria-labelledby="hero-h" className="ef-hero xl:col-span-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="hero-h" className="ef-label ef-hero-muted">
                Live on EatFinder
              </h2>
              <p className="ef-figure ef-figure--xl mt-3">{live.length}</p>
              <p className="ef-hero-muted mt-3 text-[13px] font-semibold">
                {live.length + drafts} in the catalogue · {drafts} draft{drafts === 1 ? '' : 's'}
              </p>
            </div>
            <Donut
              size={120}
              thickness={11}
              track="var(--hero-line)"
              total={100}
              segments={[{ value: health, color: 'var(--hero-data)' }]}
              label={`Catalogue health ${health}%: ${complete} of ${live.length} live listings have a photo, a map pin and opening hours`}
            >
              <span>
                <span className="block text-[26px] font-extrabold leading-none tabular-nums">{health}%</span>
                <span className="ef-hero-muted mt-1 block text-[11px] font-semibold">complete</span>
              </span>
            </Donut>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-[color:var(--hero-line)] pt-5">
            {[
              ['Photo', live.length - noPhoto.length],
              ['Map pin', live.length - noPin.length],
              ['Hours', live.length - noHours.length],
            ].map(([k, n]) => (
              <div key={k}>
                <dt className="ef-hero-muted text-[12px] font-semibold">{k}</dt>
                <dd className="mt-1 text-[15px] font-bold tabular-nums">
                  {n}
                  <span className="ef-hero-muted text-[12px] font-semibold">/{live.length}</span>
                </dd>
                <span className="ef-meter mt-2 h-1.5" aria-hidden>
                  <span style={{ transform: `scaleX(${live.length ? Number(n) / live.length : 0})` }} />
                </span>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- KPI tiles ---- */}
        <ul aria-label="Key numbers" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:col-span-7">
          {tiles.map((tile) => {
            const Icon = tile.icon
            const body = (
              <>
                <span className="flex items-start justify-between gap-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneChip[tile.tone]}`}>
                    <Icon size={19} aria-hidden />
                  </span>
                  {tile.href && (
                    <span className="ef-round" aria-hidden>
                      <ArrowUpRight size={15} />
                    </span>
                  )}
                </span>
                <span className="ef-figure mt-5 block">{tile.value}</span>
                <span className="mt-2 block text-[13px] font-bold text-text">{tile.label}</span>
                <span className="block text-[12px] font-semibold text-text-secondary">{tile.sub}</span>
              </>
            )
            return (
              <li key={tile.label} className="min-w-0">
                {tile.href ? (
                  <Link href={tile.href} className="ef-card ef-press flex h-full flex-col p-4 sm:p-5">
                    {body}
                  </Link>
                ) : (
                  <div className="ef-panel flex h-full flex-col !p-4 sm:!p-5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>

        {/* ---- attention queue ---- */}
        <section aria-labelledby="attn-h" className="ef-panel xl:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="attn-h" className="ef-heading">
              Needs you
            </h2>
            {attention.length > 0 && (
              <span className="ef-badge ef-badge--warning tabular-nums">
                {attention.reduce((s, a) => s + a.count, 0)} items
              </span>
            )}
          </div>
          {attention.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-background px-4 py-10 text-center">
              <CircleCheck size={24} aria-hidden className="text-success" />
              <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
                Nothing is waiting. The queues are empty and every live listing has a photo, a pin and hours.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {attention.map((a) => {
                const Icon = a.icon
                return (
                  <li key={a.title}>
                    <Link href={a.href ?? '/admin'} className="ef-row">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneChip[a.tone]}`}>
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{a.title}</span>
                        <span className="block truncate text-xs text-text-secondary">{a.detail}</span>
                      </span>
                      <span className="shrink-0 text-[17px] font-extrabold tabular-nums">{a.count}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ---- community pulse ---- */}
        <section aria-labelledby="pulse-h" className="ef-panel flex flex-col xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="pulse-h" className="ef-heading">
                Community pulse
              </h2>
              <p className="mt-1 text-xs text-text-secondary">Saves, photo uploads and sign-ups · last 14 days</p>
            </div>
            <div className="text-right">
              <p className="ef-figure">{pulseTotal}</p>
              {delta !== null && (
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${delta >= 0 ? 'text-success' : 'text-error'}`}
                >
                  {delta >= 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
                  {Math.abs(delta)}% vs previous 14 days
                </p>
              )}
            </div>
          </div>
          <Spark
            values={pulse}
            className="mt-6 h-28 flex-1"
            label={`Daily community actions, oldest first: ${pulse.join(', ')}`}
          />
          <div className="mt-2 flex justify-between text-[11px] font-semibold text-text-secondary">
            <span>14 days ago</span>
            <span>Today</span>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
            {[
              ['Saves', favDates.filter(in14).length],
              ['Photos', photoDates.filter(in14).length],
              ['Sign-ups', userDates.filter(in14).length],
            ].map(([k, n]) => (
              <div key={k}>
                <dt className="text-xs text-text-secondary">{k}</dt>
                <dd className="text-[17px] font-extrabold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- recent activity ---- */}
        <section aria-labelledby="events-h" className="ef-panel xl:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="events-h" className="ef-heading">
              Recent activity
            </h2>
            <Link href="/admin/system" className="ef-pill ef-pill--quiet -mr-2 h-11 text-primary">
              System log
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="rounded-xl bg-background px-4 py-8 text-center text-sm text-text-secondary">
              No events recorded yet. Imports, AI runs and photo uploads will appear here.
            </p>
          ) : (
            <ol className="flex flex-col">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 border-t border-border py-3 first:border-t-0">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${levelDot[e.level] ?? 'bg-border-strong'}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">
                      {e.level !== 'info' && <span className="sr-only">{e.level}: </span>}
                      {e.message}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {e.area} ·{' '}
                      <time dateTime={e.createdAt.toISOString()} title={e.createdAt.toLocaleString('en-GB', { timeZone: TZ })}>
                        {ago(e.createdAt, now)}
                      </time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ---- most saved ---- */}
        <section aria-labelledby="top-h" className="ef-panel xl:col-span-5">
          <h2 id="top-h" className="ef-heading mb-3">
            Most saved
          </h2>
          {top.length === 0 ? (
            <p className="rounded-xl bg-background px-4 py-8 text-center text-sm text-text-secondary">
              No favourites yet. The places people save will rank here.
            </p>
          ) : (
            <ol className="flex flex-col">
              {top.map((r, i) => (
                <li key={r.id}>
                  <Link href={`/admin/${r.id}`} className="ef-row">
                    <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-text-secondary">
                      {i + 1}
                    </span>
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-muted text-text-secondary">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <Store size={18} aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.name}</span>
                      <span className="block truncate text-xs text-text-secondary">
                        {r.neighborhood ? label('neighborhood', r.neighborhood) : 'No neighbourhood'}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums">
                      <Heart size={14} aria-hidden className="fill-accent text-accent" />
                      {r.count}
                      <span className="sr-only">saves</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ---- coverage ---- */}
        <section aria-labelledby="cov-h" className="ef-panel xl:col-span-12">
          <h2 id="cov-h" className="ef-heading">
            Coverage
          </h2>
          <p className="mt-1 text-xs text-text-secondary">Live listings by neighbourhood and cuisine — where the map is thin.</p>
          {live.length === 0 ? (
            <p className="mt-4 rounded-xl bg-background px-4 py-8 text-center text-sm text-text-secondary">
              Publish a restaurant and its neighbourhood and cuisines will chart here.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
              <div>
                <h3 className="ef-label mb-4">Neighbourhoods</h3>
                <BarList
                  max={live.length}
                  rows={areas.map(([slug, n]) => ({ key: slug, label: label('neighborhood', slug), value: n }))}
                />
                {unplaced > 0 && (
                  <p className="mt-4 text-xs font-semibold text-warning">
                    {unplaced} live listing{unplaced === 1 ? ' has' : 's have'} no neighbourhood
                  </p>
                )}
              </div>
              <div>
                <h3 className="ef-label mb-4">Cuisines</h3>
                <BarList
                  max={live.length}
                  rows={cuisines.map(([slug, n]) => ({ key: slug, label: label('cuisine', slug), value: n }))}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
