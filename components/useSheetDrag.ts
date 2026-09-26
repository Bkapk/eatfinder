'use client'

import { useRef } from 'react'

/**
 * Drag a bottom sheet down to dismiss it, from its header. Only the header:
 * the body scrolls, and a drag that fights a scroll is worse than no drag.
 *
 * The finger drives an inline transform on the sheet (the <dialog>'s first
 * child, the same element useDrawer animates). On release it either springs
 * back — dropping the inline value lets the stylesheet transition it home — or
 * is flung the rest of the way from exactly where the finger let go, and
 * useDrawer's own close waits for that transition to end. useDrawer clears
 * the inline value on the next open.
 */
export function useSheetDrag(onClose: () => void) {
  const drag = useRef<{ y: number; t: number; dy: number; sheet: HTMLElement } | null>(null)

  const end = (dismiss: boolean) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    d.sheet.style.removeProperty('transition')
    if (dismiss) {
      d.sheet.style.transform = 'translateY(100%)'
      onClose()
    } else {
      d.sheet.style.removeProperty('transform')
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !window.matchMedia('(max-width: 767px)').matches) return
      // A press on the close button is a press on the close button.
      if ((e.target as Element).closest('button, a, input, select')) return
      const sheet = e.currentTarget.closest('dialog')?.firstElementChild
      if (!(sheet instanceof HTMLElement)) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { y: e.clientY, t: performance.now(), dy: 0, sheet }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d) return
      // Upward pulls resist instead of lifting the sheet off its edge.
      const raw = e.clientY - d.y
      d.dy = raw > 0 ? raw : raw / 6
      d.sheet.style.transition = 'none'
      d.sheet.style.transform = `translateY(${d.dy}px)`
    },
    onPointerUp: () => {
      const d = drag.current
      if (!d) return
      const velocity = d.dy / Math.max(1, performance.now() - d.t) // px per ms
      end(d.dy > 120 || (d.dy > 24 && velocity > 0.5))
    },
    onPointerCancel: () => end(false),
  }
}
