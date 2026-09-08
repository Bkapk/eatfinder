import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'eatfinder_session'
const SESSION_DAYS = 7

// Read lazily, not at module load: a missing secret must fail the request, not the build.
function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET missing or shorter than 32 chars')
  }
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Signed, expiring session token: `<userId>.<expiryMs>.<hmac>` */
export function createSession(userId: string): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000
  const payload = `${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 86400,
}

export async function getCurrentUser(): Promise<{ id: string; username: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts

  const expected = Buffer.from(sign(`${userId}.${exp}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  if (!Number(exp) || Number(exp) < Date.now()) return null

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  })
}

export async function requireAuth(): Promise<{ id: string; username: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
