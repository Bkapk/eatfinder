import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { serverError } from '@/lib/apiError'
import { cookies } from 'next/headers'
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// ponytail: in-memory, per-process, keyed on username. Single admin, single
// PM2 process — a shared store only earns its keep once this runs on more than
// one node. Keyed on username rather than IP because the attacker controls the IP.
const MAX_ATTEMPTS = 10
const LOCKOUT_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; until: number }>()

function isLockedOut(username: string): boolean {
  const a = attempts.get(username)
  if (!a) return false
  if (Date.now() > a.until) {
    attempts.delete(username)
    return false
  }
  return a.count >= MAX_ATTEMPTS
}

function recordFailure(username: string): void {
  const a = attempts.get(username)
  if (!a || Date.now() > a.until) {
    attempts.set(username, { count: 1, until: Date.now() + LOCKOUT_MS })
    return
  }
  a.count++
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = loginSchema.parse(body)

    if (isLockedOut(username)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    // Community accounts log in with either their username (=lowercased
    // email) or their email directly; admin keeps using its handle. One
    // query covers both without changing the lockout key or the JSON shape.
    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
    })

    // Same response and roughly the same cost whether or not the user exists,
    // so a wrong username is not distinguishable from a wrong password.
    const isValid = user ? await verifyPassword(password, user.password) : false
    if (!user || !isValid) {
      recordFailure(username)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    attempts.delete(username)
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, createSession(user.id), sessionCookieOptions)

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } })
  } catch (error) {
    // Zod check first: a malformed login body is a 400, not something to log
    // as a server fault on every bot that posts junk at this endpoint.
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return serverError('auth/login', error)
  }
}

