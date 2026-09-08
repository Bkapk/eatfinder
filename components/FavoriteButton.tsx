'use client'

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
  const { ids, toggle } = useFavorites()
  const on = ids.includes(id)
  const text = t(locale, on ? 'card.favoriteRemove' : 'card.favoriteAdd')

  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={on}
      aria-label={label ? undefined : text}
      className={className}
    >
      <Heart size={size} aria-hidden className={on ? 'fill-accent text-accent' : ''} />
      {label && <span>{text}</span>}
    </button>
  )
}
