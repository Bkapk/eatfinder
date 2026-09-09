/**
 * @jest-environment node
 */
// next/server needs the Node fetch globals (Request/Response); jsdom doesn't have them.
import { NextRequest } from 'next/server'

jest.mock('../lib/prisma', () => ({
  prisma: { restaurant: { findMany: jest.fn(), count: jest.fn() } },
}))
jest.mock('../lib/auth', () => ({ requireAdmin: jest.fn() }))

import { prisma } from '../lib/prisma'
import { GET } from '../app/api/restaurants/route'

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/restaurants?${qs}`))

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.restaurant.findMany as jest.Mock).mockResolvedValue([])
  // count() is called as [page total, matching, live] in that order
  ;(prisma.restaurant.count as jest.Mock)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(7)
})

it('pages the query and clamps pageSize', async () => {
  await get('page=3&pageSize=999')
  expect(prisma.restaurant.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ skip: 200, take: 100 })
  )
})

it('falls back to page 1 for junk page values', async () => {
  await get('page=-4')
  expect(prisma.restaurant.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }))
})

it('applies the status filter to the page but not to the stat counts', async () => {
  const body = await (await get('status=draft&search=pizza')).json()

  const [pageQuery] = (prisma.restaurant.findMany as jest.Mock).mock.calls[0]
  expect(pageQuery.where.isActive).toBe(false)

  // The tiles must keep telling the truth about the whole search, so the
  // "matching" and "live" counts are taken without the status narrowing.
  const countArgs = (prisma.restaurant.count as jest.Mock).mock.calls.map((c) => c[0].where)
  expect(countArgs[1].isActive).toBeUndefined()
  expect(countArgs[2].isActive).toBe(true)

  expect(body.counts).toEqual({ matching: 10, live: 7, draft: 3 })
  expect(body.total).toBe(3)
})

it('rejects an unknown sort column instead of interpolating it', async () => {
  await get('sortBy=passwordHash')
  const [query] = (prisma.restaurant.findMany as jest.Mock).mock.calls[0]
  expect(query.orderBy).toEqual({ updatedAt: 'desc' })
})
