'use client'

import { useState, useEffect, useMemo } from 'react'
import { Upload, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DAYS, type Day } from '@/lib/types'
import { useVocabLabel } from '@/components/VocabProvider'
import PhotoGalleryManager from './PhotoGalleryManager'
import VocabPicker from './VocabPicker'
import SaveBar from './SaveBar'
import { HoursEditor, PRICE_OPTIONS, Segmented } from './FormControls'
import { DAY_NAMES, FIELD_LABELS, diffRestaurant, type RestaurantFormValues } from './restaurantDiff'

interface RestaurantFormProps {
  restaurant?: any
  /** Called after a create. An edit stays on the page and shows "saved". */
  onSuccess?: () => void
  onCancel: () => void
}

type Values = RestaurantFormValues

function toValues(restaurant?: any): Values {
  return {
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    heaviness: restaurant?.heaviness ?? 50,
    portionSize: restaurant?.portionSize ?? 50,
    fineDining: restaurant?.fineDining ?? 50,
    priceLevel: restaurant?.priceLevel ?? 2,
    avgPrepTime: restaurant?.avgPrepTime ?? 30,
    cuisines: restaurant?.cuisines || [],
    tags: restaurant?.tags || [],
    neighborhood: restaurant?.neighborhood || '',
    address: restaurant?.address || '',
    websiteUrl: restaurant?.websiteUrl || '',
    gmapsUrl: restaurant?.gmapsUrl || '',
    woltUrl: restaurant?.woltUrl || '',
    instagramUrl: restaurant?.instagramUrl || '',
    phone: restaurant?.phone || '',
    image: restaurant?.image || '',
    lat: restaurant?.lat?.toString() || '',
    lng: restaurant?.lng?.toString() || '',
    openHours: restaurant?.openHours && Object.keys(restaurant.openHours).length ? restaurant.openHours : null,
    rating: restaurant?.rating?.toString() || '',
    isFeatured: restaurant?.isFeatured ?? false,
    isActive: restaurant?.isActive ?? false,
  }
}

/** The slider's filled share, read by the range track in globals.css. */
const fill = (v: number) => ({ '--fill': `${v}%` }) as CSSProperties

