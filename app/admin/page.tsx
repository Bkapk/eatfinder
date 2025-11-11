'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, ArrowUpDown } from 'lucide-react'

interface Restaurant {
  id: string
  name: string
  description: string
  heaviness: number
  portionSize: number
  fineDining: number
  priceLevel: number
  spiceLevel: number
  avgPrepTime: number
  cuisines: string[]
  neighborhood: string
  websiteUrl?: string | null
  gmapsUrl?: string | null
  phone?: string | null
  image?: string | null
  lat?: number | null
  lng?: number | null
  openHours?: string | null
  updatedAt: string
}

export default function AdminPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Partial<Restaurant>>({})

  useEffect(() => {
    fetchRestaurants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy, sortOrder])

  const fetchRestaurants = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)

      const res = await fetch(`/api/restaurants?${params}`)
      const data = await res.json()
      setRestaurants(data.restaurants || [])
    } catch (error) {
      console.error('Failed to fetch restaurants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (restaurant: Restaurant) => {
    setEditingId(restaurant.id)
    setEditingValues({
      heaviness: restaurant.heaviness,
      portionSize: restaurant.portionSize,
      fineDining: restaurant.fineDining,
    })
  }

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingValues),
      })

      if (res.ok) {
        setEditingId(null)
        fetchRestaurants()
      } else {
        alert('Failed to update restaurant')
      }
    } catch (error) {
      console.error('Failed to update:', error)
      alert('An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant?')) return

    try {
      const res = await fetch(`/api/restaurants/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchRestaurants()
      } else {
        alert('Failed to delete restaurant')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('An error occurred')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Restaurants</h1>
        <button
          onClick={() => router.push('/admin/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors shadow-lg shadow-primary/30"
        >
          <Plus size={20} />
          Add Restaurant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search by name, cuisine, or neighborhood..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="updatedAt">Last Updated</option>
            <option value="name">Name</option>
            <option value="heaviness">Heaviness</option>
            <option value="portionSize">Portion Size</option>
            <option value="fineDining">Fine Dining</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
            title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <ArrowUpDown size={20} className={sortOrder === 'desc' ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading restaurants...</p>
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-12 bg-surface border border-border rounded-lg">
          <p className="text-text-secondary mb-4">No restaurants found.</p>
          <button
            onClick={() => router.push('/admin/new')}
            className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors"
          >
            Add Your First Restaurant
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-hover border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Heaviness</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Portion</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Fine Dining</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Cuisines</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{restaurant.name}</div>
                      {restaurant.neighborhood && (
                        <div className="text-xs text-text-secondary mt-1">
                          {restaurant.neighborhood}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === restaurant.id ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingValues.heaviness}
                          onChange={(e) =>
                            setEditingValues({
                              ...editingValues,
                              heaviness: Number(e.target.value),
                            })
                          }
                          className="w-16 px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        restaurant.heaviness
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === restaurant.id ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingValues.portionSize}
                          onChange={(e) =>
                            setEditingValues({
                              ...editingValues,
                              portionSize: Number(e.target.value),
                            })
                          }
                          className="w-16 px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        restaurant.portionSize
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === restaurant.id ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingValues.fineDining}
                          onChange={(e) =>
                            setEditingValues({
                              ...editingValues,
                              fineDining: Number(e.target.value),
                            })
                          }
                          className="w-16 px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        restaurant.fineDining
                      )}
                    </td>
                    <td className="px-4 py-3 text-primary font-semibold">
                      {'$'.repeat(restaurant.priceLevel)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {restaurant.cuisines.slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className="text-xs px-2 py-1 bg-surface-hover rounded-full text-text-secondary"
                          >
                            {c}
                          </span>
                        ))}
                        {restaurant.cuisines.length > 2 && (
                          <span className="text-xs text-text-secondary">
                            +{restaurant.cuisines.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {editingId === restaurant.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(restaurant.id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-surface-hover hover:bg-border border border-border rounded text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(restaurant)}
                              className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => router.push(`/admin/${restaurant.id}`)}
                              className="px-3 py-1 bg-surface-hover hover:bg-border border border-border rounded text-sm transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(restaurant.id)}
                              className="px-3 py-1 bg-error/20 hover:bg-error/30 text-error rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
