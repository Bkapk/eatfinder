import { PlacesApiError, searchText } from '@/lib/places'

describe('Places API errors surface Google\'s message', () => {
  const realFetch = global.fetch
  beforeAll(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it('throws PlacesApiError carrying the status and Google message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          error: { message: 'Requests from referer <empty> are blocked.' },
        }),
    }) as any

    await expect(searchText({ query: 'pizza' })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('Requests from referer'),
    })
    await expect(searchText({ query: 'pizza' })).rejects.toBeInstanceOf(PlacesApiError)
  })

  it('falls back to the raw body when it is not Google JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream exploded',
    }) as any

    await expect(searchText({ query: 'pizza' })).rejects.toThrow('upstream exploded')
  })
})
