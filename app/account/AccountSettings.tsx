'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, KeyRound, LogOut, UserRound } from 'lucide-react'
import { t, type Locale, type TKey } from '@/lib/i18n'
import { reloadFavorites } from '@/components/useFavorites'

type Msg = { ok: boolean; text: string } | null

/** The always-mounted live region pattern from AdminUI's <Notice>. Errors stay until the next action. */
function Message({ msg }: { msg: Msg }) {
  if (!msg) return <div role="status" aria-live="polite" className="sr-only" />
  return msg.ok ? (
    <div role="status" aria-live="polite" className="ef-notice !mb-0 mt-4">
      <CircleCheck size={17} aria-hidden className="shrink-0" />
      {msg.text}
    </div>
  ) : (
    <div role="alert" className="ef-alert !mb-0 mt-4">
      <CircleAlert size={17} aria-hidden className="mt-0.5 shrink-0" />
      {msg.text}
    </div>
  )
}

const PASSWORD_ERRORS: Record<string, TKey> = {
  wrong: 'account.password.wrong',
  invalid: 'account.password.invalid',
  rate: 'account.password.rate',
}

export default function AccountSettings({
  locale,
  displayName,
  email,
}: {
  locale: Locale
  displayName: string
  email: string
}) {
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMsg, setNameMsg] = useState<Msg>(null)

  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<Msg>(null)
  const [showPw, setShowPw] = useState(false)

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    setNameBusy(true)
    setNameMsg(null)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      })
      if (!res.ok) throw new Error()
      setNameMsg({ ok: true, text: t(locale, 'account.settings.saved') })
      router.refresh() // the hero reads the name from the server
    } catch {
      setNameMsg({ ok: false, text: t(locale, 'account.error') })
    } finally {
      setNameBusy(false)
    }
  }

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setPwBusy(true)
    setPwMsg(null)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: fd.get('current'), newPassword: fd.get('new') }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPwMsg({ ok: false, text: t(locale, PASSWORD_ERRORS[data.code] ?? 'account.error') })
        return
      }
      form.reset()
      setPwMsg({ ok: true, text: t(locale, 'account.password.done') })
    } catch {
      setPwMsg({ ok: false, text: t(locale, 'account.error') })
    } finally {
      setPwBusy(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    void reloadFavorites()
    router.push('/')
    router.refresh()
  }

  const nameUnchanged = name.trim() === displayName || !name.trim()

  return (
    <section aria-labelledby="settings-h" id="settings" className="ef-panel scroll-mt-24 lg:col-span-7">
      <h2 id="settings-h" className="ef-heading">
        {t(locale, 'account.settings.title')}
      </h2>

      {/* Phone: profile, password, then sign out last. xl: password takes the
          right column beside profile + session. */}
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-7 xl:grid-cols-2">
          <form onSubmit={saveName} className="xl:col-start-1 xl:row-start-1">
            <h3 className="ef-label mb-4 flex items-center gap-2">
              <UserRound size={14} aria-hidden />
              {t(locale, 'account.settings.profile')}
            </h3>
            <label htmlFor="acc-name" className="ef-field-label">
              {t(locale, 'account.settings.displayName')}
            </label>
            <div className="flex gap-2">
              <input
                id="acc-name"
                className="ef-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                autoComplete="nickname"
              />
              <button type="submit" className="ef-btn ef-btn--ghost shrink-0" disabled={nameBusy || nameUnchanged}>
                {nameBusy ? t(locale, 'account.settings.saving') : t(locale, 'account.settings.save')}
              </button>
            </div>
            <p className="ef-field-label mb-1 mt-4">{t(locale, 'account.settings.email')}</p>
            <p className="break-all text-[14px] text-text">{email}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              {t(locale, 'account.settings.emailHint')}
            </p>
            <Message msg={nameMsg} />
          </form>

          <div className="order-last border-t border-border pt-6 xl:order-none xl:col-start-1 xl:row-start-2">
            <h3 className="ef-label mb-2 flex items-center gap-2">
              <LogOut size={14} aria-hidden />
              {t(locale, 'account.session.title')}
            </h3>
            <p className="mb-4 text-[13px] leading-relaxed text-text-secondary">{t(locale, 'account.session.body')}</p>
            <button type="button" onClick={logout} className="ef-btn ef-btn--ghost w-full sm:w-auto">
              <LogOut size={16} aria-hidden />
              {t(locale, 'account.logout')}
            </button>
          </div>

        <form
          onSubmit={changePassword}
          className="border-t border-border pt-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0"
        >
          <h3 className="ef-label mb-4 flex items-center gap-2">
            <KeyRound size={14} aria-hidden />
            {t(locale, 'account.password.title')}
          </h3>
          {/* For password managers: the account this form belongs to. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <label htmlFor="acc-pw-current" className="ef-field-label">
            {t(locale, 'account.password.current')}
          </label>
          <input
            id="acc-pw-current"
            name="current"
            type={showPw ? 'text' : 'password'}
            className="ef-input"
            autoComplete="current-password"
            required
          />
          <label htmlFor="acc-pw-new" className="ef-field-label mt-4">
            {t(locale, 'account.password.new')}
          </label>
          <input
            id="acc-pw-new"
            name="new"
            type={showPw ? 'text' : 'password'}
            className="ef-input"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            aria-describedby="acc-pw-hint"
          />
          <p id="acc-pw-hint" className="mt-2 text-[12px] leading-relaxed text-text-secondary">
            {t(locale, 'account.password.hint')}
          </p>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[13px] font-semibold">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
            {t(locale, 'auth.showPassword')}
          </label>
          <button type="submit" className="ef-btn ef-btn--primary mt-3 w-full sm:w-auto" disabled={pwBusy}>
            {pwBusy ? t(locale, 'account.settings.saving') : t(locale, 'account.password.submit')}
          </button>
          <Message msg={pwMsg} />
        </form>
      </div>
    </section>
  )
}
