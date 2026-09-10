/**
 * Sliding bubble tab indicator. Self-contained, no dependencies, attaches to
 * markup that already exists. Two absolutely-positioned pills sit under the
 * buttons: one follows the active tab, a dimmer one follows the pointer/focus.
 *
 * Theme it with custom properties on the strip:
 *   --bubble-active-bg, --bubble-hover-bg, --bubble-radius, --bubble-speed
 */

// ---- markup contract -------------------------------------------------------
const CONFIG = {
  strip: '[data-bubble-tabs]', // the tab strip
  tab: '[data-bubble-tab]', // tab buttons, children of the strip
  activeAttr: 'aria-selected', // attribute that marks the active tab
  activeValue: 'true',
  activeClass: 'is-active', // fallback when the attribute is absent
}

// The pill is sized once to this box and scaled from it, so no frame ever
// touches width/height.
const BASE = 100

const CSS = `
[data-bubble-tabs]{position:relative;isolation:isolate}
[data-bubble-tabs] [data-bubble-tab]{position:relative;z-index:1;background:transparent}
.bubble-pill{
  position:absolute;top:0;left:0;width:${BASE}px;height:${BASE}px;
  transform-origin:0 0;pointer-events:none;will-change:transform;
  transition:transform var(--bubble-speed,200ms) ease,border-radius var(--bubble-speed,200ms) ease,opacity var(--bubble-speed,200ms) ease;
}
.bubble-pill--hover{z-index:0;opacity:0;background:var(--bubble-hover-bg,rgba(127,127,127,.18))}
.bubble-pill--active{z-index:0;background:var(--bubble-active-bg,rgba(127,127,127,.35))}
.bubble-pill.bubble-pill--no-transition{transition:none}
@media (prefers-reduced-motion:reduce){.bubble-pill{transition:none}}
`

let styled = false
function injectStyle() {
  if (styled || typeof document === 'undefined') return
  styled = true
  const el = document.createElement('style')
  el.dataset.bubbleTabs = ''
  el.textContent = CSS
  document.head.appendChild(el)
}

function isActive(tab: Element) {
  return (
    tab.getAttribute(CONFIG.activeAttr) === CONFIG.activeValue ||
    tab.classList.contains(CONFIG.activeClass)
  )
}

function place(pill: HTMLElement, strip: HTMLElement, tab: HTMLElement) {
  const s = strip.getBoundingClientRect()
  const t = tab.getBoundingClientRect()
  if (!t.width || !t.height) return
  // clientLeft/Top: rects are border-box, absolute children sit on the padding box.
  const x = t.left - s.left - strip.clientLeft
  const y = t.top - s.top - strip.clientTop
  const sx = t.width / BASE
  const sy = t.height / BASE
  pill.style.transform = `translate3d(${x}px,${y}px,0) scale(${sx},${sy})`
  // Elliptical radius pre-divided by the scale, so it renders back as a circle.
  // Cheaper than animating width/height: paint only, never layout.
  const want =
    parseFloat(getComputedStyle(strip).getPropertyValue('--bubble-radius')) || 999
  const r = Math.min(want, t.width / 2, t.height / 2)
  pill.style.borderRadius = `${r / sx}px / ${r / sy}px`
}

function snap(pill: HTMLElement, strip: HTMLElement, tab: HTMLElement) {
  pill.classList.add('bubble-pill--no-transition')
  place(pill, strip, tab)
  void pill.offsetWidth // force reflow so the removal below doesn't animate
  pill.classList.remove('bubble-pill--no-transition')
}

/**
 * Idempotent. Re-run after adding tabs dynamically — nothing observes the
 * document for you.
 */
export function initSlidingBubble(root: ParentNode = document): () => void {
  injectStyle()
  const strips = [
    ...(root instanceof Element && root.matches(CONFIG.strip) ? [root] : []),
    ...root.querySelectorAll<HTMLElement>(CONFIG.strip),
  ] as HTMLElement[]

  const teardowns = strips.map((strip) => {
    if (strip.dataset.bubbleReady) return () => {}
    strip.dataset.bubbleReady = '1'

    const active = document.createElement('div')
    active.className = 'bubble-pill bubble-pill--active'
    const hover = document.createElement('div')
    hover.className = 'bubble-pill bubble-pill--hover'
    strip.prepend(active, hover)

    const tabs = () => [...strip.querySelectorAll<HTMLElement>(CONFIG.tab)]
    let raf = 0
    const placeActive = (immediate = false) => {
      const tab = tabs().find(isActive)
      if (!tab) {
        active.style.opacity = '0'
        return
      }
      active.style.opacity = ''
      ;(immediate ? snap : place)(active, strip, tab)
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => placeActive())
    }

    // Listeners are delegated, so tabs added later need no extra wiring.
    const onPointer = (e: Event) => {
      const tab = (e.target as Element)?.closest<HTMLElement>(CONFIG.tab)
      if (!tab || !strip.contains(tab)) return
      if (hover.style.opacity !== '1') snap(hover, strip, tab)
      else place(hover, strip, tab)
      hover.style.opacity = '1'
    }
    const hide = () => {
      hover.style.opacity = '0'
    }
    // Click flips the state attribute; read it on the next frame.
    strip.addEventListener('click', schedule)
    strip.addEventListener('mouseover', onPointer)
    strip.addEventListener('focusin', onPointer)
    strip.addEventListener('mouseleave', hide)
    strip.addEventListener('focusout', hide)

    const mo = new MutationObserver(schedule)
    mo.observe(strip, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [CONFIG.activeAttr, 'class'],
    })
    const ro = new ResizeObserver(schedule) // font loading, container reflow
    ro.observe(strip)
    window.addEventListener('resize', schedule)

    placeActive(true)

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      strip.removeEventListener('click', schedule)
      strip.removeEventListener('mouseover', onPointer)
      strip.removeEventListener('focusin', onPointer)
      strip.removeEventListener('mouseleave', hide)
      strip.removeEventListener('focusout', hide)
      active.remove()
      hover.remove()
      delete strip.dataset.bubbleReady
    }
  })

  return () => teardowns.forEach((fn) => fn())
}

export default initSlidingBubble
