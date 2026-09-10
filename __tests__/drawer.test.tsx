import { act, render, fireEvent } from '@testing-library/react'
import { useDrawer } from '@/components/useDrawer'

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawer = useDrawer(open, onClose)
  return (
    <dialog {...drawer} className="ef-drawer">
      <aside data-testid="sheet"><button>panel</button></aside>
    </dialog>
  )
}

// jsdom implements neither, and useDrawer's whole job is sequencing them.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

const dialogOf = (c: HTMLElement) => c.querySelector('dialog') as HTMLDialogElement

beforeEach(() => {
  jest.useFakeTimers()
  window.matchMedia = jest.fn().mockReturnValue({ matches: false })
})

afterEach(() => {
  jest.useRealTimers()
})

// jsdom has no TransitionEvent constructor, so supply its property explicitly.
function transitionEnd(element: Element, propertyName: string) {
  fireEvent(element, Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }))
}

/** The two frames useDrawer waits out before it starts the opening slide. */
function frames() {
  act(() => {
    jest.advanceTimersByTime(32)
  })
}

test('opening waits for a painted frame before it starts the slide', () => {
  const { container } = render(<Drawer open onClose={jest.fn()} />)
  const dialog = dialogOf(container)

  // Open and parked off-screen, but not yet animating: the frame that takes
  // the dialog out of display:none is the expensive one.
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.state).toBe('opening')

  frames()
  expect(dialog.dataset.state).toBe('open')
})

test('closing waits for the sheet transform before leaving the top layer', () => {
  const onClose = jest.fn()
  const { container, rerender } = render(<Drawer open onClose={onClose} />)
  const dialog = dialogOf(container)
  frames()
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.state).toBe('open')

  rerender(<Drawer open={false} onClose={onClose} />)
  expect(dialog.dataset.state).toBe('closed')
  // Still in the top layer: the slide-out has not run yet.
  expect(dialog.open).toBe(true)

  const sheet = dialog.firstElementChild!
  transitionEnd(sheet.firstElementChild!, 'transform')
  transitionEnd(sheet, 'opacity')
  expect(dialog.open).toBe(true)
  transitionEnd(sheet, 'transform')
  expect(dialog.open).toBe(false)
})

test('closing before the opening frame does not leave an invisible modal', () => {
  const { container, rerender } = render(<Drawer open onClose={jest.fn()} />)
  const dialog = dialogOf(container)
  rerender(<Drawer open={false} onClose={jest.fn()} />)
  frames()
  expect(dialog.open).toBe(false)
  expect(dialog.dataset.state).toBe('closed')
})

test('reopening cancels the pending close without restarting off-screen', () => {
  const { container, rerender } = render(<Drawer open onClose={jest.fn()} />)
  const dialog = dialogOf(container)
  frames()
  rerender(<Drawer open={false} onClose={jest.fn()} />)
  rerender(<Drawer open onClose={jest.fn()} />)
  transitionEnd(dialog.firstElementChild!, 'transform')
  act(() => jest.advanceTimersByTime(500))
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.state).toBe('open')
})

test('closing still completes if no transition event arrives', () => {
  const { container, rerender } = render(<Drawer open onClose={jest.fn()} />)
  frames()
  rerender(<Drawer open={false} onClose={jest.fn()} />)
  act(() => jest.advanceTimersByTime(500))
  expect(dialogOf(container).open).toBe(false)
})

test('reduced motion closes immediately', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  const { container, rerender } = render(<Drawer open onClose={jest.fn()} />)
  frames()
  rerender(<Drawer open={false} onClose={jest.fn()} />)
  expect(dialogOf(container).open).toBe(false)
})

test('Escape requests the animated close instead of closing natively', () => {
  const onClose = jest.fn()
  const { container } = render(<Drawer open onClose={onClose} />)
  const dialog = dialogOf(container)
  const event = new Event('cancel', { cancelable: true })
  fireEvent(dialog, event)
  expect(event.defaultPrevented).toBe(true)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(dialog.open).toBe(true)
})

test('a drag released over the backdrop does not dismiss the drawer', () => {
  const onClose = jest.fn()
  const { container, getByTestId } = render(<Drawer open onClose={onClose} />)
  const dialog = dialogOf(container)

  // Press inside the panel, release outside it: the click lands on the dialog.
  fireEvent.pointerDown(getByTestId('sheet'))
  fireEvent.click(dialog)
  expect(onClose).not.toHaveBeenCalled()

  // A press that genuinely starts on the backdrop still closes it.
  fireEvent.pointerDown(dialog)
  fireEvent.click(dialog)
  expect(onClose).toHaveBeenCalledTimes(1)
})
