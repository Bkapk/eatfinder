'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CircleCheck, type LucideIcon } from 'lucide-react'
import Spinner from '@/components/Spinner'

export function PageHeader({
  eyebrow = 'Workspace',
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        <p className="ef-label mb-2">{eyebrow}</p>
        <h1 className="ef-title">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="admin-empty">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background text-primary">
        <Icon size={25} aria-hidden />
      </span>
      <h2 className="ef-heading">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="admin-empty" role="status">
      <Spinner size={28} label={label} />
      <p className="mt-4 text-sm text-text-secondary">{label}…</p>
    </div>
  )
}

/**
 * The quiet confirmation. Every destructive or bulk action in the admin used to
 * end in silence — the row list simply refetched — so "did that work?" was
 * answered by squinting at the table. This names what happened and then leaves.
 *
 * Errors are deliberately NOT routed through here: they stay on screen until
 * the next action, because a message you have to catch inside six seconds is
 * not an error report.
 */
export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null)

  // Keyed on the value, and every notify() sets a fresh string, so the timer
  // restarts per message rather than cutting the second one short.
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  return [notice, setNotice] as const
}

/**
 * Always mounted, even with nothing to say: a live region injected at the same
 * moment as its text is announced inconsistently, an empty one that later fills
 * is announced reliably.
 */
export function Notice({ message }: { message: string | null }) {
  if (!message) return <div role="status" aria-live="polite" className="sr-only" />
  return (
    <div role="status" aria-live="polite" className="ef-notice">
      <CircleCheck size={17} aria-hidden className="shrink-0" />
      {message}
    </div>
  )
}

export function ScoreMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="ef-meter w-12" aria-hidden>
        <span style={{ transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})` }} />
      </span>
      <span className="w-6 text-right text-xs font-semibold tabular-nums">{value}</span>
    </span>
  )
}
