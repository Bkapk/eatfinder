'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { useDrawer } from '@/components/useDrawer'

const Dismiss = createContext<() => void>(() => {})

/**
 * A listing opened from Explore or Saved, as a sheet over them rather than a
 * new page: the results underneath never unmount, so their filters, scroll
 * offset and map camera are simply still there when it closes.
 *
 * The URL is the listing's (Next intercepting route, app/(browse)/@modal), so
 * browser Back closes it, and a refresh or a shared link gets the full page.
 * The close button, Escape and a scrim click animate out first and then leave
 * every listing opened inside this sheet (similar places push their own
 * entries) in one step, landing on the results, not on the previous place.
 *
 * Mounted from a layout, so moving between places inside it keeps one sheet
 * instead of sliding a new one in per place.
 */
export function Flyout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const drawer = useDrawer(open, () => setOpen(false))
  const sheetRef = useRef<HTMLDivElement>(null)
  // Listings visited in this sheet, oldest first: one history entry each.
  const trail = useRef<string[]>([])

  useEffect(() => {
    const seen = trail.current
    if (seen.at(-2) === pathname) seen.pop() // browser Back, one place
    else if (seen.at(-1) !== pathname) seen.push(pathname)
    // A new place starts at its photo, not where the last one was scrolled to.
    sheetRef.current?.scrollTo(0, 0)
  }, [pathname])

  // Next applies metadata from the page under the URL's main slot, and with
  // an intercepted route that is still the results page: the tab would keep
  // saying "EatFinder — …" over a listing. Name the tab after the listing on
  // screen, and give the page its own title back on the way out.
  useEffect(() => {
    const before = document.title
    const name = document.getElementById('ef-flyout-title')?.textContent
    if (name) document.title = `${name} — EatFinder`
    return () => {
      document.title = before
    }
  }, [pathname])

  const leave = () => {
    const n = trail.current.length
    // An intercepted render only happens on an in-app navigation, so there is
    // always an entry behind it; the fallback is for a history the browser
    // has lost (restored session), where the honest destination is Explore.
    if (window.history.length > n) window.history.go(-n)
    else router.push('/')
  }

  return (
    <Dismiss value={() => setOpen(false)}>
      <dialog
        {...drawer}
        // Fired by useDrawer once the exit transition has finished.
        onClose={leave}
        aria-labelledby="ef-flyout-title"
        className="ef-drawer ef-flyout"
      >
        <div ref={sheetRef} className="ef-flyout-sheet">
          {children}
        </div>
      </dialog>
    </Dismiss>
  )
}

/** The flyout's top-left control, where the page has its back arrow. */
export function CloseButton({ locale, className = '' }: { locale: Locale; className?: string }) {
  const close = useContext(Dismiss)
  return (
    <button type="button" onClick={close} aria-label={t(locale, 'detail.close')} className={className}>
      <X size={20} aria-hidden />
    </button>
  )
}
