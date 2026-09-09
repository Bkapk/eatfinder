import { NextResponse } from 'next/server'

/**
 * Blind `{ error: 'Internal server error' }` in the admin routes made a broken
 * Discover page undiagnosable without shell access to the VPS. Log the whole
 * error (Node prints the stack for Error objects), and put the name, message
 * and any Prisma `code` in the response too.
 *
 * ponytail: admin-only routes, so the detail has no untrusted reader. Do NOT
 * use this in the public routes (auth, recommend, restaurants) — there it
 * would leak internals to anyone. Those keep the blind 500.
 */
/**
 * Same logging, blind body. For routes a non-admin can reach: the community
 * endpoints (requireAuth is any signed-in user, not an owner) and the public
 * ones. The cause goes to the log, never to the response.
 */
export function serverError(tag: string, error: unknown): NextResponse {
  console.error(`[${tag}]`, error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export function adminServerError(tag: string, error: unknown): NextResponse {
  console.error(`[${tag}]`, error)

  const e = error as { name?: string; message?: string; code?: string }
  const code = e?.code ? ` (${e.code})` : ''
  const detail = `${e?.name ?? 'Error'}${code}: ${e?.message ?? String(error)}`

  return NextResponse.json({ error: `Internal server error — ${detail}` }, { status: 500 })
}

/**
 * Restaurant.name and Restaurant.slug are both @unique, so renaming a
 * restaurant onto an existing name — or onto a name that merely slugifies the
 * same way ("Café Bar" vs "Cafe Bar") — used to surface as a raw 500 with no
 * hint about what went wrong.
 *
 * Returns a 409 for a Prisma unique-constraint violation, or null so the caller
 * falls through to its normal error handling.
 *
 * ponytail: no auto-disambiguation here on purpose. The Discover importer
 * renames collisions itself because it runs unattended over 20 places; a person
 * editing one restaurant typed that name deliberately and should be told, not
 * silently given "Name (Neighborhood)".
 */
export function uniqueConflictResponse(error: unknown): NextResponse | null {
  const e = error as { code?: string; meta?: { target?: unknown } }
  if (e?.code !== 'P2002') return null

  // meta.target is a string on SQLite ("Restaurant_name_key") and an array on
  // Postgres (["name"]) — match on substring so both shapes work.
  const target = Array.isArray(e.meta?.target)
    ? e.meta.target.join(',')
    : String(e.meta?.target ?? '')

  if (target.includes('placeId')) {
    return NextResponse.json({ error: 'That Google place has already been imported.' }, { status: 409 })
  }
  if (target.includes('name') || target.includes('slug')) {
    return NextResponse.json(
      { error: 'Another restaurant already uses that name. Choose a different one.' },
      { status: 409 }
    )
  }
  return NextResponse.json({ error: 'That value is already taken.' }, { status: 409 })
}
