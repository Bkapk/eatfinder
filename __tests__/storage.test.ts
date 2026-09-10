import fs from 'fs/promises'
import path from 'path'
import { imageMeta, saveImage, saveUpload, deleteUpload, sniffExt, UnsupportedImageError } from '@/lib/storage'

// These run against the local-disk backend on purpose: R2 needs credentials and
// a network, and the thing worth locking in here is that a url produced by
// saveUpload is the same url deleteUpload knows how to remove. That contract is
// what lets every caller treat the url as opaque.
const R2_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL']
const saved: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const k of R2_ENV) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})
afterAll(() => {
  for (const k of R2_ENV) if (saved[k] !== undefined) process.env[k] = saved[k]
})

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const onDisk = (url: string) => path.join(process.cwd(), 'public', 'uploads', path.basename(url))

test('saveImage round-trips through deleteUpload', async () => {
  const { url, ext } = await saveImage(PNG)

  expect(ext).toBe('png')
  expect(url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/)
  await expect(fs.access(onDisk(url))).resolves.toBeUndefined()

  await deleteUpload(url)
  await expect(fs.access(onDisk(url))).rejects.toThrow()
})

test('saveImage rejects a file that is not an image, whatever it is named', async () => {
  await expect(saveImage(Buffer.from('<html>not an image</html>'))).rejects.toThrow(UnsupportedImageError)
})

test('a traversing filename cannot escape the upload dir', async () => {
  const url = await saveUpload(PNG, '../../escaped.png')
  expect(url).toBe('/uploads/escaped.png')
  await deleteUpload(url)
})

test('deleteUpload leaves urls that are not ours alone', async () => {
  // No R2 configured and not a /uploads/ path: must be a no-op, not a throw and
  // not an unlink of something guessed from the basename.
  await expect(deleteUpload('https://example.com/somebody-elses.png')).resolves.toBeUndefined()
  await expect(deleteUpload('')).resolves.toBeUndefined()
})

test('sniffExt reads magic bytes, not extensions', () => {
  expect(sniffExt(PNG)).toBe('png')
  expect(sniffExt(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('jpg')
  expect(sniffExt(Buffer.from('RIFF____WEBP'))).toBe('webp')
  expect(sniffExt(Buffer.from('too short'))).toBeNull()
})

test('imageMeta reads dimensions and inlines a tiny blurred placeholder', async () => {
  const sharp = (await import('sharp')).default
  const real = await sharp({
    create: { width: 400, height: 250, channels: 3, background: { r: 200, g: 60, b: 20 } },
  })
    .png()
    .toBuffer()

  const meta = await imageMeta(real)

  expect(meta.width).toBe(400)
  expect(meta.height).toBe(250)
  expect(meta.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
  // The whole point of the placeholder is that it ships inside the HTML. If it
  // ever stops being tiny it is costing more than the request it saves.
  expect(meta.blurDataUrl!.length).toBeLessThan(1024)
})

test('imageMeta degrades to nulls rather than failing an upload', async () => {
  // PNG magic bytes with no image behind them: sniffExt accepts it, sharp
  // cannot decode it, and the upload still has to go through.
  await expect(imageMeta(PNG)).resolves.toEqual({ width: null, height: null, blurDataUrl: null })
})
