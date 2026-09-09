/**
 * React calls useSyncExternalStore's `subscribe` synchronously during commit,
 * once per consumer: TopBar plus one heart per card, 25 on a full page. The
 * load guard therefore has to be set synchronously — when it was set in the
 * `finally` of the async load, every one of those 25 fired its own request.
 */
import { render } from '@testing-library/react'
import FavoriteButton from '../components/FavoriteButton'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/',
}))

describe('useFavorites', () => {
  it('loads once no matter how many hearts mount', () => {
    const fetchMock = jest.fn(() => new Promise(() => {})) // never settles: the guard cannot rely on a resolution
    global.fetch = fetchMock as unknown as typeof fetch

    render(
      <>
        {Array.from({ length: 25 }).map((_, i) => (
          <FavoriteButton key={i} id={`r${i}`} locale="sq" />
        ))}
      </>
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
