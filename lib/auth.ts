import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'eatfinder_session'
const SESSION_DAYS = 7
const BCRYPT_COST = 12 // existing cost-10 hashes still verify; they upgrade on the next password set

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
  return bcrypt.hash(password, BCRYPT_COST)
}

// Compared against when the account does not exist, so an unknown username
// costs the same bcrypt round as a wrong password and timing reveals nothing.
let dummyHash: string | null = null

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash)
  dummyHash ??= await bcrypt.hash('timing-equaliser', BCRYPT_COST)
  await bcrypt.compare(password, dummyHash)
  return false
}

/**
 * Signed, expiring session token: `<userId>.<sessionVersion>.<expiryMs>.<hmac>`.
 * The version must match User.sessionVersion, so bumping that column
 * (revokeSessions) kills every cookie issued before it.
 */
export function createSession(userId: string, sessionVersion: number): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000
  const payload = `${userId}.${sessionVersion}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Signature + expiry check only; the caller still compares the version against the DB. */
export function parseSessionToken(token: string): { userId: string; version: number } | null {
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [userId, version, exp, sig] = parts

  const expected = Buffer.from(sign(`${userId}.${version}.${exp}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (!Number(exp) || Number(exp) < Date.now()) return null
  if (!/^\d+$/.test(version)) return null

  return { userId, version: Number(version) }
}

/** Logs the user out everywhere: every previously issued cookie stops verifying. */
export async function revokeSessions(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 86400,
}

export interface CurrentUser {
  id: string
  username: string
  role: string
  displayName: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = parseSessionToken(token)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      role: true,
      displayName: true,
      isBanned: true,
      sessionVersion: true,
    },
  })
  // A ban takes effect on the next request; a version mismatch means the
  // session was revoked (logout, password reset via create-admin).
  if (!user || user.isBanned || user.sessionVersion !== session.version) return null

  return { id: user.id, username: user.username, role: user.role, displayName: user.displayName }
}

/** Any signed-in, non-banned user — admin or community. */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

/** Admin only. Everything that edits the catalogue must call this, not requireAuth(). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}

/**
 * Community signup only. There is deliberately no `role` input: no request
 * path can create or promote an admin. The admin row is written exclusively by
 * scripts/create-admin.ts (and prisma/seed.ts), both run from a shell on the box.
 */
export async function createUser(input: {
  username: string
  password: string
  email?: string
  displayName?: string
}): Promise<{ id: string; username: string; sessionVersion: number }> {
  const hashed = await hashPassword(input.password)
  return prisma.user.create({
    data: {
      username: input.username,
      password: hashed,
      role: 'user',
      email: input.email,
      displayName: input.displayName ?? '',
    },
    select: { id: true, username: true, sessionVersion: true },
  })
}
