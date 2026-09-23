'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, CircleAlert, CircleCheck, Clock3, RefreshCw, Wrench } from 'lucide-react'
import { PageHeader, LoadingState } from '../components/AdminUI'

type Status = 'green' | 'orange' | 'red'
interface Check { id: string; title: string; status: Status; summary: string; detail?: string | null; checkedAt?: string | null }
interface Event { id: string; area: string; level: string; message: string; detail: string | null; createdAt: string }
interface MissingPhoto { id: string; name: string; placeId: string | null }
interface Snapshot { checks: Check[]; missingPhotos: MissingPhoto[]; events: Event[]; generatedAt: string }

const statusStyle: Record<Status, string> = {
  green: 'border-success/30 bg-success/5 text-success',
  orange: 'border-amber-500/30 bg-amber-500/5 text-amber-700',
  red: 'border-error/30 bg-error/5 text-error',
}
const statusLabel: Record<Status, string> = { green: 'Working', orange: 'Needs attention', red: 'Problem' }

function time(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not checked yet'
}

export default function SystemPage() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [repairing, setRepairing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `System API returned ${res.status}`)
      setData(body)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load system status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const runChecks = async () => {
    setChecking(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/system', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Checks returned ${res.status}`)
      setData(body)
      setNotice('Checks finished. Statuses and activity are up to date.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checks could not finish')
    } finally {
      setChecking(false)
    }
  }

  const repairPhotos = async (place: MissingPhoto) => {
    if (!place.placeId) return
    setRepairing(place.id)
    setNotice('')
    setError('')
    try {
      const res = await fetch('/api/admin/places/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeIds: [place.placeId] }),
      })
      const body = await res.json().catch(() => null)
      const result = body?.results?.[0]
      if (!res.ok || result?.status !== 'ok') throw new Error(result?.reason || body?.error || `Repair returned ${res.status}`)
      setNotice(`${place.name}: ${result.photoCount} photos added${result.photoFailures ? `, ${result.photoFailures} failed` : ''}.`)
      await load()
    } catch (cause) {
      setError(`${place.name}: ${cause instanceof Error ? cause.message : 'photo retry failed'}`)
      await load()
    } finally {
      setRepairing(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="System status"
        description="Check the services behind search, imports, images and AI. Recent application activity explains failures without server access."
        actions={<button type="button" onClick={runChecks} disabled={checking || loading} className="ef-btn ef-btn--primary">
          <RefreshCw size={17} className={checking ? 'animate-spin' : ''} aria-hidden />
          {checking ? 'Checking services…' : 'Run live checks'}
        </button>}
      />

      {error && <div role="alert" className="ef-alert mb-5">{error}</div>}
      {notice && <div role="status" className="ef-notice mb-5"><CircleCheck size={17} aria-hidden />{notice}</div>}

      {loading ? <LoadingState label="Loading system status" /> : data && <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <span>Green means a live check succeeded within 24 hours. Orange means unverified or partial. Red means a check failed.</span>
          <button type="button" onClick={() => void load()} className="font-semibold text-primary hover:underline">Refresh activity</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.checks.map((check) => (
            <article key={check.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold text-text">{check.title}</h2>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle[check.status]}`}>
                  {check.status === 'green' ? <CircleCheck size={12} aria-hidden /> : <CircleAlert size={12} aria-hidden />}
                  {statusLabel[check.status]}
                </span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">{check.summary}</p>
              {check.detail && <p className="mt-2 break-words text-xs text-text-secondary">{check.detail}</p>}
              <p className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary"><Clock3 size={13} aria-hidden />{time(check.checkedAt)}</p>
            </article>
          ))}
        </div>

        <section className="ef-panel mt-6" aria-labelledby="missing-photo-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="missing-photo-heading" className="ef-heading">Google listings without photos</h2>
              <p className="mt-1 text-sm text-text-secondary">A timed-out import can leave a draft without its gallery. Retry it here using fresh photo names from Google.</p>
            </div>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-bold">{data.missingPhotos.length}</span>
          </div>
          {data.missingPhotos.length === 0 ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-success"><CircleCheck size={17} aria-hidden />Every Google listing has a photo.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.missingPhotos.map((place) => (
                <li key={place.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/admin/${place.id}`} className="font-semibold text-text hover:text-primary">{place.name}</Link>
                  <button type="button" disabled={!place.placeId || repairing !== null} onClick={() => void repairPhotos(place)} className="ef-btn ef-btn--ghost">
                    <Wrench size={15} aria-hidden />{repairing === place.id ? 'Retrying…' : 'Retry photos'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ef-panel mt-6" aria-labelledby="activity-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="activity-heading" className="ef-heading flex items-center gap-2"><Activity size={20} aria-hidden />Recent activity</h2>
            <span className="text-xs text-text-secondary">Latest 60 application events · newest first</span>
          </div>
          {data.events.length === 0 ? <p className="mt-5 text-sm text-text-secondary">No application events yet. Run live checks or import a place to create entries.</p> : (
            <ul className="mt-4 divide-y divide-border">
              {data.events.map((event) => (
                <li key={event.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:gap-4">
                  <span className={`font-semibold ${event.level === 'error' ? 'text-error' : event.level === 'warning' ? 'text-amber-700' : 'text-success'}`}>{event.area}</span>
                  <div className="min-w-0"><p className="font-medium text-text">{event.message}</p>{event.detail && <p className="mt-0.5 break-words text-xs text-text-secondary">{event.detail}</p>}</div>
                  <time className="text-xs text-text-secondary">{time(event.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>}
    </div>
  )
}
