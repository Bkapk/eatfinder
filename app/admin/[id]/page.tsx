'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import RestaurantForm from '../components/RestaurantForm'

export default function EditRestaurantPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [restaurant, setRestaurant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || id === 'new') {
      setLoading(false)
      return
    }

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-text mb-8">
        {id === 'new' ? 'Add Restaurant' : 'Edit Restaurant'}
      </h1>
      <RestaurantForm
        restaurant={restaurant}
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}

