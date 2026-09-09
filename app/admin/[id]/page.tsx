'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size={44} className="mb-4" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-[26px] font-extrabold tracking-tight text-text mb-8">Edit Restaurant</h1>
      <RestaurantForm
        restaurant={restaurant}
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}

