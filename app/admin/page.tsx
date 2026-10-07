import { getCurrentUser } from '@/lib/auth'
import Overview from './Overview'
import RestaurantDirectory from './RestaurantDirectory'

export const dynamic = 'force-dynamic'

/**
 * The owner's command centre, with the restaurant directory under it.
 * Middleware only checks that a cookie exists and the client layout's role
 * redirect runs after this has rendered, so the role is checked here before
 * any catalogue or community numbers are read.
 */
export default async function AdminHome() {
  const user = await getCurrentUser()
  if (user?.role !== 'admin') return null
  return (
    <>
      <Overview name={user.displayName || user.username} />
      <RestaurantDirectory />
    </>
  )
}
