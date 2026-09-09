'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { t, type Locale } from '@/lib/i18n'

export default function RegisterForm({ locale, next }: { locale: Locale; next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(next)
        router.refresh()
      } else if (res.status === 409) {
        setError(t(locale, 'register.error.emailTaken'))
      } else {
        setError(t(locale, 'register.error.generic'))
      }
    } catch {
      setError(t(locale, 'register.error.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} aria-busy={loading} className="ef-card flex flex-col gap-4 p-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error bg-error-soft px-4 py-3 text-[13px] font-semibold text-error"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="ef-label mb-1.5 block">
          {t(locale, 'auth.email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="ef-input h-11"
        />
      </div>

      <div>
        <label htmlFor="displayName" className="ef-label mb-1.5 block">
          {t(locale, 'auth.displayName')}
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={60}
          autoComplete="nickname"
          aria-describedby="displayName-hint"
          className="ef-input h-11"
        />
        <p id="displayName-hint" className="mt-1 text-[12px] text-text-secondary">
          {t(locale, 'auth.displayNameHint')}
        </p>
      </div>

      <div>
        <label htmlFor="password" className="ef-label mb-1.5 block">
          {t(locale, 'auth.password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="password-hint"
          className="ef-input h-11"
        />
        <p id="password-hint" className="mt-1 text-[12px] text-text-secondary">
          {t(locale, 'auth.passwordHint')}
        </p>
      </div>

      <button type="submit" disabled={loading} className="ef-pill ef-pill--active h-11 justify-center disabled:opacity-50">
        {loading ? t(locale, 'register.submitting') : t(locale, 'register.submit')}
      </button>

      <p className="text-center text-[13px] text-text-secondary">
        {t(locale, 'register.haveAccount')}{' '}
        <Link href="/account/login" className="font-semibold text-primary hover:underline">
          {t(locale, 'register.loginLink')}
        </Link>
      </p>
    </form>
  )
}
