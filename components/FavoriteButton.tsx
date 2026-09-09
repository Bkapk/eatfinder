'use client'

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

  // Favourites are per-user rows, so without a session the write is a
  // guaranteed 401. Route to sign-in rather than flipping a heart that
  // silently reverts and leaves aria-pressed reporting a state nobody saved.
  const click = () => {
    if (signedIn === false) {
      router.push('/account/login?next=' + encodeURIComponent(pathname))
      return
    }
    toggle(id)
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={label ? undefined : text}
      className={className}
    >
      <Heart size={size} aria-hidden className={on ? 'fill-accent text-accent' : ''} />
      {label && <span>{text}</span>}
    </button>
  )
}
