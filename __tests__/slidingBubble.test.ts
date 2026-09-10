/**
 * The pill never gets width/height — it is a fixed 100x100 box moved by
 * transform — so the only thing worth testing is the arithmetic that turns a
 * button's rect into that transform, including the wrapped-row y offset and
 * the border-radius pre-division that keeps corners round under a non-uniform
 * scale.
 */
import { initSlidingBubble } from '@/components/search/sliding-bubble'

beforeAll(() => {
  // jsdom has neither layout nor ResizeObserver.
  ;(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

function rect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
}

test('places the active pill at the button, wrapped row included', () => {
  document.body.innerHTML = `
    <div data-bubble-tabs style="--bubble-radius:999px">
      <button data-bubble-tab>a</button>
      <button data-bubble-tab class="is-active">b</button>
    </div>`
  const strip = document.querySelector<HTMLElement>('[data-bubble-tabs]')!
  const [a, b] = [...document.querySelectorAll<HTMLElement>('[data-bubble-tab]')]
  rect(strip, 10, 20, 200, 80)
  rect(a, 14, 24, 90, 36)
  rect(b, 14, 64, 90, 36) // second line: y offset must be honoured

  const teardown = initSlidingBubble(strip)
  const pill = strip.querySelector<HTMLElement>('.bubble-pill--active')!

  // 14-10=4, 64-20=44; scale 90/100 by 36/100
  expect(pill.style.transform).toBe('translate3d(4px,44px,0) scale(0.9,0.36)')
  // radius clamps to half the short side (18) then divides by each scale, so it
  // renders back as 18px both ways
  expect(pill.style.borderRadius).toBe('20px / 50px')

  teardown()
  expect(strip.querySelector('.bubble-pill')).toBeNull()
})
