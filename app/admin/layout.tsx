'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  Compass,
  Images,
  LayoutList,
  LogOut,
  Sparkles,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import './admin.css'

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

function NavLink({ item, pathname }: { item: (typeof NAV)[number]; pathname: string }) {
  const Icon = item.icon
  // Every admin path starts with /admin, so the index needs an exact match
  // or it would light up on every page.
  const active =
    item.href === '/admin'
      ? pathname === '/admin' ||
        pathname === '/admin/new' ||
        !NAV.some((n) => n.href !== '/admin' && pathname.startsWith(n.href))
      : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`admin-nav-link ${
        active
          ? 'bg-primary-soft text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
      }`}
    >
      <Icon size={18} aria-hidden />
      {item.label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
    <div className="admin-shell" lang="en">
      <a href="#admin-content" className="admin-skip">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <Link href="/admin" className="flex items-center gap-3 px-2 py-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-on-primary">
            <UtensilsCrossed size={21} aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-extrabold tracking-tight">
              EatFinder<span className="text-primary">.</span>
            </span>
            <span className="block text-[11px] font-medium text-text-secondary">
              Admin workspace
            </span>
          </span>
        </Link>
        <p className="ef-label mb-3 mt-10 px-3">Manage</p>
        <nav aria-label="Admin navigation" className="flex flex-col gap-1.5">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-5">
          <Link href="/" className="admin-nav-link text-text-secondary hover:bg-surface-hover">
            <ArrowUpRight size={18} aria-hidden />
            View public site
          </Link>
          <p className="mt-5 px-3 text-xs leading-relaxed text-text-secondary">
            Good food. Great discoveries.
            <br />
            Curated in Prishtina.
          </p>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <Link href="/admin" className="flex items-center gap-2 font-extrabold lg:hidden">
            <UtensilsCrossed size={20} className="text-primary" aria-hidden />
            EatFinder
          </Link>
          <div className="hidden items-center gap-2 text-xs text-text-secondary lg:flex">
            <span>Workspace</span>
            <ChevronRight size={13} aria-hidden />
            <span className="font-semibold text-text">
              {pathname === '/admin/new'
                ? 'New restaurant'
                : (NAV.find((n) => n.href === pathname)?.label ?? 'Restaurant details')}
            </span>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-text-secondary hover:text-primary lg:hidden"
            >
              View site
            </Link>
            {user && (
              <>
                <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {user.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="max-w-40 truncate text-xs font-semibold">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="admin-icon-button"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={17} aria-hidden />
                </button>
              </>
            )}
          </div>
        </header>
        <nav aria-label="Mobile admin navigation" className="admin-mobile-nav">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <main id="admin-content" tabIndex={-1} className="admin-content">
          {children}
        </main>
        <footer className="admin-footer">
          <span>EatFinder / Admin workspace</span>
          <span>Made for better discoveries</span>
        </footer>
      </div>
    </div>
  )
}
