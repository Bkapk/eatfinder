'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Utensils } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Utensils size={32} className="text-primary" />
            <h1 className="text-[26px] font-extrabold tracking-tight text-text">EatFinder Admin</h1>
          </div>
          <p className="text-text-secondary">Sign in to manage restaurants</p>
        </div>

        <form onSubmit={handleSubmit} className="ef-panel space-y-4">
          {error && (
            <div className="px-4 py-3 bg-error-soft border border-error rounded text-error text-sm">
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
              className="ef-input"
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
              className="ef-input"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-primary text-on-primary hover:bg-primary-hover rounded font-semibold transition-colors disabled:opacity-50 shadow-md"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
