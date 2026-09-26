'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Heart, Languages, UserRound, UtensilsCrossed } from 'lucide-react'
import { LOCALE_COOKIE, t, type Locale } from '@/lib/i18n'
import { useFavorites } from './useFavorites'

export default function TopBar({
  locale,
  children,
}: {
  locale: Locale
  children?: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // useFavorites already asks the server who this is (a 401 means signed
  // out), and every page with this bar mounts it anyway — a second request to
  // /api/auth/me for the same answer was one round trip per navigation.
  const { ids, signedIn } = useFavorites()

  // `?lang=` is how the toggle switches; this is what makes it stick. The
  // server component reads the same cookie on every later request, so the URL
  // does not have to carry the locale around with the filter state.
  const langParam = searchParams.get('lang')
  useEffect(() => {
    // app/layout.tsx sets <html lang> from the cookie alone; on the first
    // request carrying ?lang= the cookie does not exist yet, so correct it here.
    document.documentElement.lang = locale
    if (!langParam) return
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(langParam)}; path=/; max-age=31536000; samesite=lax`
  }, [langParam, locale])

  const other: Locale = locale === 'sq' ? 'en' : 'sq'
  const toggleParams = new URLSearchParams(searchParams.toString())
  toggleParams.set('lang', other)

  return (
    // .ef-topbar carries the inset (px-4 sm:px-5, matching every page body
    // under this header) and the fixed --topbar-h. The height is in the class
    // and not here because the four Suspense fallbacks that stand in for this
    // component render <div className="ef-topbar" /> and have to agree with it.
    <header className={`ef-topbar ${children ? 'ef-topbar--search' : ''}`}>
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 text-text"
        aria-label={t(locale, 'nav.home')}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[color:var(--on-primary)]">
          <UtensilsCrossed size={18} aria-hidden />
        </span>
        {/* Shown on a phone too: the tab bar took the account pills, so the
            first row has the room, and a first-time visitor should see what
            this is before the search field asks them anything. */}
        <span className="text-[17px] font-extrabold tracking-tight">
          {t(locale, 'app.name')}
        </span>
      </Link>

      {children}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          href={`${pathname}?${toggleParams.toString()}`}
          className="ef-pill md:h-[var(--control-h)] md:px-4"
          aria-label={t(locale, 'nav.language')}
          hrefLang={other}
        >
          <Languages size={15} aria-hidden />
          <span className="md:hidden">{other.toUpperCase()}</span>
          <span className="hidden md:inline">{t(locale, 'nav.switchTo')}</span>
        </Link>

        {/* Below md the tab bar carries Saved and Profile, in thumb reach. */}
        <Link
          href="/saved"
          className="ef-pill ef-pill--lg hidden md:inline-flex"
          aria-label={t(locale, 'nav.favoritesCount', { n: ids.length })}
        >
          <Heart size={15} aria-hidden className={ids.length ? 'fill-accent text-accent' : ''} />
          <span className="tabular-nums">{ids.length}</span>
        </Link>

        {signedIn === true ? (
          <Link href="/account" className="ef-pill ef-pill--lg ef-pill--active hidden md:inline-flex">
            <UserRound size={15} aria-hidden />{t(locale, 'nav.account')}
          </Link>
        ) : signedIn === false ? (
          <>
            <Link href="/account/login" className="ef-pill ef-pill--lg ef-pill--quiet hidden lg:inline-flex">
              {t(locale, 'nav.signIn')}
            </Link>
            <Link href="/account/register" className="ef-pill ef-pill--lg ef-pill--active hidden md:inline-flex">
              {t(locale, 'nav.register')}
            </Link>
          </>
        ) : null}
      </div>
    </header>
  )
}
