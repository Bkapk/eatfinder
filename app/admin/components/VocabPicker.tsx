'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useVocab } from '@/components/VocabProvider'
import { slugify } from '@/lib/types'
import type { Term, VocabKind } from '@/lib/vocab'

type Props = {
  kind: VocabKind
  /** Visible label text; also the accessible name of the combobox. */
  label: string
  /** Shown when nothing is selected/typed. */
  placeholder?: string
} & (
  | { multiple: true; value: string[]; onChange: (slugs: string[]) => void; max?: number }
  | { multiple?: false; value: string; onChange: (slug: string) => void }
)

// Matches either label or the slug, ignoring case and diacritics: "zgare"
// finds "Qebapa & Zgarë", "ulpiana" finds "Ulpianë".
const norm = (s: string) => slugify(s).replace(/-/g, ' ')

/**
 * A searchable picker over one vocabulary (ARIA combobox + listbox). Single
 * mode for the neighbourhood, multiple for cuisines and tags. Typing a value
 * that is not in the list offers to add it, with both language labels; the new
 * term is created through /api/admin/vocab and selected straight away.
 */
export default function VocabPicker(props: Props) {
  const { kind, label, placeholder } = props
  const router = useRouter()
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)

  const vocab = useVocab()
  // Terms created here, until router.refresh() brings them back in the vocab.
  const [created, setCreated] = useState<Term[]>([])
  const terms = useMemo(
    () => [...vocab, ...created.filter((c) => !vocab.some((v) => v.id === c.id))].filter((t) => t.kind === kind),
    [vocab, created, kind]
  )

  const selected = props.multiple ? props.value : props.value ? [props.value] : []
  const full = props.multiple && props.max !== undefined && selected.length >= props.max
  const termFor = (slug: string) => terms.find((t) => t.slug === slug)
  const labelOf = (slug: string) => termFor(slug)?.labelSq ?? slug

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [draft, setDraft] = useState<{ labelSq: string; labelEn: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const q = norm(query)
  // Inactive terms are not offered, but one already selected still shows as a chip.
  const options = terms.filter(
    (t) => t.active && (!q || [t.labelSq, t.labelEn, t.slug].some((s) => norm(s).includes(q)))
  )
  const exact = q && terms.some((t) => norm(t.labelSq) === q || norm(t.labelEn) === q)
  const canCreate = Boolean(q) && !exact
  const count = options.length + (canCreate ? 1 : 0)

  const choose = (slug: string) => {
    if (props.multiple) {
      const on = props.value.includes(slug)
      if (!on && full) return
      props.onChange(on ? props.value.filter((s) => s !== slug) : [...props.value, slug])
      setQuery('')
    } else {
      props.onChange(slug)
      setQuery('')
      setOpen(false)
    }
  }

  const startCreate = () => {
    setDraft({ labelSq: query.trim(), labelEn: query.trim() })
    setError('')
    setOpen(false)
  }

  const create = async () => {
    if (!draft || !draft.labelSq.trim() || !draft.labelEn.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not add it')
      setCreated((c) => [...c, data.term])
      if (!selected.includes(data.term.slug)) choose(data.term.slug)
      setDraft(null)
      setQuery('')
      router.refresh() // every other picker and label on the page learns the new term
      inputRef.current?.focus()
    } catch (e: any) {
      setError(e.message || 'Could not add it')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (count ? (a + step + count) % count : 0))
    } else if (e.key === 'Enter') {
      // Never submit the surrounding restaurant form from inside the picker.
      e.preventDefault()
      if (!open) return setOpen(true)
      const cur = Math.min(active, count - 1)
      if (cur >= 0 && cur < options.length) choose(options[cur].slug)
      else if (cur >= 0 && canCreate) startCreate()
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      } else if (query) setQuery('')
    } else if (e.key === 'Backspace' && !query && props.multiple && props.value.length) {
      props.onChange(props.value.slice(0, -1))
    }
  }

  const activeId = open && count ? `${id}-opt-${Math.min(active, count - 1)}` : undefined
  // Single mode shows the chosen label in the box until you start typing.
  const shown = !props.multiple && !open && !query ? (props.value ? labelOf(props.value) : '') : query

  return (
    <div
      className="ef-combo"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <label htmlFor={`${id}-input`} className="ef-field-label">
        {label}
      </label>
      <div className="ef-combo-field" onMouseDown={(e) => {
        // A click anywhere in the box focuses the text field, chips included.
        if (e.target === e.currentTarget) {
          e.preventDefault()
          inputRef.current?.focus()
          setOpen(true)
        }
      }}>
        {props.multiple &&
          props.value.map((slug) => (
            <span key={slug} className="ef-chip">
              <span className="min-w-0 truncate">{labelOf(slug)}</span>
              <button
                type="button"
                onClick={() => props.onChange(props.value.filter((s) => s !== slug))}
                aria-label={`Remove ${labelOf(slug)}`}
                className="ef-chip-remove"
              >
                <X size={13} aria-hidden />
              </button>
            </span>
          ))}
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          value={shown}
          placeholder={
            props.multiple ? (selected.length ? '' : placeholder) : props.value ? labelOf(props.value) : placeholder
          }
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="ef-combo-input"
        />
        {!props.multiple && props.value && (
          <button
            type="button"
            onClick={() => {
              props.onChange('')
              inputRef.current?.focus()
            }}
            aria-label={`Clear ${label}`}
            className="ef-icon-btn ef-icon-btn--quiet h-9 w-9"
          >
            <X size={16} aria-hidden />
          </button>
        )}
        <ChevronDown size={16} aria-hidden className="mx-2 shrink-0 text-text-secondary" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={props.multiple || undefined}
          className="ef-combo-list"
        >
          {options.map((t, i) => {
            const on = selected.includes(t.slug)
            return (
              <li
                key={t.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={on}
                aria-disabled={!on && full ? true : undefined}
                data-active={i === Math.min(active, count - 1)}
                // mousedown, not click: keeps focus in the input so the list
                // does not close under the pointer.
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(t.slug)
                }}
                onMouseEnter={() => setActive(i)}
                className={`ef-combo-option ${!on && full ? 'opacity-50' : ''}`}
              >
                <Check size={16} aria-hidden className={on ? 'shrink-0' : 'invisible shrink-0'} />
                {t.labelSq}
                {t.labelEn !== t.labelSq && <span className="ef-combo-hint">{t.labelEn}</span>}
              </li>
            )
          })}
          {canCreate && (
            <li
              id={`${id}-opt-${options.length}`}
              role="option"
              aria-selected={false}
              data-active={Math.min(active, count - 1) === options.length}
              onMouseDown={(e) => {
                e.preventDefault()
                startCreate()
              }}
              onMouseEnter={() => setActive(options.length)}
              className="ef-combo-option text-primary"
            >
              <Plus size={16} aria-hidden className="shrink-0" />
              Add “{query.trim()}”
            </li>
          )}
          {count === 0 && <li className="ef-combo-empty">Nothing here yet. Type to add one.</li>}
        </ul>
      )}

      {props.multiple && props.max !== undefined && full && (
        <p className="mt-1.5 text-xs text-text-secondary">Up to {props.max}. Remove one to pick another.</p>
      )}

      {draft && (
        <div
          role="group"
          aria-label={`Add a new ${kind}`}
          className="ef-combo-create"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
              e.preventDefault()
              create()
            } else if (e.key === 'Escape') {
              setDraft(null)
              inputRef.current?.focus()
            }
          }}
        >
          <div>
            <label htmlFor={`${id}-sq`} className="ef-field-label">
              Albanian label
            </label>
            <input
              id={`${id}-sq`}
              autoFocus
              value={draft.labelSq}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, labelSq: e.target.value })}
              className="ef-input"
            />
          </div>
          <div>
            <label htmlFor={`${id}-en`} className="ef-field-label">
              English label
            </label>
            <input
              id={`${id}-en`}
              value={draft.labelEn}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })}
              className="ef-input"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="ef-btn ef-btn--ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              disabled={busy || !draft.labelSq.trim() || !draft.labelEn.trim()}
              className="ef-btn ef-btn--primary"
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-error sm:col-span-3">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
