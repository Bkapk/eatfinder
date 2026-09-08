import fs from 'fs/promises'
import path from 'path'

// ponytail: local disk, fine on a VPS. Swap these two functions for S3 only if it ever goes serverless.
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
