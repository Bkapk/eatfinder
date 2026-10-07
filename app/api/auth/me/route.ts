import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { serverError } from '@/lib/apiError'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // getCurrentUser() already selects role and displayName; returned as-is.
  return NextResponse.json({ user })
}

// displayName is the only self-editable field. Same bounds as registration.
const patchSchema = z.object({ displayName: z.string().trim().min(1).max(60) })

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName },
      select: { displayName: true },
    })
    return NextResponse.json({ user: { ...user, displayName: updated.displayName } })
  } catch (error) {
    return serverError('auth/me', error)
  }
}
