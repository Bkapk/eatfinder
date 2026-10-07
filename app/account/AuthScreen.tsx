'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { t, type Locale } from '@/lib/i18n'
import { initSlidingBubble } from '@/components/search/sliding-bubble'
import AuthIllustration from '@/components/auth/AuthIllustration'
import LoginForm from './login/LoginForm'
import RegisterForm from './register/RegisterForm'

export type AuthMode = 'login' | 'register'
const MODES: AuthMode[] = ['login', 'register']

/**
 * Sign in and register as one surface. /account/login and /account/register
 * both render this, each deep-linking to its own tab; switching rewrites the
 * URL in place. `next` has already been through safeReturnPath ('' = none).
 */
export default function AuthScreen({
  locale,
  mode: initial,
  next,
}: {
  locale: Locale
  mode: AuthMode
  next: string
}) {
  const [mode, setMode] = useState(initial)
  const [switched, setSwitched] = useState(false)
  const tabs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({})

  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => (strip.current ? initSlidingBubble(strip.current) : undefined), [])

  // The panel follows its content's height, so swapping two fields for three
  // (or an error arriving) eases open instead of jumping.
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const select = (m: AuthMode, focus = false) => {
    if (focus) tabs.current[m]?.focus()
    if (m === mode) return
    setMode(m)
    setSwitched(true)
    // history.replaceState, not router.replace: the two URLs are separate
    // route segments, so router.replace would refetch the other page and
    // remount this one — no height animation, and a server round trip per
    // tap. Next keeps usePathname in sync with a native replaceState.
    window.history.replaceState(null, '', `/account/${m}${window.location.search}`)
  }

  // The tab title follows, as it would have on a real navigation.
  useEffect(() => {
    document.title = `${t(locale, `${mode}.title`)} — ${t(locale, 'app.name')}`
  }, [locale, mode])

  return (
    <main className="ef-auth">
      <div className="ef-auth-art" aria-hidden>
        <AuthIllustration className="ef-auth-illo" />
        <p className="ef-auth-tagline">{t(locale, 'app.tagline')}</p>
      </div>

      <section className="ef-auth-pane" aria-labelledby="auth-title">
        <div className="mx-auto w-full max-w-[25rem]">
          <h1 id="auth-title" className="ef-title text-center">
            {t(locale, `auth.${mode}.heading`)}
          </h1>
          <p className="mt-2 text-center text-[15px] leading-relaxed text-text-secondary">
            {t(locale, `auth.${mode}.lead`)}
          </p>

          <div
            ref={strip}
            data-bubble-tabs
            role="tablist"
            aria-label={t(locale, 'auth.switch')}
            className="ef-auth-switch"
            style={
              {
                '--bubble-active-bg': 'var(--surface)',
                '--bubble-hover-bg': 'color-mix(in srgb, var(--surface) 55%, transparent)',
                '--bubble-radius': '999px',
                '--bubble-speed': 'var(--dur-panel)',
              } as CSSProperties
            }
            onKeyDown={(e) => {
              const to =
                e.key === 'Home' ? 'login'
                : e.key === 'End' ? 'register'
                : e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (mode === 'login' ? 'register' : 'login')
                : null
              if (!to) return
              e.preventDefault()
              select(to, true)
            }}
          >
            {MODES.map((m) => (
              <button
                key={m}
                ref={(el) => {
                  tabs.current[m] = el
                }}
                id={`auth-tab-${m}`}
                type="button"
                role="tab"
                data-bubble-tab
                aria-selected={mode === m}
                aria-controls="auth-panel"
                tabIndex={mode === m ? 0 : -1}
                onClick={() => select(m)}
                className="ef-auth-tab"
              >
                {t(locale, `${m}.title`)}
              </button>
            ))}
          </div>

          <div className="ef-auth-morph" style={{ height }}>
            <div ref={inner} id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`} className="p-1">
              {/* Keyed: each form starts clean. Faded only after a switch, so
                  the first paint is not held back by an entrance. */}
              <div key={mode} className={switched ? 'ef-fade-enter' : undefined}>
                {mode === 'login' ? (
                  <LoginForm locale={locale} next={next} />
                ) : (
                  <RegisterForm locale={locale} next={next} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
