'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { AlertCircle, CheckCircle2, ChevronUp, Save } from 'lucide-react'
import type { FieldChange } from './restaurantDiff'

const noop = () => () => {}

const LEAVE_PROMPT = 'You have unsaved changes. Leave this page and lose them?'

/**
 * The sticky action bar at the foot of an admin edit form. Owns the three
 * things that only make sense while something is unsaved: the change count
 * with its expandable before/after diff, Ctrl/Cmd+S, and the leave guards
 * (beforeunload for reloads and tab closes, a capture-phase click guard for
 * in-app links). Must be rendered inside the <form> it saves.
 */
export default function SaveBar({
  changes,
  saving,
  saved,
  error,
  submitLabel,
  onDiscard,
  onBack,
}: {
  changes: FieldChange[]
  saving: boolean
  /** True after a successful save until the next edit. */
  saved: boolean
  error: string
  submitLabel: string
  onDiscard: () => void
  onBack: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const diffId = useId()
  const [open, setOpen] = useState(false)
  // The server cannot know the platform; it renders "Ctrl S" and a Mac swaps
  // in ⌘S after hydration without a mismatch.
  const shortcut = useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl S'),
    () => 'Ctrl S'
  )
  const dirty = changes.length > 0
  const n = changes.length
  // Collapses with the last change rather than through an effect.
  const expanded = open && dirty

  // Ctrl/Cmd+S saves from anywhere on the page, even with nothing dirty —
  // swallowing the browser's "Save page as" is the expected behaviour here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && !saving) ref.current?.closest('form')?.requestSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, saving])

  // ponytail: covers reloads, tab close and <a> clicks; the browser Back
  // button inside the SPA is not intercepted (Next has no route-change veto).
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return // jump links
      if (!window.confirm(LEAVE_PROMPT)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])


  return (
    <div ref={ref} className="admin-savebar" data-state={dirty ? 'dirty' : 'clean'}>
      {error && (
        <div role="alert" className="admin-savebar-error">
          <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {expanded && (
        <ul id={diffId} aria-label="Unsaved changes" className="admin-savebar-diff">
          {changes.map((c) => (
            <li key={c.key}>
              <span className="font-semibold text-text-secondary">{c.label}</span>
              <span className="grid gap-0.5">
                <del>
                  <span className="sr-only">was </span>
                  {c.from}
                </del>
                <ins>
                  <span className="sr-only">now </span>
                  {c.to}
                </ins>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-savebar-row">
        <span role="status" className="sr-only">
          {saved && !dirty ? 'All changes saved' : ''}
        </span>
        <div className="admin-savebar-status">
          {dirty ? (
            <button
              type="button"
              className="admin-savebar-toggle"
              aria-expanded={expanded}
              aria-controls={diffId}
              onClick={() => setOpen(!expanded)}
            >
              <span className="admin-savebar-dot" aria-hidden />
              <span className="tabular-nums">
                {n} unsaved {n === 1 ? 'change' : 'changes'}
              </span>
              <span className="text-text-secondary">· {expanded ? 'Hide' : 'Review'}</span>
              <ChevronUp size={16} aria-hidden className="text-text-secondary" />
            </button>
          ) : saved ? (
            <span className="flex items-center gap-2 text-success">
              <CheckCircle2 size={17} aria-hidden /> All changes saved
            </span>
          ) : (
            <span className="text-text-secondary">No unsaved changes</span>
          )}
        </div>
        {dirty ? (
          <button type="button" onClick={onDiscard} disabled={saving} className="ef-btn ef-btn--ghost">
            Discard
          </button>
        ) : (
          <button type="button" onClick={onBack} className="ef-btn ef-btn--ghost">
            Back to list
          </button>
        )}
        <button type="submit" disabled={saving || !dirty} className="ef-btn ef-btn--primary">
          <Save size={17} aria-hidden />
          {saving ? 'Saving…' : submitLabel}
          <kbd className="admin-savebar-kbd" aria-hidden>
            {shortcut}
          </kbd>
        </button>
      </div>
    </div>
  )
}
