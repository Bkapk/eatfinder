'use client'

import { LayoutGrid, Map as MapIcon, Rows3 } from 'lucide-react'
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
}: {
  locale: Locale
  view: View
  onChange: (v: View) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={t(locale, 'view.label')}
      className={`flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-md ${className}`}
    >
      {VIEWS.map((v) => {
        const Icon = VIEW_ICON[v]
        const on = view === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={on}
            title={t(locale, `view.${v}`)}
            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors duration-200 ${
              on
                ? 'bg-primary text-[color:var(--on-primary)]'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text'
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
}: {
  locale: Locale
  total: number
  sort: Sort
  onSort: (s: Sort) => void
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
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

      <label className="flex shrink-0 items-center gap-2">
        <span className="sr-only">{t(locale, 'sort.label')}</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as Sort)}
          className="h-9 cursor-pointer rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-text transition-colors duration-200 hover:bg-surface-hover"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(locale, `sort.${s}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
