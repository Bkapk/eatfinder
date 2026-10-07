import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  createSession,
  getCurrentUser,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth'
import { createMapLimiter } from '@/lib/ratelimit'
import { serverError } from '@/lib/apiError'

// Same rules as registration: 8 minimum, and bcrypt reads only 72 bytes.
const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8)
    .refine((p) => Buffer.byteLength(p) <= 72, 'Password too long'),
})

// Per account: a stolen session cookie must not become an unlimited oracle
// for guessing the current password.
const checkLimit = createMapLimiter(5, 15 * 60 * 1000)

/**
 * Change password. Bumps sessionVersion, so every other device is signed out,
 * then re-issues this browser's cookie at the new version so the person who
 * just proved the password stays signed in here. Error bodies carry a `code`
 * the client maps to its own dictionary string.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated', code: 'auth' }, { status: 401 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'invalid' }, { status: 400 })

    if (!checkLimit(user.id)) {
      return NextResponse.json({ error: 'Too many attempts', code: 'rate' }, { status: 429 })
    }

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    if (!(await verifyPassword(parsed.data.currentPassword, row?.password ?? null))) {
      return NextResponse.json({ error: 'Current password is wrong', code: 'wrong' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(parsed.data.newPassword), sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
    ;(await cookies()).set(SESSION_COOKIE, createSession(user.id, updated.sessionVersion), sessionCookieOptions)
    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError('auth/password', error)
  }
}
