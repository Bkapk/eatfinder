import { safeReturnPath, postLoginPath } from '../lib/redirect'

describe('safeReturnPath', () => {
  it('keeps local paths and query strings', () => {
    expect(safeReturnPath('/r/soma-book-station?lang=sq', '/account')).toBe('/r/soma-book-station?lang=sq')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/ok\nLocation: evil'])
  ('rejects unsafe redirects', (path) => {
    expect(safeReturnPath(path, '/account')).toBe('/account')
  })
})

describe('postLoginPath', () => {
  it('sends admins to the dashboard, or where they were bounced from', () => {
    expect(postLoginPath('admin', '')).toBe('/admin')
    expect(postLoginPath('admin', '/admin/queue')).toBe('/admin/queue')
  })

  it('returns users where they came from, never into /admin', () => {
    expect(postLoginPath('user', '/saved')).toBe('/saved')
    expect(postLoginPath('user', '')).toBe('/account')
    expect(postLoginPath('user', '/admin')).toBe('/account')
    expect(postLoginPath('user', '/admin/photos?x=1')).toBe('/account')
    expect(postLoginPath('user', '/administrators-pick')).toBe('/administrators-pick')
  })
})
