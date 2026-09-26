'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Share } from 'lucide-react'
import { t, type Locale } from '@/lib/i18n'
import { searchMemory } from '@/components/search/memory'

/**
 * Back to the list you came from, at the place you left it. When this session
 * has a search behind it, that is history's previous entry, and the search
 * shell restores its results and scroll offset from memory. Opened cold from a
 * shared link there is nothing behind it, so it goes to the front door.
 */
export function BackButton({ locale, className = '' }: { locale: Locale; className?: string }) {
  const router = useRouter()
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (!searchMemory.params) return
        e.preventDefault()
        router.back()
      }}
      aria-label={t(locale, 'detail.backShort')}
      className={className}
    >
      <ArrowLeft size={20} aria-hidden />
    </Link>
  )
}

/**
 * The phone's own share sheet where there is one (every mobile browser);
 * elsewhere, copy the link and say so.
 */
export function ShareButton({
  locale,
  title,
  className = '',
}: {
  locale: Locale
  title: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    // The listing itself, without ?lang=: the recipient gets their own language.
    const url = `${window.location.origin}${window.location.pathname}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // Dismissing the share sheet rejects; that is not an error.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: nothing honest to report beyond the button staying put.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label={t(locale, 'detail.share')}
        className={className}
      >
        {copied ? <Check size={19} aria-hidden className="text-success" /> : <Share size={19} aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {copied ? t(locale, 'detail.linkCopied') : ''}
      </span>
    </>
  )
}
