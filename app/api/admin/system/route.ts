import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { recordSystemEvent, type EventLevel } from '@/lib/systemEvents'
import { deleteUpload, imageMeta, saveUpload, sniffExt } from '@/lib/storage'
import { downloadPhotoMedia, placeDetails, searchText } from '@/lib/places'

export const dynamic = 'force-dynamic'

type Status = 'green' | 'orange' | 'red'
type CheckId = 'database' | 'storage' | 'places' | 'places-photo' | 'gemini' | 'mapbox'

const SERVICES: Array<{ id: CheckId; title: string; configured: () => boolean }> = [
  { id: 'storage', title: 'Photo storage', configured: () => true },
  { id: 'places', title: 'Google Places', configured: () => !!process.env.GOOGLE_PLACES_API_KEY },
  { id: 'places-photo', title: 'Google photo media', configured: () => !!process.env.GOOGLE_PLACES_API_KEY },
  { id: 'gemini', title: 'Gemini AI', configured: () => !!process.env.GEMINI_API_KEY },
  { id: 'mapbox', title: 'Mapbox', configured: () => !!process.env.MAPBOX_TOKEN },
]

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return message.slice(0, 300)
}

async function snapshot() {
  try {
    await prisma.$queryRaw`SELECT 1`
    const [events, restaurants, photos, missingPhotos] = await Promise.all([
      prisma.systemEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
      prisma.restaurant.count(),
      prisma.restaurantPhoto.count(),
      prisma.restaurant.findMany({
        where: { source: 'google', photos: { none: {} } },
        select: { id: true, name: true, placeId: true },
        orderBy: { name: 'asc' },
      }),
    ])
    const workflow = (id: string, title: string) => {
      const last = events.find((e) => e.area === id)
      const status: Status = !last ? 'orange' : last.level === 'error' ? 'red' : last.level === 'warning' ? 'orange' : 'green'
      return { id, title, status, summary: last?.message ?? 'No activity recorded yet', detail: last?.detail ?? null, checkedAt: last?.createdAt.toISOString() ?? null }
    }
    const checks = [
      { id: 'database', title: 'Database', status: 'green' as Status, summary: `${restaurants} restaurants · ${photos} photos`, checkedAt: new Date().toISOString() },
      ...SERVICES.map((service) => {
        const last = events.find((e) => e.area === `check:${service.id}`)
        const configured = service.configured()
        const stale = last && Date.now() - last.createdAt.getTime() > 24 * 60 * 60 * 1000
        const status: Status = !configured ? 'red' : !last || stale ? 'orange' : last.level === 'error' ? 'red' : last.level === 'warning' ? 'orange' : 'green'
        return {
          id: service.id,
          title: service.title,
          status,
          summary: !configured ? 'Key is not configured' : !last ? 'Configured · run checks to verify' : stale ? 'Last check is over 24 hours old' : last.message,
          detail: last?.detail ?? null,
          checkedAt: last?.createdAt.toISOString() ?? null,
        }
      }),
      workflow('places-import', 'Restaurant imports'),
      workflow('community-photo', 'Community photos'),
      { id: 'photo-coverage', title: 'Google photo coverage', status: (missingPhotos.length ? 'orange' : 'green') as Status, summary: missingPhotos.length ? `${missingPhotos.length} Google listings need photos` : 'Every Google listing has a photo', checkedAt: new Date().toISOString() },
    ]
    return {
      checks,
      missingPhotos,
      events: events.map((e) => ({ id: e.id, area: e.area, level: e.level, message: e.message, detail: e.detail, createdAt: e.createdAt.toISOString() })),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      checks: [{ id: 'database', title: 'Database', status: 'red' as Status, summary: 'Database query failed', detail: responseError(error), checkedAt: new Date().toISOString() }],
      missingPhotos: [],
      events: [],
      generatedAt: new Date().toISOString(),
    }
  }
}

async function check(id: CheckId, run: () => Promise<{ level: EventLevel; message: string; detail?: string }>) {
  try {
    const result = await run()
    await recordSystemEvent(`check:${id}`, result.level, result.message, result.detail)
  } catch (error) {
    await recordSystemEvent(`check:${id}`, 'error', `${id} check failed`, responseError(error))
  }
}

async function probePlaces() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    await recordSystemEvent('check:places', 'error', 'Google Places key is missing')
    await recordSystemEvent('check:places-photo', 'error', 'Google Places key is missing')
    return
  }
  let mediaChecked = false
  await check('places', async () => {
    const existing = await prisma.restaurant.findFirst({ where: { placeId: { not: null } }, select: { placeId: true } })
    const placeId = existing?.placeId ?? (await searchText({ query: 'restaurant in Prishtina' }))[0]?.placeId
    if (!placeId) return { level: 'warning' as const, message: 'Places responded but no sample place was found' }
    const place = await placeDetails(placeId)
    // The media check uses this fresh name immediately; Google says names may expire.
    const photo = place.photos?.[0]
    if (!photo) {
      await recordSystemEvent('check:places-photo', 'warning', 'Place details worked, but sample place has no photo')
      mediaChecked = true
    } else {
      await check('places-photo', async () => {
        const bytes = await downloadPhotoMedia(photo.name, 400)
        const meta = await imageMeta(bytes)
        if (!sniffExt(bytes) || !meta.width || !meta.height) {
          return { level: 'error' as const, message: 'Google returned unreadable photo bytes' }
        }
        return { level: 'info' as const, message: `Photo media decoded (${meta.width} × ${meta.height})` }
      })
      mediaChecked = true
    }
    return { level: 'info' as const, message: 'Place Details API responded successfully' }
  })
  if (!mediaChecked) await recordSystemEvent('check:places-photo', 'warning', 'Photo media could not be checked because Place Details failed')
}

async function probeStorage() {
  await check('storage', async () => {
    const name = `health-${randomBytes(12).toString('hex')}.txt`
    const url = await saveUpload(Buffer.from('eatfinder storage check'), name)
    await deleteUpload(url)
    return { level: 'info' as const, message: 'Upload write succeeded; cleanup requested' }
  })
}

async function probeGemini() {
  await check('gemini', async () => {
    const key = process.env.GEMINI_API_KEY
    if (!key) return { level: 'error' as const, message: 'Gemini key is missing' }
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': key },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { level: 'error' as const, message: `Gemini model check returned HTTP ${res.status}`, detail: `Model: ${model}` }
    return { level: 'info' as const, message: `Gemini model ${model} is available` }
  })
}

async function probeMapbox(origin: string) {
  await check('mapbox', async () => {
    const token = process.env.MAPBOX_TOKEN
    if (!token) return { level: 'error' as const, message: 'Mapbox token is missing' }
    const res = await fetch(`https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${encodeURIComponent(token)}`, {
      headers: { Referer: origin },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { level: 'error' as const, message: `Mapbox style check returned HTTP ${res.status}` }
    return { level: 'info' as const, message: 'Mapbox style API responded successfully' }
  })
}

export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json(await snapshot())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')
    await Promise.all([probeStorage(), probePlaces(), probeGemini(), probeMapbox(`${protocol}://${host}/`)])
    return NextResponse.json(await snapshot())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'Forbidden' ? 403 : 401 })
  }
}
