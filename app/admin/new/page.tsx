'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../components/AdminUI'
import RestaurantForm from '../components/RestaurantForm'

export default function NewRestaurantPage() {
  const router = useRouter()

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
        title="Add restaurant"
        description="A great discovery starts with the details. Shape the profile, imagery, and information guests see."
      />
      <RestaurantForm
        onSuccess={() => router.push('/admin')}
        onCancel={() => router.push('/admin')}
      />
    </div>
  )
}
