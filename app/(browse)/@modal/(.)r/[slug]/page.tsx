import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n'
import RestaurantDetail, { restaurantMetadata } from '@/components/detail/RestaurantDetail'

export const dynamic = 'force-dynamic'

/** /r/[slug] opened from Explore or Saved: the same listing, as a flyout. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  return restaurantMetadata((await params).slug)
}

export default async function RestaurantFlyout({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const [{ slug }, jar] = await Promise.all([params, cookies()])
  // Cookie only: the URL is /r/slug, and the page underneath already wrote
  // any ?lang= it was opened with into the cookie.
  const locale = resolveLocale(null, jar.get(LOCALE_COOKIE)?.value)
  return <RestaurantDetail slug={slug} locale={locale} flyout />
}
