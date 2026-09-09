import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createUser, createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import { createMapLimiter } from '@/lib/ratelimit'
import { serverError } from '@/lib/apiError'

// role is deliberately absent from this schema — a crafted body has nowhere
// to put it. createUser() always defaults role to 'user' below.
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(60),
})

// Same in-process limiter pattern as the login lockout, keyed on the
// normalised email instead of username.
const checkLimit = createMapLimiter(10, 15 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, displayName } = registerSchema.parse(body)

    if (!checkLimit(email)) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: email }] },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 })
    }

    let user
    try {
      // username = lowercased email (Data model, "What changes to existing rows").
      // role is never read from the request; createUser() defaults it to 'user'.
      user = await createUser({ username: email, password, email, displayName })
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 })
      }
      throw error
    }

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, createSession(user.id), sessionCookieOptions)

    return NextResponse.json({ success: true, user: { id: user.id, displayName } })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return serverError('auth/register', error)
  }
}
