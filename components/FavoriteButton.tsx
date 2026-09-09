'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { useFavorites } from './useFavorites'

export default function FavoriteButton({
  id,
  locale,
  className = '',
  size = 16,
  label = false,
}: {
  id: string
  locale: Locale
  className?: string
  size?: number
  label?: boolean
}) {
  const { ids, signedIn, toggle } = useFavorites()
  const router = useRouter()
  const pathname = usePathname()
  const on = ids.includes(id)
  const text = t(locale, on ? 'card.favoriteRemove' : 'card.favoriteAdd')

  // The pop is armed by the click, not derived from `on`. Keyed off `on` alone
  // every already-saved heart on the page would fire on mount — twenty-four
  // cards celebrating a decision the user made last week.
  const [pop, setPop] = useState(false)

  // Favourites are per-user rows, so without a session the write is a
  // guaranteed 401. Route to sign-in rather than flipping a heart that
  // silently reverts and leaves aria-pressed reporting a state nobody saved.
  const click = () => {
    if (signedIn === false) {
      router.push('/account/login?next=' + encodeURIComponent(pathname))
      return
    }
    // Only on the way in. Removing a favourite is not an achievement.
    if (!on) setPop(true)
    toggle(id)
  }

  return (
    <button
      type="button"
      onClick={click}
      // Icon-only: the name stays put and aria-pressed carries the state,
      // otherwise it announces "Remove from favourites, pressed". With a
      // visible label that text is the state, so aria-pressed would say it twice.
      aria-pressed={label ? undefined : on}
      aria-label={label ? undefined : t(locale, 'card.favoriteAdd')}
      data-on={pop && on ? 'true' : undefined}
      onAnimationEnd={() => setPop(false)}
      className={`ef-favorite ${className}`}
    >
      <Heart size={size} aria-hidden className={on ? 'fill-accent text-accent' : ''} />
      {label && <span>{text}</span>}
    </button>
  )
}
