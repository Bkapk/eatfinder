'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  ArrowUpDown,
  Compass,
  Store,
  CircleCheck,
  FilePenLine,
  Trash2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader, EmptyState, LoadingState, ScoreMeter } from './components/AdminUI'

interface Restaurant {
  id: string
  name: string
  description: string
  heaviness: number
  portionSize: number
  fineDining: number
  priceLevel: number
  spiceLevel: number
  avgPrepTime: number
  cuisines: string[]
  neighborhood: string
  websiteUrl?: string | null
  gmapsUrl?: string | null
  phone?: string | null
  image?: string | null
  lat?: number | null
  lng?: number | null
  openHours?: string | null
  updatedAt: string
  // Admin-only, added on top of toDTO() by app/api/restaurants/route.ts.
  isActive: boolean
  source: string
  placeId: string | null
  aiStatus: string
}

export default function AdminPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  // Only the very first fetch is allowed to replace the table with a spinner.
  // Every later one dims what is already there, so typing in the search box
  // stops collapsing and re-expanding the page under the cursor.
  const [firstLoad, setFirstLoad] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'draft'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<Restaurant>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ matching: 0, live: 0, draft: 0 })

  const PAGE_SIZE = 50
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 250ms debounce: `search` is a server query now, and typing "pizzeria"
  // used to fire nine full table fetches.
  useEffect(() => {
    const t = setTimeout(fetchRestaurants, search ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy, sortOrder, statusFilter, page])

  // Any change to what is being listed invalidates the page number — staying on
  // page 4 of a filter that now has one page shows an empty table.
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, sortBy, sortOrder])

  const fetchRestaurants = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)
      params.append('page', String(page))
      params.append('pageSize', String(PAGE_SIZE))

      const res = await fetch(`/api/restaurants?${params}`)
      const data = await res.json()
      setRestaurants(data.restaurants || [])
      setTotal(data.total ?? 0)
      setCounts(data.counts ?? { matching: 0, live: 0, draft: 0 })
    } catch (error) {
      console.error('Failed to fetch restaurants:', error)
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }

  // The server already applied search + status; this is just the current page.
  const visibleRestaurants = restaurants

  // A selection the admin can no longer see must not be acted on: searching or
  // switching the status filter would otherwise let a bulk delete hit rows that
  // scrolled out of the list.
  const visibleIds = new Set(visibleRestaurants.map((r) => r.id))
  const selectedVisible = [...selected].filter((id) => visibleIds.has(id))
  const allVisibleSelected =
    visibleRestaurants.length > 0 && selectedVisible.length === visibleRestaurants.length
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllVisible = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(visibleRestaurants.map((r) => r.id)))

  const setPublished = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/restaurants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to change status')
      return
    }
    fetchRestaurants()
  }

  const runBulk = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (selectedVisible.length === 0) return
    if (
      action === 'delete' &&
      !confirm(
        `Delete ${selectedVisible.length} restaurant${selectedVisible.length === 1 ? '' : 's'}? ` +
          'Their photos are deleted too. This cannot be undone.'
      )
    ) {
      return
    }

    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/restaurants/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedVisible, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Bulk action failed')
        return
      }
      setSelected(new Set())
      await fetchRestaurants()
    } finally {
      setBulkBusy(false)
    }
  }

  const handleEdit = (restaurant: Restaurant) => {
    setEditingId(restaurant.id)
    setEditingValues({
      heaviness: restaurant.heaviness,
      portionSize: restaurant.portionSize,
      fineDining: restaurant.fineDining,
    })
  }

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingValues),
      })

      if (res.ok) {
        setEditingId(null)
        fetchRestaurants()
      } else {
        alert('Failed to update restaurant')
      }
    } catch (error) {
      console.error('Failed to update:', error)
      alert('An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant?')) return

    try {
      const res = await fetch(`/api/restaurants/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchRestaurants()
      } else {
        alert('Failed to delete restaurant')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('An error occurred')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Your catalogue"
        title="Restaurants"
        description="Keep your city's food scene fresh. Manage listings, refine profiles, and make every discovery count."
        actions={
          <>
            <Link href="/admin/discover" className="ef-btn ef-btn--ghost">
              <Compass size={17} aria-hidden />
              Discover places
            </Link>
            <Link href="/admin/new" className="ef-btn ef-btn--primary">
              <Plus size={18} aria-hidden />
              Add restaurant
            </Link>
          </>
        }
      />

      <div
        className="admin-stats"
        aria-label={search ? 'Search result summary' : 'Catalogue summary'}
      >
        {[
          {
            label: search ? 'Matching restaurants' : 'Total restaurants',
            count: counts.matching,
            icon: Store,
            color: 'bg-primary-soft text-primary',
          },
          {
            label: search ? 'Matching live listings' : 'Live on EatFinder',
            count: counts.live,
            icon: CircleCheck,
            color: 'bg-success-soft text-success',
          },
          {
            label: search ? 'Matching drafts' : 'Draft listings',
            count: counts.draft,
            icon: FilePenLine,
            color: 'bg-warning-soft text-warning',
          },
        ].map(({ label, count, icon: Icon, color }) => (
          <div className="admin-stat" key={label}>
            <span className={'grid h-11 w-11 shrink-0 place-items-center rounded-xl ' + color}>
              <Icon size={21} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-text-secondary">{label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                {firstLoad ? '—' : count}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-toolbar">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            size={18}
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search restaurants"
            placeholder="Search name, cuisine, or neighborhood…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ef-input pl-11"
          />
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'live' | 'draft')}
            className="ef-input flex-1 sm:w-auto"
          >
            <option value="all">All statuses</option>
            <option value="live">Live only</option>
            <option value="draft">Drafts only</option>
          </select>
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="ef-input flex-1 sm:w-auto"
          >
            <option value="updatedAt">Last updated</option>
            <option value="name">Name</option>
            <option value="heaviness">Heaviness</option>
            <option value="portionSize">Portion size</option>
            <option value="fineDining">Fine dining</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="admin-icon-button !h-11 !w-11"
            aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
            title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <ArrowUpDown size={17} aria-hidden />
          </button>
        </div>
      </div>

      {firstLoad ? (
        <LoadingState label="Loading restaurants" />
      ) : visibleRestaurants.length === 0 ? (
        <EmptyState
          icon={Store}
          title={
            search || statusFilter !== 'all'
              ? 'No matching restaurants'
              : 'Your catalogue starts here'
          }
          description={
            search || statusFilter !== 'all'
              ? 'Try another search or status filter to find the listing you need.'
              : 'Add your first restaurant or discover local places to start building your catalogue.'
          }
        >
          {search || statusFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
              className="ef-btn ef-btn--ghost"
            >
              Clear filters
            </button>
          ) : (
            <Link href="/admin/new" className="ef-btn ef-btn--primary">
              <Plus size={17} aria-hidden />
              Add restaurant
            </Link>
          )}
        </EmptyState>
      ) : (
        <div
          className={
            'admin-list overflow-hidden rounded-2xl border border-border bg-surface' +
            (loading ? ' admin-refreshing' : '')
          }
          aria-busy={loading}
        >
          <div className="admin-table-bar">
            {selectedVisible.length > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">
                    {selectedVisible.length} selected
                  </span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-semibold text-text-secondary underline hover:text-primary"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => runBulk('publish')}
                    disabled={bulkBusy}
                    className="ef-btn ef-btn--primary"
                  >
                    <Eye size={15} aria-hidden />
                    Publish
                  </button>
                  <button
                    onClick={() => runBulk('unpublish')}
                    disabled={bulkBusy}
                    className="ef-btn ef-btn--ghost"
                  >
                    <EyeOff size={15} aria-hidden />
                    Unpublish
                  </button>
                  <button
                    onClick={() => runBulk('delete')}
                    disabled={bulkBusy}
                    className="ef-btn ef-btn--ghost !text-error hover:!bg-error-soft"
                  >
                    <Trash2 size={15} aria-hidden />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-bold">Restaurant directory</h2>
                <span className="text-xs text-text-secondary">
                  {total === 0
                    ? 'No listings'
                    : `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + visibleRestaurants.length} of ${total}`}
                </span>
              </>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <caption className="sr-only">
                Restaurant listings and profile scores from 0 to 100
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        // `indeterminate` is a DOM property with no HTML
                        // attribute, so it can only be set through a ref.
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected
                        }}
                        onChange={toggleAllVisible}
                        aria-label={
                          allVisibleSelected ? 'Deselect all listings' : 'Select all listings'
                        }
                      />
                      Restaurant
                    </span>
                  </th>
                  <th scope="col">Profile · 0–100</th>
                  <th scope="col">Price</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRestaurants.map((restaurant) => (
                  <tr key={restaurant.id} data-selected={selected.has(restaurant.id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(restaurant.id)}
                          onChange={() => toggleOne(restaurant.id)}
                          aria-label={'Select ' + restaurant.name}
                        />
                        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-muted text-primary">
                          {restaurant.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={restaurant.image}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Store size={20} aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={'/admin/' + restaurant.id}
                            className="block font-bold leading-snug hover:text-primary"
                          >
                            {restaurant.name}
                          </Link>
                          <p className="mt-1 text-xs text-text-secondary">
                            {restaurant.neighborhood || 'No neighborhood'}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {restaurant.cuisines.slice(0, 2).join(' · ')}
                            {restaurant.cuisines.length > 2 &&
                              ' +' + (restaurant.cuisines.length - 2)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Profile">
                      <div className="flex flex-wrap gap-x-4 gap-y-2 md:flex-col">
                        {(['heaviness', 'portionSize', 'fineDining'] as const).map(
                          (axis, index) => (
                            <label
                              key={axis}
                              className="flex items-center justify-between gap-3 text-xs text-text-secondary"
                            >
                              <span>{['Heaviness', 'Portion', 'Fine dining'][index]}</span>
                              {editingId === restaurant.id ? (
                                <input
                                  aria-label={restaurant.name + ' ' + axis}
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={editingValues[axis]}
                                  onChange={(e) =>
                                    setEditingValues({
                                      ...editingValues,
                                      [axis]: Number(e.target.value),
                                    })
                                  }
                                  className="ef-input !min-h-8 w-16 px-2 py-1"
                                />
                              ) : (
                                <ScoreMeter value={restaurant[axis]} />
                              )}
                            </label>
                          )
                        )}
                      </div>
                    </td>
                    <td data-label="Price">
                      <span className="font-bold tracking-wider">
                        {'$'.repeat(restaurant.priceLevel)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={
                            'admin-badge ' +
                            (restaurant.isActive
                              ? 'bg-success-soft text-success'
                              : 'bg-warning-soft text-warning')
                          }
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                          {restaurant.isActive ? 'Live' : 'Draft'}
                        </span>
                        <span className="text-xs capitalize text-text-secondary">
                          {restaurant.source}
                        </span>
                        {restaurant.aiStatus && restaurant.aiStatus !== 'none' && (
                          <span className="text-[11px] text-text-secondary">
                            AI: {restaurant.aiStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {editingId === restaurant.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(restaurant.id)}
                              className="ef-btn ef-btn--primary"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="ef-btn ef-btn--ghost"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <Link href={'/admin/' + restaurant.id} className="ef-btn ef-btn--ghost">
                              Edit details
                            </Link>
                            <button
                              onClick={() => setPublished(restaurant.id, !restaurant.isActive)}
                              className="ef-btn ef-btn--ghost"
                              title={
                                restaurant.isActive
                                  ? 'Hide from the public site'
                                  : 'Publish to the public site'
                              }
                            >
                              {restaurant.isActive ? (
                                <>
                                  <EyeOff size={15} aria-hidden />
                                  Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye size={15} aria-hidden />
                                  Publish
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(restaurant)}
                              className="admin-icon-button"
                              aria-label={'Quick edit scores for ' + restaurant.name}
                              title="Quick edit scores"
                            >
                              <SlidersHorizontal size={16} aria-hidden />
                            </button>
                            <button
                              onClick={() => handleDelete(restaurant.id)}
                              className="admin-icon-button hover:!bg-error-soft hover:!text-error"
                              aria-label={'Delete ' + restaurant.name}
                              title="Delete restaurant"
                            >
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between gap-3 border-t border-border px-5 py-4"
              aria-label="Pagination"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="ef-btn ef-btn--ghost disabled:opacity-40"
              >
                <ChevronLeft size={15} aria-hidden />
                Previous
              </button>
              <span className="text-xs text-text-secondary" aria-live="polite">
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="ef-btn ef-btn--ghost disabled:opacity-40"
              >
                Next
                <ChevronRight size={15} aria-hidden />
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
