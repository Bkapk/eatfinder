import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n'
import './globals.css'

// next/font self-hosts and preloads the file at build time: no render-blocking
// round trip to fonts.googleapis.com, and no layout shift while it swaps.
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'], // latin-ext carries ë and ç for Albanian
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EatFinder',
  description: 'Find where to eat in Prishtina',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Cookie only — the layout cannot see searchParams, so a first visit with
  // ?lang=en renders content in English while this attribute still says sq.
  // <TopBar> corrects document.documentElement.lang on the client for that one
  // render, and every later request reads the cookie it just wrote.
  const locale = resolveLocale(null, (await cookies()).get(LOCALE_COOKIE)?.value)

  return (
    <html lang={locale} className={manrope.variable}>
      <body>{children}</body>
    </html>
  )
}
