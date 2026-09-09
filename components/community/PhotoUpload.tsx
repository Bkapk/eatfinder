'use client'

import { useRef, useState } from 'react'
import { t, type Locale } from '@/lib/i18n'

const MAX_BYTES = 5 * 1024 * 1024

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
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    if (file.size > MAX_BYTES) {
      setMessage({ text: t(locale, 'photoUpload.error.tooLarge'), kind: 'error' })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('restaurantId', restaurantId)
      form.set('caption', caption)
      form.set('file', file)
      const res = await fetch('/api/community/photos', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          const minutes = Math.max(1, Math.ceil((data.retryAfterSeconds ?? 3600) / 60))
          setMessage({ text: t(locale, 'photoUpload.error.rateLimited', { minutes }), kind: 'error' })
        } else {
          setMessage({ text: data.error || t(locale, 'photoUpload.error.generic'), kind: 'error' })
        }
        return
      }

      setMessage({
        text: t(
          locale,
          data.status === 'approved' ? 'photoUpload.success.approved' : 'photoUpload.success.pending'
        ),
        kind: 'success',
      })
      setFile(null)
      setCaption('')
      if (inputRef.current) inputRef.current.value = ''
      onUploaded?.()
    } catch {
      setMessage({ text: t(locale, 'photoUpload.error.generic'), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-[13px] text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-primary"
        aria-label={t(locale, 'photoUpload.chooseFile')}
      />
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={140}
        placeholder={t(locale, 'photoUpload.captionPlaceholder')}
        className="ef-input h-10"
        aria-label={t(locale, 'photoUpload.caption')}
      />
      {message && (
        <p
          className={`text-[13px] font-semibold ${message.kind === 'success' ? 'text-success' : 'text-error'}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!file || busy}
        className="ef-pill ef-pill--active self-start disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t(locale, 'photoUpload.submitting') : t(locale, 'photoUpload.submit')}
      </button>
    </form>
  )
}
