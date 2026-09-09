/**
 * @jest-environment node
 */
// next/server needs the Node fetch globals (Request/Response); jsdom doesn't have them.
import { NextRequest } from 'next/server'

jest.mock('../lib/prisma', () => ({
  prisma: {
    restaurant: { findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    restaurantPhoto: { findMany: jest.fn() },
  },
}))
jest.mock('../lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('../lib/storage', () => ({ deleteUpload: jest.fn().mockResolvedValue(undefined) }))

import { prisma } from '../lib/prisma'
import { deleteUpload } from '../lib/storage'
import { POST as bulkPOST } from '../app/api/admin/restaurants/bulk/route'
import { deleteRestaurantsWithFiles } from '../lib/restaurants'

const post = (body: unknown) =>
  bulkPOST(
    new NextRequest('http://localhost/api/admin/restaurants/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => jest.clearAllMocks())

describe('bulk publish / unpublish', () => {
  it('publish sets isActive true for exactly the ids given', async () => {
    ;(prisma.restaurant.updateMany as jest.Mock).mockResolvedValue({ count: 2 })

    const res = await post({ ids: ['a', 'b'], action: 'publish' })

    expect(await res.json()).toEqual({ action: 'publish', count: 2 })
    expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { isActive: true },
    })
  })

  it('unpublish sets isActive false — not true via boolean coercion', async () => {
    ;(prisma.restaurant.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    await post({ ids: ['a'], action: 'unpublish' })

    expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } },
      data: { isActive: false },
    })
  })

  it('deduplicates ids so the reported count is honest', async () => {
    ;(prisma.restaurant.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    await post({ ids: ['a', 'a', 'a'], action: 'publish' })

    expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } },
      data: { isActive: true },
    })
  })

  it('rejects an unknown action and an empty selection', async () => {
    expect((await post({ ids: ['a'], action: 'nuke' })).status).toBe(400)
    expect((await post({ ids: [], action: 'publish' })).status).toBe(400)
  })
})

describe('deleteRestaurantsWithFiles', () => {
  it('deletes gallery files too, deduped against the hero image', async () => {
    ;(prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
      { id: 'r1', image: '/uploads/hero.jpg' },
    ])
    ;(prisma.restaurantPhoto.findMany as jest.Mock).mockResolvedValue([
      { url: '/uploads/hero.jpg' }, // same file as the hero — must not unlink twice
      { url: '/uploads/two.jpg' },
    ])
    ;(prisma.restaurant.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    expect(await deleteRestaurantsWithFiles(['r1'])).toBe(1)

    const unlinked = (deleteUpload as jest.Mock).mock.calls.map((c) => c[0]).sort()
    expect(unlinked).toEqual(['/uploads/hero.jpg', '/uploads/two.jpg'])
  })

  it('touches nothing when the id matches no restaurant', async () => {
    ;(prisma.restaurant.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.restaurantPhoto.findMany as jest.Mock).mockResolvedValue([])

    expect(await deleteRestaurantsWithFiles(['missing'])).toBe(0)
    expect(prisma.restaurant.deleteMany).not.toHaveBeenCalled()
    expect(deleteUpload).not.toHaveBeenCalled()
  })

  it('short-circuits on an empty id list', async () => {
    expect(await deleteRestaurantsWithFiles([])).toBe(0)
    expect(prisma.restaurant.findMany).not.toHaveBeenCalled()
  })
})
