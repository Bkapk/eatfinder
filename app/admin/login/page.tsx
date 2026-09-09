'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
        router.push('/admin')
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-surface shadow-md md:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-on-primary md:flex">
          <div className="flex items-center gap-3 text-lg font-extrabold">
            <UtensilsCrossed size={24} aria-hidden />
            EatFinder.
          </div>
          <div className="py-16">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em]">
              Behind every great discovery
            </p>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              A city full of flavour.
              <br />
              Curated by you.
            </h2>
            <p className="mt-6 text-sm leading-relaxed">
              Your workspace for the places, people, and photos that make EatFinder.
            </p>
          </div>
          <p className="text-xs">Prishtina, one restaurant at a time.</p>
        </aside>
        <div className="p-6 sm:p-10">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-primary"
          >
            <ArrowLeft size={15} aria-hidden />
            Back to EatFinder
          </Link>
          {/* The badge, the title and the line under it are one block: at mb-5
              the badge sat further from its own heading than the heading sat
              from the subtitle. */}
          <div className="mb-8">
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck size={23} aria-hidden />
            </span>
            <h1 className="ef-title">Welcome back</h1>
            <p className="mt-2 text-sm text-text-secondary">Sign in to your admin workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
            {error && (
              <div role="alert" className="ef-alert !mb-0">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="ef-field-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="ef-input h-12"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="ef-field-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // h-12, like the username field above it: this one inherited the
                // ~38px default and the two stacked fields were different sizes.
                className="ef-input h-12"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="ef-btn ef-btn--primary h-12 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={16} aria-hidden />
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-text-secondary">
            Restaurant management · Admin access
          </p>
        </div>
      </div>
    </div>
  )
}
