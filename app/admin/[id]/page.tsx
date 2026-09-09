'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../components/AdminUI'
import RestaurantForm from '../components/RestaurantForm'
import Spinner from '@/components/Spinner'

export default function EditRestaurantPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [restaurant, setRestaurant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/restaurants/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setRestaurant(data.restaurant)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Failed to fetch restaurant:', error)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-72">
        <div className="text-center">
          <Spinner size={44} className="mb-4" />
          <p className="text-text-secondary">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden />
        All restaurants
      </Link>
      <PageHeader
        eyebrow="Restaurant profile"
        title="Edit restaurant"
        description="A great discovery starts with the details. Shape the profile, imagery, and information guests see."
      />
      <RestaurantForm
        restaurant={restaurant}
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}
