// Photos live on Cloudflare R2 once R2_PUBLIC_URL is set, so next/image has to be
// told that host. Read here rather than hardcoded: the bucket url differs between
// the r2.dev dev domain and a custom domain, and getting it wrong fails as a
// silently broken image rather than an error.
function r2Pattern() {
  const raw = process.env.R2_PUBLIC_URL
  if (!raw) return []
  try {
    const { protocol, hostname } = new URL(raw)
    return [{ protocol: protocol.replace(':', ''), hostname }]
  } catch {
    // Malformed value: better a missing pattern than a config that will not parse.
    console.warn(`[next.config] R2_PUBLIC_URL is not a valid URL, ignoring: ${raw}`)
    return []
  }
}

const isDev = process.env.NODE_ENV === 'development'

// ponytail: 'unsafe-inline' scripts because the app router emits inline
// bootstrap scripts; a nonce CSP would force every page dynamic. This CSP still
// pins script/connect origins, blocks framing, <base> and plugin injection.
// Mapbox GL needs blob: workers and *.mapbox.com for tiles/styles/telemetry.
// img-src allows https: because admin-entered image URLs and the R2 host vary.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.mapbox.com${isDev ? ' ws:' : ''}`,
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // One login page for everyone; the old admin URL keeps working.
  async redirects() {
    return [{ source: '/admin/login', destination: '/account/login?next=/admin', permanent: false }]
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        // Ignored by browsers over plain http, so harmless in local dev.
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ],
    }]
  },
  // 'standalone' was removed: Next warns that `next start` does not support it,
  // and it additionally requires hand-copying public/ and .next/static into
  // .next/standalone. Nothing consumes it here: the Dockerfile is gone and PM2
  // runs `next start` against a normal build with node_modules present.
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      ...r2Pattern(),
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
}

module.exports = nextConfig
