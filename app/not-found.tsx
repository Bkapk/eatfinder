import Link from 'next/link'
import { cookies } from 'next/headers'
import { UtensilsCrossed } from 'lucide-react'
import { LOCALE_COOKIE, resolveLocale, t } from '@/lib/i18n'

/**
 * The 404. Next's built-in one is an unstyled system-font line on white, which
 * on a site this branded reads as "the server broke", not "that link is old".
 *
 * The cookie read costs nothing here: the root layout already calls cookies()
 * for <html lang>, so this route was never going to be prerendered anyway.
 */
export default async function NotFound() {
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)

  return (
    <main className="ef-enter flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface text-primary">
        <UtensilsCrossed size={25} aria-hidden />
      </span>
      {/* The code stays visible for anyone reporting the link, but as an
          eyebrow — the sentence below is what the visitor actually needs. */}
      <p className="ef-label mt-5">404</p>
      <h1 className="ef-title mt-2">
        {t(locale, 'notFound.title')}
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-text-secondary">
        {t(locale, 'notFound.body')}
      </p>
      <Link href="/" className="ef-btn ef-btn--primary mt-6 min-h-11 px-5">
        {t(locale, 'notFound.cta')}
      </Link>
    </main>
  )
}
