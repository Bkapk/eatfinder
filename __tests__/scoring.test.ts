import { passesFilters, calculateScore, search, SearchFilters } from '../lib/scoring'
import { RestaurantDTO } from '../lib/types'

function makeRestaurant(overrides: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: '1',
    slug: 'test-restaurant',
    name: 'Test Restaurant',
    description: '',
    heaviness: 50,
    portionSize: 50,
    fineDining: 50,
    spiceLevel: 0,
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
})
