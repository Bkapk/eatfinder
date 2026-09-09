'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, Trash2, Bot, User } from 'lucide-react'

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
    if (action === 'delete' && !window.confirm(`Delete this photo of ${photo.restaurantName}?`)) return
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
      <h1 className="text-3xl font-bold text-text mb-6">Photo Moderation</h1>

      <div className="flex gap-2 mb-6">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === s ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 bg-error/10 border border-error rounded-lg text-error">{error}</div>
      )}

      {loading ? (
        <div className="text-text-secondary">Loading...</div>
      ) : photos.length === 0 ? (
        <div className="text-text-secondary">No {tab === 'all' ? '' : tab} photos.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
      ? 'bg-success/10 text-success'
      : status === 'rejected'
        ? 'bg-error/10 text-error'
        : 'bg-info/10 text-info'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>{status}</span>
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
    <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption || photo.restaurantName} className="aspect-square w-full object-cover" />

      <div className="p-4 flex flex-col gap-2">
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
          {photo.wasAutoDecision ? 'Auto-decided by AI' : photo.decidedByUsername ? `Reviewed by ${photo.decidedByUsername}` : 'Awaiting review'}
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

        <div className="flex gap-2 mt-2">
          {photo.status !== 'approved' && (
            <button
              onClick={() => onDecide('approve')}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-success/10 text-success rounded font-medium text-sm disabled:opacity-50"
            >
              <Check size={14} /> Approve
            </button>
          )}
          {photo.status !== 'rejected' && (
            <button
              onClick={() => onDecide('reject')}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-error/10 text-error rounded font-medium text-sm disabled:opacity-50"
            >
              <X size={14} /> Reject
            </button>
          )}
          <button
            onClick={() => onDecide('delete')}
            disabled={busy}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-surface-hover text-text-secondary rounded font-medium text-sm disabled:opacity-50"
            aria-label="Delete photo"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
