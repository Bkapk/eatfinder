'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import type { RestaurantPhotoDTO } from '@/lib/types'
import { t, type Locale } from '@/lib/i18n'
import { useDrawer } from '@/components/useDrawer'

/**
 * Google Places attribution arrives as an anchor tag. Rendering it raw would
 * mean dangerouslySetInnerHTML on third-party markup; the obligation is to
 * credit the author, and the text alone does that without the XSS surface.
 * Same rule as app/r/[slug]/page.tsx, which is where this started.
 */
function attributionText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export interface GalleryPhoto extends RestaurantPhotoDTO {
  submittedByName: string | null
}

function credit(photo: GalleryPhoto): string {
  const names = photo.attributions.map(attributionText).filter(Boolean)
  if (photo.submittedByName) names.push(photo.submittedByName)
  return names.join(', ')
}

/**
 * The blur-up placeholder. blurDataUrl is a ~16px WebP inlined in the HTML, so
 * there is no second request and nothing to wait for, and the CSS blur is what
 * turns 16 pixels into a soft wash of the right colours. It sits UNDER the
 * <img> rather than being swapped out on load: an <img> that has not decoded
 * yet paints nothing, so the placeholder shows through with no JS state, no
 * onLoad handler and no hydration cost.
 */
function Blur({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <span
      aria-hidden
      // scale-110 hides the soft edge blur() leaves at the element bounds.
      className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
      style={{ backgroundImage: `url("${url}")` }}
    />
  )
}

/** How many tiles the grid shows before the rest collapse behind "show all". */
const PREVIEW_COUNT = 6

export default function PhotoGallery({
  photos,
  alt,
  locale,
}: {
  photos: GalleryPhoto[]
  alt: string
  locale: Locale
}) {
  // null = closed. The index is the whole of the lightbox state.
  const [index, setIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  const close = useCallback(() => setIndex(null), [])
  const dialog = useDrawer(index !== null, close)

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length))
    },
    [photos.length]
  )

  // Arrow keys on the dialog itself would need focus to stay inside it while
  // the buttons re-render; the listener lives on the document for the lifetime
  // of the open lightbox instead, which is also what a user expects from one.
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, step])

  const shown = expanded ? photos : photos.slice(0, PREVIEW_COUNT)
  const hidden = photos.length - shown.length
  const current = index === null ? null : photos[index]

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t(locale, 'gallery.open', { n: i + 1, total: photos.length })}
              className="ef-photo-tile group relative block aspect-square w-full overflow-hidden rounded-xl"
            >
              <Blur url={photo.blurDataUrl} />
              {/* Opaque URL straight from the database — never parsed or rebuilt. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || alt}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                // The first row is what a visitor sees on arrival; below that,
                // lazy. eager on all of them would race the hero for bandwidth.
                loading={i < 3 ? 'eager' : 'lazy'}
                decoding="async"
                className="relative h-full w-full object-cover transition-transform duration-[var(--dur)] group-hover:scale-[1.03]"
              />
              {/* The last visible tile doubles as the "+N" affordance while the
                  grid is collapsed, so the count needs no chrome of its own. */}
              {!expanded && hidden > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 grid place-items-center bg-[rgb(11_18_32_/_0.55)] text-[17px] font-bold text-white">
                  +{hidden}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {!expanded && hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="ef-pill mt-3">
          {t(locale, 'gallery.showAll', { n: photos.length })}
        </button>
      )}

      {/* Spread, like the other two dialogs: naming the ref field explicitly is
          what react-hooks/refs flags as reading a ref during render. */}
      <dialog
        {...dialog}
        onClose={close}
        aria-label={t(locale, 'detail.gallery')}
        className="ef-lightbox"
      >
        {/* useDrawer waits for a transform transition on this first child
            before calling close(), so the exit is allowed to animate. */}
        <figure className="ef-lightbox-frame">
          {current && (
            <>
              <div className="relative flex min-h-0 flex-1 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={current.id}
                  src={current.url}
                  alt={current.caption || alt}
                  className="ef-enter max-h-full max-w-full rounded-xl object-contain"
                />
              </div>

              <figcaption className="flex shrink-0 items-center justify-between gap-4 px-1 pt-3 text-[13px] text-white">
                <span className="min-w-0">
                  {current.caption && <span className="font-semibold">{current.caption}</span>}
                  {credit(current) && (
                    <span className="block truncate opacity-70">{credit(current)}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums opacity-70">
                  {t(locale, 'gallery.counter', { n: (index ?? 0) + 1, total: photos.length })}
                </span>
              </figcaption>
            </>
          )}

          <button
            type="button"
            onClick={close}
            aria-label={t(locale, 'gallery.close')}
            className="ef-lightbox-btn absolute right-0 top-0"
          >
            <X size={18} aria-hidden />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t(locale, 'gallery.prev')}
                className="ef-lightbox-btn absolute left-0 top-1/2 -translate-y-1/2"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t(locale, 'gallery.next')}
                className="ef-lightbox-btn absolute right-0 top-1/2 -translate-y-1/2"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </>
          )}
        </figure>
      </dialog>
    </>
  )
}
