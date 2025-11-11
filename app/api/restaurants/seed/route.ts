import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

const sampleRestaurants = [
  {
    name: 'The Light Bite Cafe',
    description: 'Fresh salads, smoothies, and light sandwiches. Perfect for a healthy lunch.',
    heaviness: 20,
    portionSize: 40,
    fineDining: 30,
    priceLevel: 2,
    spiceLevel: 10,
    avgPrepTime: 15,
    cuisines: JSON.stringify(['Healthy', 'Salads', 'Smoothies']),
    neighborhood: 'Downtown',
  },
  {
    name: 'Mama Rosa\'s Italian Kitchen',
    description: 'Authentic Italian pasta and pizza. Family-friendly atmosphere.',
    heaviness: 70,
    portionSize: 85,
    fineDining: 45,
    priceLevel: 2,
    spiceLevel: 20,
    avgPrepTime: 25,
    cuisines: JSON.stringify(['Italian', 'Pizza', 'Pasta']),
    neighborhood: 'Little Italy',
  },
  {
    name: 'Le Château Fine Dining',
    description: 'Elegant French cuisine with impeccable service. Perfect for special occasions.',
    heaviness: 60,
    portionSize: 70,
    fineDining: 95,
    priceLevel: 4,
    spiceLevel: 15,
    avgPrepTime: 45,
    cuisines: JSON.stringify(['French', 'Fine Dining']),
    neighborhood: 'Uptown',
  },
  {
    name: 'Spicy Dragon Szechuan',
    description: 'Authentic Szechuan cuisine with bold flavors and heat.',
    heaviness: 65,
    portionSize: 75,
    fineDining: 50,
    priceLevel: 2,
    spiceLevel: 90,
    avgPrepTime: 20,
    cuisines: JSON.stringify(['Chinese', 'Szechuan', 'Spicy']),
    neighborhood: 'Chinatown',
  },
  {
    name: 'Burger Express',
    description: 'Quick-service burgers and fries. Fast and filling.',
    heaviness: 80,
    portionSize: 90,
    fineDining: 15,
    priceLevel: 1,
    spiceLevel: 30,
    avgPrepTime: 10,
    cuisines: JSON.stringify(['American', 'Burgers', 'Fast Food']),
    neighborhood: 'Multiple Locations',
  },
  {
    name: 'Sushi Zen',
    description: 'Fresh sushi and sashimi. Minimalist Japanese aesthetic.',
    heaviness: 35,
    portionSize: 50,
    fineDining: 70,
    priceLevel: 3,
    spiceLevel: 25,
    avgPrepTime: 30,
    cuisines: JSON.stringify(['Japanese', 'Sushi']),
    neighborhood: 'Waterfront',
  },
  {
    name: 'Taco Fiesta',
    description: 'Vibrant Mexican street food. Casual and fun atmosphere.',
    heaviness: 55,
    portionSize: 70,
    fineDining: 25,
    priceLevel: 1,
    spiceLevel: 60,
    avgPrepTime: 12,
    cuisines: JSON.stringify(['Mexican', 'Tacos', 'Street Food']),
    neighborhood: 'East Side',
  },
  {
    name: 'The Steakhouse',
    description: 'Premium cuts of meat, classic sides, and extensive wine list.',
    heaviness: 90,
    portionSize: 95,
    fineDining: 80,
    priceLevel: 4,
    spiceLevel: 20,
    avgPrepTime: 40,
    cuisines: JSON.stringify(['Steakhouse', 'American']),
    neighborhood: 'Financial District',
  },
  {
    name: 'Green Garden Vegan',
    description: 'Plant-based cuisine with creative flavors. All organic ingredients.',
    heaviness: 40,
    portionSize: 60,
    fineDining: 55,
    priceLevel: 3,
    spiceLevel: 35,
    avgPrepTime: 20,
    cuisines: JSON.stringify(['Vegan', 'Organic', 'Healthy']),
    neighborhood: 'Arts District',
  },
  {
    name: 'Ramen House',
    description: 'Authentic Japanese ramen with rich broths and perfect noodles.',
    heaviness: 75,
    portionSize: 80,
    fineDining: 40,
    priceLevel: 2,
    spiceLevel: 50,
    avgPrepTime: 15,
    cuisines: JSON.stringify(['Japanese', 'Ramen']),
    neighborhood: 'University District',
  },
]

export async function POST() {
  try {
    await requireAuth()

    let created = 0
    for (const restaurant of sampleRestaurants) {
      try {
        await prisma.restaurant.create({
          data: restaurant,
        })
        created++
      } catch (error: any) {
        // Skip if restaurant already exists
        if (error.code !== 'P2002') {
          throw error
        }
      }
    }

    return NextResponse.json({ success: true, count: created })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

