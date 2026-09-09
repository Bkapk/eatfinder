import { prisma } from './prisma'
import { deleteUpload } from './storage'

/**
 * Deleting a Restaurant row cascades to RestaurantPhoto (schema.prisma), but a
 * cascade only removes database rows — the uploaded files it pointed at stayed
 * on disk / in R2 forever. Collect every url the restaurants own, delete the
 * rows, then delete the files.
 *
 * Files go last on purpose: an orphaned file is a wasted byte, an orphaned row
 * is a broken image in the UI. If the file cleanup half-fails, the catalogue is
 * still correct. deleteUpload already swallows its own per-file errors.
 *
 * Returns the number of restaurants actually deleted.
 */
export async function deleteRestaurantsWithFiles(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const [restaurants, photos] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: ids } }, select: { id: true, image: true } }),
    prisma.restaurantPhoto.findMany({
      where: { restaurantId: { in: ids } },
      select: { url: true },
    }),
  ])
  if (restaurants.length === 0) return 0

  const { count } = await prisma.restaurant.deleteMany({
    where: { id: { in: restaurants.map((r) => r.id) } },
  })

  // The hero image is usually also a gallery row, so dedupe before unlinking.
  const urls = new Set<string>()
  for (const r of restaurants) if (r.image) urls.add(r.image)
  for (const p of photos) if (p.url) urls.add(p.url)
  await Promise.all([...urls].map((url) => deleteUpload(url)))

  return count
}
