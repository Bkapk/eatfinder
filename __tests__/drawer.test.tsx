import { render, fireEvent } from '@testing-library/react'
import { useDrawer } from '@/components/useDrawer'

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawer = useDrawer(open, onClose)
  return (
    <dialog {...drawer} className="ef-drawer">
      <aside data-testid="sheet">panel</aside>
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

test('closing waits for the sheet animation before leaving the top layer', () => {
  const onClose = jest.fn()
  const { container, rerender } = render(<Drawer open onClose={onClose} />)
  const dialog = dialogOf(container)
  expect(dialog.open).toBe(true)
  expect(dialog.dataset.state).toBe('open')

  rerender(<Drawer open={false} onClose={onClose} />)
  expect(dialog.dataset.state).toBe('closed')
  // Still in the top layer: the slide-out has not run yet.
  expect(dialog.open).toBe(true)

  const sheet = dialog.firstElementChild!
  sheet.dispatchEvent(new Event('animationend', { bubbles: true }))
  expect(dialog.open).toBe(false)
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
