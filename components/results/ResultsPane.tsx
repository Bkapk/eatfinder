'use client'

import { SearchX } from 'lucide-react'
import type { ScoredRestaurant } from '@/lib/types'
import type { View } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'
import RestaurantCard from './RestaurantCard'

export default function ResultsPane({
  locale,
  items,
  view,
  loading,
  error,
  hasMore,
  hoveredId,
  onHover,
  onLoadMore,
  onRetry,
  onClearAll,
}: {
  locale: Locale
  items: ScoredRestaurant[]
  view: View
  loading: boolean
  error: boolean
  hasMore: boolean
  hoveredId: string | null
  onHover: (id: string | null) => void
  onLoadMore: () => void
  onRetry: () => void
  onClearAll: () => void
}) {
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-[16px] font-extrabold text-text">{t(locale, 'results.error.title')}</p>
        <p className="max-w-xs text-[14px] text-text-secondary">
          {t(locale, 'results.error.body')}
        </p>
        <button type="button" onClick={onRetry} className="ef-pill ef-pill--active mt-1">
          {t(locale, 'results.error.retry')}
        </button>
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <SearchX size={28} aria-hidden className="text-text-secondary" />
        <p className="text-[16px] font-extrabold text-text">{t(locale, 'results.empty.title')}</p>
        <p className="max-w-xs text-[14px] text-text-secondary">
          {t(locale, 'results.empty.body')}
        </p>
        <button type="button" onClick={onClearAll} className="ef-pill mt-1">
          {t(locale, 'results.empty.reset')}
        </button>
      </div>
    )
  }

  return (
    // pb-24 below md: the floating map/list pill is fixed at bottom-5 and
    // centred, exactly over "Load more" and the last row's bottom edge.
    <div className="ef-results-container flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4 sm:px-5 md:pb-4">
      <ul className={view === 'list' ? 'flex flex-col gap-3' : 'ef-results-grid'}>
        {items.map((item) => (
          <li key={item.id}>
            <RestaurantCard
              item={item}
              locale={locale}
              size={view === 'list' ? 'list' : 'grid'}
              onHover={onHover}
              active={hoveredId === item.id}
            />
          </li>
        ))}
        {loading &&
          items.length === 0 &&
          // Reserve the space the first page will occupy so the pane does not
          // jump when it lands.
          Array.from({ length: 6 }).map((_, i) => (
            <li
              key={`skeleton-${i}`}
              aria-hidden
              className="h-56 animate-pulse rounded-2xl bg-surface-hover"
            />
          ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="ef-pill h-11 px-6 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? t(locale, 'results.loading') : t(locale, 'results.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
