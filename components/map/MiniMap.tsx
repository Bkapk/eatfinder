'use client'

import dynamic from 'next/dynamic'
import type { Locale } from '@/lib/i18n'

/**
 * mapbox-gl reaches for `window` at import time, so the view must not be part
 * of the server render. `ssr: false` is only legal inside a client component,
 * which is the whole reason this thin wrapper exists — app/r/[slug]/page.tsx is
 * a server component.
 */
const MiniMapView = dynamic(() => import('./MiniMapView'), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-surface-hover" />,
})

export default function MiniMap(props: {
  token: string | null
  locale: Locale
  lat: number
  lng: number
}) {
  return <MiniMapView {...props} />
}
