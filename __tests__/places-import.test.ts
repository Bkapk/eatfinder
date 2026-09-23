/** @jest-environment node */
// Import regression: a draft left without photos can recover without a second restaurant.
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/places/import/route'
import { prisma } from '@/lib/prisma'
import { placeDetails, toRestaurantDraft, downloadPhotoMedia } from '@/lib/places'
import { saveImage } from '@/lib/storage'

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn().mockResolvedValue({ id: 'admin' }) }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  restaurant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  restaurantPhoto: { create: jest.fn() },
} }))
jest.mock('@/lib/places', () => ({
  assertPlacesEnabled: jest.fn(),
  placeDetails: jest.fn(),
  toRestaurantDraft: jest.fn(),
  downloadPhotoMedia: jest.fn(),
  PlacesDisabledError: class PlacesDisabledError extends Error {},
}))
jest.mock('@/lib/storage', () => ({ saveImage: jest.fn() }))
jest.mock('@/lib/systemEvents', () => ({ recordSystemEvent: jest.fn().mockResolvedValue(undefined) }))

const db = prisma as jest.Mocked<typeof prisma>
const details = placeDetails as jest.Mock
const draft = toRestaurantDraft as jest.Mock
const download = downloadPhotoMedia as jest.Mock
const save = saveImage as jest.Mock

function request(placeIds: string[]) {
  return new NextRequest('http://localhost/api/admin/places/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ placeIds }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(db.restaurant.findUnique as jest.Mock).mockResolvedValue({ id: 'draft-1', name: 'Gjiks and Chicks', image: null, _count: { photos: 0 } })
  details.mockResolvedValue({})
  draft.mockReturnValue({ photos: [{ name: 'places/example/photos/one' }, { name: 'places/example/photos/two' }] })
  download.mockResolvedValue(Buffer.from('image'))
  save.mockResolvedValue({ url: '/uploads/photo.jpg', ext: 'jpg', width: 400, height: 300, blurDataUrl: null })
  ;(db.restaurantPhoto.create as jest.Mock).mockResolvedValue({})
  ;(db.restaurant.update as jest.Mock).mockResolvedValue({})
})

test('repairs an existing photo-less draft and reports the restored photos', async () => {
  const res = await POST(request(['places/example']))
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.results[0]).toMatchObject({ status: 'ok', restaurantId: 'draft-1', photoCount: 2, photoFailures: 0 })
  expect(db.restaurant.create).not.toHaveBeenCalled()
  expect(db.restaurantPhoto.create).toHaveBeenCalledTimes(2)
  expect(db.restaurant.update).toHaveBeenCalledWith({ where: { id: 'draft-1' }, data: { image: '/uploads/photo.jpg' } })
})

test('keeps a successful photo when another Google photo fails', async () => {
  download.mockRejectedValueOnce(new Error('Google photo 403')).mockResolvedValueOnce(Buffer.from('image'))
  const res = await POST(request(['places/example']))
  const body = await res.json()

  expect(body.results[0]).toMatchObject({ status: 'ok', photoCount: 1, photoFailures: 1 })
  expect(db.restaurantPhoto.create).toHaveBeenCalledTimes(1)
})

test('rejects a multi-place request so each place has its own timeout and result', async () => {
  const res = await POST(request(['places/one', 'places/two']))
  expect(res.status).toBe(400)
  expect(db.restaurant.findUnique).not.toHaveBeenCalled()
})
