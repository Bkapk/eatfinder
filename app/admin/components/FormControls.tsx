'use client'

import { useId, useState } from 'react'
import { Clock, Copy, X } from 'lucide-react'
import { DAYS, type Day, type OpenHours } from '@/lib/types'
import { DAY_NAMES } from './restaurantDiff'

/**
 * `.ef-segmented`: one choice from a short ordered set. Real radios, so a
 * single tab stop and arrow keys come from the browser.
 */
export function Segmented<T extends string | number>({
  name,
  label,
  value,
  options,
  onChange,
  labelId,
}: {
  name: string
  /** Accessible group name when there is no visible label to point at. */
  label?: string
  /** id of a visible label element; preferred over `label`. */
  labelId?: string
  value: T
  options: { value: T; label: string; description: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={labelId ? undefined : label}
      aria-labelledby={labelId}
      className="ef-segmented"
    >
      {options.map((o) => (
        <label key={String(o.value)} className="ef-segment" title={o.description}>
          <input
            type="radio"
            name={name}
            value={String(o.value)}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            aria-label={`${o.label} (${o.description})`}
          />
          <span aria-hidden>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

export const PRICE_OPTIONS = [
  { value: 1, label: '$', description: 'Budget' },
  { value: 2, label: '$$', description: 'Moderate' },
  { value: 3, label: '$$$', description: 'Upscale' },
  { value: 4, label: '$$$$', description: 'Fine dining' },
]

const DEFAULT_SLOT: [string, string] = ['09:00', '23:00']

/**
 * The weekly schedule as seven rows of switch + two time fields, in place of
 * the JSON textarea. Writes the exact OpenHours wire shape. A closed day keeps
 * its last times greyed out (and remembers them), so toggling a day never
 * changes the row's height or loses what was typed.
 */
export function HoursEditor({
  value,
  onChange,
  invalidDays = [],
}: {
  value: OpenHours | null
  onChange: (v: OpenHours | null) => void
  invalidDays?: Day[]
}) {
  const id = useId()
  const [remembered, setRemembered] = useState<Partial<Record<Day, [string, string]>>>({})

  if (!value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
        <p className="flex items-center gap-2.5 text-[13px] text-text-secondary">
          <Clock size={16} aria-hidden className="shrink-0" />
          No hours on file. Guests won’t see open or closed for this place.
        </p>
        <button
          type="button"
          className="ef-btn ef-btn--ghost"
          onClick={() => onChange(Object.fromEntries(DAYS.map((d) => [d, DEFAULT_SLOT])) as OpenHours)}
        >
          Add opening hours
        </button>
      </div>
    )
  }

  const timesOf = (d: Day): [string, string] => value[d] ?? remembered[d] ?? DEFAULT_SLOT
  const set = (d: Day, slot: [string, string] | null) => {
    if (slot) setRemembered((r) => ({ ...r, [d]: slot }))
    onChange({ ...value, [d]: slot })
  }

  return (
    <div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {DAYS.map((d) => {
          const open = !!value[d]
          const [from, to] = timesOf(d)
          const overnight = open && from && to && to <= from
          const bad = invalidDays.includes(d)
          return (
            <li
              key={d}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[7rem_7.5rem_minmax(0,1fr)] sm:px-4"
            >
              <label htmlFor={`${id}-${d}`} className="text-[13px] font-semibold text-text">
                {DAY_NAMES[d]}
                {overnight && (
                  <span aria-hidden className="block text-[11px] text-text-secondary sm:hidden">
                    Closes next day
                  </span>
                )}
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 justify-self-end text-[13px] text-text-secondary sm:justify-self-start">
                <input
                  id={`${id}-${d}`}
                  type="checkbox"
                  role="switch"
                  className="ef-switch"
                  checked={open}
                  onChange={(e) => set(d, e.target.checked ? timesOf(d) : null)}
                />
                <span aria-hidden className="w-12">{open ? 'Open' : 'Closed'}</span>
              </label>
              <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <input
                  id={`hours.${d}`}
                  type="time"
                  aria-label={`${DAY_NAMES[d]} opens`}
                  value={from}
                  disabled={!open}
                  aria-invalid={bad && open && !from ? true : undefined}
                  onChange={(e) => set(d, [e.target.value, to])}
                  className="ef-input min-w-0 flex-1 px-3 tabular-nums sm:max-w-[10rem]"
                />
                <span aria-hidden className="text-text-secondary">–</span>
                <input
                  type="time"
                  aria-label={`${DAY_NAMES[d]} closes`}
                  aria-describedby={overnight ? `${id}-${d}-next` : undefined}
                  value={to}
                  disabled={!open}
                  aria-invalid={bad && open && !to ? true : undefined}
                  onChange={(e) => set(d, [from, e.target.value])}
                  className="ef-input min-w-0 flex-1 px-3 tabular-nums sm:max-w-[10rem]"
                />
                {/* Reserved width so a past-midnight close doesn't shift the row.
                    Below sm there is no room beside two time fields, so the
                    hint moves under the day name instead. */}
                <span id={`${id}-${d}-next`} className="hidden w-14 shrink-0 text-[11px] font-semibold text-text-secondary sm:block">
                  {overnight ? 'next day' : ''}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="ef-btn ef-btn--ghost"
          onClick={() => onChange(Object.fromEntries(DAYS.map((d) => [d, value.mon ?? null])) as OpenHours)}
        >
          <Copy size={15} aria-hidden /> Copy Monday to every day
        </button>
        <button type="button" className="ef-btn ef-btn--ghost" onClick={() => onChange(null)}>
          <X size={15} aria-hidden /> Remove hours
        </button>
      </div>
    </div>
  )
}
