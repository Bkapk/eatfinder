import { NextResponse, type NextRequest } from 'next/server'

// Inlined, not imported from lib/auth: that module pulls in prisma and bcryptjs,
// neither of which can be bundled into the edge runtime. Keep in sync with
// SESSION_COOKIE in lib/auth.ts.
const SESSION_COOKIE = 'eatfinder_session'

// ponytail: presence check only. Middleware runs on the edge where node:crypto
// is unavailable, and every /api route already calls requireAuth() for the real
// HMAC verification. This exists solely to stop unauthenticated users being
// served the admin shell and seeing it flash before the client-side redirect.
//
// A signed-in community user's cookie also passes this gate — the edge cannot
// verify the HMAC or read the role. /admin safety rests entirely on
// requireAdmin() in every route handler plus the role check against
// /api/auth/me in app/admin/layout.tsx, which redirects a non-admin away from
// the shell. Matcher stays /admin only; community pages live under /account
// and are never matched here.
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()

  const login = new URL('/admin/login', request.url)
  login.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/admin/((?!login).*)', '/admin'],
}
