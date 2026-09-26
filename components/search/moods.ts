import { Salad, Soup, Wine, Zap, type LucideIcon } from 'lucide-react'
import type { TKey } from '@/lib/i18n'

/**
 * One-tap moods. The three sliders are the reason the product exists, but a
 * slider buried in a drawer is a feature nobody finds; these are the four
 * settings people actually reach for, one tap each, on the rail. A preset is
 * nothing but slider values, so it composes with every other filter and a
 * shared link still carries plain numbers.
 */
export const MOODS: {
  key: string
  label: TKey
  icon: LucideIcon
  heavy: number
  hungry: number
  fine: number
}[] = [
  { key: 'quick', label: 'mood.preset.quick', icon: Zap, heavy: 30, hungry: 25, fine: 15 },
  { key: 'hearty', label: 'mood.preset.hearty', icon: Soup, heavy: 85, hungry: 90, fine: 35 },
  { key: 'date', label: 'mood.preset.date', icon: Wine, heavy: 45, hungry: 50, fine: 85 },
  { key: 'light', label: 'mood.preset.light', icon: Salad, heavy: 15, hungry: 35, fine: 55 },
]

export function activeMood(f: { heavy: number; hungry: number; fine: number }) {
  return MOODS.find((m) => m.heavy === f.heavy && m.hungry === f.hungry && m.fine === f.fine)
}
