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
      if (el.open) {
        el.dataset.state = 'open'
        return
      }

      // Why the opening jank was one-sided: closing animates an element the
      // browser has already laid out and painted, but opening takes the dialog
      // out of display:none, and THAT frame is also the first layout, first
      // style resolution and first paint of the entire panel — plus the top
      // layer promotion. An animation started on that frame spends its opening
      // frames waiting for all of it, which is the jump.
      //
      // So: park the sheet off-screen with no animation, open, and let the
      // browser get that expensive frame out of the way. Two rAFs, because one
      // only buys the layout — the second is the one that runs after it has
      // actually painted. Then the slide starts on an element it has already
      // dealt with, and it is a composited translate from there.
      el.dataset.state = 'opening'
      el.showModal()

      let paint = 0
      const layout = requestAnimationFrame(() => {
        paint = requestAnimationFrame(() => {
          el.dataset.state = 'open'
        })
      })
      return () => {
        cancelAnimationFrame(layout)
        cancelAnimationFrame(paint)
      }
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
