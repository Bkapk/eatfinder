'use client'

import { useEffect, useRef, type RefObject } from 'react'
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
  paneRef,
  onPaneScroll,
  animate = true,
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
  paneRef?: RefObject<HTMLDivElement | null>
  onPaneScroll?: (top: number) => void
  /** Off when the list is being restored on Back: it was already on screen. */
  animate?: boolean
}) {
  // Infinite scroll, a screen ahead of the end. The button below stays as the
  // fallback and for anyone who wants the list to stop growing on its own.
  const sentinel = useRef<HTMLDivElement>(null)
  const more = useRef(onLoadMore)
  useEffect(() => {
    more.current = onLoadMore
  })
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loading) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) more.current()
      },
      { rootMargin: '0px 0px 800px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading])

  if (error) {
    return (
      <div className="ef-enter flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        {/* .ef-heading, not a bespoke 16px/extrabold: the admin's <EmptyState>
            and this one are the same message in the same product. */}
        <p className="ef-heading">{t(locale, 'results.error.title')}</p>
        <p className="max-w-xs text-[14px] text-text-secondary">
          {t(locale, 'results.error.body')}
        </p>
        {/* --lg like "Load more": the one control in an otherwise empty pane is
            not the place to ship the search rail's compact 36px pill. */}
        <button
          type="button"
          onClick={onRetry}
          className="ef-pill ef-pill--lg ef-pill--active mt-1"
        >
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
        <button type="button" onClick={onClearAll} className="ef-pill ef-pill--lg mt-1">
          {t(locale, 'results.empty.reset')}
        </button>
      </div>
    )
  }

  return (
    // Below md the document scrolls, not this box: that is what lets the
    // browser's toolbar collapse, pull-to-refresh work and the header hide.
    // From md the split pane scrolls on its own beside the map.
    <div
      ref={paneRef}
      onScroll={onPaneScroll ? (e) => onPaneScroll(e.currentTarget.scrollTop) : undefined}
      className="ef-results-container flex-1 px-4 pb-8 pt-4 sm:px-5 md:overflow-y-auto md:overscroll-contain md:pb-6"
    >
      {/* ef-stagger: the list reveals as a list. The index is clamped at 9, so
          the last card is 360ms behind the first whether the query returned ten
          rows or five hundred — an uncapped stagger turns a big result set into
          a minute-long wipe. */}
      {/* gap-4 in list view is the 16px .ef-results-grid already uses between
          cards — at gap-3 switching view silently retuned the rhythm. */}
      <ul
        className={`${animate ? 'ef-stagger' : ''} ${view === 'list' ? 'flex flex-col gap-3' : 'ef-results-grid'}`}
      >
        {items.map((item, i) => (
          <li key={item.id} style={{ '--i': Math.min(i, 9) } as React.CSSProperties}>
            <RestaurantCard
              item={item}
              locale={locale}
              size={view === 'list' ? 'list' : 'grid'}
              onHover={onHover}
              active={hoveredId === item.id}
              eager={i < 2}
            />
          </li>
        ))}
        {loading &&
          items.length === 0 &&
          // Reserve the space the first page will occupy so the pane does not
          // jump when it lands — and reserve it in the SHAPE of a result card
          // (3:2 photo, title line, meta line) rather than as a grey slab, so
          // the wait already tells you what is coming.
          Array.from({ length: 6 }).map((_, i) =>
            view === 'list' ? (
              <li
                key={`skeleton-${i}`}
                aria-hidden
                className="flex h-[7.5rem] overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="w-28 shrink-0 animate-pulse bg-surface-hover sm:w-32" />
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-hover" />
                  <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-surface-muted" />
                  <div className="mt-auto h-3.5 w-2/5 animate-pulse rounded-full bg-surface-muted" />
                </div>
              </li>
            ) : (
              // The shape of the photo-led card — 4:3 photo, name, meta line,
              // hours line — so the list does not jump when it lands.
              <li key={`skeleton-${i}`} aria-hidden>
                <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-surface-hover" />
                <div className="flex flex-col gap-2 pt-3">
                  <div className="flex justify-between gap-3">
                    <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-hover" />
                    <div className="h-4 w-10 animate-pulse rounded-full bg-surface-hover" />
                  </div>
                  <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-surface-muted" />
                  <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-surface-muted" />
                </div>
              </li>
            )
          )}
      </ul>

      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="ef-pill ef-pill--lg px-6 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? t(locale, 'results.loading') : t(locale, 'results.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
