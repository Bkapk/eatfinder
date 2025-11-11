'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Utensils, LogOut } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        if (pathname !== '/admin/login') {
          router.push('/admin/login')
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      if (pathname !== '/admin/login') {
        router.push('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="flex items-center gap-2 text-primary font-semibold text-lg hover:text-primary-hover transition-colors">
                <Utensils size={24} />
                EatFinder Admin
              </Link>
              <div className="hidden sm:flex gap-4">
                <Link 
                  href="/admin" 
                  className={`px-3 py-2 rounded transition-colors ${
                    pathname === '/admin' 
                      ? 'text-primary font-medium' 
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Restaurants
                </Link>
                <Link 
                  href="/admin/import" 
                  className={`px-3 py-2 rounded transition-colors ${
                    pathname === '/admin/import' 
                      ? 'text-primary font-medium' 
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Import/Export
                </Link>
                <Link 
                  href="/eat" 
                  className="px-3 py-2 rounded transition-colors text-text-secondary hover:text-text"
                >
                  View Public Page
                </Link>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-text-secondary text-sm">{user.username}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-hover hover:bg-border border border-border rounded transition-colors text-sm"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
