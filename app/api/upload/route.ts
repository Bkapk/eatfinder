import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { saveImage, UnsupportedImageError } from '@/lib/storage'
import { adminServerError } from '@/lib/apiError'

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const file = (await request.formData()).get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Checked before reading the body into memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())

    let url: string
    try {
      ;({ url } = await saveImage(buf))
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ url, filepath: url })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 401 })
    }
    return adminServerError('upload', error)
  }
}
