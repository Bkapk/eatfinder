'use client'

import { useState } from 'react'
import { Search, MapPin, CheckCircle2, Loader2, Compass } from 'lucide-react'

import { PageHeader, EmptyState } from '../components/AdminUI'

interface Candidate {
  placeId: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  priceLevel: number | null
  rating: number | null
  ratingCount: number | null
  primaryType: string | null
  alreadyImported: boolean
}

type ImportResult =
  | { placeId: string; status: 'ok'; restaurantId: string; name: string }
  | { placeId: string; status: 'skipped'; reason: string }
  | { placeId: string; status: 'failed'; reason: string }

export default function DiscoverPage() {
  const [mode, setMode] = useState<'text' | 'nearby'>('text')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<ImportResult[]>([])

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    setError('')
    setDisabled(false)
    setResults([])

    try {
      const body: Record<string, unknown> = { mode }
      if (mode === 'text') {
        body.query = query
      } else {
        body.lat = 42.6629
        body.lng = 21.1655
        body.radius = 3000
      }

      const res = await fetch('/api/admin/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (res.status === 503) {
        setDisabled(true)
        setError(data.error || 'Google Places is disabled.')
        setCandidates([])
        return
      }
      if (!res.ok) {
        setError(data.error || 'Search failed')
        setCandidates([])
        return
      }

      setCandidates(data.candidates || [])
      setSelected(new Set())
    } catch (err) {
      setError('An error occurred while searching.')
    } finally {
      setSearching(false)
    }
  }

  const toggle = (placeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(placeId)) next.delete(placeId)
      else next.add(placeId)
      return next
    })
  }

  const importSelected = async () => {
    if (selected.size === 0) return
    setImporting(true)
    setError('')
    setResults([])

    try {
      const res = await fetch('/api/admin/places/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeIds: Array.from(selected) }),
      })
      const data = await res.json()

      if (res.status === 503) {
        setDisabled(true)
        setError(data.error || 'Google Places is disabled.')
        return
      }
      if (!res.ok) {
        setError(data.error || 'Import failed')
        return
      }

      setResults(data.results || [])
      const ok = new Set<string>(
        (data.results || [])
          .filter((r: ImportResult) => r.status === 'ok')
          .map((r: ImportResult) => r.placeId)
      )
      setCandidates((prev) =>
        prev.map((c) => (ok.has(c.placeId) ? { ...c, alreadyImported: true } : c))
      )
      setSelected(new Set())
    } catch (err) {
      setError('An error occurred while importing.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Grow your catalogue"
        title="Discover places"
        description="Find local favorites on Google Places and bring them into EatFinder as drafts, ready for your review."
      />

      {disabled && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 bg-error-soft border border-error rounded-lg text-error"
        >
          Google Places is disabled: {error || 'GOOGLE_PLACES_API_KEY is not set.'} Add the key to
          your environment and restart the app to use Discover.
        </div>
      )}

      {!disabled && error && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 bg-error-soft border border-error rounded-lg text-error"
        >
          {error}
        </div>
      )}

      <form onSubmit={runSearch} className="ef-panel mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('text')}
            aria-pressed={mode === 'text'}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'text'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-hover border border-border text-text-secondary'
            }`}
          >
            Text search
          </button>
          <button
            type="button"
            onClick={() => setMode('nearby')}
            aria-pressed={mode === 'nearby'}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'nearby'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-hover border border-border text-text-secondary'
            }`}
          >
            Nearby · Prishtina, 3 km
          </button>
        </div>

        {mode === 'text' && (
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              size={20}
            />
            <input
              aria-label="Search Google Places"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "restaurants in Prishtina" or a specific business name'
              className="ef-input pl-10"
              required
            />
          </div>
        )}

        <button type="submit" disabled={searching} className="ef-btn ef-btn--primary">
          {searching ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {!searching && !error && candidates.length === 0 && results.length === 0 && (
        <EmptyState
          icon={Compass}
          title="Find the next local favorite"
          description="Search by restaurant name or explore places within 3 km of Prishtina centre. Selected places are imported as drafts."
        />
      )}

      {results.length > 0 && (
        <div className="ef-panel mb-6">
          <h2 className="text-lg font-semibold mb-3">Import results</h2>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.placeId} className="flex items-center gap-2">
                <span
                  className={
                    r.status === 'ok'
                      ? 'text-success font-medium'
                      : r.status === 'skipped'
                        ? 'text-text-secondary font-medium'
                        : 'text-error font-medium'
                  }
                >
                  {r.status}
                </span>
                <span>{r.status === 'ok' ? r.name : r.placeId}</span>
                {'reason' in r && <span className="text-text-secondary">— {r.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-text-secondary text-sm">
              {candidates.length} result{candidates.length === 1 ? '' : 's'}, {selected.size}{' '}
              selected
            </p>
            <button
              onClick={importSelected}
              disabled={selected.size === 0 || importing}
              className="ef-btn ef-btn--primary"
            >
              {importing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {importing ? 'Importing...' : `Import selected (${selected.size})`}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <label
                key={c.placeId}
                className={`block bg-surface border rounded-2xl p-5 cursor-pointer transition-colors ${
                  c.alreadyImported
                    ? 'border-border opacity-60 cursor-not-allowed'
                    : selected.has(c.placeId)
                      ? 'border-primary bg-primary-soft'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.placeId)}
                    disabled={c.alreadyImported}
                    onChange={() => toggle(c.placeId)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{c.name}</span>
                      {c.alreadyImported && (
                        <span className="text-xs px-2 py-0.5 bg-surface-hover rounded-full text-text-secondary shrink-0">
                          Already imported
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{c.address}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                      {c.priceLevel && <span>{'$'.repeat(c.priceLevel)}</span>}
                      {c.rating != null && (
                        <span>
                          {c.rating.toFixed(1)}★ ({c.ratingCount ?? 0})
                        </span>
                      )}
                      {c.primaryType && <span className="truncate">{c.primaryType}</span>}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
