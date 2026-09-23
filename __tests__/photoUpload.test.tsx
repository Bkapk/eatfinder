import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PhotoUpload from '@/components/community/PhotoUpload'

beforeEach(() => {
  let next = 0
  URL.createObjectURL = jest.fn(() => `blob:photo-${++next}`)
  URL.revokeObjectURL = jest.fn()
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => `photo-${++next}`) })
})

test('previews multiple photos, removes one, then uploads the remaining file', async () => {
  const onUploaded = jest.fn()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ status: 'pending' }) })
  render(<PhotoUpload restaurantId="restaurant-1" locale="en" onUploaded={onUploaded} />)

  const picker = screen.getByLabelText('Choose a photo') as HTMLInputElement
  const first = new File(['first'], 'dinner.jpg', { type: 'image/jpeg' })
  const second = new File(['second'], 'room.png', { type: 'image/png' })
  fireEvent.change(picker, { target: { files: [first, second] } })
  expect(screen.getByAltText('dinner.jpg')).toBeTruthy()
  expect(screen.getByAltText('room.png')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Share 2 photos' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Remove dinner.jpg' }))
  expect(screen.queryByAltText('dinner.jpg')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Share 1 photo' }))

  await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Thanks! Your photo is being reviewed.')).toBeTruthy()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})

test('rejects an unsupported file before upload', () => {
  global.fetch = jest.fn()
  render(<PhotoUpload restaurantId="restaurant-1" locale="en" />)
  fireEvent.change(screen.getByLabelText('Choose a photo'), {
    target: { files: [new File(['bad'], 'document.pdf', { type: 'application/pdf' })] },
  })
  expect(screen.getByRole('alert').textContent).toContain('Choose JPEG')
  expect(global.fetch).not.toHaveBeenCalled()
})
