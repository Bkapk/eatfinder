'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_FILES = 5 // matches the per-user hourly limit on the API
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])

interface PickedPhoto { id: string; file: File; preview: string }

export default function PhotoUpload({ restaurantId, locale, onUploaded }: {
  restaurantId: string
  locale: Locale
  onUploaded?: () => void
}) {
  const [items, setItems] = useState<PickedPhoto[]>([])
  const [caption, setCaption] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previews = useRef(new Set<string>())

  useEffect(() => () => {
    for (const url of previews.current) URL.revokeObjectURL(url)
  }, [])

  const release = (item: PickedPhoto) => {
    URL.revokeObjectURL(item.preview)
    previews.current.delete(item.preview)
  }

  const addFiles = (files: File[]) => {
    if (busy || files.length === 0) return
    if (files.some((file) => !ACCEPTED.has(file.type))) {
      setMessage({ text: t(locale, 'photoUpload.error.type'), kind: 'error' })
      return
    }
    if (files.some((file) => file.size > MAX_BYTES)) {
      setMessage({ text: t(locale, 'photoUpload.error.tooLarge'), kind: 'error' })
      return
    }
    const fresh = files.filter((file) => !items.some((item) =>
      item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified
    ))
    if (items.length + fresh.length > MAX_FILES) {
      setMessage({ text: t(locale, 'photoUpload.tooMany', { n: MAX_FILES }), kind: 'error' })
      return
    }
    const added = fresh.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return { id: crypto.randomUUID(), file, preview }
    })
    setItems((current) => [...current, ...added])
    setMessage(null)
  }

  const remove = (id: string) => {
    const item = items.find((entry) => entry.id === id)
    if (item) release(item)
    setItems((current) => current.filter((entry) => entry.id !== id))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || items.length === 0) return
    setBusy(true)
    setMessage(null)
    setDoneIds([])
    setProgress(0)
    const completed: PickedPhoto[] = []
    let approved = 0
    let pending = 0
    let failure = ''

    for (const [index, item] of items.entries()) {
      setActiveId(item.id)
      setProgress(index + 1)
      try {
        const form = new FormData()
        form.set('restaurantId', restaurantId)
        form.set('caption', caption)
        form.set('file', item.file)
        const res = await fetch('/api/community/photos', { method: 'POST', body: form })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          failure = res.status === 429
            ? t(locale, 'photoUpload.error.rateLimited', { minutes: Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 3600) / 60)) })
            : data?.error || `${t(locale, 'photoUpload.error.generic')} (HTTP ${res.status})`
          break
        }
        completed.push(item)
        setDoneIds((current) => [...current, item.id])
        if (data?.status === 'approved') approved++
        else pending++
      } catch {
        failure = t(locale, 'photoUpload.error.generic')
        break
      }
    }

    if (completed.length) {
      const completedSet = new Set(completed.map((item) => item.id))
      setItems((current) => current.filter((item) => !completedSet.has(item.id)))
      for (const item of completed) release(item)
      onUploaded?.()
    }
    setActiveId(null)
    setBusy(false)
    if (failure) {
      setMessage({
        text: completed.length ? `${completed.length} ${t(locale, 'photoUpload.sent')}. ${failure}` : failure,
        kind: 'error',
      })
    } else {
      setCaption('')
      setMessage({
        text: completed.length === 1
          ? t(locale, approved ? 'photoUpload.success.approved' : 'photoUpload.success.pending')
          : t(locale, 'photoUpload.success.batch', { approved, pending }),
        kind: 'success',
      })
    }
    setDoneIds([])
    setProgress(0)
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
        className="sr-only"
        aria-label={t(locale, 'photoUpload.chooseFile')}
      />

      <div
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)) }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${dragging ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/50'}`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><ImagePlus size={23} aria-hidden /></span>
        <p className="text-[15px] font-bold text-text">{t(locale, 'photoUpload.dropTitle')}</p>
        <p className="mt-1 text-sm text-text-secondary">{t(locale, 'photoUpload.dropHint')}</p>
        <button type="button" disabled={busy || items.length >= MAX_FILES} onClick={() => inputRef.current?.click()} className="ef-btn ef-btn--primary mt-4">
          <Camera size={17} aria-hidden />{t(locale, 'photoUpload.browse')}
        </button>
        <p className="mt-3 text-xs text-text-secondary">{t(locale, 'photoUpload.rules', { n: MAX_FILES })}</p>
      </div>

      {items.length > 0 && <>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-text">{t(locale, 'photoUpload.selected', { n: items.length })}</p>
          <span className="text-xs text-text-secondary">{items.length}/{MAX_FILES}</span>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="relative overflow-hidden rounded-xl border border-border bg-surface">
              {/* Blob URL is created from the user's selected file and revoked after use. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt={item.file.name} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text" title={item.file.name}>{item.file.name}</span>
                <span className="shrink-0 text-[11px] text-text-secondary">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              {busy && activeId === item.id ? <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-bold text-white"><Loader2 size={22} className="animate-spin" aria-hidden />{t(locale, 'photoUpload.uploading')}</span>
                : doneIds.includes(item.id) ? <span className="absolute right-2 top-2 rounded-full bg-success p-1.5 text-white"><Check size={15} aria-hidden /></span>
                : <button type="button" disabled={busy} onClick={() => remove(item.id)} aria-label={`${t(locale, 'photoUpload.remove')} ${item.file.name}`} className="absolute right-2 top-2 rounded-full bg-surface/95 p-1.5 text-text shadow-sm hover:text-error disabled:opacity-50"><Trash2 size={15} aria-hidden /></button>}
            </li>
          ))}
        </ul>
      </>}

      <div>
        <label htmlFor={`photo-caption-${restaurantId}`} className="mb-1.5 block text-sm font-semibold text-text">{t(locale, 'photoUpload.caption')}</label>
        <input id={`photo-caption-${restaurantId}`} type="text" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={140} placeholder={t(locale, 'photoUpload.captionPlaceholder')} disabled={busy} className="ef-input" />
        <p className="mt-1 text-xs text-text-secondary">{t(locale, 'photoUpload.captionHint')}</p>
      </div>

      {busy && <div role="status" className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((progress - 1) / items.length) * 100}%` }} /></div>
        <p className="text-xs font-medium text-text-secondary">{t(locale, 'photoUpload.progress', { n: progress, total: items.length })}</p>
      </div>}
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${message.kind === 'error' ? 'text-error' : 'text-success'}`}>{message.text}</p>}
      <button type="submit" disabled={items.length === 0 || busy} className="ef-btn ef-btn--primary w-full justify-center sm:w-auto">
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <UploadCloud size={17} aria-hidden />}
        {busy ? t(locale, 'photoUpload.submitting') : items.length === 0
          ? t(locale, 'photoUpload.submitEmpty')
          : items.length === 1 ? t(locale, 'photoUpload.submitOne') : t(locale, 'photoUpload.submitMany', { n: items.length })}
      </button>
    </form>
  )
}
