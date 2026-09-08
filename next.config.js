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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
