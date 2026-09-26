'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { LayoutGrid, Map as MapIcon, Rows3 } from 'lucide-react'
import { initSlidingBubble } from './sliding-bubble'
import { SORTS, VIEWS, type Sort, type View } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'

const VIEW_ICON = { grid: LayoutGrid, list: Rows3, map: MapIcon } as const

/**
 * Floats over the map top-right on desktop and sits in the mobile bar. Grid and
 * list change the results layout; map hides the results pane so the map is the
 * whole page (which is also the mobile "show map" state).
 */
export function ViewToggle({
  locale,
  view,
  onChange,
  className = '',
  includeMap = true,
}: {
  locale: Locale
  view: View
  onChange: (v: View) => void
  className?: string
  includeMap?: boolean
}) {
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => (strip.current ? initSlidingBubble(strip.current) : undefined), [])

  return (
    <div
      ref={strip}
      data-bubble-tabs
      role="group"
      aria-label={t(locale, 'view.label')}
      // p-1 around a 36px button lands the group on the shared 44px control
      // height, so it lines up with the search capsule and the sort pill. No
      // shadow: over the map it is white inside a hairline like everything else
      // in this row, and shadow-md here was the heaviest thing on the screen.
      style={
        {
          '--bubble-active-bg': 'var(--primary)',
          '--bubble-hover-bg': 'var(--surface-hover)',
          '--bubble-radius': '999px',
          '--bubble-speed': '200ms',
        } as CSSProperties
      }
      className={`flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 ${className}`}
    >
      {VIEWS.filter((v) => includeMap || v !== 'map').map((v) => {
        const Icon = VIEW_ICON[v]
        const on = view === v
        return (
          <button
            key={v}
            data-bubble-tab
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={on}
            title={t(locale, `view.${v}`)}
            className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors duration-200 ${
              on
                ? 'is-active text-[color:var(--on-primary)]'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            <Icon size={14} aria-hidden />
            <span className="hidden lg:inline">{t(locale, `view.${v}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function SortHeader({
  locale,
  total,
  sort,
  onSort,
  loading,
  children,
}: {
  locale: Locale
  total: number
  sort: Sort
  onSort: (s: Sort) => void
  loading: boolean
  /** The grid/list toggle, wherever the map overlay is not carrying it. */
  children?: React.ReactNode
}) {
  return (
    // On a phone this is the first line of the list itself, on the page
    // colour, not another white bar stacked under the header.
    <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 md:border-b md:border-border md:bg-surface md:py-2.5">
      <h2
        aria-live="polite"
        className="truncate text-[15px] font-extrabold tracking-tight text-text"
      >
        {loading
          ? t(locale, 'results.loading')
          : total === 1
            ? t(locale, 'results.headingOne')
            : t(locale, 'results.heading', { n: total })}
      </h2>

      <div className="flex shrink-0 items-center gap-2">
      <label className="flex shrink-0 items-center gap-2">
        <span className="sr-only">{t(locale, 'sort.label')}</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as Sort)}
          // The same pill as the Filters button and the language switch. A
          // <select> gets display:block back in globals.css, and the chevron
          // room with it.
          className="ef-pill ef-pill--lg"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(locale, `sort.${s}`)}
            </option>
          ))}
        </select>
      </label>
      {children}
      </div>
    </div>
  )
}
