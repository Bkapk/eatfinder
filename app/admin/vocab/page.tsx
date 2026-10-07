'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, Tags } from 'lucide-react'
import { useVocab } from '@/components/VocabProvider'
import type { Term, VocabKind } from '@/lib/vocab'
import { EmptyState, Notice, PageHeader, useNotice } from '../components/AdminUI'

const KINDS: { kind: VocabKind; label: string; one: string }[] = [
  { kind: 'neighborhood', label: 'Neighborhoods', one: 'neighborhood' },
  { kind: 'cuisine', label: 'Cuisines', one: 'cuisine' },
  { kind: 'tag', label: 'Tags', one: 'tag' },
]

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

/**
 * The three lists restaurants are described with. Rename and reorder freely:
 * restaurants store the slug, so a rename relabels every place that uses the
 * term and a reorder changes the order pickers and filters list them in.
 * Hiding a term removes it from the pickers only; places that already have it
 * keep it. Nothing here deletes, so nothing here can orphan a restaurant.
 */
export default function VocabPage() {
  const router = useRouter()
  const vocab = useVocab()
  const [kind, setKind] = useState<VocabKind>('neighborhood')
  const meta = KINDS.find((k) => k.kind === kind)!

  // Local copy so a reorder or rename shows at once; the vocab from the root
  // layout replaces it when router.refresh() lands.
  // (Reset during render, React's pattern for "state derived from a prop".)
  const [rows, setRows] = useState<Term[]>([])
  const [source, setSource] = useState<{ vocab: Term[]; kind: VocabKind } | null>(null)
  if (source?.vocab !== vocab || source.kind !== kind) {
    setSource({ vocab, kind })
    setRows(vocab.filter((t) => t.kind === kind))
  }

  const [newSq, setNewSq] = useState('')
  const [newEn, setNewEn] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useNotice()

  const run = async (fn: () => Promise<string>) => {
    setError('')
    try {
      setNotice(await fn())
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setRows(vocab.filter((t) => t.kind === kind)) // undo the optimistic change
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const labelSq = newSq.trim()
    const labelEn = newEn.trim() || labelSq
    if (!labelSq) return
    run(async () => {
      const data = await send('/api/admin/vocab', 'POST', { kind, labelSq, labelEn })
      setNewSq('')
      setNewEn('')
      return data.existed ? `“${data.term.labelSq}” already exists` : `Added “${data.term.labelSq}”`
    })
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row)
    setRows(next)
    run(async () => {
      await send('/api/admin/vocab', 'PUT', { kind, ids: next.map((r) => r.id) })
      return `Moved “${row.labelSq}”`
    })
  }

  const patch = (row: Term, data: Partial<Pick<Term, 'labelSq' | 'labelEn' | 'active'>>, message: string) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...data } : r)))
    run(async () => {
      await send(`/api/admin/vocab/${row.id}`, 'PATCH', data)
      return message
    })
  }

  // Saved when the field is left, only if it actually changed. Empty reverts.
  const rename = (row: Term, field: 'labelSq' | 'labelEn', value: string) => {
    const original = vocab.find((t) => t.id === row.id)?.[field] ?? row[field]
    const v = value.trim()
    if (!v) return setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [field]: original } : r)))
    if (v !== original) patch(row, { [field]: v }, `Renamed to “${v}”`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Vocabulary"
        description="The neighborhoods, cuisines and tags restaurants are described with, in both languages. Visitors see them in the filters and on every listing."
      />

      <div role="group" aria-label="List" className="admin-tabs">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => setKind(k.kind)} aria-pressed={kind === k.kind} className="admin-tab">
            {k.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="ef-alert">
          {error}
        </div>
      )}
      <Notice message={notice} />

      <form onSubmit={add} className="ef-panel mb-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="vocab-new-sq" className="ef-field-label">
            New {meta.one}, Albanian
          </label>
          <input
            id="vocab-new-sq"
            value={newSq}
            maxLength={60}
            onChange={(e) => setNewSq(e.target.value)}
            className="ef-input"
            required
          />
        </div>
        <div>
          <label htmlFor="vocab-new-en" className="ef-field-label">
            English <span className="font-normal text-text-secondary">(defaults to the Albanian)</span>
          </label>
          <input
            id="vocab-new-en"
            value={newEn}
            maxLength={60}
            onChange={(e) => setNewEn(e.target.value)}
            className="ef-input"
          />
        </div>
        <button type="submit" className="ef-btn ef-btn--primary">
          <Plus size={17} aria-hidden /> Add
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`No ${meta.label.toLowerCase()} yet`}
          description="Add the first one above. It shows up in the restaurant form straight away."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Albanian</th>
                <th>English</th>
                <th>Slug</th>
                <th>In pickers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td data-label="Order">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${row.labelSq} up`}
                        className="ef-icon-btn"
                      >
                        <ArrowUp size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === rows.length - 1}
                        aria-label={`Move ${row.labelSq} down`}
                        className="ef-icon-btn"
                      >
                        <ArrowDown size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                  <td data-label="Albanian">
                    <input
                      aria-label={`Albanian label for ${row.slug}`}
                      value={row.labelSq}
                      maxLength={60}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, labelSq: e.target.value } : r)))
                      }
                      onBlur={(e) => rename(row, 'labelSq', e.target.value)}
                      className="ef-input"
                    />
                  </td>
                  <td data-label="English">
                    <input
                      aria-label={`English label for ${row.slug}`}
                      value={row.labelEn}
                      maxLength={60}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, labelEn: e.target.value } : r)))
                      }
                      onBlur={(e) => rename(row, 'labelEn', e.target.value)}
                      className="ef-input"
                    />
                  </td>
                  <td data-label="Slug" className="text-xs text-text-secondary">
                    {row.slug}
                  </td>
                  <td data-label="In pickers">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] font-semibold">
                      <input
                        type="checkbox"
                        role="switch"
                        className="ef-switch"
                        checked={row.active}
                        onChange={(e) =>
                          patch(
                            row,
                            { active: e.target.checked },
                            e.target.checked ? `“${row.labelSq}” is offered again` : `“${row.labelSq}” hidden from pickers`
                          )
                        }
                      />
                      {row.active ? 'Shown' : 'Hidden'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
