import fs from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

// ponytail: local disk, fine on a VPS. Swap these two functions for S3/R2 only if it
// ever goes serverless. Callers must treat the returned url as opaque — store it and
// render it, never parse it or rebuild a filesystem path from it.
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function saveUpload(file: Buffer, filename: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file)
  return `/uploads/${filename}`
}

export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return
  // basename only: never let a stored value walk out of the upload dir
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {})
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
