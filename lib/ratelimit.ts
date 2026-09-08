import { prisma } from './prisma'

/**
 * Counts rows created since `sinceMs`, keyed by a Prisma model delegate and an
 * extra `where`. DB-counted rate limits survive a process restart — unlike the
 * in-process Map limiter below, which is fine for quota-only endpoints but not
 * for anything that costs money.
 */
async function countSince(
  model: { count: (args: { where: Record<string, unknown> }) => Promise<number> },
  where: Record<string, unknown>,
  sinceMs: number
): Promise<number> {
  return model.count({
    where: { ...where, createdAt: { gte: new Date(Date.now() - sinceMs) } },
  })
}

/** AiProposal rows created in the last hour, across all restaurants. */
export function aiProposalsLastHour(): Promise<number> {
  return countSince(prisma.aiProposal, {}, 60 * 60 * 1000)
}

/** RestaurantPhoto rows a given user submitted in the last `windowMs`. */
export function photosByUser(userId: string, windowMs: number): Promise<number> {
  return countSince(prisma.restaurantPhoto, { submittedById: userId }, windowMs)
}

/**
 * ponytail: in-process Map limiter for quota (not spend) endpoints, lifted
 * from the pattern in app/api/auth/login/route.ts. Resets on process restart
 * and does not share state across multiple node processes — fine for a
 * single-PM2-process VPS; upgrade to a DB or Redis counter if that changes.
 */
export function createMapLimiter(maxAttempts: number, windowMs: number) {
  const hits = new Map<string, { count: number; until: number }>()

  return function check(key: string): boolean {
    const now = Date.now()
    const h = hits.get(key)
    if (!h || now > h.until) {
      hits.set(key, { count: 1, until: now + windowMs })
      return true
    }
    if (h.count >= maxAttempts) return false
    h.count++
    return true
  }
}
