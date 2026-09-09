import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'
import type { S3Client } from '@aws-sdk/client-s3'

// Cloudflare R2 when it is configured, local disk when it is not — so the app
// still runs for development and review with no Cloudflare account.
//
// Callers must treat the returned url as OPAQUE: store it and render it, never
// parse it, prefix it, or rebuild a path from it. Routing back to the right
// backend on delete is this module's job and nobody else's.
// Where local uploads are written. On a server this points OUTSIDE the
// checkout, at the persistent volume, so a reclone cannot destroy them.
//
// This used to be a symlink at public/uploads pointing at that volume. Next 16
// builds with Turbopack, which walks public/ and hard-fails on a symlink
// leaving the project root ("points out of the filesystem root"), taking the
// whole build down. nginx already serves /uploads/ straight from the volume
// (deploy/nginx-dev.conf), so Next never needs the files under public/ at all.
//
// Unset — local development — keeps the plain public/uploads directory, which
// `next dev` serves itself.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
const LOCAL_PREFIX = '/uploads/'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

// Read at call time, never at module load: a half-filled env must fail the
// request that needs it, not the build. Same precedent as secret() in lib/auth.ts.
function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null
  // Trailing slash here would produce '//key' in every stored url, and those
  // urls are permanent — normalise once, at the only place that builds them.
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl.replace(/\/+$/, '') }
}

export function isR2Configured(): boolean {
  return r2Config() !== null
}

let cached: { client: S3Client; accountId: string; accessKeyId: string } | null = null

// Imported dynamically, not at module load. A local-disk deployment then never
// pulls the AWS SDK in at all, and neither does any test that does not touch R2
// — the SDK's browser ESM build is unparseable under the jsdom test environment.
async function client(cfg: R2Config): Promise<S3Client> {
  // Rebuild if the credentials changed under us; otherwise reuse the connection pool.
  if (cached && cached.accountId === cfg.accountId && cached.accessKeyId === cfg.accessKeyId) {
    return cached.client
  }
  const { S3Client } = await import('@aws-sdk/client-s3')
  const c = new S3Client({
    region: 'auto', // R2 is single-region; 'auto' is what Cloudflare documents
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
  cached = { client: c, accountId: cfg.accountId, accessKeyId: cfg.accessKeyId }
  return c
}

export async function saveUpload(file: Buffer, filename: string): Promise<string> {
  const key = path.basename(filename) // never let a caller write outside the bucket root
  const cfg = r2Config()

  if (!cfg) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    await fs.writeFile(path.join(UPLOAD_DIR, key), file)
    return `${LOCAL_PREFIX}${key}`
  }

  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  const s3 = await client(cfg)
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: file,
      ContentType: MIME[key.split('.').pop() ?? ''] ?? 'application/octet-stream',
      // Uploads are immutable — the filename is random and never reused.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
  return `${cfg.publicUrl}/${key}`
}

/**
 * Routes on the URL's own shape, not on the current config, so a local file
 * saved before R2 was switched on still deletes correctly afterwards.
 */
export async function deleteUpload(url: string): Promise<void> {
  if (!url) return

  if (url.startsWith(LOCAL_PREFIX)) {
    // basename only: never let a stored value walk out of the upload dir
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {})
    return
  }

  const cfg = r2Config()
  if (!cfg || !url.startsWith(`${cfg.publicUrl}/`)) return // not ours; leave it alone

  const key = url.slice(cfg.publicUrl.length + 1)
  if (!key || key.includes('/')) return // keys are flat; anything else is not one of ours

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  const s3 = await client(cfg)
  await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })).catch(() => {})
}

// Extension comes from the file's own magic bytes, never from the uploaded
// filename and never from the client-supplied Content-Type: public/uploads is
// served from our own origin, so a stored .html would be stored XSS. This is
// the only correct image validator in the repo — every upload path must go
// through it.
export function sniffExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png'
  if (buf.subarray(0, 6).toString('latin1').startsWith('GIF8')) return 'gif'
  // RIFF....WEBP and ....ftypavif both live in the first 12 bytes.
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
    return 'webp'
  if (buf.subarray(4, 12).toString('latin1') === 'ftypavif') return 'avif'
  return null
}

export class UnsupportedImageError extends Error {}

/**
 * Sniffs, rejects unsupported types, names randomly and writes. One
 * validator, every upload caller (admin upload, community submission,
 * Places photo download) goes through this rather than a half-copy of it.
 */
export async function saveImage(buffer: Buffer): Promise<{ url: string; ext: string }> {
  const ext = sniffExt(buffer)
  if (!ext) {
    throw new UnsupportedImageError('Unsupported image type. Allowed: jpg, png, gif, webp, avif')
  }
  const filename = `${randomBytes(16).toString('hex')}.${ext}`
  const url = await saveUpload(buffer, filename)
  return { url, ext }
}
