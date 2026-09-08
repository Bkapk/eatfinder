import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

// next/font self-hosts and preloads the file at build time: no render-blocking
// round trip to fonts.googleapis.com, and no layout shift while it swaps.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EatFinder - Find Your Perfect Meal',
  description: 'Decide where to eat based on your mood, hunger level, and dining preferences',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  )
}
