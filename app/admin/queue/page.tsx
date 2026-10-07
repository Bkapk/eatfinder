'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, AlertTriangle, Sparkles } from 'lucide-react'
import type { RestaurantDTO } from '@/lib/types'
import { useVocab, useVocabLabel } from '@/components/VocabProvider'
import { resolveTerm, type VocabKind } from '@/lib/vocab'
import { PRICE_OPTIONS, Segmented } from '../components/FormControls'
import VocabPicker from '../components/VocabPicker'
import {
  flattenScoringResult,
  type RestaurantScoringResult,
  type RestaurantProposalFields,
} from '@/lib/aiSchemas'

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
  reviewedByUsername: string | null
  reviewedAt: string | null
  reviewNote: string
  appliedFields: RestaurantProposalFields | null
}

import { PageHeader, EmptyState, LoadingState, Notice, useNotice } from '../components/AdminUI'

const STATUS_TABS = ['pending', 'approved', 'rejected', 'failed'] as const

export default function QueuePage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('pending')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  // Only the first load swaps in a spinner. Switching tabs afterwards dims the
  // list in place, instead of collapsing the page to the empty state's height
  // and expanding it again.
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useNotice()
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
      setFirstLoad(false)
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
      // The card disappears from the pending tab on the next load, so without
      // this the only evidence of an approval is a row that vanished.
      setNotice(`${proposal.restaurant.name} updated from the AI profile`)
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
      setNotice(`Proposal dismissed — ${proposal.restaurant.name} is unchanged`)
      await load()
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Content review"
        title="AI review queue"
        description="Review suggested profiles with confidence. Refine the details before they reach your catalogue."
      />

      <div role="group" aria-label="Filter" className="admin-tabs">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className="admin-tab"
          >
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
        <LoadingState label="Loading review queue" />
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={status === 'pending' ? 'All caught up' : `No ${status} proposals`}
          description={
            status === 'pending'
              ? 'New AI suggestions will appear here. Open a restaurant and choose “Ask AI” to request a profile review.'
              : 'Proposals with this status will appear here after review.'
          }
        />
      ) : (
        <div
          className={'admin-list space-y-6' + (loading ? ' admin-refreshing' : '')}
          aria-busy={loading}
        >
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
  const label = useVocabLabel('sq')
  const labels = (kind: 'cuisine' | 'tag', slugs: string[]) => slugs.map((s) => label(kind, s)).join(', ')

  const vocab = useVocab()
  const [fields, setFields] = useState<RestaurantProposalFields>(() => {
    const f = payload && !lowSignal ? flattenScoringResult(payload) : currentAsFields(restaurant)
    // A proposal queued before the vocabulary existed says "Balkan" or
    // "Qendra": show the term it maps to. A value with no match stays as
    // written so it is visible, and approving it is refused until it is fixed.
    const map = (kind: VocabKind, values: string[]) =>
      [...new Set(values.map((v) => resolveTerm(vocab, kind, v) ?? v).filter(Boolean))]
    return {
      ...f,
      cuisines: map('cuisine', f.cuisines),
      tags: map('tag', f.tags),
      neighborhood: map('neighborhood', [f.neighborhood])[0] ?? '',
    }
  })

  if (proposal.status === 'failed') {
    return (
      // ef-panel, not a bespoke rounded-lg box: a failed proposal is the same
      // card as a successful one in a different tone, and at rounded-lg it was
      // the only 8px corner in a list of 16px ones.
      <div className="ef-panel border-error">
        <div className="mb-2 flex items-center gap-2 text-base font-bold tracking-tight text-error">
          <AlertTriangle size={18} aria-hidden className="shrink-0" />
          {restaurant.name} — enrichment failed
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">{proposal.errorMessage}</p>
        {proposal.rawResponse && (
          <pre
            tabIndex={0}
            className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-xs leading-relaxed"
          >
            {proposal.rawResponse}
          </pre>
        )}
      </div>
    )
  }

  if (!payload) return null

  if (proposal.status !== 'pending') {
    const reviewedFields = proposal.status === 'approved'
      ? proposal.appliedFields ?? flattenScoringResult(payload)
      : flattenScoringResult(payload)
    return (
      <article className="ef-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/admin/${restaurant.id}`} className="font-bold text-primary hover:underline">
            {restaurant.name}
          </Link>
          <span className="ef-badge">{proposal.status}</span>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          {proposal.model} · {proposal.reviewedByUsername || 'Admin'} ·{' '}
          {proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleString() : 'Review date unavailable'}
        </p>
        {proposal.reviewNote && <p className="mt-3 text-sm">{proposal.reviewNote}</p>}
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <span>Heaviness: {reviewedFields.heaviness}</span>
          <span>Portion: {reviewedFields.portionSize}</span>
          <span>Fine dining: {reviewedFields.fineDining}</span>
          <span>Price: {'$'.repeat(reviewedFields.priceLevel)}</span>
          <span>
            Neighborhood:{' '}
            {reviewedFields.neighborhood ? label('neighborhood', reviewedFields.neighborhood) : '—'}
          </span>
          <span className="sm:col-span-2">Cuisines: {labels('cuisine', reviewedFields.cuisines) || '—'}</span>
        </div>
        <p className="mt-3 text-sm text-text-secondary">{reviewedFields.description}</p>
      </article>
    )
  }

  return (
    <div className="ef-panel">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <Link
            href={`/admin/${restaurant.id}`}
            className="text-base font-bold tracking-tight text-primary hover:underline"
          >
            {restaurant.name}
          </Link>
          <p className="mt-0.5 text-xs text-text-secondary">
            {proposal.model} · overall confidence{' '}
            {Math.round((proposal.overallConfidence ?? 0) * 100)}%
          </p>
        </div>
        {lowSignal && (
          <span className="ef-badge ef-badge--error shrink-0">
            <AlertTriangle size={13} aria-hidden /> Low signal — not auto-filled
          </span>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
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
          label="Portion size"
          current={restaurant.portionSize}
          field={payload.scores.portionSize}
          value={fields.portionSize}
          onChange={(v) => setFields((f) => ({ ...f, portionSize: v }))}
        />
        <AxisField
          id={`${proposal.id}-fineDining`}
          label="Fine dining"
          current={restaurant.fineDining}
          field={payload.scores.fineDining}
          value={fields.fineDining}
          onChange={(v) => setFields((f) => ({ ...f, fineDining: v }))}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <FieldLabel
            label="Price level"
            confidence={payload.priceLevel.confidence}
            rationale={payload.priceLevel.rationale}
          />
          <p className="mb-2 text-xs text-text-secondary">
            Current: {'$'.repeat(restaurant.priceLevel)}
          </p>
          <Segmented
            name={`${proposal.id}-priceLevel`}
            label="Price level"
            value={fields.priceLevel}
            options={PRICE_OPTIONS}
            onChange={(priceLevel) => setFields((f) => ({ ...f, priceLevel }))}
          />
        </div>

        <div>
          <FieldLabel
            label="Neighborhood"
            confidence={payload.neighborhood.confidence}
            rationale={payload.neighborhood.rationale}
          />
          <p className="mb-2 text-xs text-text-secondary">
            Current: {restaurant.neighborhood ? label('neighborhood', restaurant.neighborhood) : '(none)'}
          </p>
          <VocabPicker
            kind="neighborhood"
            label="Approve as"
            placeholder="No neighborhood"
            value={fields.neighborhood}
            onChange={(neighborhood) => setFields((f) => ({ ...f, neighborhood }))}
          />
        </div>
      </div>

      <div className="mb-5">
        <FieldLabel
          label="Cuisines"
          confidence={payload.cuisines.confidence}
          rationale={payload.cuisines.rationale}
        />
        <p className="mb-2 text-xs text-text-secondary">
          Current: {labels('cuisine', restaurant.cuisines) || '(none)'}
        </p>
        <VocabPicker
          kind="cuisine"
          label="Approve as"
          multiple
          max={4}
          value={fields.cuisines}
          onChange={(cuisines) => setFields((f) => ({ ...f, cuisines }))}
        />
      </div>

      <div className="mb-5">
        <FieldLabel
          label="Tags"
          confidence={payload.tags.confidence}
          rationale={payload.tags.rationale}
        />
        <p className="mb-2 text-xs text-text-secondary">
          Current: {labels('tag', restaurant.tags) || '(none)'}
        </p>
        <VocabPicker
          kind="tag"
          label="Approve as"
          multiple
          max={4}
          value={fields.tags}
          onChange={(tags) => setFields((f) => ({ ...f, tags }))}
        />
      </div>

      <div className="mb-5">
        <FieldLabel
          htmlFor={`${proposal.id}-description`}
          label="Description (Albanian)"
          confidence={payload.description.confidence}
          rationale={payload.description.rationale}
        />
        <p className="mb-2 text-xs leading-relaxed text-text-secondary">
          Current: {restaurant.description || '(none)'}
        </p>
        <textarea
          id={`${proposal.id}-description`}
          value={fields.description}
          onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          maxLength={280}
          className="ef-input resize-none"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
        <button onClick={onReject} disabled={busy} className="ef-btn ef-btn--ghost">
          <X size={17} aria-hidden /> Reject
        </button>
        <button
          onClick={() => onApprove(fields)}
          disabled={busy}
          className="ef-btn ef-btn--primary"
        >
          <Check size={17} aria-hidden /> Approve
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
    // The label, its confidence bar and its rationale are one block with 8px
    // under it; every one of them used to sit 4px apart, so a field's own
    // caption was as close to the next field's label as to its own control.
    <label htmlFor={htmlFor} className="mb-2 block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-text">{label}</span>
        <ConfidenceBar confidence={confidence} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{rationale}</p>
    </label>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    // .ef-meter — the same track as <ScoreMeter> and the detail page's mood
    // bars. This used to be a hand-kept copy with a comment asking the next
    // person to keep three numbers in sync across two files.
    <span className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums text-text-secondary">
      <span className="ef-meter w-16">
        <span style={{ transform: `scaleX(${pct / 100})` }} />
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
    <div className="flex flex-col rounded-xl border border-border bg-background p-4">
      <FieldLabel
        htmlFor={id}
        label={label}
        confidence={field.confidence}
        rationale={field.rationale}
      />
      {/* mt-auto pins the slider to the bottom of the tile: the four rationales
          above it are different lengths, so without this the four sliders in
          the row sat at four different heights. */}
      <p className="mb-2 mt-auto text-xs text-text-secondary">
        Current: {current} · Proposed: {field.value}
      </p>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${value}%` } as React.CSSProperties}
      />
      {/* tabular-nums in the UI font, not font-mono: there is no mono token in
          this design system, so that span rendered in the browser default. */}
      <div className="mt-1.5 text-right text-[13px] font-bold tabular-nums text-primary">
        {value}
      </div>
    </div>
  )
}
