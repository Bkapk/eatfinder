'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, AlertTriangle } from 'lucide-react'
import { CUISINE_VOCAB, TAG_VOCAB, type RestaurantDTO } from '@/lib/types'
import { flattenScoringResult, type RestaurantScoringResult, type RestaurantProposalFields } from '@/lib/aiSchemas'

interface Proposal {
  id: string
  restaurantId: string
  restaurant: RestaurantDTO
  model: string
  status: 'pending' | 'approved' | 'rejected' | 'failed'
  payload: RestaurantScoringResult | null
  rawResponse: string | null
  errorMessage: string | null
  overallConfidence: number | null
  createdAt: string
}

const STATUS_TABS = ['pending', 'approved', 'rejected', 'failed'] as const

export default function QueuePage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('pending')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const load = async (s = status) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/proposals?status=${s}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load queue')
      setProposals(data.proposals)
    } catch (err: any) {
      setError(err.message || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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

  const approve = async (proposal: Proposal, fields: RestaurantProposalFields) => {
    await withBusy(proposal.id, async () => {
      const res = await fetch(`/api/admin/proposals/${proposal.id}?action=approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: fields }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to approve')
        return
      }
      await load()
    })
  }

  const reject = async (proposal: Proposal) => {
    const reviewNote = window.prompt('Reason for rejecting (optional):') || ''
    await withBusy(proposal.id, async () => {
      const res = await fetch(`/api/admin/proposals/${proposal.id}?action=reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reject')
        return
      }
      await load()
    })
  }

  const approveAll = async () => {
    for (const p of proposals) {
      if (p.status !== 'pending' || !p.payload) continue
      const fields = p.payload.insufficientEvidence
        ? currentAsFields(p.restaurant)
        : flattenScoringResult(p.payload)
      await approve(p, fields)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[26px] font-extrabold tracking-tight text-text">AI Review Queue</h1>
        {status === 'pending' && proposals.length > 0 && (
          <button
            onClick={approveAll}
            className="ef-btn ef-btn--primary"
          >
            Approve All
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter" className="ef-scroll-fade -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              status === s ? 'bg-primary text-on-primary' : 'bg-surface-hover text-text-secondary hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 mb-6 bg-error-soft border border-error rounded-lg text-error">{error}</div>
      )}

      {loading ? (
        <div role="status" className="text-text-secondary">Loading...</div>
      ) : proposals.length === 0 ? (
        <div className="text-text-secondary">No {status} proposals.</div>
      ) : (
        <div className="space-y-6">
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busy.has(p.id)}
              onApprove={(fields) => approve(p, fields)}
              onReject={() => reject(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function currentAsFields(r: RestaurantDTO): RestaurantProposalFields {
  return {
    heaviness: r.heaviness,
    portionSize: r.portionSize,
    fineDining: r.fineDining,
    spiceLevel: r.spiceLevel,
    priceLevel: r.priceLevel,
    cuisines: r.cuisines,
    tags: r.tags,
    description: r.description,
    neighborhood: r.neighborhood,
  }
}

function ProposalCard({
  proposal,
  busy,
  onApprove,
  onReject,
}: {
  proposal: Proposal
  busy: boolean
  onApprove: (fields: RestaurantProposalFields) => void
  onReject: () => void
}) {
  const { restaurant, payload } = proposal
  const lowSignal = payload?.insufficientEvidence ?? false

  const [fields, setFields] = useState<RestaurantProposalFields>(() =>
    payload && !lowSignal ? flattenScoringResult(payload) : currentAsFields(restaurant)
  )

  if (proposal.status === 'failed') {
    return (
      <div className="bg-surface border border-error rounded-lg p-6">
        <div className="flex items-center gap-2 text-error font-semibold mb-2">
          <AlertTriangle size={18} />
          {restaurant.name} — enrichment failed
        </div>
        <p className="text-sm text-text-secondary mb-2">{proposal.errorMessage}</p>
        {proposal.rawResponse && (
          <pre
            tabIndex={0}
            className="text-xs bg-background border border-border rounded p-3 overflow-x-auto whitespace-pre-wrap"
          >
            {proposal.rawResponse}
          </pre>
        )}
      </div>
    )
  }

  if (!payload) return null

  return (
    <div className="ef-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href={`/admin/${restaurant.id}`} className="text-lg font-semibold text-primary hover:underline">
            {restaurant.name}
          </Link>
          <div className="text-xs text-text-secondary">
            {proposal.model} · overall confidence {Math.round((proposal.overallConfidence ?? 0) * 100)}%
          </div>
        </div>
        {lowSignal && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-error-soft text-error rounded">
            <AlertTriangle size={14} /> Low signal — not auto-filled
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <AxisField
          id={`${proposal.id}-heaviness`}
          label="Heaviness"
          current={restaurant.heaviness}
          field={payload.scores.heaviness}
          value={fields.heaviness}
          onChange={(v) => setFields((f) => ({ ...f, heaviness: v }))}
        />
        <AxisField
          id={`${proposal.id}-portionSize`}
          label="Portion Size"
          current={restaurant.portionSize}
          field={payload.scores.portionSize}
          value={fields.portionSize}
          onChange={(v) => setFields((f) => ({ ...f, portionSize: v }))}
        />
        <AxisField
          id={`${proposal.id}-fineDining`}
          label="Fine Dining"
          current={restaurant.fineDining}
          field={payload.scores.fineDining}
          value={fields.fineDining}
          onChange={(v) => setFields((f) => ({ ...f, fineDining: v }))}
        />
        <AxisField
          id={`${proposal.id}-spiceLevel`}
          label="Spice Level"
          current={restaurant.spiceLevel}
          field={payload.scores.spiceLevel}
          value={fields.spiceLevel}
          onChange={(v) => setFields((f) => ({ ...f, spiceLevel: v }))}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <FieldLabel htmlFor={`${proposal.id}-priceLevel`} label="Price Level" confidence={payload.priceLevel.confidence} rationale={payload.priceLevel.rationale} />
          <div className="text-xs text-text-secondary mb-1">Current: {'$'.repeat(restaurant.priceLevel)}</div>
          <select
            id={`${proposal.id}-priceLevel`}
            value={fields.priceLevel}
            onChange={(e) => setFields((f) => ({ ...f, priceLevel: Number(e.target.value) }))}
            className="ef-input"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {'$'.repeat(n)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor={`${proposal.id}-neighborhood`} label="Neighborhood" confidence={payload.neighborhood.confidence} rationale={payload.neighborhood.rationale} />
          <div className="text-xs text-text-secondary mb-1">Current: {restaurant.neighborhood || '(none)'}</div>
          <input
            id={`${proposal.id}-neighborhood`}
            type="text"
            value={fields.neighborhood}
            onChange={(e) => setFields((f) => ({ ...f, neighborhood: e.target.value }))}
            className="ef-input"
          />
        </div>
      </div>

      <div className="mb-4">
        <FieldLabel label="Cuisines" confidence={payload.cuisines.confidence} rationale={payload.cuisines.rationale} />
        <div className="text-xs text-text-secondary mb-1">Current: {restaurant.cuisines.join(', ') || '(none)'}</div>
        <VocabPicker vocab={CUISINE_VOCAB} selected={fields.cuisines} onChange={(v) => setFields((f) => ({ ...f, cuisines: v }))} />
      </div>

      <div className="mb-4">
        <FieldLabel label="Tags" confidence={payload.tags.confidence} rationale={payload.tags.rationale} />
        <div className="text-xs text-text-secondary mb-1">Current: {restaurant.tags.join(', ') || '(none)'}</div>
        <VocabPicker vocab={TAG_VOCAB} selected={fields.tags} onChange={(v) => setFields((f) => ({ ...f, tags: v }))} />
      </div>

      <div className="mb-4">
        <FieldLabel htmlFor={`${proposal.id}-description`} label="Description (Albanian)" confidence={payload.description.confidence} rationale={payload.description.rationale} />
        <div className="text-xs text-text-secondary mb-1">Current: {restaurant.description || '(none)'}</div>
        <textarea
          id={`${proposal.id}-description`}
          value={fields.description}
          onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          maxLength={280}
          className="ef-input resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          onClick={onReject}
          disabled={busy}
          className="ef-btn ef-btn--ghost"
        >
          <X size={18} /> Reject
        </button>
        <button
          onClick={() => onApprove(fields)}
          disabled={busy}
          className="ef-btn ef-btn--primary"
        >
          <Check size={18} /> Approve
        </button>
      </div>
    </div>
  )
}

function FieldLabel({
  htmlFor,
  label,
  confidence,
  rationale,
}: {
  htmlFor?: string
  label: string
  confidence: number
  rationale: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <ConfidenceBar confidence={confidence} />
      </div>
      <p className="text-xs text-text-secondary italic">{rationale}</p>
    </label>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    <span className="flex items-center gap-2 text-xs text-text-secondary">
      <span className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
        <span
          className="block h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </span>
      {pct}%
    </span>
  )
}

function AxisField({
  id,
  label,
  current,
  field,
  value,
  onChange,
}: {
  id: string
  label: string
  current: number
  field: { value: number; confidence: number; rationale: string }
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} confidence={field.confidence} rationale={field.rationale} />
      <div className="text-xs text-text-secondary mb-1">
        Current: {current} · Proposed: {field.value}
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="text-right text-primary font-mono text-sm">{value}</div>
    </div>
  )
}

// ponytail: plain checkbox list, not a combobox/tag-input — the vocab is
// short (< 30 entries) and this is an internal review tool, not the public UI.
function VocabPicker({
  vocab,
  selected,
  onChange,
}: {
  vocab: readonly string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {vocab.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => toggle(v)}
          className={`min-h-[24px] px-2 py-1 text-xs rounded-full border transition-colors ${
            selected.includes(v)
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-background border-border text-text-secondary hover:text-text'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
