'use client'

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { t, type Locale } from '@/lib/i18n'

/** The detail page's location panel. Same no-token degradation as MapPane. */
export default function MiniMap({
  token,
  locale,
  lat,
  lng,
}: {
  token: string | null
  locale: Locale
  lat: number
  lng: number
}) {
  if (!token) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-muted text-center">
        <MapPin size={22} aria-hidden className="text-text-secondary" />
        <p className="text-[13px] font-semibold text-text-secondary">
          {t(locale, 'map.disabled.title')}
        </p>
      </div>
    )
  }

  return (
    <div className="h-56 overflow-hidden rounded-2xl border border-border">
      <Map
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
        style={{ width: '100%', height: '100%' }}
        aria-label={t(locale, 'map.label')}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[color:var(--on-primary)] shadow-md">
            <MapPin size={16} aria-hidden />
          </span>
        </Marker>
      </Map>
    </div>
  )
}
