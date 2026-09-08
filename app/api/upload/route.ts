import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { saveUpload } from '@/lib/storage'
import { randomBytes } from 'crypto'

// Extension comes from the file's own magic bytes, never from the uploaded
// filename and never from the client-supplied Content-Type: public/uploads is
// served from our own origin, so a stored .html would be stored XSS.
const MAX_BYTES = 5 * 1024 * 1024

function sniffExt(buf: Buffer): string | null {
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

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const file = (await request.formData()).get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Checked before reading the body into memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = sniffExt(buf)
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported image type. Allowed: jpg, png, gif, webp, avif' },
        { status: 400 }
      )
    }

    const url = await saveUpload(buf, `${randomBytes(16).toString('hex')}.${ext}`)

    return NextResponse.json({ url, filepath: url })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
