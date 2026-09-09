import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { photoToDTO } from '@/lib/types'
import { saveImage, UnsupportedImageError } from '@/lib/storage'
import { moderatePhoto, decidePhotoModeration, AiDisabledError, type ModerationResult } from '@/lib/gemini'

const MAX_BYTES = 5 * 1024 * 1024
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const HOUR_LIMIT = 5
const DAY_LIMIT = 20

const fieldsSchema = z.object({
  restaurantId: z.string().min(1),
  caption: z.string().max(140).optional().default(''),
})

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

/** Oldest row inside the window tells us when the budget frees up again. */
async function retryAfterMs(userId: string, windowMs: number): Promise<number> {
  const oldest = await prisma.restaurantPhoto.findFirst({
    where: { submittedById: userId, createdAt: { gte: new Date(Date.now() - windowMs) } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  if (!oldest) return 0
  return Math.max(0, oldest.createdAt.getTime() + windowMs - Date.now())
}

/** Best-effort fetch of an existing photo's bytes, for moderation context only. */
async function fetchPhotoBytes(
  url: string,
  origin: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const abs = url.startsWith('http') ? url : `${origin}${url}`
    const res = await fetch(abs)
    if (!res.ok) return null
    const data = Buffer.from(await res.arrayBuffer())
    return { data, mimeType: res.headers.get('content-type') || 'image/jpeg' }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const hourCount = await prisma.restaurantPhoto.count({
      where: { submittedById: user.id, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
    })
    if (hourCount >= HOUR_LIMIT) {
      const retryMs = await retryAfterMs(user.id, HOUR_MS)
      return rateLimited(retryMs)
    }
    const dayCount = await prisma.restaurantPhoto.count({
      where: { submittedById: user.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    })
    if (dayCount >= DAY_LIMIT) {
      const retryMs = await retryAfterMs(user.id, DAY_MS)
      return rateLimited(retryMs)
    }

    const form = await request.formData()
    const file = form.get('file')
    const { restaurantId, caption } = fieldsSchema.parse({
      restaurantId: form.get('restaurantId'),
      caption: form.get('caption') || undefined,
    })

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    // Checked from file.size before arrayBuffer() — same precedent as
    // app/api/upload/route.ts.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    // A community user cannot address a draft, and restaurantId/caption are
    // the only fields this schema accepts — source/status/sortOrder are not
    // reachable from the request body.
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, isActive: true, name: true, cuisines: true },
    })
    if (!restaurant || !restaurant.isActive) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const buf = Buffer.from(await file.arrayBuffer())

    let saved: { url: string; ext: string }
    try {
      saved = await saveImage(buf)
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    const existing = await prisma.restaurantPhoto.findMany({
      where: { restaurantId, status: 'approved' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 3,
      select: { url: true },
    })
    const existingPhotos = (
      await Promise.all(existing.map((p) => fetchPhotoBytes(p.url, request.nextUrl.origin)))
    ).filter((p): p is { data: Buffer; mimeType: string } => p !== null)

    let moderation: ModerationResult
    try {
      moderation = await moderatePhoto({
        restaurantName: restaurant.name,
        cuisines: JSON.parse(restaurant.cuisines || '[]'),
        photo: { data: buf, mimeType: MIME_BY_EXT[saved.ext] ?? 'application/octet-stream' },
        existingPhotos,
      })
    } catch (error) {
      // Fail closed: a missing key or any other thrown error must never
      // block submission and must never auto-publish. AiDisabledError is
      // the documented "degrade to manual moderation" path.
      if (!(error instanceof AiDisabledError)) {
        console.error('Photo moderation error:', error)
      }
      moderation = {
        ok: false,
        raw: null,
        error: error instanceof Error ? error.message : 'moderation unavailable',
        model: 'unavailable',
      }
    }

    const decision = decidePhotoModeration(moderation)

    const photo = await prisma.restaurantPhoto.create({
      data: {
        restaurantId,
        url: saved.url,
        caption,
        source: 'community',
        submittedById: user.id,
        status: decision.status,
        aiVerdict: moderation.ok ? JSON.stringify(moderation.data) : null,
        aiConfidence: moderation.ok ? moderation.data.confidence : null,
        aiReason: decision.reason,
        wasAutoDecision: decision.wasAutoDecision,
      },
    })

    // Never overwrite an owner-chosen hero.
    if (decision.status === 'approved') {
      await prisma.restaurant.updateMany({
        where: { id: restaurantId, OR: [{ image: null }, { image: '' }] },
        data: { image: saved.url },
      })
    }

    return NextResponse.json({ photo: photoToDTO(photo), status: decision.status }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Community photo submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function rateLimited(retryMs: number) {
  const retrySeconds = Math.max(1, Math.ceil(retryMs / 1000))
  const retryMinutes = Math.max(1, Math.ceil(retryMs / 60000))
  return NextResponse.json(
    {
      error: `You've reached the photo upload limit. Try again in about ${retryMinutes} minute(s).`,
      retryAfterSeconds: retrySeconds,
    },
    { status: 429, headers: { 'Retry-After': String(retrySeconds) } }
  )
}

/** GET returns the caller's own submissions only — never another user's. */
export async function GET() {
  try {
    const user = await requireAuth()
    const photos = await prisma.restaurantPhoto.findMany({
      where: { submittedById: user.id },
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { slug: true, name: true } } },
    })
    return NextResponse.json({
      photos: photos.map((p) => ({
        ...photoToDTO(p),
        restaurantSlug: p.restaurant.slug,
        restaurantName: p.restaurant.name,
      })),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Community photo list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
