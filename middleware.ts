import { NextResponse, type NextRequest } from 'next/server'

// Inlined, not imported from lib/auth: that module pulls in prisma and bcryptjs,
// neither of which can be bundled into the edge runtime. Keep in sync with
// SESSION_COOKIE in lib/auth.ts.
const SESSION_COOKIE = 'eatfinder_session'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF: SameSite=Lax already blocks cross-site form posts, but sibling
 * subdomains (*.bleart.dev) count as same-site and get the cookie anyway. So
 * every state-changing /api request must come from this exact host. Browsers
 * always send Origin on a cross-origin POST; when it is absent (curl, server
 * to server) there is no ambient-cookie risk, so Sec-Fetch-Site is the last word.
 */
export function isCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return new URL(origin).host !== request.headers.get('host')
    } catch {
      return true // "null" or garbage
    }
  }
  const site = request.headers.get('sec-fetch-site')
  return site === 'cross-site' || site === 'same-site'
}

// ponytail: the /admin branch is a presence check only. Middleware runs on the
// edge where node:crypto is unavailable, and every /api route already calls
// requireAdmin() for the real HMAC + role verification. This exists solely to
// stop unauthenticated users being served the admin shell and seeing it flash
// before the client-side redirect. A community user's cookie also passes; the
// role check in app/admin/layout.tsx and requireAdmin() handle that.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (UNSAFE_METHODS.has(request.method) && isCrossOrigin(request)) {
      return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
    }
    return NextResponse.next()
  }

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()

  // A reverse proxy can present an internal origin in request.url even while
  // the browser uses the public host. Nginx forwards the original Host and
  // protocol; use those for the absolute Location NextResponse requires.
  const login = new URL('/account/login', request.url)
  const host = request.headers.get('host')
  if (host && /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    login.host = host
    if (!host.includes(':')) login.port = ''
  }
  if (request.headers.get('x-forwarded-proto') === 'https') login.protocol = 'https:'
  login.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(login)
}

// /admin/login never reaches here: next.config.js redirects it first.
export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
}
