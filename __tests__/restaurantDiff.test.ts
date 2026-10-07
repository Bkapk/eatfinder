import { diffRestaurant, type RestaurantFormValues } from '@/app/admin/components/restaurantDiff'

const base: RestaurantFormValues = {
  name: 'Tiffany', description: '', heaviness: 50, portionSize: 50, fineDining: 50, priceLevel: 2,
  avgPrepTime: 30, cuisines: ['grill'], tags: [], neighborhood: '', address: '', websiteUrl: '',
  gmapsUrl: '', woltUrl: '', instagramUrl: '', phone: '', image: '', lat: '', lng: '',
  openHours: { mon: ['09:00', '23:00'], tue: null }, rating: '', isFeatured: false, isActive: false,
}

describe('diffRestaurant', () => {
  it('is empty when nothing changed', () => {
    expect(diffRestaurant(base, { ...base, cuisines: ['grill'] })).toEqual([])
  })

  it('formats changed fields for people', () => {
    const changes = diffRestaurant(base, { ...base, priceLevel: 4, isActive: true, cuisines: ['grill', 'pizza'] }, (_k, s) => s.toUpperCase())
    expect(changes).toEqual([
      { key: 'priceLevel', label: 'Price level', from: '$$', to: '$$$$' },
      { key: 'cuisines', label: 'Cuisines', from: 'GRILL', to: 'GRILL, PIZZA' },
      { key: 'isActive', label: 'Status', from: 'Draft', to: 'Published' },
    ])
  })

  it('reports opening hours one day at a time', () => {
    const changes = diffRestaurant(base, { ...base, openHours: { mon: ['10:00', '23:00'], tue: null } })
    expect(changes).toEqual([{ key: 'openHours.mon', label: 'Hours · Monday', from: '09:00–23:00', to: '10:00–23:00' }])
    expect(diffRestaurant(base, { ...base, openHours: null })).toHaveLength(7)
  })
})
