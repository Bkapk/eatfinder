'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Compass, Images, LayoutList, LogOut, Sparkles, Store, Utensils } from 'lucide-react'
import Spinner from '@/components/Spinner'

/**
 * Every admin surface, in one list. /admin/discover, /admin/queue and
 * /admin/photos shipped in Phases 3-5 reachable by direct URL only, because
 * each phase's agent correctly refused to edit a file outside its ownership.
 */
const NAV = [
  { href: '/admin', label: 'Restaurants', icon: Store },
  { href: '/admin/discover', label: 'Discover', icon: Compass },
  { href: '/admin/queue', label: 'AI Queue', icon: Sparkles },
  { href: '/admin/photos', label: 'Photos', icon: Images },
  { href: '/admin/import', label: 'Import/Export', icon: LayoutList },
] as const

function NavLink({
  item,
  pathname,
}: {
  item: (typeof NAV)[number]
  pathname: string
}) {
  const Icon = item.icon
  // Every admin path starts with /admin, so the index needs an exact match
  // or it would light up on every page.
  const active =
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-200 ${
        active
          ? 'bg-primary-soft text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
      }`}
    >
      <Icon size={15} aria-hidden />
      {item.label}
    </Link>
  )
}

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
        if (data.user.role !== 'admin') {
          // A community account passed the cookie-presence check in
          // middleware.ts; the real gate is here and on every data route.
          router.push('/')
          return
        }
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
        <Spinner size={32} />
      </div>
    )
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-sticky border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-6">
              <Link
                href="/admin"
                className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold tracking-tight text-text"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-on-primary">
                  <Utensils size={18} aria-hidden />
                </span>
                <span className="hidden sm:block">EatFinder Admin</span>
              </Link>

              <div className="hidden items-center gap-1 lg:flex">
                {NAV.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/" className="ef-btn ef-btn--ghost hidden h-9 xl:inline-flex">
                View site
              </Link>
              {user && (
                <>
                  <span className="hidden text-[13px] font-semibold text-text-secondary sm:block">
                    {user.username}
                  </span>
                  <button onClick={handleLogout} className="ef-btn ef-btn--ghost h-9">
                    <LogOut size={16} aria-hidden />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Below lg the nav becomes a scrollable rail rather than disappearing —
              /admin/queue and /admin/photos were previously URL-only on any width. */}
          <div className="ef-scroll-fade -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
