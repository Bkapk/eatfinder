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
      <div className="ef-enter flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        {/* .ef-heading, not a bespoke 16px/extrabold: the admin's <EmptyState>
            and this one are the same message in the same product. */}
        <p className="ef-heading">{t(locale, 'results.error.title')}</p>
        <p className="max-w-xs text-[14px] text-text-secondary">
          {t(locale, 'results.error.body')}
        </p>
        {/* h-11 like "Load more": the one control in an otherwise empty pane is
            not the place to ship the search rail's compact 36px pill. */}
        <button type="button" onClick={onRetry} className="ef-pill ef-pill--active mt-1 h-11 px-5">
          {t(locale, 'results.error.retry')}
        </button>
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div className="ef-enter flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <SearchX size={28} aria-hidden className="text-text-secondary" />
        <p className="ef-heading">{t(locale, 'results.empty.title')}</p>
        <p className="max-w-xs text-[14px] text-text-secondary">
          {t(locale, 'results.empty.body')}
        </p>
        <button type="button" onClick={onClearAll} className="ef-pill mt-1 h-11 px-5">
          {t(locale, 'results.empty.reset')}
        </button>
      </div>
    )
  }

  return (
    // pb-24 below md: the floating map/list pill is fixed at bottom-5 and
    // centred, exactly over "Load more" and the last row's bottom edge.
    <div className="ef-results-container flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4 sm:px-5 md:pb-4">
      {/* ef-stagger: the list reveals as a list. The index is clamped at 9, so
          the last card is 360ms behind the first whether the query returned ten
          rows or five hundred — an uncapped stagger turns a big result set into
          a minute-long wipe. */}
      {/* gap-4 in list view is the 16px .ef-results-grid already uses between
          cards — at gap-3 switching view silently retuned the rhythm. */}
      <ul
        className={`ef-stagger ${view === 'list' ? 'flex flex-col gap-4' : 'ef-results-grid'}`}
      >
        {items.map((item, i) => (
          <li key={item.id} style={{ '--i': Math.min(i, 9) } as React.CSSProperties}>
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
          // jump when it lands — and reserve it in the SHAPE of a result card
          // (3:2 photo, title line, meta line) rather than as a grey slab, so
          // the wait already tells you what is coming.
          Array.from({ length: 6 }).map((_, i) => (
            <li
              key={`skeleton-${i}`}
              aria-hidden
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="aspect-[3/2] w-full animate-pulse bg-surface-hover" />
              {/* p-4 and three rows, because that is exactly what a real card
                  is: title, meta line, price/match row. At p-3 with two rows the
                  skeleton was ~18px shorter than the card replacing it, so the
                  whole list jumped upward the instant results landed. */}
              <div className="flex flex-col gap-2 p-4">
                <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-hover" />
                <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-surface-muted" />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="h-4 w-10 animate-pulse rounded-full bg-surface-hover" />
                  <div className="h-4 w-14 animate-pulse rounded-full bg-surface-muted" />
                </div>
              </div>
            </li>
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
