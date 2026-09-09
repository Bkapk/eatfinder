import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
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
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">{title}</h1>
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
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
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

export function ScoreMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </span>
      <span className="w-6 text-right text-xs font-semibold tabular-nums">{value}</span>
    </span>
  )
}
