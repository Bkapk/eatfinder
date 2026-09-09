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
    <form onSubmit={handleSubmit} className="admin-form" aria-busy={saving}>
      <div className="admin-form-grid">
        <nav aria-label="Restaurant form sections" className="admin-form-jumps admin-form-wide">
          {[
            ['basic', 'Overview'],
            ['scores', 'Profile scores'],
            ['contact', 'Contact'],
            ['image', 'Images'],
            ['location', 'Location & hours'],
          ].map(([id, label]) => (
            <a key={id} href={'#' + id}>
              {label}
            </a>
          ))}
        </nav>
        {error && (
          <div role="alert" className="ef-alert admin-form-wide !mb-0">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div id="basic" className="ef-panel admin-form-section admin-form-wide">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2>Basic information</h2>
            {restaurant?.id && (
              <button
                type="button"
                onClick={askAi}
                disabled={asking}
                className="ef-btn ef-btn--ghost"
              >
                <Sparkles size={16} />
                {asking ? 'Asking AI…' : 'Ask AI'}
              </button>
            )}
          </div>
          {aiStatus && <p className="text-sm text-text-secondary mb-4">{aiStatus}</p>}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="ef-field-label">
                Name <span className="text-error">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="ef-input"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="ef-field-label">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="ef-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="neighborhood" className="ef-field-label">
                  Neighborhood
                </label>
                <input
                  id="neighborhood"
                  type="text"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  className="ef-input"
                />
              </div>
              <div>
                <label htmlFor="address" className="ef-field-label">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="ef-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Core Scores */}
        <div id="scores" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Profile scores</h2>
          <p className="admin-form-hint">
            Describe the dining experience on a scale from 0 to 100.
          </p>
          {/* gap-4 is the gutter every other field row in this form uses; gap-6
              made the three sliders drift out of step with the grids above. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="heaviness" className="text-[13px] font-semibold text-text">
                  Heaviness
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">{formData.heaviness}</span>
              </div>
              <input
                id="heaviness"
                type="range"
                min="0"
                max="100"
                value={formData.heaviness}
                onChange={(e) => setFormData({ ...formData, heaviness: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="portionSize" className="text-[13px] font-semibold text-text">
                  Portion Size
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">{formData.portionSize}</span>
              </div>
              <input
                id="portionSize"
                type="range"
                min="0"
                max="100"
                value={formData.portionSize}
                onChange={(e) => setFormData({ ...formData, portionSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="fineDining" className="text-[13px] font-semibold text-text">
                  Fine Dining
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">{formData.fineDining}</span>
              </div>
              <input
                id="fineDining"
                type="range"
                min="0"
                max="100"
                value={formData.fineDining}
                onChange={(e) => setFormData({ ...formData, fineDining: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div id="details" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Additional details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="priceLevel" className="ef-field-label">
                Price Level (1-4)
              </label>
              <select
                id="priceLevel"
                value={formData.priceLevel}
                onChange={(e) => setFormData({ ...formData, priceLevel: Number(e.target.value) })}
                className="ef-input"
              >
                <option value="1">$</option>
                <option value="2">$$</option>
                <option value="3">$$$</option>
                <option value="4">$$$$</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="spiceLevel" className="text-[13px] font-semibold text-text">
                  Spice Level
                </label>
                <span className="text-[13px] font-bold tabular-nums text-primary">{formData.spiceLevel}</span>
              </div>
              <input
                id="spiceLevel"
                type="range"
                min="0"
                max="100"
                value={formData.spiceLevel}
                onChange={(e) => setFormData({ ...formData, spiceLevel: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="avgPrepTime" className="ef-field-label">
                Avg Prep Time (minutes)
              </label>
              <input
                id="avgPrepTime"
                type="number"
                min="0"
                value={formData.avgPrepTime}
                onChange={(e) => setFormData({ ...formData, avgPrepTime: Number(e.target.value) })}
                className="ef-input"
              />
            </div>
          </div>
        </div>

        {/* Cuisines */}
        <div id="cuisines" className="ef-panel admin-form-section">
          <h2 className="mb-4">Cuisines</h2>
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
                aria-label="Add cuisine tag"
                className="ef-input flex-1"
              />
              {/* ponytail: native <datalist> autocomplete, not a combobox component — the API
                still accepts free text, this just nudges toward CUISINE_VOCAB. */}
              <datalist id="cuisine-vocab">
                {CUISINE_VOCAB.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button type="button" onClick={addCuisine} className="ef-btn ef-btn--primary">
                Add
              </button>
            </div>
            {formData.cuisines.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.cuisines.map((cuisine) => (
                  <span key={cuisine} className="ef-chip ef-chip-enter">
                    {cuisine}
                    <button
                      type="button"
                      onClick={() => removeCuisine(cuisine)}
                      aria-label={`Remove ${cuisine}`}
                      className="ef-chip-remove"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div id="tags" className="ef-panel admin-form-section">
          <h2 className="mb-4">Tags</h2>
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
                aria-label="Add tag"
                className="ef-input flex-1"
              />
              <datalist id="tag-vocab">
                {TAG_VOCAB.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <button type="button" onClick={addTag} className="ef-btn ef-btn--primary">
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span key={tag} className="ef-chip ef-chip-enter">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="ef-chip-remove"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contact & Links */}
        <div id="contact" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Contact & links</h2>
          <p className="admin-form-hint">Give guests a direct route to the restaurant.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="websiteUrl" className="ef-field-label">
                Website URL
              </label>
              <input
                id="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="gmapsUrl" className="ef-field-label">
                Google Maps URL
              </label>
              <input
                id="gmapsUrl"
                type="url"
                value={formData.gmapsUrl}
                onChange={(e) => setFormData({ ...formData, gmapsUrl: e.target.value })}
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="phone" className="ef-field-label">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="woltUrl" className="ef-field-label">
                Wolt URL
              </label>
              <input
                id="woltUrl"
                type="url"
                value={formData.woltUrl}
                onChange={(e) => setFormData({ ...formData, woltUrl: e.target.value })}
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="instagramUrl" className="ef-field-label">
                Instagram URL
              </label>
              <input
                id="instagramUrl"
                type="url"
                value={formData.instagramUrl}
                onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="rating" className="ef-field-label">
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
                className="ef-input"
              />
            </div>
          </div>

          {/* No w-4 h-4: that override shrank this one box below the 18px every
              other checkbox in the app draws, and the gap-3 matches them too. */}
          <label className="mt-5 flex cursor-pointer items-center gap-3 text-[13px] font-semibold text-text">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
            />
            Featured
          </label>
        </div>

        {/* Image */}
        <div id="image" className="ef-panel admin-form-section admin-form-wide">
          <div className="mb-4 flex items-center gap-2.5">
            <Upload size={18} className="text-primary" aria-hidden />
            <h2>Image</h2>
          </div>
          <div className="space-y-4">
            <input
              type="file"
              accept="image/*"
              aria-label="Upload hero image"
              onChange={handleImageUpload}
              disabled={uploading}
              className="ef-input ef-file-input !py-3 disabled:opacity-50"
            />
            {/* Indeterminate: /api/upload is a single fetch() and reports no
                byte progress, so the bar promises activity and nothing more. */}
            {uploading && (
              <div role="status">
                <div className="ef-progress" aria-hidden />
                <p className="mt-2 text-sm text-text-secondary">Uploading…</p>
              </div>
            )}
            {formData.image && (
              <div className="aspect-[16/9] max-w-xs overflow-hidden rounded-xl border border-border">
                {/* Opaque URL from lib/storage saveImage(); never reconstructed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div id="location" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Location & opening hours</h2>
          <p className="admin-form-hint">
            Optional coordinates and the restaurant’s weekly schedule.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lat" className="ef-field-label">
                  Latitude
                </label>
                <input
                  id="lat"
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  className="ef-input"
                />
              </div>

              <div>
                <label htmlFor="lng" className="ef-field-label">
                  Longitude
                </label>
                <input
                  id="lng"
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  className="ef-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="openHours" className="ef-field-label">
                Open Hours (JSON)
              </label>
              <textarea
                id="openHours"
                value={formData.openHours}
                onChange={(e) => setFormData({ ...formData, openHours: e.target.value })}
                rows={9}
                placeholder='{"mon": ["09:00", "23:00"], "sun": null}'
                className="ef-input resize-none font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Photo gallery */}
        {restaurant?.id && (
          <PhotoGalleryManager
            restaurantId={restaurant.id}
            restaurantName={formData.name}
            onSetHero={(url) => setFormData((f) => ({ ...f, image: url }))}
          />
        )}
      </div>
      {/* Actions */}
      <div className="admin-form-actions">
        <span className="mr-auto hidden text-xs text-text-secondary sm:block">
          Review your changes before saving.
        </span>
        <button type="button" onClick={onCancel} className="ef-btn ef-btn--ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="ef-btn ef-btn--primary">
          <Save size={17} aria-hidden />
          {saving ? 'Saving…' : 'Save restaurant'}
        </button>
      </div>
    </form>
  )
}
