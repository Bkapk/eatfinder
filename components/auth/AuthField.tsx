'use client'

import { useRef, useState, type InputHTMLAttributes } from 'react'
import { Check, Eye, EyeOff, type LucideIcon } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'placeholder' | 'id'> & {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  /** Show the green tick once the browser's own constraints pass. */
  check?: boolean
  /** [show, hide] accessible names; turns on the password reveal button. */
  reveal?: [string, string]
}

/**
 * The roomy auth field: leading icon, small label riding above the value, a
 * validity tick and an optional password reveal. The tick and the invalid edge
 * are CSS (:valid / :user-invalid), so the browser's own rules — type=email,
 * required, minLength — stay the single source of what "valid" means.
 */
export default function AuthField({ id, label, icon: Icon, hint, check, reveal, type = 'text', ...input }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [shown, setShown] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div>
      <div
        className="ef-auth-field"
        // The whole box is the target, not just the 24px line of text.
        onMouseDown={(e) => {
          if ((e.target as Element).closest('input, button')) return
          e.preventDefault()
          ref.current?.focus()
        }}
      >
        <Icon size={20} aria-hidden className="ef-auth-field-icon" />
        <div className="ef-auth-field-body">
          <label htmlFor={id} className="ef-auth-label">
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            type={reveal && shown ? 'text' : type}
            // A single space so :placeholder-shown can tell "empty" from "valid".
            placeholder=" "
            aria-describedby={hintId}
            className="ef-auth-input"
            {...input}
          />
        </div>
        {check && (
          <span className="ef-auth-check" aria-hidden>
            <Check size={13} strokeWidth={3.5} />
          </span>
        )}
        {reveal && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? reveal[1] : reveal[0]}
            className="ef-auth-reveal"
          >
            {shown ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 px-1 text-[12px] leading-snug text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  )
}
