import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TopBar from '@/components/TopBar'
import MobileNav from '@/components/MobileNav'
import AccountView, { type AccountData } from './AccountView'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'account.title')} — ${t(locale, 'app.name')}` }
}

function slugs(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Everything the dashboard shows, in one round trip on the server. It used to
 * be two client fetches after hydration, so the page arrived as a "Loading…"
 * card and then changed shape.
 */
async function loadAccount(userId: string): Promise<Omit<AccountData, 'user'> & { email: string | null; createdAt: string }> {
  const [row, favorites, photos] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
    prisma.favorite.findMany({
      // A drafted restaurant is not a place you can visit; it drops out here
      // exactly as it drops out of Saved.
      where: { userId, restaurant: { isActive: true } },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        restaurant: {
          select: {
            id: true,
            slug: true,
            name: true,
            image: true,
            cuisines: true,
            neighborhood: true,
            priceLevel: true,
            rating: true,
          },
        },
      },
    }),
    prisma.restaurantPhoto.findMany({
      where: { submittedById: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        caption: true,
        status: true,
        createdAt: true,
        restaurant: { select: { slug: true, name: true } },
      },
    }),
  ])

  return {
    email: row?.email ?? null,
    createdAt: (row?.createdAt ?? new Date()).toISOString(),
    saved: favorites.map(({ createdAt, restaurant: r }) => ({
      ...r,
      cuisines: slugs(r.cuisines),
      savedAt: createdAt.toISOString(),
    })),
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      restaurantSlug: p.restaurant.slug,
      restaurantName: p.restaurant.name,
    })),
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar, user] = await Promise.all([searchParams, cookies(), getCurrentUser()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)

  let data: AccountData | null = null
  if (user) {
    const { email, createdAt, ...rest } = await loadAccount(user.id)
    data = { user: { ...user, email, createdAt }, ...rest }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="ef-topbar" />}>
        <TopBar locale={locale} />
      </Suspense>

      <main className="ef-tabbar-pad mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6 md:py-8">
        <AccountView locale={locale} data={data} />
      </main>

      <MobileNav locale={locale} current="profile" hasMap={Boolean(process.env.MAPBOX_TOKEN)} />
    </div>
  )
}
