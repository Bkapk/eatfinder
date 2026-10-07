import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { LOCALE_COOKIE, resolveLocale, type Locale } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import RestaurantDetail, { restaurantMetadata } from '@/components/detail/RestaurantDetail'

export const dynamic = 'force-dynamic'

/**
 * The listing as a page: a shared link, a refresh, or a place opened from
 * anywhere outside Explore and Saved. Opened from those two, the same body
 * renders as a flyout over them instead (app/(browse)/@modal/(.)r).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  return restaurantMetadata((await params).slug)
}

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, sp, jar] = await Promise.all([params, searchParams, cookies()])
  // Same rule as app/(browse)/page.tsx: ?lang= wins, then the cookie, then Albanian.
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale: Locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface md:bg-background">
      {/* The site header is desktop chrome. A phone opens straight onto the
          photo with its controls floating on it, like a native place sheet. */}
      <div className="hidden md:block">
        <Suspense fallback={<div className="ef-topbar" />}>
          <TopBar locale={locale} />
        </Suspense>
      </div>

      <RestaurantDetail slug={slug} locale={locale} />
    </div>
  )
}
