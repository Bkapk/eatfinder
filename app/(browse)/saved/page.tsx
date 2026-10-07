import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import MobileNav from '@/components/MobileNav'
import SavedView from './SavedView'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'saved.title')} — ${t(locale, 'app.name')}` }
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar] = await Promise.all([searchParams, cookies()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="ef-topbar" />}>
        <TopBar locale={locale} />
      </Suspense>

      {/* The same container query as the results pane, so a saved place is
          the same card at the same size as the one you hearted it from. */}
      <main className="ef-results-container ef-tabbar-pad mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 md:pb-10">
        <h1 className="ef-title mb-6">{t(locale, 'saved.title')}</h1>
        <SavedView locale={locale} />
      </main>

      <MobileNav locale={locale} current="saved" hasMap={Boolean(process.env.MAPBOX_TOKEN)} />
    </div>
  )
}
