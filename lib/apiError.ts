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
export function adminServerError(tag: string, error: unknown): NextResponse {
  console.error(`[${tag}]`, error)

  const e = error as { name?: string; message?: string; code?: string }
  const code = e?.code ? ` (${e.code})` : ''
  const detail = `${e?.name ?? 'Error'}${code}: ${e?.message ?? String(error)}`

  return NextResponse.json({ error: `Internal server error — ${detail}` }, { status: 500 })
}
