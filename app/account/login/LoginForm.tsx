'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { t, type Locale } from '@/lib/i18n'

export default function LoginForm({ locale, next }: { locale: Locale; next: string }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(next)
        router.refresh()
      } else {
        setError(res.status === 429 ? t(locale, 'login.error.locked') : t(locale, 'login.error.generic'))
      }
    } catch {
      setError(t(locale, 'login.error.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="ef-card flex flex-col gap-4 p-6">
      {error && (
        <div className="rounded-xl border border-error bg-error/10 px-4 py-3 text-[13px] font-semibold text-error">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="identifier" className="ef-label mb-1.5 block">
          {t(locale, 'auth.identifier')}
        </label>
        <input
          id="identifier"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
          autoComplete="current-password"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button type="submit" disabled={loading} className="ef-pill ef-pill--active h-11 justify-center disabled:opacity-50">
        {loading ? t(locale, 'login.submitting') : t(locale, 'login.submit')}
      </button>

      <p className="text-center text-[13px] text-text-secondary">
        {t(locale, 'login.noAccount')}{' '}
        <Link href="/account/register" className="font-semibold text-primary hover:underline">
          {t(locale, 'login.registerLink')}
        </Link>
      </p>
    </form>
  )
}
