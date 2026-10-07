'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, Loader2, LockKeyhole, UserRound } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { reloadFavorites } from '@/components/useFavorites'
import { postLoginPath } from '@/lib/redirect'
import AuthField from '@/components/auth/AuthField'

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
        void reloadFavorites()
        router.push(postLoginPath(data.user.role, next))
        router.refresh()
      } else {
        setError(
          res.status === 429 ? t(locale, 'login.error.locked') : t(locale, 'login.error.generic')
        )
      }
    } catch {
      setError(t(locale, 'login.error.generic'))
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
        id="identifier"
        label={t(locale, 'auth.identifier')}
        icon={UserRound}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />

      <AuthField
        id="password"
        type="password"
        label={t(locale, 'auth.password')}
        icon={LockKeyhole}
        reveal={[t(locale, 'auth.showPassword'), t(locale, 'auth.hidePassword')]}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />

      <button type="submit" disabled={loading} className="ef-btn ef-btn--primary ef-auth-submit">
        {loading && <Loader2 size={18} aria-hidden className="motion-safe:animate-spin" />}
        {loading ? t(locale, 'login.submitting') : t(locale, 'login.submit')}
      </button>
    </form>
  )
}
