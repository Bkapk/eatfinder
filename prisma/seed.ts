import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/auth'
import { slugify } from '../lib/types'
import { sampleRestaurants } from './sample-restaurants'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'changeme'

  const existingUser = await prisma.user.findUnique({
    where: { username },
  })

  if (!existingUser) {
    const hashedPassword = await hashPassword(password)
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        // Explicit: User.role defaults to 'user', which cannot pass requireAdmin().
        // Without this a freshly seeded database has no account that can reach
        // /admin at all. The v2 migration only backfills the row that already
        // existed, so it does not cover this path.
        role: 'admin',
      },
    })
    console.log(`✅ Admin user created: ${username}`)
  } else if (existingUser.role !== 'admin') {
    // A database seeded before this fix has an admin stuck at role 'user'.
    await prisma.user.update({ where: { username }, data: { role: 'admin' } })
    console.log(`✅ Promoted existing user to admin: ${username}`)
  } else {
    console.log(`ℹ️  Admin user already exists: ${username}`)
  }

  // Create sample restaurants
  let created = 0
  for (const restaurant of sampleRestaurants) {
    try {
      await prisma.restaurant.create({
        data: { ...restaurant, slug: slugify(restaurant.name) },
      })
      created++
    } catch (error: any) {
      // Skip if restaurant already exists
      if (error.code !== 'P2002') {
        console.error(`Failed to create ${restaurant.name}:`, error)
      }
    }
  }

  console.log(`✅ Created ${created} sample restaurants`)
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

