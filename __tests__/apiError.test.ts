/**
 * @jest-environment node
 */
// next/server needs the Node fetch globals (Request/Response); jsdom doesn't have them.
import { adminServerError } from '@/lib/apiError'

describe('adminServerError', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => spy.mockClear())

  it('puts the error name and message in the response body', async () => {
    const res = adminServerError('places/search', new TypeError('fetch failed'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Internal server error — TypeError: fetch failed')
  })

  it('includes a Prisma error code when there is one', async () => {
    const err = Object.assign(new Error('Column `placeId` does not exist'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2022',
    })
    const res = adminServerError('places/search', err)
    expect((await res.json()).error).toContain('PrismaClientKnownRequestError (P2022)')
  })

  it('logs the whole error with its tag', () => {
    const err = new Error('boom')
    adminServerError('places/import', err)
    expect(spy).toHaveBeenCalledWith('[places/import]', err)
  })

  it('survives a non-Error throw', async () => {
    const res = adminServerError('places/refresh', 'just a string')
    expect((await res.json()).error).toBe('Internal server error — Error: just a string')
  })
})
