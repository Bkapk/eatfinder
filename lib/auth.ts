import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'eatfinder_session'
const SESSION_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Verify a password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Create a session (simple implementation)
 */
export async function createSession(userId: string): Promise<string> {
  // In production, use proper session management (JWT, Redis, etc.)
  // For now, we'll use a simple cookie-based approach
  const sessionId = `${userId}-${Date.now()}`
  return sessionId
}

/**
 * Get current user from session
 */
export async function getCurrentUser(): Promise<{ id: string; username: string } | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  
  if (!session?.value) {
    return null
  }

  // Simple session validation (in production, use proper session store)
  const [userId] = session.value.split('-')
  if (!userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  })

  return user
}

/**
 * Check if user is authenticated
 */
export async function requireAuth(): Promise<{ id: string; username: string }> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Initialize admin user if it doesn't exist
 */
export async function initAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'changeme'

  const existing = await prisma.user.findUnique({
    where: { username },
  })

  if (!existing) {
    const hashedPassword = await hashPassword(password)
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    })
    console.log(`✅ Admin user created: ${username}`)
  }
}