export default function RestaurantForm({ restaurant, onSuccess, onCancel }: RestaurantFormProps) {
  const label = useVocabLabel('en')
  const [baseline, setBaseline] = useState<Values>(() => toValues(restaurant))
  const [formData, setFormData] = useState<Values>(baseline)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<string[]>([])
  const [aiStatus, setAiStatus] = useState('')
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (restaurant) {
      const v = toValues(restaurant)
      setBaseline(v)
      setFormData(v)
    }
  }, [restaurant])

  const changes = useMemo(() => diffRestaurant(baseline, formData, label), [baseline, formData, label])

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setFormData((f) => ({ ...f, [key]: value }))
    setSaved(false)
    setInvalid((xs) => (xs.includes(key) ? xs.filter((x) => x !== key) : xs))
  }
  const isInvalid = (key: string) => (invalid.includes(key) ? true : undefined)

  const discard = () => {
    if (!window.confirm(`Discard ${changes.length} unsaved ${changes.length === 1 ? 'change' : 'changes'}?`)) return
    setFormData(baseline)
    setInvalid([])
    setError('')
  }

  /** Report a problem in the bar, mark the fields and take focus to the first. */
  const fail = (message: string, keys: string[] = []) => {
    setError(message)
    setInvalid(keys)
    if (keys[0]) document.getElementById(keys[0])?.focus()
  }

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
        set('image', data.url)
      } else {
        setError(data.error || 'Failed to upload image')
      }
    } catch (err) {
      setError('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError('')

    // Our own checks instead of the browser's bubbles (the form is noValidate).
    if (!formData.name.trim()) return fail('Give the restaurant a name.', ['name'])
    const badDays = DAYS.filter((d) => {
      const slot = formData.openHours?.[d]
      return slot && (!slot[0] || !slot[1])
    })
    if (badDays.length) {
      return fail(`Set both times for ${badDays.map((d) => DAY_NAMES[d]).join(', ')}, or mark the day closed.`, badDays.map((d) => `hours.${d}`))
    }

    setSaving(true)
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
        openHours: formData.openHours,
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
        setBaseline(formData)
        setInvalid([])
        if (restaurant) setSaved(true)
        else onSuccess?.()
      } else if (Array.isArray(data.details) && data.details.length) {
        // Zod issues: name the fields in words, and mark them.
        const keys = [...new Set<string>(data.details.map((d: any) => String(d.path?.[0] ?? '')))].filter(Boolean)
        const msg = data.details
          .map((d: any) => `${FIELD_LABELS[d.path?.[0] as keyof Values] ?? d.path?.join('.') ?? 'Field'}: ${d.message}`)
          .join(' · ')
        fail(msg, keys)
      } else {
        fail(data.error || 'Failed to save restaurant')
      }
    } catch {
      fail('Could not reach the server. Your changes are still here — try again.')
    } finally {
      setSaving(false)
    }
  }

  const field = (
    key: 'address' | 'websiteUrl' | 'gmapsUrl' | 'phone' | 'woltUrl' | 'instagramUrl',
    text: string,
    type = 'text',
    extra: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div>
      <label htmlFor={key} className="ef-field-label">
        {text}
      </label>
      <input
        id={key}
        type={type}
        value={formData[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={isInvalid(key)}
        className="ef-input"
        {...extra}
      />
    </div>
  )

  const axes = [
    ['heaviness', 'Heaviness', 'Light', 'Hearty'],
    ['portionSize', 'Portion size', 'Small', 'Generous'],
    ['fineDining', 'Fine dining', 'Casual', 'Formal'],
  ] as const

  return (
    <form onSubmit={handleSubmit} className="admin-form" aria-busy={saving} noValidate>
      <div className="admin-form-grid">
        <nav aria-label="Restaurant form sections" className="admin-form-jumps admin-form-wide">
          {[
            ['basic', 'Overview'],
            ['scores', 'Profile scores'],
            ['contact', 'Contact'],
            ['image', 'Images'],
            ['location', 'Location & hours'],
          ].map(([id, text]) => (
            <a key={id} href={'#' + id}>
              {text}
            </a>
          ))}
        </nav>

        {/* Basic Information */}
        <div id="basic" className="ef-panel admin-form-section admin-form-wide">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2>Basic information</h2>
            {restaurant?.id && (
              <button type="button" onClick={askAi} disabled={asking} className="ef-btn ef-btn--ghost">
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
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={isInvalid('name')}
                aria-required
                className="ef-input"
              />
            </div>

            <div>
              <label htmlFor="description" className="ef-field-label">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => set('description', e.target.value)}
                aria-invalid={isInvalid('description')}
                rows={4}
                className="ef-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VocabPicker
                kind="neighborhood"
                label="Neighborhood"
                placeholder="Search neighborhoods…"
                value={formData.neighborhood}
                onChange={(neighborhood) => set('neighborhood', neighborhood)}
              />
              {field('address', 'Address', 'text', { autoComplete: 'street-address' })}
            </div>
          </div>
        </div>

        {/* Core Scores */}
        <div id="scores" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Profile scores</h2>
          <p className="admin-form-hint">Describe the dining experience on a scale from 0 to 100.</p>
          {/* gap-4 is the gutter every other field row in this form uses. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {axes.map(([key, text, lo, hi]) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor={key} className="text-[13px] font-semibold text-text">
                    {text}
                  </label>
                  <span className="text-[13px] font-bold tabular-nums text-primary">{formData[key]}</span>
                </div>
                <input
                  id={key}
                  type="range"
                  min="0"
                  max="100"
                  value={formData[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  style={fill(formData[key])}
                />
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-text-secondary">
                  <span>{lo}</span>
                  <span>{hi}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Details */}
        <div id="details" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Additional details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span id="priceLevel-label" className="ef-field-label">
                Price level
              </span>
              <Segmented
                name="priceLevel"
                labelId="priceLevel-label"
                value={formData.priceLevel}
                options={PRICE_OPTIONS}
                onChange={(v) => set('priceLevel', v)}
              />
            </div>

            <div>
              <label htmlFor="avgPrepTime" className="ef-field-label">
                Avg prep time <span className="font-normal text-text-secondary">(minutes)</span>
              </label>
              <input
                id="avgPrepTime"
                type="number"
                inputMode="numeric"
                min="0"
                value={formData.avgPrepTime}
                onChange={(e) => set('avgPrepTime', Number(e.target.value))}
                aria-invalid={isInvalid('avgPrepTime')}
                className="ef-input tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Cuisines */}
        <div id="cuisines" className="ef-panel admin-form-section">
          <h2 className="mb-4">Cuisines</h2>
          <p className="admin-form-hint">What kind of food. The first one is shown on the card.</p>
          <VocabPicker
            kind="cuisine"
            label="Selected cuisines"
            placeholder="Search or add a cuisine…"
            multiple
            value={formData.cuisines}
            onChange={(cuisines) => set('cuisines', cuisines)}
          />
        </div>

        {/* Tags */}
        <div id="tags" className="ef-panel admin-form-section">
          <h2 className="mb-4">Tags</h2>
          <p className="admin-form-hint">Features guests filter by: terrace, open late, delivery…</p>
          <VocabPicker
            kind="tag"
            label="Selected tags"
            placeholder="Search or add a tag…"
            multiple
            value={formData.tags}
            onChange={(tags) => set('tags', tags)}
          />
        </div>

        {/* Contact & Links */}
        <div id="contact" className="ef-panel admin-form-section admin-form-wide">
          <h2 className="mb-4">Contact & links</h2>
          <p className="admin-form-hint">Give guests a direct route to the restaurant.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field('websiteUrl', 'Website URL', 'url', { inputMode: 'url', placeholder: 'https://' })}
            {field('gmapsUrl', 'Google Maps URL', 'url', { inputMode: 'url', placeholder: 'https://' })}
            {field('phone', 'Phone', 'tel', { autoComplete: 'tel' })}
            {field('woltUrl', 'Wolt URL', 'url', { inputMode: 'url', placeholder: 'https://' })}
            {field('instagramUrl', 'Instagram URL', 'url', { inputMode: 'url', placeholder: 'https://' })}
            <div>
              <label htmlFor="rating" className="ef-field-label">
                Editorial rating <span className="font-normal text-text-secondary">(0–5)</span>
              </label>
              <input
                id="rating"
                type="number"
                inputMode="decimal"
                min="0"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(e) => set('rating', e.target.value)}
                aria-invalid={isInvalid('rating')}
                className="ef-input tabular-nums"
              />
            </div>
          </div>

          {/* Switches, not checkboxes: both are states of the listing that take
              effect on save, and each row is a full 44px target. */}
          <div className="mt-5 grid gap-1 sm:grid-cols-2 sm:gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] font-semibold text-text">
              <input
                type="checkbox"
                role="switch"
                className="ef-switch"
                checked={formData.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                aria-describedby="isActive-hint"
              />
              <span>
                Publish on EatFinder
                <span id="isActive-hint" className="block text-xs font-normal text-text-secondary">
                  New restaurants stay in drafts until you publish them.
                </span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] font-semibold text-text">
              <input
                type="checkbox"
                role="switch"
                className="ef-switch"
                checked={formData.isFeatured}
                onChange={(e) => set('isFeatured', e.target.checked)}
              />
              Featured
            </label>
          </div>
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
          <p className="admin-form-hint">Optional coordinates and the restaurant’s weekly schedule.</p>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['lat', 'lng'] as const).map((key) => (
                <div key={key}>
                  <label htmlFor={key} className="ef-field-label">
                    {key === 'lat' ? 'Latitude' : 'Longitude'}
                  </label>
                  <input
                    id={key}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={formData[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={isInvalid(key)}
                    placeholder={key === 'lat' ? '42.6629' : '21.1655'}
                    className="ef-input tabular-nums"
                  />
                </div>
              ))}
            </div>

            <div>
              <h3 className="ef-field-label">Opening hours</h3>
              <HoursEditor
                value={formData.openHours}
                onChange={(v) => {
                  set('openHours', v)
                  setInvalid((xs) => xs.filter((x) => !x.startsWith('hours.')))
                }}
                invalidDays={invalid.filter((x) => x.startsWith('hours.')).map((x) => x.slice(6) as Day)}
              />
            </div>
          </div>
        </div>

        {/* Photo gallery */}
        {restaurant?.id && (
          <PhotoGalleryManager
            restaurantId={restaurant.id}
            restaurantName={formData.name}
            onSetHero={(url) => set('image', url)}
          />
        )}
      </div>

      <SaveBar
        changes={changes}
        saving={saving}
        saved={saved}
        error={error}
        submitLabel={restaurant ? 'Save changes' : 'Create restaurant'}
        onDiscard={discard}
        onBack={onCancel}
      />
    </form>
  )
}

