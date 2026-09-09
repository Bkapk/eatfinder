'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, Trash2, Bot, User, Images } from 'lucide-react'

import { PageHeader, EmptyState, LoadingState } from '../components/AdminUI'

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
  const [error, setError] = useState('')
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
        <div
          role="alert"
          className="px-4 py-3 mb-6 bg-error-soft border border-error rounded-lg text-error"
        >
          {error}
        </div>
      )}

      {loading ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} busy={busy.has(p.id)} onDecide={(a) => decide(p, a)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AdminPhoto['status'] }) {
  const cls =
    status === 'approved'
      ? 'bg-success-soft text-success'
      : status === 'rejected'
        ? 'bg-error-soft text-error'
        : 'bg-warning-soft text-warning'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>{status}</span>
  )
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

      <div className="p-5 flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/admin/${photo.restaurantId}`}
            className="font-semibold text-primary hover:underline truncate"
          >
            {photo.restaurantName}
          </Link>
          <StatusBadge status={photo.status} />
        </div>

        {photo.caption && <p className="text-sm text-text">{photo.caption}</p>}

        <div className="text-xs text-text-secondary">
          Submitted by {photo.submittedByName || 'unknown'}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          {photo.wasAutoDecision ? <Bot size={13} /> : <User size={13} />}
          {photo.wasAutoDecision
            ? 'Auto-decided by AI'
            : photo.decidedByUsername
              ? `Reviewed by ${photo.decidedByUsername}`
              : 'Awaiting review'}
        </div>

        {photo.aiReason && (
          <p className="text-xs text-text-secondary bg-background border border-border rounded p-2">
            AI: {photo.aiReason}
            {photo.aiConfidence != null && ` (${Math.round(photo.aiConfidence * 100)}% confidence)`}
          </p>
        )}

        {photo.decisionNote && (
          <p className="text-xs text-text-secondary italic">Note: {photo.decisionNote}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-auto border-t border-border pt-4">
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
            className="admin-icon-button !h-11 !w-11 hover:text-error"
            aria-label="Delete photo"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
