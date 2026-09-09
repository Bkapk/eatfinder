'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Heart, Languages, UtensilsCrossed } from 'lucide-react'
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
  const { ids } = useFavorites()

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
    // px-4 sm:px-5 matches the inset every page body under this header uses
    // (results pane, /account, /r). At px-3 the chrome was tighter than the
    // content it framed, which is visible on the detail and account pages where
    // the wordmark sits directly above the page's own left edge.
    <header className="z-sticky flex w-full shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2.5 sm:gap-4 sm:px-5">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 text-text"
        aria-label={t(locale, 'nav.home')}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[color:var(--on-primary)]">
          <UtensilsCrossed size={18} aria-hidden />
        </span>
        <span className="hidden text-[17px] font-extrabold tracking-tight sm:block">
          {t(locale, 'app.name')}
        </span>
      </Link>

      {children}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          href={`${pathname}?${toggleParams.toString()}`}
          className="ef-pill"
          aria-label={t(locale, 'nav.language')}
        >
          <Languages size={15} aria-hidden />
          <span className="hidden sm:inline">{t(locale, 'nav.switchTo')}</span>
        </Link>

        {/* Hidden below sm: at 320px it and the language pill squeeze the
            search input to nothing. The count is on /account. */}
        <Link
          href="/account"
          className="ef-pill hidden sm:inline-flex"
          aria-label={t(locale, 'nav.favoritesCount', { n: ids.length })}
        >
          <Heart size={15} aria-hidden className={ids.length ? 'fill-accent text-accent' : ''} />
          <span className="tabular-nums">{ids.length}</span>
        </Link>

        <Link
          href="/account/login"
          className="hidden h-9 items-center rounded-full px-3.5 text-[13px] font-bold text-text transition-colors duration-200 hover:bg-surface-hover lg:inline-flex"
        >
          {t(locale, 'nav.signIn')}
        </Link>
        <Link href="/account/register" className="ef-pill ef-pill--active hidden sm:inline-flex">
          {t(locale, 'nav.register')}
        </Link>
      </div>
    </header>
  )
}
