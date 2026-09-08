import { parseFilters, toSearchParams, ParsedFilters } from '../lib/filters'

describe('filters round-trip', () => {
  it('parseFilters(toSearchParams(f)) equals f for a filled-in filter object', () => {
    const filters: ParsedFilters = {
      heavy: 70,
      hungry: 30,
      fine: 90,
      cuisines: ['Italian', 'Pizza'],
      tags: ['late-night', 'wifi'],
      neighborhoods: ['Qendra'],
      query: 'burek',
      minPrice: 1,
      maxPrice: 3,
      maxPrepTime: 20,
      spiceMax: 60,
      openNow: true,
      woltOnly: true,
      near: { lat: 42.6629, lng: 21.1655 },
      maxDistanceKm: 5,
      bbox: [21.1, 42.6, 21.2, 42.7],
      sort: 'rating',
      view: 'map',
      page: 2,
    }

    const roundTripped = parseFilters(toSearchParams(filters))
    expect(roundTripped).toEqual(filters)
  })

  it('parses to defaults when the URL carries nothing', () => {
    const parsed = parseFilters(new URLSearchParams())
    expect(parsed).toEqual({
      heavy: 50,
      hungry: 50,
      fine: 50,
      cuisines: undefined,
      tags: undefined,
      neighborhoods: undefined,
      query: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      maxPrepTime: undefined,
      spiceMax: undefined,
      openNow: undefined,
      woltOnly: undefined,
      maxDistanceKm: undefined,
      bbox: undefined,
      sort: undefined,
      view: 'grid',
      page: 1,
      near: undefined,
    })
  })
})
