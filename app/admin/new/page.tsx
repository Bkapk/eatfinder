'use client'

import { useRouter } from 'next/navigation'
import RestaurantForm from '../components/RestaurantForm'

export default function NewRestaurantPage() {
  const router = useRouter()

  return (
    <div>
      <h1>Add Restaurant</h1>
      <RestaurantForm
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}

