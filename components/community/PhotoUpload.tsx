'use client'

import { useRef, useState } from 'react'
import { t, type Locale } from '@/lib/i18n'

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Matches HOUR_LIMIT in app/api/community/photos — picking a different number
 * here would only mean the last few files in a batch come back 429. The server
 * still enforces it; this just stops the UI promising what it cannot deliver.
 */
const MAX_FILES = 5

/** The submit widget on /r/[slug]. Signed-out users never reach this —
 *  app/r/[slug]/page.tsx only renders it for a signed-in, non-banned user. */
export default function PhotoUpload({
  restaurantId,
  locale,
  onUploaded,
}: {
  restaurantId: string
  locale: Locale
  onUploaded?: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFiles([])
    setCaption('')
    if (inputRef.current) inputRef.current.value = ''
  }

  /**
   * One request per photo, run in series. The route moderates each upload
   * through Gemini with the already-approved photos as context, so a batch sent
   * in parallel would judge every file against the same stale set — and the
   * per-user rate limit counts rows, which only a serial run can stop short of.
   */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return
    if (files.some((f) => f.size > MAX_BYTES)) {
      setMessage({ text: t(locale, 'photoUpload.error.tooLarge'), kind: 'error' })
      return
    }

    setBusy(true)
    setMessage(null)
    setProgress(0)

    let approved = 0
    let pending = 0

    try {
      for (const [i, file] of files.entries()) {
        setProgress(i + 1)

        const form = new FormData()
        form.set('restaurantId', restaurantId)
        form.set('caption', caption)
        form.set('file', file)
        const res = await fetch('/api/community/photos', { method: 'POST', body: form })
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 429) {
            const minutes = Math.max(1, Math.ceil((data.retryAfterSeconds ?? 3600) / 60))
            setMessage({
              text: t(locale, 'photoUpload.error.rateLimited', { minutes }),
              kind: 'error',
            })
          } else {
            setMessage({ text: data.error || t(locale, 'photoUpload.error.generic'), kind: 'error' })
          }
          // Whatever already landed still counts — stop here rather than
          // hammering a limit that has just been reported.
          if (approved + pending > 0) onUploaded?.()
          return
        }

        if (data.status === 'approved') approved++
        else pending++
      }

      setMessage({
        text:
          files.length === 1
            ? t(locale, approved ? 'photoUpload.success.approved' : 'photoUpload.success.pending')
            : t(locale, 'photoUpload.success.batch', { approved, pending }),
        kind: 'success',
      })
      reset()
      onUploaded?.()
    } catch {
      setMessage({ text: t(locale, 'photoUpload.error.generic'), kind: 'error' })
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    setFiles(picked.slice(0, MAX_FILES))
    setMessage(
      picked.length > MAX_FILES
        ? { text: t(locale, 'photoUpload.tooMany', { n: MAX_FILES }), kind: 'error' }
        : null
    )
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        onChange={pick}
        className="text-[13px] text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-primary"
        aria-label={t(locale, 'photoUpload.chooseFile')}
      />
      {files.length > 1 && (
        <p className="text-[13px] font-semibold text-text-secondary">
          {t(locale, 'photoUpload.selected', { n: files.length })}
        </p>
      )}
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={140}
        placeholder={t(locale, 'photoUpload.captionPlaceholder')}
        className="ef-input h-10"
        aria-label={t(locale, 'photoUpload.caption')}
      />
      {/* Each upload is a single fetch() with no progress events, so the bar
          stays indeterminate — the honest number is which file of how many. */}
      {busy && (
        <>
          <div className="ef-progress" aria-hidden />
          {files.length > 1 && (
            <p className="text-[13px] text-text-secondary" role="status">
              {t(locale, 'photoUpload.progress', { n: progress, total: files.length })}
            </p>
          )}
        </>
      )}

      {message && (
        <p
          className={`ef-enter text-[13px] font-semibold ${message.kind === 'success' ? 'text-success' : 'text-error'}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={files.length === 0 || busy}
        className="ef-pill ef-pill--active self-start disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t(locale, 'photoUpload.submitting') : t(locale, 'photoUpload.submit')}
      </button>
    </form>
  )
}
