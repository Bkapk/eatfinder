'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, Phone, Globe, Utensils } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface ScoredRestaurant {
  id: string
  score: number
  name: string
  priceLevel: number
  cuisines: string
  image: string
  description: string
  websiteUrl: string
  gmapsUrl: string
  phone: string
  neighborhood: string
  spiceLevel: number
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
  const [heavy, setHeavy] = useState(50)
  const [hungry, setHungry] = useState(50)
  const [fineDine, setFineDine] = useState(50)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined)
  const [results, setResults] = useState<ScoredRestaurant[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        heavy: heavy.toString(),
        hungry: hungry.toString(),
        finedine: fineDine.toString(),
      })

      if (selectedCuisines.length > 0) {
        params.append('cuisines', selectedCuisines.join(','))
      }

      if (maxPrice !== undefined) {
        params.append('maxPrice', maxPrice.toString())
      }

      const response = await fetch(`/api/recommend?${params}`)
      const data = await response.json()
      setResults(data.items || [])
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    } finally {
      setLoading(false)
    }
  }, [heavy, hungry, fineDine, selectedCuisines, maxPrice])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    )
  }

  const getPriceDisplay = (level: number) => {
    return '$'.repeat(level)
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:text-primary transition-colors">
            <Utensils size={32} />
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
                <span className="text-primary font-mono text-lg">{heavy}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={heavy}
                onChange={(e) => setHeavy(parseInt(e.target.value))}
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
                <span className="text-primary font-mono text-lg">{hungry}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hungry}
                onChange={(e) => setHungry(parseInt(e.target.value))}
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
                <span className="text-primary font-mono text-lg">{fineDine}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={fineDine}
                onChange={(e) => setFineDine(parseInt(e.target.value))}
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
          <div className="mb-4">
            <label className="font-medium block mb-3">Cuisines (optional)</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_CUISINES.map(cuisine => (
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

          {/* Price filter */}
          <div>
            <label className="font-medium block mb-3">Max price (optional)</label>
            <div className="flex gap-2">
              {[undefined, 1, 2, 3, 4].map(price => (
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
                  {price === undefined ? 'Any' : getPriceDisplay(price)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            Recommendations {results.length > 0 && `(${results.length})`}
          </h2>

          {loading ? (
            <div className="text-center py-12 text-text-secondary">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4">Finding the perfect spots...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-border rounded-lg">
              <Search size={48} className="mx-auto mb-4 text-text-secondary" />
              <p className="text-text-secondary">
                No restaurants match your criteria. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((restaurant) => {
                const cuisines = JSON.parse(restaurant.cuisines || '[]')
                return (
                  <div
                    key={restaurant.id}
                    className="bg-surface border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                  >
                    {/* Image */}
                    <div className="relative h-48 bg-surface-hover">
                      {restaurant.image ? (
                        <Image
                          src={restaurant.image}
                          alt={restaurant.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Utensils size={48} className="text-text-secondary" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold">{restaurant.name}</h3>
                        <span className="text-sm text-text-secondary">
                          {getPriceDisplay(restaurant.priceLevel)}
                        </span>
                      </div>

                      {cuisines.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {cuisines.slice(0, 3).map((cuisine: string) => (
                            <span
                              key={cuisine}
                              className="text-xs px-2 py-1 bg-surface-hover rounded"
                            >
                              {cuisine}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                        {restaurant.description}
                      </p>

                      {restaurant.neighborhood && (
                        <p className="text-xs text-text-secondary mb-4">
                          📍 {restaurant.neighborhood}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {restaurant.websiteUrl && (
                          <a
                            href={restaurant.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary hover:bg-primary-hover rounded text-sm transition-colors"
                          >
                            <Globe size={16} />
                            Website
                          </a>
                        )}
                        {restaurant.gmapsUrl && (
                          <a
                            href={restaurant.gmapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-surface-hover hover:bg-border rounded text-sm transition-colors"
                          >
                            <MapPin size={16} />
                            Map
                          </a>
                        )}
                        {restaurant.phone && (
                          <a
                            href={`tel:${restaurant.phone}`}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-surface-hover hover:bg-border rounded text-sm transition-colors"
                          >
                            <Phone size={16} />
                          </a>
                        )}
                      </div>

                      {/* Score badge */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-text-secondary">
                          Match score: <span className="text-primary font-mono">{restaurant.score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

