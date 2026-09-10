import fs from 'fs/promises'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

import { imageMeta } from '../lib/storage'

dotenv.config()

const prisma = new PrismaClient()

// Mirrors lib/storage.ts. Reading the bytes back is the one thing that module
// deliberately does not expose — urls there are opaque to callers — so this
// one-off backfill resolves them itself rather than widening that contract.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')

async function bytes(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/uploads/')) {
      return await fs.readFile(path.join(UPLOAD_DIR, path.basename(url)))
    }
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Fills blurDataUrl (and width/height) for photos that predate that column. */
async function main() {
  const photos = await prisma.restaurantPhoto.findMany({
    where: { blurDataUrl: null },
    select: { id: true, url: true },
  })
  console.log(`${photos.length} photo(s) without a placeholder.`)

  let done = 0
  let failed = 0
  for (const photo of photos) {
    const buf = await bytes(photo.url)
    if (!buf) {
      failed++
      console.warn(`  unreadable: ${photo.url}`)
      continue
    }
    const meta = await imageMeta(buf)
    if (!meta.blurDataUrl) {
      failed++
      continue
    }
    await prisma.restaurantPhoto.update({ where: { id: photo.id }, data: meta })
    done++
  }

  console.log(`Backfilled ${done}, skipped ${failed}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
