import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import AccountView from './AccountView'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'account.title')} — ${t(locale, 'app.name')}` }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar] = await Promise.all([searchParams, cookies()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}>
        <TopBar locale={locale} />
      </Suspense>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <AccountView locale={locale} />
      </main>
    </div>
  )
}
