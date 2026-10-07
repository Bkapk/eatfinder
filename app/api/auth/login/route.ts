import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { clientIp, createMapLimiter } from '@/lib/ratelimit'
import { serverError } from '@/lib/apiError'
import { cookies } from 'next/headers'
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
})

// ponytail: in-memory, per-process — single PM2 process. Two layers:
// per-account failures stop guessing one password; per-IP attempts stop
// spraying one password across many accounts.
const MAX_FAILURES = 10
const LOCKOUT_MS = 15 * 60 * 1000
const failures = new Map<string, { count: number; until: number }>()
const checkIp = createMapLimiter(30, LOCKOUT_MS)

function isLockedOut(key: string): boolean {
  const a = failures.get(key)
  if (!a) return false
  if (Date.now() > a.until) {
    failures.delete(key)
    return false
  }
  return a.count >= MAX_FAILURES
}

function recordFailure(key: string): void {
  const now = Date.now()
  if (failures.size > 10_000) for (const [k, v] of failures) if (now > v.until) failures.delete(k)
  const a = failures.get(key)
  if (!a || now > a.until) {
    failures.set(key, { count: 1, until: now + LOCKOUT_MS })
    return
  }
  a.count++
}

const tooMany = () =>
  NextResponse.json({ error: 'Too many failed attempts. Try again in 15 minutes.' }, { status: 429 })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = loginSchema.parse(body)
    // Case-folded so "Admin" and "admin" share one lockout counter.
    const key = username.toLowerCase()

    if (!checkIp(clientIp(request.headers)) || isLockedOut(key)) return tooMany()

    // Community accounts log in with either their username (=lowercased
    // email) or their email; the admin uses its handle. One query covers both.
    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: key }] },
      select: { id: true, username: true, password: true, role: true, isBanned: true, sessionVersion: true },
    })

    // Always one bcrypt round (a dummy hash when the user is missing), and the
    // same 401 for unknown user, wrong password and banned account.
    const isValid = await verifyPassword(password, user?.password ?? null)
    if (!user || !isValid || user.isBanned) {
      recordFailure(key)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    failures.delete(key)
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, createSession(user.id, user.sessionVersion), sessionCookieOptions)

    // role is returned so the single login page can send the admin to /admin.
    // It is display/routing only — every admin route re-checks it server-side.
    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    })
  } catch (error) {
    // Zod check first: a malformed login body is a 400, not something to log
    // as a server fault on every bot that posts junk at this endpoint.
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    return serverError('auth/login', error)
  }
}
