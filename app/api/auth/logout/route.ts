import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, getCurrentUser, revokeSessions } from '@/lib/auth'
import { serverError } from '@/lib/apiError'

// Logout revokes every session for the account, not just this browser's
// cookie: a copied or stolen cookie dies too. Cost: signing out on one device
// signs you out on all of them.
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (user) await revokeSessions(user.id)
    ;(await cookies()).delete(SESSION_COOKIE)
    return NextResponse.json({ success: true })
  } catch (error) {
    ;(await cookies()).delete(SESSION_COOKIE)
    return serverError('auth/logout', error)
  }
}
