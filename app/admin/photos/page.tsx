'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, Trash2, Bot, User, Images } from 'lucide-react'

import { PageHeader, EmptyState, LoadingState, Notice, useNotice } from '../components/AdminUI'

interface AdminPhoto {
  id: string
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  url: string
  caption: string
  submittedByName: string | null
  status: 'pending' | 'approved' | 'rejected'
  aiVerdict: { verdict: string; reason: string; qualityScore: number } | null
  aiConfidence: number | null
  aiReason: string | null
  wasAutoDecision: boolean
  decidedByUsername: string | null
  decidedAt: string | null
  decisionNote: string
  createdAt: string
}

const TABS = ['pending', 'approved', 'rejected', 'all'] as const

export default function AdminPhotosPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending')
  const [photos, setPhotos] = useState<AdminPhoto[]>([])
  const [loading, setLoading] = useState(true)
  // Only the first load swaps in a spinner. Switching tabs afterwards dims the
  // list in place, instead of collapsing the page to the empty state's height
  // and expanding it again.
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useNotice()
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const load = async (t = tab) => {
    setLoading(true)
    setError('')
    try {
      const qs = t === 'all' ? '' : `?status=${t}`
      const res = await fetch(`/api/admin/photos${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load photos')
      setPhotos(data.photos)
    } catch (err: any) {
      setError(err.message || 'Failed to load photos')
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }

  useEffect(() => {
    load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(id))
    try {
      await fn()
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(id)
        return next
      })
    }
  }

  const decide = async (photo: AdminPhoto, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete this photo of ${photo.restaurantName}?`))
      return
    const decisionNote =
      action === 'reject' ? window.prompt('Reason for rejecting (optional):') || '' : ''

    await withBusy(photo.id, async () => {
      const res = await fetch(`/api/admin/photos/${photo.id}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Failed to ${action}`)
        return
      }
      // Moderating is repetitive work: say which gallery just changed, so a
      // mis-click is caught on the spot rather than three photos later.
      setNotice(
        action === 'approve'
          ? `Live in ${photo.restaurantName}'s gallery`
          : action === 'reject'
            ? `Photo rejected — ${photo.restaurantName}`
            : `Photo deleted — ${photo.restaurantName}`
      )
      await load()
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title="Photo moderation"
        description="A better view of every restaurant. Review community submissions and keep the gallery looking its best."
      />

      <div role="group" aria-label="Filter" className="admin-tabs">
        {TABS.map((s) => (
          <button key={s} onClick={() => setTab(s)} aria-pressed={tab === s} className="admin-tab">
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="ef-alert">
          {error}
        </div>
      )}

      <Notice message={notice} />

      {firstLoad ? (
        <LoadingState label="Loading photos" />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={Images}
          title={
            tab === 'pending'
              ? 'The gallery is up to date'
              : `No ${tab === 'all' ? '' : tab + ' '}photos yet`
          }
          description={
            tab === 'pending'
              ? 'There are no photos waiting for review. New community submissions will appear here.'
              : 'Photos with this status will appear here as your community contributes.'
          }
        />
      ) : (
        <div
          className={
            'admin-list grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3' +
            (loading ? ' admin-refreshing' : '')
          }
          aria-busy={loading}
        >
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} busy={busy.has(p.id)} onDecide={(a) => decide(p, a)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AdminPhoto['status'] }) {
  const tone =
    status === 'approved'
      ? 'ef-badge--success'
      : status === 'rejected'
        ? 'ef-badge--error'
        : // Pending here means "waiting on you", which is the warning tone. The
          // same word on the guest's account page is --info, because there it
          // means "we have it" and nothing is owed.
          'ef-badge--warning'
  return <span className={`ef-badge ${tone} shrink-0 capitalize`}>{status}</span>
}

function PhotoCard({
  photo,
  busy,
  onDecide,
}: {
  photo: AdminPhoto
  busy: boolean
  onDecide: (action: 'approve' | 'reject' | 'delete') => void
}) {
  return (
    <div className="ef-card overflow-hidden flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || photo.restaurantName}
        loading="lazy"
        decoding="async"
        className="aspect-[4/3] w-full bg-surface-muted object-cover"
      />

      {/* gap-2 through the meta lines, gap-4 under the title: at a flat gap-3
          the restaurant name, the caption and four lines of provenance were
          evenly spaced, so nothing in the card looked like the heading. */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Link
            href={`/admin/${photo.restaurantId}`}
            className="truncate text-base font-bold tracking-tight text-primary hover:underline"
          >
            {photo.restaurantName}
          </Link>
          <StatusBadge status={photo.status} />
        </div>

        {photo.caption && <p className="text-sm leading-relaxed text-text">{photo.caption}</p>}

        <p className="text-xs text-text-secondary">
          Submitted by {photo.submittedByName || 'unknown'}
        </p>

        <p className="flex items-center gap-1.5 text-xs text-text-secondary">
          {photo.wasAutoDecision ? (
            <Bot size={13} aria-hidden className="shrink-0" />
          ) : (
            <User size={13} aria-hidden className="shrink-0" />
          )}
          {photo.wasAutoDecision
            ? 'Auto-decided by AI'
            : photo.decidedByUsername
              ? `Reviewed by ${photo.decidedByUsername}`
              : 'Awaiting review'}
        </p>

        {photo.aiReason && (
          <p className="rounded-xl border border-border bg-background p-3 text-xs leading-relaxed text-text-secondary">
            AI: {photo.aiReason}
            {photo.aiConfidence != null && ` (${Math.round(photo.aiConfidence * 100)}% confidence)`}
          </p>
        )}

        {photo.decisionNote && (
          <p className="text-xs leading-relaxed text-text-secondary">
            Note: {photo.decisionNote}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-5">
          {photo.status !== 'approved' && (
            <button
              onClick={() => onDecide('approve')}
              disabled={busy}
              className="ef-btn flex-1 bg-success-soft text-success hover:bg-success hover:text-on-primary"
            >
              <Check size={14} /> Approve
            </button>
          )}
          {photo.status !== 'rejected' && (
            <button
              onClick={() => onDecide('reject')}
              disabled={busy}
              className="ef-btn flex-1 bg-error-soft text-error hover:bg-error hover:text-on-primary"
            >
              <X size={14} /> Reject
            </button>
          )}
          <button
            onClick={() => onDecide('delete')}
            disabled={busy}
            className="ef-icon-btn ef-icon-btn--danger"
            aria-label="Delete photo"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
