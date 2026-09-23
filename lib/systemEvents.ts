import { prisma } from './prisma'

export type EventLevel = 'info' | 'warning' | 'error'

function scrub(value: string): string {
  let clean = value
  for (const key of [process.env.GOOGLE_PLACES_API_KEY, process.env.GEMINI_API_KEY, process.env.MAPBOX_TOKEN]) {
    if (key && key.length >= 8) clean = clean.replaceAll(key, '[redacted]')
  }
  return clean
}

/** Logging must never turn a working import or upload into a failed request. */
export async function recordSystemEvent(
  area: string,
  level: EventLevel,
  message: string,
  detail?: string
): Promise<void> {
  try {
    await prisma.systemEvent.create({
      data: {
        area: area.slice(0, 60),
        level,
        message: scrub(message).slice(0, 240),
        detail: detail ? scrub(detail).slice(0, 1000) : undefined,
      },
    })
  } catch (error) {
    console.error('Could not write system event:', error)
  }
}
