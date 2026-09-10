'use client'

import { useEffect, useRef } from 'react'

/**
 * A native <dialog> driven as an animated sheet. Both drawers in the app — the
 * public filter panel and the admin nav — go through here, because all three
 * of the bugs it fixes were duplicated at both call sites.
 *
 * 1. The exit has to run before close(). close() removes the dialog from the
 *    top layer in the same tick, so anything keyed off [open] gets zero frames
 *    to animate out. `data-state` is set first and close() waits for
 *    animationend.
 * 2. Escape must go the same way. The native `cancel` event closes the dialog
 *    itself, so Escape used to snap shut while the X button animated —
 *    preventDefault sends it back through the app's own open state instead.
 * 3. A click is delivered to the nearest common ancestor of pointerdown and
 *    pointerup. Drag a slider inside the panel, release past its edge, and
 *    that "click" lands on the dialog — indistinguishable from a backdrop
 *    click, so the drawer dismissed itself mid-drag. The press has to have
 *    STARTED on the backdrop to count.
 */
export function useDrawer(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)

  // Kept in a ref so the effect below depends on `open` alone: parents re-create
  // this callback on every render, and re-running the effect would restart the
  // animation mid-slide.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (open) {
      el.dataset.state = 'open'
      if (!el.open) el.showModal()
      return
    }

    if (!el.open) return
    el.dataset.state = 'closed'

    // The sheet, not a descendant: the panel is full of controls with their own
    // transitions and any of them finishing would close the drawer early.
    const sheet = el.firstElementChild
    const done = (e: AnimationEvent) => {
      if (e.target === sheet) el.close()
    }
    el.addEventListener('animationend', done)
    return () => el.removeEventListener('animationend', done)
  }, [open])

  const downOnBackdrop = useRef(false)

  return {
    ref,
    onCancel: (e: React.SyntheticEvent) => {
      e.preventDefault()
      closeRef.current()
    },
    onPointerDown: (e: React.PointerEvent) => {
      downOnBackdrop.current = e.target === ref.current
    },
    onClick: (e: React.MouseEvent) => {
      if (downOnBackdrop.current && e.target === ref.current) closeRef.current()
    },
  }
}
