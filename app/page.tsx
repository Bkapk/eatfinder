import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import SearchShell from '@/components/search/SearchShell'

// MAPBOX_TOKEN and the lang cookie are both read per request, so this page can
// never be prerendered with a stale token baked in.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'app.name')} — ${t(locale, 'app.tagline')}` }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar] = await Promise.all([searchParams, cookies()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)

  // Deliberately NOT NEXT_PUBLIC_: that would inline the value at build time
  // into the standalone bundle. It is read here, per request, and handed down
  // as a prop. Falsy is a supported state — the map pane degrades.
  const mapboxToken = process.env.MAPBOX_TOKEN || null

  // SearchShell owns the h1, the skip link, <TopBar> and <main>: the header
  // has to sit outside <main> to be a banner landmark rather than a generic
  // div, and it cannot move up here because it wraps the search bar, which
  // is driven by this shell's client state.
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Suspense fallback={<div className="ef-topbar" />}>
        <SearchShell locale={locale} mapboxToken={mapboxToken} />
      </Suspense>
    </div>
  )
}
