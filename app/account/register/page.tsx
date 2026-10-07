import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'
import TopBar from '@/components/TopBar'
import AuthScreen from '../AuthScreen'
import { safeReturnPath } from '@/lib/redirect'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)
  return { title: `${t(locale, 'register.title')} — ${t(locale, 'app.name')}` }
}

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [sp, jar] = await Promise.all([searchParams, cookies()])
  const langParam = typeof sp.lang === 'string' ? sp.lang : null
  const locale = resolveLocale(langParam, jar.get(LOCALE_COOKIE)?.value)
  // '' = no return path; RegisterForm then lands on /account.
  const next = safeReturnPath(sp.next, '')

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <Suspense fallback={<div className="ef-topbar" />}>
        <TopBar locale={locale} />
      </Suspense>

      <AuthScreen locale={locale} mode="register" next={next} />
    </div>
  )
}
