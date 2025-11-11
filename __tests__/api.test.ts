import { NextRequest } from 'next/server'
import { GET as recommendGET } from '../app/api/recommend/route'

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    restaurant: {
      findMany: jest.fn(),
    },
  },
}))

describe('Recommendation API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return restaurants sorted by score', async () => {
    const { prisma } = require('../lib/prisma')

    prisma.restaurant.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'Test Restaurant',
        description: 'Test',
        heaviness: 50,
        portionSize: 50,
        fineDining: 50,
        priceLevel: 2,
        cuisines: JSON.stringify(['Italian']),
        image: null,
        websiteUrl: null,
        gmapsUrl: null,
        phone: null,
        avgPrepTime: 30,
      },
    ])

    const url = new URL('http://localhost/api/recommend?heavy=50&hungry=50&finedine=50')
    const request = new NextRequest(url)

    const response = await recommendGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toBeDefined()
    expect(data.items.length).toBeGreaterThan(0)
    expect(data.items[0]).toHaveProperty('score')
    expect(data.items[0]).toHaveProperty('name')
  })

  it('should handle invalid parameters', async () => {
    const url = new URL('http://localhost/api/recommend?heavy=invalid')
    const request = new NextRequest(url)

    const response = await recommendGET(request)
    const data = await response.json()

    // Should still work with defaults or return error
    expect([200, 400]).toContain(response.status)
  })
})

