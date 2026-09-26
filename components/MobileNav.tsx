'use client'

import Link from 'next/link'
import { Compass, Heart, Map as MapIcon, UserRound, type LucideIcon } from 'lucide-react'
import { t, type Locale, type TKey } from '@/lib/i18n'
import { useFavorites } from './useFavorites'
import { searchMemory } from './search/memory'

export type Tab = 'explore' | 'map' | 'saved' | 'profile'

/**
 * The phone's primary navigation, in thumb reach. Explore and Map are two
 * looks at the same search, so from another page they link back to the last
 * query rather than to a blank one — the filters you set are still there.
 * On the search page itself they switch the view in place via `onView`.
 */
export default function MobileNav({
  locale,
  current,
  hasMap = true,
  onView,
}: {
  locale: Locale
  current: Tab
  hasMap?: boolean
  onView?: (tab: 'explore' | 'map') => void
}) {
  const { ids } = useFavorites()

  const searchHref = (map: boolean) => {
    const sp = new URLSearchParams(searchMemory.params)
    if (map) sp.set('view', 'map')
    // A list the user chose sticks; only coming off the map resets to grid.
    else if (!sp.get('view') || sp.get('view') === 'map') sp.set('view', 'grid')
    return `/?${sp.toString()}`
  }

  const tabs: { id: Tab; label: TKey; icon: LucideIcon; href: string }[] = [
    { id: 'explore', label: 'nav.explore', icon: Compass, href: searchHref(false) },
    ...(hasMap ? [{ id: 'map' as const, label: 'nav.map' as const, icon: MapIcon, href: searchHref(true) }] : []),
    { id: 'saved', label: 'nav.saved', icon: Heart, href: '/saved' },
    { id: 'profile', label: 'nav.profile', icon: UserRound, href: '/account' },
  ]

  const i = tabs.findIndex((tab) => tab.id === current)

  return (
    <nav
      aria-label={t(locale, 'nav.main')}
      className="ef-tabbar md:hidden"
      style={
        {
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          '--n': tabs.length,
          // No current tab, no highlight: the CSS keys off --i being set.
          ...(i >= 0 && { '--i': i }),
        } as React.CSSProperties
      }
    >
      {tabs.map(({ id, label, icon: Icon, href }) => {
        const on = current === id
        const body = (
          <>
            <span className="ef-tab-icon">
              <Icon
                size={21}
                strokeWidth={on ? 2.4 : 2}
                aria-hidden
                className={on && id === 'saved' ? 'fill-primary' : ''}
              />
              {id === 'saved' && ids.length > 0 && (
                <span className="ef-tab-badge" aria-hidden>
                  {ids.length > 99 ? '99+' : ids.length}
                </span>
              )}
            </span>
            {t(locale, label)}
          </>
        )
        const common = {
          className: 'ef-tab',
          'aria-current': on ? ('page' as const) : undefined,
          'aria-label':
            id === 'saved' && ids.length > 0
              ? `${t(locale, label)} (${ids.length})`
              : undefined,
        }
        // On the search page, Explore and Map flip the view without a
        // navigation, so the scroll position and results stay put.
        if (onView && (id === 'explore' || id === 'map')) {
          return (
            <button key={id} type="button" onClick={() => onView(id)} {...common}>
              {body}
            </button>
          )
        }
        return (
          <Link key={id} href={href} {...common}>
            {body}
          </Link>
        )
      })}
    </nav>
  )
}
