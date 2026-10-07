import type { ReactNode } from 'react'

/**
 * The two chart shapes the dashboards use, as plain SVG/CSS — no chart
 * library. Both are server-safe (no hooks), so the admin overview renders them
 * on the server and the account page uses them from a client component.
 *
 * Colours are tokens only: steps of Signal Blue for categories (the Two Voices
 * Rule allows no third hue), Hairline Strong for "other". Every chart ships
 * the same numbers as text beside it, so the tints do not carry meaning alone.
 */
export const SERIES = [
  'var(--primary)',
  'color-mix(in srgb, var(--primary) 66%, var(--surface))',
  'color-mix(in srgb, var(--primary) 40%, var(--surface))',
  'color-mix(in srgb, var(--primary) 22%, var(--surface))',
  'var(--border-strong)',
]

/** A ring. `segments` share the circle by value; one segment = a progress ring. */
export function Donut({
  segments,
  track = 'var(--surface-hover)',
  size = 132,
  thickness = 12,
  label,
  total: max,
  children,
}: {
  segments: { value: number; color: string }[]
  /** Defaults to the sum of the segments; pass 100 for a single progress arc. */
  total?: number
  track?: string
  size?: number
  thickness?: number
  /** The whole chart's meaning in words; the SVG itself is hidden. */
  label: string
  children?: ReactNode
}) {
  const r = 50 - thickness / 2
  const c = 2 * Math.PI * r
  const total = max ?? segments.reduce((s, x) => s + x.value, 0)
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 1.2 : 0
  let offset = 0
  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c
            const el = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                strokeLinecap={segments.length === 1 ? 'round' : 'butt'}
              />
            )
            offset += len
            return el
          })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  )
}

/** Small vertical bars, oldest left. Static heights — nothing here animates. */
export function Spark({
  values,
  label,
  color = 'var(--primary)',
  className = 'h-14',
}: {
  values: number[]
  label: string
  color?: string
  className?: string
}) {
  const max = Math.max(1, ...values)
  return (
    <div role="img" aria-label={label} className={`flex items-end gap-[3px] ${className}`}>
      {values.map((v, i) => (
        <span
          key={i}
          aria-hidden
          className="min-h-[3px] flex-1 rounded-full"
          // A zero day still shows a stub, so the axis reads as "nothing
          // happened" rather than "no data".
          style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: v ? color : 'var(--border)' }}
        />
      ))}
    </div>
  )
}

/** Labelled rows with a meter under each; the value is the text, the bar is the shape of it. */
export function BarList({
  rows,
  max,
  unit,
}: {
  rows: { key: string; label: ReactNode; value: number; note?: string }[]
  max?: number
  unit?: string
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-semibold text-text">{r.label}</span>
            <span className="shrink-0 tabular-nums text-text-secondary">
              <span className="font-bold text-text">{r.value}</span>
              {unit && ` ${unit}`}
              {r.note && ` · ${r.note}`}
            </span>
          </div>
          <span className="ef-meter h-2" aria-hidden>
            <span style={{ transform: `scaleX(${Math.min(1, r.value / top)})` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}
