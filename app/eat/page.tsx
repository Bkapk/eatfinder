'use client'

import { useState, useEffect } from 'react'
import { Search, MapPin, Phone, Globe, Utensils } from 'lucide-react'
import Link from 'next/link'

interface Restaurant {
  id: string
  score: number
  name: string
  priceLevel: number
  cuisines: string[]
  image?: string | null
  description: string
  websiteUrl?: string | null
  gmapsUrl?: string | null
  phone?: string | null
}

const COMMON_CUISINES = [
  'American',
  'Italian',
  'Japanese',
  'Mexican',
  'Thai',
  'Chinese',
  'French',
  'Indian',
  'Mediterranean',
  'BBQ',
  'Vegetarian',
  'Seafood',
]

export default function EatPage() {
  const [wantHeavy, setWantHeavy] = useState(50)
  const [wantHungry, setWantHungry] = useState(50)
  const [wantFinedine, setWantFinedine] = useState(50)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)

  // Fetch recommendations
  const fetchRecommendations = async () => {
    setLoading(true)
    setShowAll(false) // Reset to show top 3 when searching again
    try {
      const params = new URLSearchParams({
        heavy: wantHeavy.toString(),
        hungry: wantHungry.toString(),
        finedine: wantFinedine.toString(),
      })

      if (selectedCuisines.length > 0) {
        params.append('cuisine', selectedCuisines.join(','))
      }

      if (maxPrice !== undefined) {
        params.append('max_price', maxPrice.toString())
      }

      const res = await fetch(`/api/recommend?${params}`)
      const data = await res.json()
      setRestaurants(data.items || [])

      // Extract unique cuisines
      const cuisines = new Set<string>()
      data.items?.forEach((r: Restaurant) => {
        r.cuisines?.forEach((c) => cuisines.add(c))
      })
      setAvailableCuisines(Array.from(cuisines).sort())
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load initial recommendations on mount
  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine]
    )
  }

  const getPriceSymbols = (level: number) => {
    return '$'.repeat(level)
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:text-primary transition-colors">
            <Utensils size={32} className="text-primary" />
            <h1 className="text-4xl font-bold">EatFinder</h1>
          </Link>
          <p className="text-text-secondary">Find your perfect meal</p>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">What are you in the mood for?</h2>

          {/* Sliders */}
          <div className="space-y-6 mb-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-medium">How heavy?</label>
                <span className="text-primary font-mono text-lg">{wantHeavy}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wantHeavy}
                onChange={(e) => setWantHeavy(Number(e.target.value))}
                className="w-full"
                aria-label="Heaviness level"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>Light</span>
                <span>Heavy</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-medium">How hungry?</label>
                <span className="text-primary font-mono text-lg">{wantHungry}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wantHungry}
                onChange={(e) => setWantHungry(Number(e.target.value))}
                className="w-full"
                aria-label="Hunger level"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>Small portions</span>
                <span>Large portions</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-medium">How fancy?</label>
                <span className="text-primary font-mono text-lg">{wantFinedine}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wantFinedine}
                onChange={(e) => setWantFinedine(Number(e.target.value))}
                className="w-full"
                aria-label="Fine dining level"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>Casual</span>
                <span>Fine dining</span>
              </div>
            </div>
          </div>

          {/* Cuisine filters */}
          {availableCuisines.length > 0 && (
            <div className="mb-4">
              <label className="font-medium block mb-3">Cuisines (optional)</label>
              <div className="flex flex-wrap gap-2">
                {availableCuisines.map((cuisine) => (
                  <button
                    key={cuisine}
                    onClick={() => toggleCuisine(cuisine)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedCuisines.includes(cuisine)
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover border border-border hover:border-primary'
                    }`}
                    aria-pressed={selectedCuisines.includes(cuisine)}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price filter */}
          <div className="mb-6">
            <label className="font-medium block mb-3">Max price (optional)</label>
            <div className="flex gap-2 flex-wrap">
              {[undefined, 1, 2, 3, 4].map((price) => (
                <button
                  key={price || 'any'}
                  onClick={() => setMaxPrice(price)}
                  className={`px-4 py-2 rounded transition-colors ${
                    maxPrice === price
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover border border-border hover:border-primary'
                  }`}
                  aria-pressed={maxPrice === price}
                >
                  {price === undefined ? 'Any' : getPriceSymbols(price)}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="w-full px-6 py-3 bg-primary hover:bg-primary-hover rounded-lg font-semibold text-lg transition-all disabled:opacity-50 shadow-lg shadow-primary/30"
          >
            {loading ? 'Searching...' : 'Find Restaurants'}
          </button>
        </div>

        {/* Results */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            {restaurants.length > 0 && !showAll ? 'Top Recommendations' : 'Recommendations'} 
            {restaurants.length > 0 && ` (${restaurants.length} found)`}
          </h2>

          {loading ? (
            <div className="text-center py-12 text-text-secondary">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4">Finding the perfect spots...</p>
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-border rounded-lg">
              <Search size={48} className="mx-auto mb-4 text-text-secondary" />
              <p className="text-text-secondary mb-2">No restaurants match your criteria.</p>
              <p className="text-text-secondary text-sm">
                Try adjusting your preferences or add some restaurants in the admin area.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(showAll ? restaurants : restaurants.slice(0, 3)).map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="bg-surface border border-border rounded-lg overflow-hidden hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20"
                >
                  {/* Image */}
                  {restaurant.image ? (
                    <div className="relative h-48 bg-surface-hover">
                      <img
                        src={restaurant.image}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-surface-hover flex items-center justify-center">
                      <Utensils size={48} className="text-text-secondary" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold">{restaurant.name}</h3>
                      <span className="text-primary font-semibold ml-2">
                        {getPriceSymbols(restaurant.priceLevel)}
                      </span>
                    </div>

                    <div className="text-sm text-text-secondary mb-3">
                      Score: {restaurant.score.toFixed(1)}
                    </div>

                    {restaurant.cuisines.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {restaurant.cuisines.map((c) => (
                          <span
                            key={c}
                            className="text-xs px-2 py-1 bg-surface-hover rounded-full text-text-secondary"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {restaurant.neighborhood && (
                      <p className="text-sm text-text-secondary mb-4">
                        📍 {restaurant.neighborhood}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {restaurant.websiteUrl && (
                        <a
                          href={restaurant.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-hover hover:bg-primary hover:text-white border border-border hover:border-primary rounded text-sm transition-colors"
                        >
                          <Globe size={14} />
                          Website
                        </a>
                      )}
                      {restaurant.gmapsUrl && (
                        <a
                          href={restaurant.gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-hover hover:bg-primary hover:text-white border border-border hover:border-primary rounded text-sm transition-colors"
                        >
                          <MapPin size={14} />
                          Map
                        </a>
                      )}
                      {restaurant.phone && (
                        <a
                          href={`tel:${restaurant.phone}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-hover hover:bg-primary hover:text-white border border-border hover:border-primary rounded text-sm transition-colors"
                        >
                          <Phone size={14} />
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>

              {/* Show More Button */}
              {!showAll && restaurants.length > 3 && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setShowAll(true)}
                    className="px-8 py-3 bg-surface-hover hover:bg-surface border-2 border-primary hover:border-primary-hover rounded-lg font-semibold transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30"
                  >
                    Show {restaurants.length - 3} More Options
                  </button>
                </div>
              )}

              {/* Show Less Button */}
              {showAll && restaurants.length > 3 && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => {
                      setShowAll(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="px-8 py-3 bg-surface-hover hover:bg-surface border-2 border-border hover:border-primary rounded-lg font-semibold transition-all"
                  >
                    Show Less
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
