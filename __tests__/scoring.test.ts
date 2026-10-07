import { passesFilters, calculateScore, search, SearchFilters } from '../lib/scoring'
import { RestaurantDTO, directionsUrl, nextChange } from '../lib/types'

function makeRestaurant(overrides: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: '1',
    slug: 'test-restaurant',
    name: 'Test Restaurant',
    description: '',
    heaviness: 50,
    portionSize: 50,
    fineDining: 50,
    priceLevel: 2,
    avgPrepTime: 30,
    cuisines: ['Italian'],
    tags: [],
    neighborhood: '',
    address: '',
    lat: null,
    lng: null,
    woltUrl: null,
    websiteUrl: null,
    instagramUrl: null,
    gmapsUrl: null,
    phone: null,
    image: null,
    openHours: null,
    rating: null,
    googleRating: null,
    googleRatingCount: null,
    isFeatured: false,
    ...overrides,
  }
}

function makeFilters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return { heavy: 50, hungry: 50, fine: 50, ...overrides }
}

describe('passesFilters', () => {
  it('rejects a restaurant over the max price', () => {
    const r = makeRestaurant({ priceLevel: 4 })
    expect(passesFilters(r, makeFilters({ maxPrice: 2 }))).toBe(false)
  })

  it('rejects a restaurant without a matching cuisine', () => {
    const r = makeRestaurant({ cuisines: ['Mexican'] })
    expect(passesFilters(r, makeFilters({ cuisines: ['Italian'] }))).toBe(false)
  })

  it('accepts a restaurant with unknown hours even when openNow is set', () => {
    const r = makeRestaurant({ openHours: null })
    expect(passesFilters(r, makeFilters({ openNow: true }))).toBe(true)
  })

  it('rejects a confirmed-closed restaurant when openNow is set', () => {
    const r = makeRestaurant({ openHours: { mon: ['09:00', '10:00'] } })
    const monday9am = new Date('2026-08-31T11:00:00') // a Monday, after closing
    expect(passesFilters(r, makeFilters({ openNow: true }), monday9am)).toBe(false)
  })
})

describe('calculateScore', () => {
  it('gives the maximum mood score for an exact match', () => {
    const r = makeRestaurant({ heaviness: 50, portionSize: 50, fineDining: 50 })
    const score = calculateScore(r, makeFilters())
    expect(score).toBe(300)
  })

  it('penalizes mismatches proportionally', () => {
    const r = makeRestaurant({ heaviness: 0, portionSize: 50, fineDining: 50 })
    const score = calculateScore(r, makeFilters({ heavy: 50 }))
    expect(score).toBe(250) // 50 + 100 + 100
  })

  it('adds an editorial rating bonus', () => {
    const r = makeRestaurant({ rating: 5 })
    const score = calculateScore(r, makeFilters())
    expect(score).toBe(325) // 300 + (5/5)*25
  })

  it('adds a featured bonus', () => {
    const r = makeRestaurant({ isFeatured: true })
    const score = calculateScore(r, makeFilters())
    expect(score).toBe(310)
  })

  it('adds a wolt-orderable bonus', () => {
    const r = makeRestaurant({ woltUrl: 'https://wolt.com/x' })
    const score = calculateScore(r, makeFilters())
    expect(score).toBe(305)
  })
})

describe('search', () => {
  it('sorts restaurants by score descending', () => {
    const restaurants = [
      makeRestaurant({ id: '1', heaviness: 50 }),
      makeRestaurant({ id: '2', heaviness: 0 }),
      makeRestaurant({ id: '3', heaviness: 100 }),
    ]

    const results = search(restaurants, makeFilters({ heavy: 50 }))
    expect(results[0].id).toBe('1')
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('respects the limit', () => {
    const restaurants = Array.from({ length: 20 }, (_, i) =>
      makeRestaurant({ id: String(i), heaviness: i * 5 })
    )

    const results = search(restaurants, makeFilters(), 12)
    expect(results.length).toBe(12)
  })

  it('excludes restaurants that fail hard filters', () => {
    const restaurants = [
      makeRestaurant({ id: '1', priceLevel: 1 }),
      makeRestaurant({ id: '2', priceLevel: 4 }),
    ]

    const results = search(restaurants, makeFilters({ maxPrice: 2 }))
    expect(results.map((r) => r.id)).toEqual(['1'])
  })

  it('puts our picks first among ties in an explicit sort, and only among ties', () => {
    const restaurants = [
      makeRestaurant({ id: 'plain', priceLevel: 2 }),
      makeRestaurant({ id: 'pick', priceLevel: 2, isFeatured: true }),
      makeRestaurant({ id: 'cheap', priceLevel: 1 }),
    ]

    const results = search(restaurants, makeFilters({ sort: 'price-asc' }))
    expect(results.map((r) => r.id)).toEqual(['cheap', 'pick', 'plain'])
  })
})

describe('nextChange', () => {
  // 2026-09-28 is a Monday.
  const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m)

  it('gives the closing time while open', () => {
    expect(nextChange({ mon: ['10:00', '22:00'] }, at(12))).toBe('22:00')
  })

  it('gives a later opening time while closed', () => {
    expect(nextChange({ mon: ['18:00', '23:00'] }, at(12))).toBe('18:00')
  })

  it('says nothing once closed for the day', () => {
    expect(nextChange({ mon: ['10:00', '15:00'] }, at(16))).toBeNull()
  })

  it("closes yesterday's past-midnight slot first", () => {
    expect(nextChange({ sun: ['18:00', '02:00'], mon: ['12:00', '23:00'] }, at(1))).toBe('02:00')
  })

  it('is null for unknown hours', () => {
    expect(nextChange(null, at(12))).toBeNull()
  })
})

describe('directionsUrl', () => {
  const place = { name: 'Napoli', address: 'Rr. Agim Ramadani 15', lat: 42.66, lng: 21.16, gmapsUrl: null }

  it('routes to the coordinates, naming the Google place when there is one', () => {
    const url = new URL(directionsUrl(place, 'places/ChIJabc')!)
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('destination')).toBe('42.66,21.16')
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJabc')
  })

  it('falls back to name and address, then the stored Maps link, then nothing', () => {
    const noCoords = { ...place, lat: null, lng: null }
    expect(new URL(directionsUrl(noCoords)!).searchParams.get('destination')).toBe(
      'Napoli, Rr. Agim Ramadani 15'
    )
    expect(directionsUrl({ ...noCoords, address: '', gmapsUrl: 'https://maps.app.goo.gl/x' })).toBe(
      'https://maps.app.goo.gl/x'
    )
    expect(directionsUrl({ ...noCoords, address: '' })).toBeNull()
  })
})
