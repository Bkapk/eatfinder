import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'login.title')} — ${t(locale, 'app.name')}` }
}

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar] = await Promise.all([searchParams, cookies()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)
  const next = typeof sp.next === 'string' ? sp.next : '/account'

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}>
        <TopBar locale={locale} />
      </Suspense>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="mb-6 text-center text-[28px] font-extrabold tracking-tight text-text">
          {t(locale, 'login.title')}
        </h1>
        <LoginForm locale={locale} next={next} />
      </main>
    </div>
  )
}
