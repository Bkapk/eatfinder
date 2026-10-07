'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { reloadFavorites } from '@/components/useFavorites'
import AuthField from '@/components/auth/AuthField'

/** `next` is a safe internal path or '' (none), in which case /account. */
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
        void reloadFavorites()
        router.push(next || '/account')
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
    <form onSubmit={submit} aria-busy={loading} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="ef-alert !mb-0">
          <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <AuthField
        id="email"
        type="email"
        label={t(locale, 'auth.email')}
        icon={Mail}
        check
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <AuthField
        id="displayName"
        label={t(locale, 'auth.displayName')}
        icon={UserRound}
        check
        hint={t(locale, 'auth.displayNameHint')}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        maxLength={60}
        autoComplete="nickname"
      />

      <AuthField
        id="password"
        type="password"
        label={t(locale, 'auth.password')}
        icon={LockKeyhole}
        check
        reveal={[t(locale, 'auth.showPassword'), t(locale, 'auth.hidePassword')]}
        hint={t(locale, 'auth.passwordHint')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
      />

      <button type="submit" disabled={loading} className="ef-btn ef-btn--primary ef-auth-submit">
        {loading && <Loader2 size={18} aria-hidden className="motion-safe:animate-spin" />}
        {loading ? t(locale, 'register.submitting') : t(locale, 'register.submit')}
      </button>
    </form>
  )
}
