'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Save, Sparkles } from 'lucide-react'
import { CUISINE_VOCAB, TAG_VOCAB } from '@/lib/types'
import PhotoGalleryManager from './PhotoGalleryManager'

interface RestaurantFormProps {
  restaurant?: any
  onSuccess: () => void
  onCancel: () => void
}

export default function RestaurantForm({ restaurant, onSuccess, onCancel }: RestaurantFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    heaviness: 50,
    portionSize: 50,
    fineDining: 50,
    priceLevel: 2,
    spiceLevel: 50,
    avgPrepTime: 30,
    cuisines: [] as string[],
    tags: [] as string[],
    neighborhood: '',
    address: '',
    websiteUrl: '',
    gmapsUrl: '',
    woltUrl: '',
    instagramUrl: '',
    phone: '',
    image: '',
    lat: '',
    lng: '',
    openHours: '',
    rating: '',
    isFeatured: false,
  })

  const [cuisineInput, setCuisineInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiStatus, setAiStatus] = useState('')
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || '',
        description: restaurant.description || '',
        heaviness: restaurant.heaviness ?? 50,
        portionSize: restaurant.portionSize ?? 50,
        fineDining: restaurant.fineDining ?? 50,
        priceLevel: restaurant.priceLevel ?? 2,
        spiceLevel: restaurant.spiceLevel ?? 50,
        avgPrepTime: restaurant.avgPrepTime ?? 30,
        cuisines: restaurant.cuisines || [],
        tags: restaurant.tags || [],
        neighborhood: restaurant.neighborhood || '',
        address: restaurant.address || '',
        websiteUrl: restaurant.websiteUrl || '',
        gmapsUrl: restaurant.gmapsUrl || '',
        woltUrl: restaurant.woltUrl || '',
        instagramUrl: restaurant.instagramUrl || '',
        phone: restaurant.phone || '',
        image: restaurant.image || '',
        lat: restaurant.lat?.toString() || '',
        lng: restaurant.lng?.toString() || '',
        openHours: restaurant.openHours ? JSON.stringify(restaurant.openHours, null, 2) : '',
        rating: restaurant.rating?.toString() || '',
        isFeatured: restaurant.isFeatured ?? false,
      })
    }
  }, [restaurant])

  const askAi = async () => {
    if (!restaurant?.id) return
    setAsking(true)
    setAiStatus('')
    try {
      const res = await fetch('/api/admin/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiStatus(data.error || 'AI enrichment failed')
        return
      }
      const result = data.results?.[0]
      if (result?.status === 'proposed') {
        setAiStatus('Proposal created — review it in the AI Queue.')
      } else if (result?.status === 'failed') {
        setAiStatus(`AI could not produce a usable result: ${result.reason}`)
      } else {
        setAiStatus(result?.reason || 'This restaurant already has a pending proposal.')
      }
    } catch {
      setAiStatus('AI enrichment failed')
    } finally {
      setAsking(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setFormData((prev) => ({ ...prev, image: data.url }))
      } else {
        setError(data.error || 'Failed to upload image')
      }
    } catch (err) {
      setError('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const addCuisine = () => {
    const cuisine = cuisineInput.trim()
    if (cuisine && !formData.cuisines.includes(cuisine)) {
      setFormData((prev) => ({
        ...prev,
        cuisines: [...prev.cuisines, cuisine],
      }))
      setCuisineInput('')
    }
  }

  const removeCuisine = (cuisine: string) => {
    setFormData((prev) => ({
      ...prev,
      cuisines: prev.cuisines.filter((c) => c !== cuisine),
    }))
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    let openHours: unknown = null
    if (formData.openHours.trim()) {
      try {
        openHours = JSON.parse(formData.openHours)
      } catch {
        setError('Open Hours must be valid JSON, e.g. {"mon": ["09:00", "23:00"], "sun": null}')
        setSaving(false)
        return
      }
    }

    try {
      const payload: any = {
        ...formData,
        websiteUrl: formData.websiteUrl || null,
        gmapsUrl: formData.gmapsUrl || null,
        woltUrl: formData.woltUrl || null,
        instagramUrl: formData.instagramUrl || null,
        phone: formData.phone || null,
        image: formData.image || null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        openHours,
      }

      const url = restaurant ? `/api/restaurants/${restaurant.id}` : '/api/restaurants'
      const method = restaurant ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess()
      } else {
        setError(data.error || 'Failed to save restaurant')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="px-4 py-3 bg-error/10 border border-error rounded-lg text-error">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary">Basic Information</h2>
          {restaurant?.id && (
            <button
              type="button"
              onClick={askAi}
              disabled={asking}
              className="flex items-center gap-2 px-3 py-2 bg-surface-hover hover:bg-border border border-border rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} />
              {asking ? 'Asking AI...' : 'Ask AI'}
            </button>
          )}
        </div>
        {aiStatus && <p className="text-sm text-text-secondary mb-4">{aiStatus}</p>}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name <span className="text-error">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="neighborhood" className="block text-sm font-medium mb-2">
                Neighborhood
              </label>
              <input
                id="neighborhood"
                type="text"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-2">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Core Scores */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Core Scores (0-100)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="heaviness" className="text-sm font-medium">
                Heaviness
              </label>
              <span className="text-primary font-mono">{formData.heaviness}</span>
            </div>
            <input
              id="heaviness"
              type="range"
              min="0"
              max="100"
              value={formData.heaviness}
              onChange={(e) =>
                setFormData({ ...formData, heaviness: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="portionSize" className="text-sm font-medium">
                Portion Size
              </label>
              <span className="text-primary font-mono">{formData.portionSize}</span>
            </div>
            <input
              id="portionSize"
              type="range"
              min="0"
              max="100"
              value={formData.portionSize}
              onChange={(e) =>
                setFormData({ ...formData, portionSize: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="fineDining" className="text-sm font-medium">
                Fine Dining
              </label>
              <span className="text-primary font-mono">{formData.fineDining}</span>
            </div>
            <input
              id="fineDining"
              type="range"
              min="0"
              max="100"
              value={formData.fineDining}
              onChange={(e) =>
                setFormData({ ...formData, fineDining: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Additional Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="priceLevel" className="block text-sm font-medium mb-2">
              Price Level (1-4)
            </label>
            <select
              id="priceLevel"
              value={formData.priceLevel}
              onChange={(e) =>
                setFormData({ ...formData, priceLevel: Number(e.target.value) })
              }
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="spiceLevel" className="text-sm font-medium">
                Spice Level
              </label>
              <span className="text-primary font-mono">{formData.spiceLevel}</span>
            </div>
            <input
              id="spiceLevel"
              type="range"
              min="0"
              max="100"
              value={formData.spiceLevel}
              onChange={(e) =>
                setFormData({ ...formData, spiceLevel: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="avgPrepTime" className="block text-sm font-medium mb-2">
              Avg Prep Time (minutes)
            </label>
            <input
              id="avgPrepTime"
              type="number"
              min="0"
              value={formData.avgPrepTime}
              onChange={(e) =>
                setFormData({ ...formData, avgPrepTime: Number(e.target.value) })
              }
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Cuisines */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Cuisines</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              list="cuisine-vocab"
              value={cuisineInput}
              onChange={(e) => setCuisineInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCuisine()
                }
              }}
              placeholder="Add cuisine tag"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {/* ponytail: native <datalist> autocomplete, not a combobox component — the API
                still accepts free text, this just nudges toward CUISINE_VOCAB. */}
            <datalist id="cuisine-vocab">
              {CUISINE_VOCAB.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={addCuisine}
              className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors"
            >
              Add
            </button>
          </div>
          {formData.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.cuisines.map((cuisine) => (
                <span
                  key={cuisine}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-surface-hover border border-border rounded-full text-sm"
                >
                  {cuisine}
                  <button
                    type="button"
                    onClick={() => removeCuisine(cuisine)}
                    className="hover:text-error transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Tags</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              list="tag-vocab"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Add tag, e.g. outdoor-seating"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="tag-vocab">
              {TAG_VOCAB.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors"
            >
              Add
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-surface-hover border border-border rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-error transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact & Links */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Contact & Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-medium mb-2">
              Website URL
            </label>
            <input
              id="websiteUrl"
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="gmapsUrl" className="block text-sm font-medium mb-2">
              Google Maps URL
            </label>
            <input
              id="gmapsUrl"
              type="url"
              value={formData.gmapsUrl}
              onChange={(e) => setFormData({ ...formData, gmapsUrl: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="woltUrl" className="block text-sm font-medium mb-2">
              Wolt URL
            </label>
            <input
              id="woltUrl"
              type="url"
              value={formData.woltUrl}
              onChange={(e) => setFormData({ ...formData, woltUrl: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="instagramUrl" className="block text-sm font-medium mb-2">
              Instagram URL
            </label>
            <input
              id="instagramUrl"
              type="url"
              value={formData.instagramUrl}
              onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="rating" className="block text-sm font-medium mb-2">
              Editorial Rating (0-5)
            </label>
            <input
              id="rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm font-medium">
          <input
            type="checkbox"
            checked={formData.isFeatured}
            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured
        </label>
      </div>

      {/* Image */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload size={20} className="text-primary" />
          <h2 className="text-xl font-semibold text-primary">Image</h2>
        </div>
        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary-hover disabled:opacity-50"
          />
          {uploading && (
            <div className="text-sm text-text-secondary">Uploading...</div>
          )}
          {formData.image && (
            <div className="max-w-xs">
              <img
                src={formData.image}
                alt="Preview"
                className="w-full h-auto rounded-lg border border-border"
              />
            </div>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Location (Optional)</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium mb-2">
                Latitude
              </label>
              <input
                id="lat"
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="lng" className="block text-sm font-medium mb-2">
                Longitude
              </label>
              <input
                id="lng"
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="openHours" className="block text-sm font-medium mb-2">
              Open Hours (JSON)
            </label>
            <textarea
              id="openHours"
              value={formData.openHours}
              onChange={(e) => setFormData({ ...formData, openHours: e.target.value })}
              rows={9}
              placeholder='{"mon": ["09:00", "23:00"], "sun": null}'
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Photo gallery */}
      {restaurant?.id && <PhotoGalleryManager restaurantId={restaurant.id} onSetHero={(url) => setFormData((f) => ({ ...f, image: url }))} />}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-surface-hover hover:bg-border border border-border rounded-lg font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Restaurant'}
        </button>
      </div>
    </form>
  )
}
