import Link from 'next/link'
import { Utensils } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-2xl">
        <div className="flex items-center justify-center gap-3">
          <Utensils size={48} className="text-primary" />
          <h1 className="text-6xl font-bold">EatFinder</h1>
        </div>
        
        <p className="text-xl text-text-secondary">
          Find your perfect meal based on your mood, hunger, and dining preferences
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/eat"
            className="px-8 py-4 bg-primary hover:bg-primary-hover rounded-lg font-semibold text-lg transition-colors"
          >
            Find a Restaurant
          </Link>
          
          <Link
            href="/admin"
            className="px-8 py-4 bg-surface hover:bg-surface-hover border border-border rounded-lg font-semibold text-lg transition-colors"
          >
            Admin Panel
          </Link>
        </div>
      </div>
    </div>
  )
}

