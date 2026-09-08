'use client'

import { useRouter } from 'next/navigation'
import RestaurantForm from '../components/RestaurantForm'

export default function NewRestaurantPage() {
  const router = useRouter()

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-text mb-8">Add Restaurant</h1>
      <RestaurantForm
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}

