import RestaurantList from '@/components/RestaurantList'

export default function AdminPage() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <RestaurantList />
      </div>
    </div>
  )
}

