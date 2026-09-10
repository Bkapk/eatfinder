'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  Compass,
  Images,
  LayoutList,
  LogOut,
  Menu,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import { useDrawer } from '@/components/useDrawer'
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

/**
 * One nav, rendered twice: pinned on desktop, in a sheet below lg. Two copies
 * of this markup is how the mobile nav drifted into a five-item horizontal
 * scroller that hid half its own destinations.
 */
function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <Link href="/admin" className="flex items-center gap-3 px-3 py-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
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
      <p className="ef-label mb-2 mt-8 px-3">Manage</p>
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
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  // showModal() is what brings the focus trap, Escape, the inert background and
  // focus restoration to the hamburger; useDrawer adds the slide and shares
  // every fix with the public filter panel.
  const navDrawer = useDrawer(navOpen, () => setNavOpen(false))


  // Navigating is the point of the sheet, so arriving somewhere closes it.
  useEffect(() => setNavOpen(false), [pathname])

  // Rotating to landscape past lg with the sheet open would leave a modal
  // <dialog> in the top layer that CSS has set to display:none — invisible, but
  // still holding the rest of the page inert. Close it at the breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => {
      if (mq.matches) setNavOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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
        <SidebarContent pathname={pathname} />
      </aside>

      {/* The same nav as a left-anchored sheet below lg. It shares .ef-drawer
          with the public filter panel, so both slide on translate alone. */}
      <dialog
        {...navDrawer}
        aria-label="Admin navigation"
        onClose={() => setNavOpen(false)}
        className="ef-drawer ef-drawer--left lg:hidden"
      >
        <div className="admin-nav-sheet">
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="ef-icon-btn ef-icon-btn--quiet absolute right-4 top-4"
          >
            <X size={18} aria-hidden />
          </button>
          <SidebarContent pathname={pathname} />
        </div>
      </dialog>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="ef-icon-btn lg:hidden"
          >
            <Menu size={19} aria-hidden />
          </button>
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
                  className="ef-icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={17} aria-hidden />
                </button>
              </>
            )}
          </div>
        </header>
        {/* keyed on the route: an 8px fade-up marks "this is a different page"
            on a shell where the chrome never changes. */}
        <main
          key={pathname}
          id="admin-content"
          tabIndex={-1}
          className="admin-content ef-enter"
        >
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
