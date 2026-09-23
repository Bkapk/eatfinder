import { safeReturnPath } from '../lib/redirect'

describe('safeReturnPath', () => {
  it('keeps local paths and query strings', () => {
    expect(safeReturnPath('/r/soma-book-station?lang=sq', '/account')).toBe('/r/soma-book-station?lang=sq')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/ok\nLocation: evil'])
  ('rejects unsafe redirects', (path) => {
    expect(safeReturnPath(path, '/account')).toBe('/account')
  })
})
